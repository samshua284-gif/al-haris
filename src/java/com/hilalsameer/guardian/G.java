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
    /* 1.139: the DEFAULT message templates exist in both app languages
       and follow uiLang — Hilal switched to English and the SOS still
       arrived in Arabic. A stored text equal to EITHER default counts
       as "the default" (so saving an untouched field never freezes a
       language); a text he wrote himself is his, and is used as-is in
       both languages. */
    public static final String TPL_AR = "SOS! {name} يحتاج مساعدة عاجلة. موقعي: {loc} البطارية {bat}% الساعة {time}. اتصلوا بـ9999";
    public static final String TPL_EN = "SOS! {name} needs urgent help. My location: {loc} Battery {bat}% Time {time}. Call 9999";
    public static final String SAFE_AR = "{name}: أنا بخير، أُلغيت الاستغاثة. شكرًا لكم.";
    public static final String SAFE_EN = "{name}: I am fine, the SOS is cancelled. Thank you.";
    public static boolean en(Context c) {
        try { return "en".equals(p(c).getString("uiLang", "ar")); }
        catch (Exception e) { return false; }
    }
    public static String template(Context c) {
        // An emptied field must never produce an empty SOS (1.51): fall back.
        String t = p(c).getString("template", "");
        if (t == null || t.trim().isEmpty() || t.equals(TPL_AR) || t.equals(TPL_EN))
            return en(c) ? TPL_EN : TPL_AR;
        return t;
    }
    public static String safeTemplate(Context c) {
        String t = p(c).getString("safe_template", "");
        if (t == null || t.trim().isEmpty() || t.equals(SAFE_AR) || t.equals(SAFE_EN))
            return en(c) ? SAFE_EN : SAFE_AR;
        return t;
    }
    /* 1.203 (Hilal's order): the numbers work in every country — each
       number is used exactly as the user typed it. Entries split on
       commas or new lines (the settings field is one-per-line);
       spaces, dashes and parentheses are stripped; a leading + the
       user typed is preserved. Nothing is ever prepended: no country
       code is assumed anywhere, and no length is validated. */
    public static List<String> recipients(Context c) {
        List<String> out = new ArrayList<>();
        String csv = p(c).getString("recipients", "");
        for (String s : csv.split("[,\\n]")) {
            s = s.replaceAll("[\\s\\-()]", "");
            if (!s.isEmpty()) out.add(s);
        }
        return out;
    }
    public static boolean armed(Context c) { return p(c).getBoolean("armed", false); }
    public static boolean salawatOn(Context c) { return p(c).getBoolean("salawat_on", true); }
    public static void setSalawatOn(Context c, boolean on) { p(c).edit().putBoolean("salawat_on", on).apply(); }
    public static boolean delivered(Context c) { return p(c).getBoolean("delivered", false); }
    public static boolean safePending(Context c) { return p(c).getBoolean("safe_pending", false); }

    public static int batteryPct(Context c) {
        try {
            BatteryManager bm = (BatteryManager) c.getSystemService(Context.BATTERY_SERVICE);
            return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        } catch (Exception e) { return -1; }
    }
    public static void setUiAlive(Context c, boolean a) {
        SharedPreferences.Editor e = p(c).edit().putBoolean("ui_alive", a);
        if (a) e.putLong("ui_ts", System.currentTimeMillis());
        e.apply();
    }
    public static void uiPing(Context c) { p(c).edit().putBoolean("ui_alive", true).putLong("ui_ts", System.currentTimeMillis()).apply(); }
    public static boolean uiAliveFresh(Context c) {
        return p(c).getBoolean("ui_alive", false)
            && System.currentTimeMillis() - p(c).getLong("ui_ts", 0) < 45000;
    }
    public static int salawatMin(Context c) { return p(c).getInt("salawat_min", 15); }
    public static void setSalawatMin(Context c, int m) { p(c).edit().putInt("salawat_min", m).apply(); }
    public static long salawatLast(Context c) { return p(c).getLong("salawat_last", 0); }
    public static void setSalawatLast(Context c, long t) { p(c).edit().putLong("salawat_last", t).apply(); }

    /* Salawat alarm mode (1.111): when Hilal swipes the app away from
       Recents, WatchService stops — his close means close — and the
       prayer reminder moves to AlarmManager wake-ups: no permanent
       background presence, yet the salawat still arrives on time. */
    public static android.app.PendingIntent salawatAlarmIntent(Context c) {
        android.content.Intent i = new android.content.Intent(c, SalawatAlarm.class);
        return android.app.PendingIntent.getBroadcast(c, 41, i,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
    }
    public static void scheduleSalawatAlarm(Context c) {
        if (!salawatOn(c)) return;
        long next = salawatLast(c) + salawatMin(c) * 60000L;
        long now = System.currentTimeMillis();
        if (next <= now) next = now + 30000L;
        android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            if (android.os.Build.VERSION.SDK_INT >= 31 && am.canScheduleExactAlarms())
                am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, next, salawatAlarmIntent(c));
            else
                am.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, next, salawatAlarmIntent(c));
        } catch (Exception ignored) {}
    }
    public static void cancelSalawatAlarm(Context c) {
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(salawatAlarmIntent(c));
        } catch (Exception ignored) {}
    }
    /* 1.158: the pin bell — a soft chime when Hilal steps into a pin's zero
       zone (his idea, 2026-11-24). Same asset-player pattern as the salawat
       clip; a static guard keeps overlapping rings impossible. */
    private static long sBellAt = 0;
    public static void playBellClip(final Context c) {
        try {
            long now = System.currentTimeMillis();
            if (now - sBellAt < 2500) return;
            sBellAt = now;
            android.content.res.AssetFileDescriptor afd = c.getAssets().openFd("www/bell.mp3");
            final android.media.MediaPlayer mp = new android.media.MediaPlayer();
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mp.setOnCompletionListener(m -> { try { m.release(); } catch (Exception ignored) {} });
            mp.prepare();
            mp.start();
        } catch (Exception ignored) {}
    }
    public static void playSalawatClip(final Context c) {
        try {
            android.content.res.AssetFileDescriptor afd = c.getAssets().openFd("www/salawat2.mp3");
            final android.media.MediaPlayer mp = new android.media.MediaPlayer();
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mp.setOnCompletionListener(m -> { try { m.release(); } catch (Exception ignored) {} });
            mp.prepare();
            mp.start();
        } catch (Exception ignored) {}
    }

    /** Warm location: last fix kept in prefs, refreshed by service/activity listeners. */
    public static void saveFix(Context c, Location l) {
        if (l == null) return;
        /* 1.179 (Hilal's bound: "from zero at the phone to 300 m — it
           captures the best signal"): the cache must hold the BEST fix,
           not merely the newest. A coarse network guess (desert error of
           hundreds of metres) may not overwrite a fresher accurate fix;
           the cached fix yields only to a more accurate one, or when it
           is over 5 minutes old. */
        try {
            SharedPreferences sp0 = p(c);
            if (sp0.contains("last_lat")) {
                float cAcc = sp0.getFloat("last_acc", 9999f);
                long age = l.getTime() - sp0.getLong("last_loc_at", 0);
                float nAcc = l.hasAccuracy() ? l.getAccuracy() : 9999f;
                if (age < -60000L) return;
                if (age < 300000L && nAcc > cAcc) return;
            }
        } catch (Exception ignored) {}
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

    // 1.107: bidi armour. A mixed Arabic/Latin SMS is re-ordered by the
    // RECEIVING phone's bidirectional algorithm: on 2026-11-24 Hilal's own
    // SOS arrived scrambled (البطارية jumped ahead of موقعي, the % detached
    // from its number). Each substituted value is wrapped in a first-strong
    // isolate (U+2068..U+2069) so it travels as one indivisible unit in
    // whichever direction its own content needs, "{bat}%" is isolated WITH
    // its percent sign, and a message containing Arabic is prefixed with
    // U+200F (RLM) so the paragraph direction is RTL on any phone.
    private static String iso(String v) { return "\u2068" + v + "\u2069"; }

    public static String fillTemplate(Context c, String tpl) {
        Location l = lastFix(c);
        String loc = (l == null) ? "?" : String.format(Locale.US, "%.5f,%.5f",
                l.getLatitude(), l.getLongitude());
        String time = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        int bat = batteryPct(c);
        String batS = bat < 0 ? "?" : String.valueOf(bat);
        String out = tpl.replace("{bat}%", iso(batS + "%"))
                  .replace("{name}", iso(name(c)))
                  .replace("{loc}", iso(loc))
                  .replace("{bat}", iso(batS))
                  .replace("{time}", iso(time));
        // 1.139: paragraph direction follows the TEMPLATE's language,
        // not the substituted values — an English SOS carrying an Arabic
        // name (isolated above) must still read left-to-right.
        boolean tplAr = tpl.codePoints().anyMatch(cp -> cp >= 0x0600 && cp <= 0x06FF);
        out = (tplAr ? "\u200F" : "\u200E") + out;
        return out;
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

    // 1.84 (Hilal: the «fresh measurement» age piled up into minutes): the
    // one-shot callback above only lands when something registers it, so
    // between button presses the snapshot aged while the label kept calling
    // it «فوري». A PERSISTENT listener now stays registered for the app's
    // life and the telephony stack PUSHES every cell change into freshCells
    // — true live sync — while the one-shot remains as a manual nudge.
    private static volatile boolean liveRegistered;
    private static class LiveCb extends android.telephony.TelephonyCallback
            implements android.telephony.TelephonyCallback.CellInfoListener {
        @Override public void onCellInfoChanged(List<CellInfo> list) {
            if (list != null) { freshCells = list; freshAt = System.currentTimeMillis(); }
        }
    }

    public static void ensureLiveCells(Context c) {
        if (liveRegistered || android.os.Build.VERSION.SDK_INT < 31) return;
        try {
            TelephonyManager tm = (TelephonyManager) c.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm == null) return;
            tm.registerTelephonyCallback(c.getMainExecutor(), new LiveCb());
            liveRegistered = true;
        } catch (Exception ignored) {}
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
        ensureLiveCells(c);
        JSONObject out = new JSONObject();
        // 1.103 (Hilal's discovery): Android withholds cell readings while
        // system Location is OFF — the meter must say so, not sit silent.
        try {
            android.location.LocationManager lm = (android.location.LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
            boolean locOn = lm != null && (lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
                    || lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER));
            out.put("locOn", locOn);
        } catch (Exception ignored) {}
        JSONObject lte = new JSONObject(), gsm = new JSONObject();
        boolean anyService = false;
        String carrier = "";
        // 1.173 (Hilal caught it live): in AIRPLANE MODE the meter kept
        // showing the last pre-flight readings as live signal, green bars
        // and «service available». The stale snapshot was believed twice
        // over — the cached cell list (preferred for 2 min) still flags
        // its cells isRegistered, which flipped anyService back to true.
        // Airplane mode (and a radio reporting POWER_OFF) is unambiguous:
        // the radios are off, so the meter now says exactly that.
        boolean airplane = false;
        try { airplane = android.provider.Settings.Global.getInt(c.getContentResolver(),
                android.provider.Settings.Global.AIRPLANE_MODE_ON, 0) != 0; } catch (Exception ignored) {}
        try { out.put("airplane", airplane); } catch (Exception ignored) {}
        int ssState = -1;
        try {
            TelephonyManager tm = (TelephonyManager) c.getSystemService(Context.TELEPHONY_SERVICE);
            carrier = tm.getNetworkOperatorName() == null ? "" : tm.getNetworkOperatorName();
            try {
                ServiceState ss = tm.getServiceState();
                if (ss != null) { ssState = ss.getState(); if (ssState == ServiceState.STATE_IN_SERVICE) anyService = true; }
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
            boolean radioOff = airplane || ssState == ServiceState.STATE_POWER_OFF;
            if (radioOff) {
                // No readings exist while the radios are off — empty the
                // tiles rather than dressing up the last snapshot as live.
                bestLteLvl = -1; bestGsmLvl = -1; bestNrLvl = -1; bestWcdmaLvl = -1;
                camp = ""; anyService = false;
            } else if (ssState == ServiceState.STATE_OUT_OF_SERVICE
                    || ssState == ServiceState.STATE_EMERGENCY_ONLY) {
                // Neighbour dBm readings stay (they are the flicker hunt's
                // value), but cached isRegistered flags must not claim
                // service the radio itself denies.
                anyService = false;
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
    public static boolean logWhisper(Context c, String kind) {
        int r = logWhisperEx(c, kind);
        return r == 0 || r == 1;
    }

    /* 1.193: the same log, but reporting WHY — a manual press used to
       vanish into silence (added, duplicate and refused all looked
       identical: nothing happened), so Hilal read the button as broken.
       Codes: 0 = added, 1 = duplicate of the newest (<60 s, ~30 m, same
       network), 2 = no location fix yet, 3 = error, 4 = auto-gate refusal. */
    public static int logWhisperEx(Context c, String kind) {
        try {
            Location l = lastFix(c);
            if (l == null) return 2;
            /* 1.179 (Hilal's bound, 2026-11-25): an auto flicker is planted
               only from a fix accurate to 300 m and no older than 10
               minutes. Last night a network guess planted a pin ~300 m
               from where he truly stood, on a compound he never entered —
               the signal was real, the pin was the guess. Returns false
               when the gate refuses, so the watcher can retry while the
               service lasts and a better fix arrives. */
            if ("لمعة".equals(kind)) {
                float gAcc = l.hasAccuracy() ? l.getAccuracy() : 9999f;
                long gAge = System.currentTimeMillis() - l.getTime();
                if (gAcc > 300f || gAge > 600000L) return 4;
            }
            JSONObject sig = signalJson(c);
            JSONObject w = new JSONObject();
            w.put("lat", l.getLatitude()); w.put("lng", l.getLongitude());
            w.put("at", System.currentTimeMillis()); w.put("kind", kind);
            w.put("acc", l.hasAccuracy() ? (int) l.getAccuracy() : -1);
            /* 1.180 (Hilal: «اجعله يعمل على جميع الشبكات وخاصة 2G»): the
               planter used to read only the LTE and GSM slots, LTE first —
               a flicker caught while camped on 3G or 5G was logged with no
               network and no dBm at all (his «شبكة dBm» row of 06:17), and
               a faint LTE neighbour could mask the strong 2G he was
               actually camped on. Now the CAMPED network's own reading is
               recorded first; if it has none, the strongest reading across
               all four networks wins; if no reading exists at all, the
               camped network's name is still recorded. */
            JSONObject lte = sig.optJSONObject("lte"), gsm = sig.optJSONObject("gsm");
            JSONObject nr = sig.optJSONObject("nr"), wcdma = sig.optJSONObject("wcdma");
            String camp = sig.optString("camp", "");
            JSONObject camped = "2G".equals(camp) ? gsm : "3G".equals(camp) ? wcdma
                    : "5G".equals(camp) ? nr : "4G".equals(camp) ? lte : null;
            JSONObject pick = null; String pickNet = null;
            if (camped != null && camped.has("dbm")) { pick = camped; pickNet = camp; }
            else {
                JSONObject[] all = { lte, nr, wcdma, gsm };
                String[] names = { "4G", "5G", "3G", "2G" };
                int bestDbm = Integer.MIN_VALUE;
                for (int i = 0; i < all.length; i++) {
                    if (all[i] != null && all[i].has("dbm") && all[i].optInt("dbm") > bestDbm) {
                        bestDbm = all[i].optInt("dbm"); pick = all[i]; pickNet = names[i];
                    }
                }
            }
            if (pick != null) { w.put("net", pickNet); w.put("dbm", pick.optInt("dbm")); }
            else if (!camp.isEmpty()) { w.put("net", camp); }
            JSONArray arr = new JSONArray(sp(c).getString("whispers", "[]"));
            // Dedupe (1.35): skip a sample that repeats the newest one within 60 s
            // and ~30 m with the same network — service callbacks can fire together.
            if (arr.length() > 0) {
                JSONObject last = arr.optJSONObject(arr.length() - 1);
                if (last != null
                        && System.currentTimeMillis() - last.optLong("at") < 60000
                        && Math.abs(last.optDouble("lat") - l.getLatitude()) < 0.0003
                        && Math.abs(last.optDouble("lng") - l.getLongitude()) < 0.0003
                        && last.optString("net").equals(w.optString("net"))) return 1;
            }
            arr.put(w);
            while (arr.length() > 300) arr.remove(0);
            sp(c).edit().putString("whispers", arr.toString()).apply();
            return 0;
        } catch (Exception ignored) { return 3; }
    }
    private static SharedPreferences sp(Context c) { return p(c); }
}
