package com.hilalsameer.guardian;

import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellSignalStrengthGsm;
import android.telephony.CellSignalStrengthLte;
import android.telephony.ServiceState;
import android.telephony.SmsManager;
import android.telephony.TelephonyManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Shared state + the drawn bow: pre-built message, warm location, instant fire. */
public class G {
    public static final String PREF = "guardian";

    public static SharedPreferences p(Context c) {
        return c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    public static String name(Context c) { return p(c).getString("name", ""); }
    public static String template(Context c) {
        return p(c).getString("template",
            "SOS! {name} يحتاج مساعدة عاجلة. موقعي: {loc} البطارية {bat}% الساعة {time}. اتصلوا بـ9999");
    }
    public static String safeTemplate(Context c) {
        return p(c).getString("safe_template",
            "{name}: أنا بخير، أُلغيت الاستغاثة. شكرًا لكم.");
    }
    public static List<String> recipients(Context c) {
        List<String> out = new ArrayList<>();
        String csv = p(c).getString("recipients", "");
        for (String s : csv.split(",")) { s = s.trim(); if (!s.isEmpty()) out.add(s); }
        return out;
    }
    public static boolean armed(Context c) { return p(c).getBoolean("armed", false); }
    public static boolean delivered(Context c) { return p(c).getBoolean("delivered", false); }
    public static boolean safePending(Context c) { return p(c).getBoolean("safe_pending", false); }

    public static int batteryPct(Context c) {
        try {
            BatteryManager bm = (BatteryManager) c.getSystemService(Context.BATTERY_SERVICE);
            return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        } catch (Exception e) { return -1; }
    }

    /** Warm location: last fix kept in prefs, refreshed by service/activity listeners. */
    public static void saveFix(Context c, Location l) {
        if (l == null) return;
        p(c).edit()
            .putFloat("last_lat", (float) l.getLatitude())
            .putFloat("last_lng", (float) l.getLongitude())
            .putLong("last_loc_at", l.getTime())
            .putFloat("last_acc", l.getAccuracy())
            .apply();
    }
    public static Location lastFix(Context c) {
        SharedPreferences sp = p(c);
        if (!sp.contains("last_lat")) {
            try {
                LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
                Location best = null;
                for (String prov : lm.getProviders(true)) {
                    Location l = lm.getLastKnownLocation(prov);
                    if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
                }
                if (best != null) { saveFix(c, best); return best; }
            } catch (Exception ignored) {}
            return null;
        }
        Location l = new Location("cache");
        l.setLatitude(sp.getFloat("last_lat", 0));
        l.setLongitude(sp.getFloat("last_lng", 0));
        l.setTime(sp.getLong("last_loc_at", 0));
        l.setAccuracy(sp.getFloat("last_acc", 999));
        return l;
    }

    public static String fillTemplate(Context c, String tpl) {
        Location l = lastFix(c);
        String loc = (l == null) ? "?" : String.format(Locale.US, "%.5f,%.5f",
                l.getLatitude(), l.getLongitude());
        String time = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        int bat = batteryPct(c);
        return tpl.replace("{name}", name(c))
                  .replace("{loc}", loc)
                  .replace("{bat}", bat < 0 ? "?" : String.valueOf(bat))
                  .replace("{time}", time);
    }

    /** Signal snapshot: separate 4G (LTE) and 2G (GSM) readings — Hilal's dual meter. */
    public static JSONObject signalJson(Context c) {
        JSONObject out = new JSONObject();
        JSONObject lte = new JSONObject(), gsm = new JSONObject();
        boolean anyService = false;
        String carrier = "";
        try {
            TelephonyManager tm = (TelephonyManager) c.getSystemService(Context.TELEPHONY_SERVICE);
            carrier = tm.getNetworkOperatorName() == null ? "" : tm.getNetworkOperatorName();
            try {
                ServiceState ss = tm.getServiceState();
                if (ss != null && ss.getState() == ServiceState.STATE_IN_SERVICE) anyService = true;
            } catch (Exception ignored) {}
            List<CellInfo> cells = null;
            try { cells = tm.getAllCellInfo(); } catch (Exception ignored) {}
            int bestLteDbm = Integer.MIN_VALUE, bestLteLvl = -1;
            int bestGsmDbm = Integer.MIN_VALUE, bestGsmLvl = -1;
            if (cells != null) {
                for (CellInfo ci : cells) {
                    if (ci instanceof CellInfoLte) {
                        CellSignalStrengthLte s = ((CellInfoLte) ci).getCellSignalStrength();
                        int dbm = s.getRsrp();
                        if (ci.isRegistered()) anyService = true;
                        if (dbm > bestLteDbm && dbm != Integer.MAX_VALUE) { bestLteDbm = dbm; bestLteLvl = s.getLevel(); }
                    } else if (ci instanceof CellInfoGsm) {
                        CellSignalStrengthGsm s = ((CellInfoGsm) ci).getCellSignalStrength();
                        int dbm = s.getDbm();
                        if (ci.isRegistered()) anyService = true;
                        if (dbm > bestGsmDbm && dbm != Integer.MAX_VALUE) { bestGsmDbm = dbm; bestGsmLvl = s.getLevel(); }
                    }
                }
            }
            if (bestLteLvl >= 0) { lte.put("dbm", bestLteDbm); lte.put("level", bestLteLvl); }
            if (bestGsmLvl >= 0) { gsm.put("dbm", bestGsmDbm); gsm.put("level", bestGsmLvl); }
        } catch (Exception ignored) {}
        try {
            out.put("lte", lte); out.put("gsm", gsm);
            out.put("service", anyService); out.put("carrier", carrier);
            out.put("battery", batteryPct(c));
        } catch (Exception ignored) {}
        return out;
    }

    public static boolean hasService(Context c) {
        try { return signalJson(c).optBoolean("service", false); }
        catch (Exception e) { return false; }
    }

    private static boolean sendSms(Context c, String text) {
        List<String> rcpts = recipients(c);
        if (rcpts.isEmpty()) return false;
        try {
            SmsManager sm = SmsManager.getDefault();
            ArrayList<String> parts = sm.divideMessage(text);
            for (String r : rcpts) sm.sendMultipartTextMessage(r, null, parts, null, null);
            return true;
        } catch (Exception e) { return false; }
    }

    /** The bow looses: fire SOS if armed & undelivered; fire I'm-safe if queued. */
    public static synchronized void tryFire(Context c) {
        if (!hasService(c)) return;
        SharedPreferences sp = p(c);
        if (armed(c) && !delivered(c)) {
            if (sendSms(c, fillTemplate(c, template(c)))) {
                sp.edit().putBoolean("delivered", true)
                         .putLong("delivered_at", System.currentTimeMillis()).apply();
                logWhisper(c, "SOS");
            }
        } else if (safePending(c)) {
            if (sendSms(c, fillTemplate(c, safeTemplate(c)))) {
                sp.edit().putBoolean("safe_pending", false)
                         .putBoolean("safe_sent", true).apply();
            }
        }
    }

    /** Silent log of every spot where signal was glimpsed. */
    public static void logWhisper(Context c, String kind) {
        try {
            Location l = lastFix(c);
            if (l == null) return;
            JSONObject sig = signalJson(c);
            JSONObject w = new JSONObject();
            w.put("lat", l.getLatitude()); w.put("lng", l.getLongitude());
            w.put("at", System.currentTimeMillis()); w.put("kind", kind);
            JSONObject lte = sig.optJSONObject("lte"), gsm = sig.optJSONObject("gsm");
            if (lte != null && lte.has("dbm")) { w.put("net", "4G"); w.put("dbm", lte.optInt("dbm")); }
            else if (gsm != null && gsm.has("dbm")) { w.put("net", "2G"); w.put("dbm", gsm.optInt("dbm")); }
            JSONArray arr = new JSONArray(sp(c).getString("whispers", "[]"));
            arr.put(w);
            while (arr.length() > 300) arr.remove(0);
            sp(c).edit().putString("whispers", arr.toString()).apply();
        } catch (Exception ignored) {}
    }
    private static SharedPreferences sp(Context c) { return p(c); }
}
