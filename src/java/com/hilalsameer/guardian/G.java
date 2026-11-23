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
        // An emptied field must never produce an empty SOS (1.51): fall back.
        String t = p(c).getString("template", "");
        return (t == null || t.trim().isEmpty())
            ? "SOS! {name} يحتاج مساعدة عاجلة. موقعي: {loc} البطارية {bat}% الساعة {time}. اتصلوا بـ9999"
            : t;
    }
    public static String safeTemplate(Context c) {
        String t = p(c).getString("safe_template", "");
        return (t == null || t.trim().isEmpty())
            ? "{name}: أنا بخير، أُلغيت الاستغاثة. شكرًا لكم."
            : t;
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

    // 1.61: forced-fresh cell snapshot. getAllCellInfo() returns the system's
    // CACHE, which Samsung often hands back empty (notably on 5G NSA) even
    // while service is up — the meter then showed «لا قياس» on both tiles.
    // requestCellInfoUpdate makes the MODEM measure now; the result is kept
    // here and preferred by signalJson for two minutes.
    private static volatile List<CellInfo> freshCells;
    private static volatile long freshAt;

    /** One-shot TelephonyCallback (API 31+): registering makes the telephony
        stack push a fresh cell snapshot; we keep it and unregister. (The
        requestCellInfoUpdate listener type is absent from this build's SDK
        stub, so the callback is the compilable official path.) */
    private static class FreshCb extends android.telephony.TelephonyCallback
            implements android.telephony.TelephonyCallback.CellInfoListener {
        private final TelephonyManager tm;
        FreshCb(TelephonyManager tm) { this.tm = tm; }
        @Override public void onCellInfoChanged(List<CellInfo> list) {
            freshCells = list; freshAt = System.currentTimeMillis();
            try { tm.unregisterTelephonyCallback(this); } catch (Exception ignored) {}
        }
    }

    public static void requestFreshCells(Context c) {
        if (android.os.Build.VERSION.SDK_INT < 31) return;
        try {
            TelephonyManager tm = (TelephonyManager) c.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm == null) return;
            tm.registerTelephonyCallback(c.getMainExecutor(), new FreshCb(tm));
        } catch (Exception ignored) {}
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
            if (freshCells != null && System.currentTimeMillis() - freshAt < 120000) cells = freshCells;
            if (cells == null) { try { cells = tm.getAllCellInfo(); } catch (Exception ignored) {} }
            int bestLteDbm = Integer.MIN_VALUE, bestLteLvl = -1;
            int bestGsmDbm = Integer.MIN_VALUE, bestGsmLvl = -1;
            int bestNrDbm = Integer.MIN_VALUE, bestNrLvl = -1;
            int bestWcdmaDbm = Integer.MIN_VALUE, bestWcdmaLvl = -1;
            String camp = "";
            if (cells != null) {
                for (CellInfo ci : cells) {
                    if (ci instanceof CellInfoLte) {
                        CellSignalStrengthLte s = ((CellInfoLte) ci).getCellSignalStrength();
                        int dbm = s.getRsrp();
                        if (ci.isRegistered()) { anyService = true; if (camp.isEmpty() || camp.equals("2G") || camp.equals("3G")) camp = "4G"; }
                        if (dbm > bestLteDbm && dbm != Integer.MAX_VALUE) { bestLteDbm = dbm; bestLteLvl = s.getLevel(); }
                    } else if (ci instanceof CellInfoGsm) {
                        CellSignalStrengthGsm s = ((CellInfoGsm) ci).getCellSignalStrength();
                        int dbm = s.getDbm();
                        if (ci.isRegistered()) { anyService = true; if (camp.isEmpty()) camp = "2G"; }
                        if (dbm > bestGsmDbm && dbm != Integer.MAX_VALUE) { bestGsmDbm = dbm; bestGsmLvl = s.getLevel(); }
                    } else if (ci instanceof android.telephony.CellInfoNr) {
                        // 1.57: the meter was blind on 5G — it parsed only LTE/GSM,
                        // so a phone camped on NR showed «لا قياس» on both tiles.
                        android.telephony.CellSignalStrengthNr s = (android.telephony.CellSignalStrengthNr)
                                ((android.telephony.CellInfoNr) ci).getCellSignalStrength();
                        int dbm = s.getDbm();
                        if (ci.isRegistered()) { anyService = true; camp = "5G"; }
                        if (dbm > bestNrDbm && dbm != Integer.MAX_VALUE) { bestNrDbm = dbm; bestNrLvl = s.getLevel(); }
                    } else if (ci instanceof android.telephony.CellInfoWcdma) {
                        android.telephony.CellSignalStrengthWcdma s = (android.telephony.CellSignalStrengthWcdma)
                                ((android.telephony.CellInfoWcdma) ci).getCellSignalStrength();
                        int dbm = s.getDbm();
                        if (ci.isRegistered()) { anyService = true; if (camp.isEmpty() || camp.equals("2G")) camp = "3G"; }
                        if (dbm > bestWcdmaDbm && dbm != Integer.MAX_VALUE) { bestWcdmaDbm = dbm; bestWcdmaLvl = s.getLevel(); }
                    }
                }
            }
            if (bestLteLvl >= 0) { lte.put("dbm", bestLteDbm); lte.put("level", bestLteLvl); }
            if (bestGsmLvl >= 0) { gsm.put("dbm", bestGsmDbm); gsm.put("level", bestGsmLvl); }
            JSONObject nr = new JSONObject(), wcdma = new JSONObject();
            if (bestNrLvl >= 0) { nr.put("dbm", bestNrDbm); nr.put("level", bestNrLvl); }
            if (bestWcdmaLvl >= 0) { wcdma.put("dbm", bestWcdmaDbm); wcdma.put("level", bestWcdmaLvl); }
            out.put("nr", nr); out.put("wcdma", wcdma); out.put("camp", camp);
            out.put("freshSec", freshAt > 0 ? (System.currentTimeMillis() - freshAt) / 1000 : -1);
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

    public static boolean sent(Context c) { return p(c).getLong("sent_at", 0) > 0; }

    /** The SmsManager to send from (1.56). getDefault() follows the default
        SMS subscription, which on dual-SIM phones can point at an inactive
        SIM — the documented first cause of send error 17 (NETWORK_ERROR)
        while the stock Messages app, sending on the voice/active SIM,
        succeeds. Prefer the default VOICE subscription explicitly. */
    private static SmsManager sendManager(Context c) {
        try {
            android.telephony.SubscriptionManager subm = (android.telephony.SubscriptionManager)
                    c.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (subm != null) {
                int sub = android.telephony.SubscriptionManager.getDefaultVoiceSubscriptionId();
                if (!android.telephony.SubscriptionManager.isValidSubscriptionId(sub))
                    sub = android.telephony.SubscriptionManager.getDefaultSmsSubscriptionId();
                if (android.telephony.SubscriptionManager.isValidSubscriptionId(sub))
                    return SmsManager.getDefault().createForSubscriptionId(sub);
            }
        } catch (Exception e) { /* fall through to the plain default */ }
        return SmsManager.getDefault();
    }

    private static boolean sendSms(Context c, String text, boolean trackDelivery) {
        List<String> rcpts = recipients(c);
        if (rcpts.isEmpty()) return false;
        try {
            SmsManager sm = sendManager(c);
            ArrayList<String> parts = sm.divideMessage(text);
            // 1.52: a SENT intent on every part — the radio's verdict (ok or the
            // exact error code) instead of silence; delivery intent on the LAST
            // part only (a message is delivered when its final part lands).
            android.content.Intent si = new android.content.Intent(c, SmsSentReceiver.class);
            android.app.PendingIntent spi = android.app.PendingIntent.getBroadcast(c, 1, si,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT
                            | android.app.PendingIntent.FLAG_IMMUTABLE);
            ArrayList<android.app.PendingIntent> sentIntents = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) sentIntents.add(spi);
            ArrayList<android.app.PendingIntent> deliveredIntents = null;
            if (trackDelivery) {
                android.content.Intent di = new android.content.Intent(c, SmsDeliveredReceiver.class);
                android.app.PendingIntent dpi = android.app.PendingIntent.getBroadcast(c, 0, di,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                                | android.app.PendingIntent.FLAG_IMMUTABLE);
                deliveredIntents = new ArrayList<>();
                for (int i = 0; i < parts.size(); i++)
                    deliveredIntents.add(i == parts.size() - 1 ? dpi : null);
            }
            for (String r : rcpts) sm.sendMultipartTextMessage(r, null, parts, sentIntents, deliveredIntents);
            return true;
        } catch (Exception e) { return false; }
    }

    /** The bow looses: fire SOS if armed & unconfirmed; re-fire until the network's
        delivery report confirms arrival (the original covenant — until 1.49 the code
        marked "delivered" the moment the send call merely did not throw). */
    public static synchronized void tryFire(Context c) {
        if (!hasService(c)) return;
        SharedPreferences sp = p(c);
        if (armed(c) && !delivered(c)) {
            long sentAt = sp.getLong("sent_at", 0);
            long lastAtt = sp.getLong("last_attempt_at", 0);
            long now = System.currentTimeMillis();
            // Cadence (1.53): an accepted-but-unconfirmed send re-fires after
            // 3 min; a radio-REJECTED send retries after 60 s — never faster.
            // (1.52 cleared sent_at on rejection with no floor, and the watch
            // tick turned that into a send every few seconds: a storm.)
            // 1.57: after 3 consecutive radio rejections, slow to one attempt
            // per 10 min — a hostile network path must not flood the stock
            // Messages thread with a failed draft every minute all night.
            long rejectFloor = sp.getInt("reject_streak", 0) >= 3 ? 600000 : 60000;
            boolean due = (sentAt > 0)
                    ? (now - sentAt > 180000)
                    : (lastAtt == 0 || now - lastAtt > rejectFloor);
            if (due) {
                sp.edit().putLong("last_attempt_at", now).putInt("send_error", 0).apply();
                if (sendSms(c, fillTemplate(c, template(c)), true)) {
                    sp.edit().putLong("sent_at", now).apply();
                    logWhisper(c, "SOS");
                }
            }
        } else if (safePending(c)) {
            if (sendSms(c, fillTemplate(c, safeTemplate(c)), false)) {
                sp.edit().putBoolean("safe_pending", false)
                         .putBoolean("safe_sent", true).apply();
            }
        }
    }

    /** Send-result entry point (SmsSentReceiver, 1.52). A radio-level rejection
        clears sent_at so the next watch tick re-fires at once, and the error
        code is kept where the panel can say it in words. */
    public static void onSentResult(Context c, boolean ok, int code) {
        SharedPreferences sp = p(c);
        if (ok) {
            sp.edit().putInt("send_error", 0).putInt("reject_streak", 0).apply();
        } else {
            sp.edit().putInt("send_error", code)
                     .putInt("reject_streak", sp.getInt("reject_streak", 0) + 1)
                     .putLong("sent_at", 0).apply();
        }
    }

    public static int sendError(Context c) { return p(c).getInt("send_error", 0); }

    /** Delivery-report entry point (SmsDeliveredReceiver). */
    public static void onDeliveryReport(Context c, boolean ok) {
        SharedPreferences sp = p(c);
        if (!armed(c) || delivered(c)) return;
        if (ok) {
            sp.edit().putBoolean("delivered", true)
                     .putLong("delivered_at", System.currentTimeMillis()).apply();
        } else {
            // The carrier says it did not arrive: clear sent_at so the next
            // flicker re-fires at once instead of waiting out the 3 minutes.
            sp.edit().putLong("sent_at", 0).apply();
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
            // Dedupe (1.35): skip a sample that repeats the newest one within 60 s
            // and ~30 m with the same network — service callbacks can fire together.
            if (arr.length() > 0) {
                JSONObject last = arr.optJSONObject(arr.length() - 1);
                if (last != null
                        && System.currentTimeMillis() - last.optLong("at") < 60000
                        && Math.abs(last.optDouble("lat") - l.getLatitude()) < 0.0003
                        && Math.abs(last.optDouble("lng") - l.getLongitude()) < 0.0003
                        && last.optString("net").equals(w.optString("net"))) return;
            }
            arr.put(w);
            while (arr.length() > 300) arr.remove(0);
            sp(c).edit().putString("whispers", arr.toString()).apply();
        } catch (Exception ignored) {}
    }
    private static SharedPreferences sp(Context c) { return p(c); }
}
