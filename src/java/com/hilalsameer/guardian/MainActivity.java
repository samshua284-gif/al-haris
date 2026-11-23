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
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

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
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                String u = req.getUrl().toString();
                if (u.startsWith("https://tiles.local/")) {
                    try {
                        java.util.List<String> p = req.getUrl().getPathSegments();
                        String layer = p.get(0);
                        String ext = layer.equals("sat") ? "jpg" : "png";
                        File f = new File(new File(new File(getFilesDir(), "tiles"), layer),
                                p.get(1) + "/" + p.get(2) + "/" + p.get(3) + "." + ext);
                        if (f.exists() && f.length() > 0)
                            return new WebResourceResponse(ext.equals("jpg") ? "image/jpeg" : "image/png",
                                    null, new FileInputStream(f));
                    } catch (Exception ignored) {}
                    byte[] empty = android.util.Base64.decode(
                            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=",
                            android.util.Base64.DEFAULT);
                    return new WebResourceResponse("image/png", null, new ByteArrayInputStream(empty));
                }
                return super.shouldInterceptRequest(v, req);
            }
        });
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

        @JavascriptInterface public void requestLocation() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                        || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[] { Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION }, 7);
                else startWatcher();
            });
        }

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

        /* ---------- offline map packs ---------- */

        @JavascriptInterface public String packInfo(double lat, double lng, int radiusKm) {
            try {
                int tiles = 0;
                for (int z = 7; z <= 13; z++) {
                    int[] r = tileRange(lat, lng, radiusForZ(radiusKm, z), z);
                    tiles += (r[1] - r[0] + 1) * (r[3] - r[2] + 1);
                }
                JSONObject o = new JSONObject();
                o.put("tilesPerLayer", tiles);
                o.put("tiles", tiles * 2);
                o.put("mb", Math.round((tiles * 13000L + tiles * 22000L) / 104857.6) / 10.0);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public void downloadPack(final String name, final double lat,
                                                       final double lng, final int radiusKm) {
            if (packThread != null && packThread.isAlive()) return;
            packCancel = false;
            packThread = new Thread(() -> {
                String[] layers = { "roads", "sat" };
                int total = 0;
                for (int z = 7; z <= 13; z++) {
                    int[] r = tileRange(lat, lng, radiusForZ(radiusKm, z), z);
                    total += (r[1] - r[0] + 1) * (r[3] - r[2] + 1);
                }
                total *= 2;
                int done = 0, fails = 0, consecFails = 0;
                long bytes = 0;
                boolean aborted = false;
                try {
                    for (String layer : layers) {
                        String ext = layer.equals("sat") ? "jpg" : "png";
                        for (int z = 7; z <= 13 && !packCancel && !aborted; z++) {
                            int[] r = tileRange(lat, lng, radiusForZ(radiusKm, z), z);
                            for (int x = r[0]; x <= r[1] && !packCancel && !aborted; x++) {
                                for (int y = r[2]; y <= r[3]; y++) {
                                    if (packCancel) break;
                                    File f = new File(new File(new File(getFilesDir(), "tiles"), layer),
                                            z + "/" + x + "/" + y + "." + ext);
                                    if (f.exists() && f.length() > 0) { done++; continue; }
                                    String url = layer.equals("sat")
                                            ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x
                                            : "https://tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png";
                                    long got = fetchTile(url, f);
                                    if (got > 0) { bytes += got; consecFails = 0; }
                                    else { fails++; if (++consecFails >= 30) { aborted = true; break; } }
                                    done++;
                                    if (done % 10 == 0) {
                                        final int d = done, t = total;
                                        final String ly = layer;
                                        pushJs("window.__onPackProgress&&window.__onPackProgress({done:" + d
                                                + ",total:" + t + ",layer:'" + ly + "'})");
                                    }
                                    try { Thread.sleep(layer.equals("sat") ? 30 : 60); } catch (Exception ignored) {}
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
                JSONObject o = new JSONObject();
                try {
                    o.put("ok", !packCancel && !aborted);
                    o.put("cancelled", packCancel);
                    o.put("tiles", done);
                    o.put("fails", fails);
                    if (!packCancel && !aborted) {
                        android.content.SharedPreferences sp = G.p(MainActivity.this);
                        JSONArray packs = new JSONArray(sp.getString("packs", "[]"));
                        JSONObject pk = new JSONObject();
                        pk.put("name", name); pk.put("lat", lat); pk.put("lng", lng);
                        pk.put("radiusKm", radiusKm); pk.put("at", System.currentTimeMillis());
                        pk.put("mb", Math.round(bytes / 104857.6) / 10.0);
                        packs.put(pk);
                        sp.edit().putString("packs", packs.toString()).apply();
                        o.put("mb", Math.round(bytes / 104857.6) / 10.0);
                    }
                } catch (Exception ignored) {}
                pushJs("window.__onPackDone&&window.__onPackDone(" + o.toString() + ")");
            });
            packThread.start();
        }

        @JavascriptInterface public void cancelPack() { packCancel = true; }

        @JavascriptInterface public String listPacks() {
            try {
                JSONObject o = new JSONObject();
                android.content.SharedPreferences sp = G.p(MainActivity.this);
                o.put("packs", new JSONArray(sp.getString("packs", "[]")));
                o.put("tilesMB", Math.round(dirSize(new File(getFilesDir(), "tiles")) / 104857.6) / 10.0);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public void deletePack(int idx) {
            try {
                android.content.SharedPreferences sp = G.p(MainActivity.this);
                JSONArray packs = new JSONArray(sp.getString("packs", "[]"));
                JSONArray keep = new JSONArray();
                for (int i = 0; i < packs.length(); i++) if (i != idx) keep.put(packs.get(i));
                sp.edit().putString("packs", keep.toString()).apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface public void clearTiles() {
            deleteRecursive(new File(getFilesDir(), "tiles"));
            G.p(MainActivity.this).edit().putString("packs", "[]").apply();
        }
    }

    /* ---------- map helpers ---------- */
    private volatile boolean packCancel = false;
    private Thread packThread = null;

    private void pushJs(final String js) {
        if (web == null) return;
        web.post(() -> { try { web.evaluateJavascript(js, null); } catch (Exception ignored) {} });
    }

    /* Smart taper for the 500 km pack: full detail near the centre, coarser far away. */
    static double radiusForZ(int radiusKm, int z) {
        if (radiusKm >= 500) return z <= 10 ? 500 : (z <= 12 ? 150 : 50);
        return radiusKm;
    }

    static int[] tileRange(double lat, double lng, double rKm, int z) {
        double dLat = rKm / 111.32;
        double dLng = rKm / (111.32 * Math.cos(Math.toRadians(lat)));
        int n = 1 << z;
        int x0 = (int) Math.floor((lng - dLng + 180) / 360.0 * n);
        int x1 = (int) Math.floor((lng + dLng + 180) / 360.0 * n);
        int y0 = (int) Math.floor((1 - Math.log(Math.tan(Math.toRadians(lat + dLat))
                + 1 / Math.cos(Math.toRadians(lat + dLat))) / Math.PI) / 2 * n);
        int y1 = (int) Math.floor((1 - Math.log(Math.tan(Math.toRadians(lat - dLat))
                + 1 / Math.cos(Math.toRadians(lat - dLat))) / Math.PI) / 2 * n);
        x0 = Math.max(0, Math.min(n - 1, x0)); x1 = Math.max(0, Math.min(n - 1, x1));
        y0 = Math.max(0, Math.min(n - 1, y0)); y1 = Math.max(0, Math.min(n - 1, y1));
        return new int[] { x0, x1, y0, y1 };
    }

    private long fetchTile(String url, File dest) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(12000); c.setReadTimeout(12000);
            c.setRequestProperty("User-Agent", "AlHaris-Guardian/1.22 (free offline safety maps)");
            if (c.getResponseCode() != 200) return -1;
            dest.getParentFile().mkdirs();
            File tmp = new File(dest.getPath() + ".tmp");
            InputStream in = c.getInputStream();
            FileOutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[8192]; int r; long total = 0;
            while ((r = in.read(buf)) > 0) { out.write(buf, 0, r); total += r; }
            out.close(); in.close();
            if (total <= 0 || !tmp.renameTo(dest)) { tmp.delete(); return -1; }
            return total;
        } catch (Exception e) { return -1; }
        finally { if (c != null) c.disconnect(); }
    }

    static long dirSize(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return f.length();
        long s = 0;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) s += dirSize(k);
        return s;
    }

    static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRecursive(k);
        }
        f.delete();
    }
}
