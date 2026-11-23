package com.hilalsameer.guardian;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private LocationManager lm;
    private Ringtone alarm;
    private boolean alarmOn = false;

    private final LocationListener uiLoc = new LocationListener() {
        @Override public void onLocationChanged(Location l) {
            G.saveFix(MainActivity.this, l);
            pushLoc();
        }
        @Override public void onStatusChanged(String p, int s, Bundle e) {}
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {}
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        requestPerms();
        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "GN");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)
            startWatcher();
    }

    @Override public void onRequestPermissionsResult(int rc, String[] perms, int[] results) {
        super.onRequestPermissionsResult(rc, perms, results);
        for (int r : results) if (r == PackageManager.PERMISSION_GRANTED) { startWatcher(); break; }
    }

    private void requestPerms() {
        String[] want = { Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE };
        java.util.List<String> need = new java.util.ArrayList<>();
        for (String s : want) if (checkSelfPermission(s) != PackageManager.PERMISSION_GRANTED) need.add(s);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) need.add(Manifest.permission.POST_NOTIFICATIONS);
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), 1);
    }

    private void startWatcher() {
        Intent s = new Intent(this, WatchService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(s); else startService(s);
        } catch (Exception ignored) {}
    }

    @Override protected void onResume() {
        super.onResume();
        try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000, 3, uiLoc); } catch (Exception ignored) {}
        try { lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 5, uiLoc); } catch (Exception ignored) {}
        pushLoc();
    }
    @Override protected void onPause() {
        super.onPause();
        try { lm.removeUpdates(uiLoc); } catch (Exception ignored) {}
    }

    private void pushLoc() {
        Location l = G.lastFix(this);
        if (l == null || web == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("lat", l.getLatitude()); o.put("lng", l.getLongitude());
            o.put("at", l.getTime()); o.put("acc", l.getAccuracy());
            final String js = "window.__onLoc&&window.__onLoc(" + o.toString() + ")";
            web.post(() -> web.evaluateJavascript(js, null));
        } catch (Exception ignored) {}
    }

    public class Bridge {
        @JavascriptInterface public String getSignal() { return G.signalJson(MainActivity.this).toString(); }

        @JavascriptInterface public String getLocation() {
            Location l = G.lastFix(MainActivity.this);
            if (l == null) return "{}";
            try {
                JSONObject o = new JSONObject();
                o.put("lat", l.getLatitude()); o.put("lng", l.getLongitude());
                o.put("at", l.getTime()); o.put("acc", l.getAccuracy());
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public String getState() {
            try {
                JSONObject o = new JSONObject();
                android.content.SharedPreferences sp = G.p(MainActivity.this);
                o.put("name", G.name(MainActivity.this));
                o.put("recipients", sp.getString("recipients", ""));
                o.put("template", G.template(MainActivity.this));
                o.put("safeTemplate", G.safeTemplate(MainActivity.this));
                o.put("armed", G.armed(MainActivity.this));
                o.put("armedAt", sp.getLong("armed_at", 0));
                o.put("delivered", G.delivered(MainActivity.this));
                o.put("deliveredAt", sp.getLong("delivered_at", 0));
                o.put("safePending", G.safePending(MainActivity.this));
                o.put("safeSent", sp.getBoolean("safe_sent", false));
                o.put("places", new JSONArray(sp.getString("places", "[]")));
                o.put("whispers", new JSONArray(sp.getString("whispers", "[]")));
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public void saveSetup(String name, String recipients, String tpl, String safeTpl) {
            G.p(MainActivity.this).edit()
                .putString("name", name == null ? "" : name.trim())
                .putString("recipients", recipients == null ? "" : recipients.trim())
                .putString("template", tpl == null ? "" : tpl)
                .putString("safe_template", safeTpl == null ? "" : safeTpl)
                .apply();
        }

        @JavascriptInterface public void savePlaces(String json) {
            G.p(MainActivity.this).edit().putString("places", json).apply();
        }

        @JavascriptInterface public void armSos() {
            G.p(MainActivity.this).edit()
                .putBoolean("armed", true).putBoolean("delivered", false)
                .putBoolean("safe_sent", false).putBoolean("safe_pending", false)
                .putLong("armed_at", System.currentTimeMillis()).apply();
            startWatcher();
            G.tryFire(MainActivity.this);
        }

        @JavascriptInterface public void cancelSos() {
            boolean wasDelivered = G.delivered(MainActivity.this);
            android.content.SharedPreferences.Editor e = G.p(MainActivity.this).edit()
                .putBoolean("armed", false);
            if (wasDelivered) e.putBoolean("safe_pending", true);
            e.apply();
            startWatcher();
            G.tryFire(MainActivity.this);
        }

        @JavascriptInterface public void addWhisper() { G.logWhisper(MainActivity.this, "يدوي"); }

        @JavascriptInterface public void beacon(boolean on) {
            runOnUiThread(() -> {
                try {
                    AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
                    if (on && !alarmOn) {
                        am.setStreamVolume(AudioManager.STREAM_ALARM,
                            am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
                        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                        alarm = RingtoneManager.getRingtone(MainActivity.this, uri);
                        if (Build.VERSION.SDK_INT >= 28) alarm.setLooping(true);
                        alarm.play(); alarmOn = true;
                    } else if (!on && alarmOn) {
                        if (alarm != null) alarm.stop();
                        alarmOn = false;
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface public void openNetworkSettings() {
            try { startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
        }
    }
}
