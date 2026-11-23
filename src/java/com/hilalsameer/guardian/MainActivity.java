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
        // JS dialogs (1.44): without a WebChromeClient, alert() is silently dropped
        // and confirm() returns false — which left every confirm-gated button dead
        // (discard-cancel, clear-all). Show real Android dialogs and resume properly.
        web.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override public boolean onJsAlert(WebView v, String url, String msg,
                    final android.webkit.JsResult res) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(msg)
                        .setPositiveButton("حسنًا", (d, w) -> res.confirm())
                        .setOnCancelListener(d -> res.confirm())
                        .show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg,
                    final android.webkit.JsResult res) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(msg)
                        .setPositiveButton("نعم", (d, w) -> res.confirm())
                        .setNegativeButton("لا", (d, w) -> res.cancel())
                        .setOnCancelListener(d -> res.cancel())
                        .show();
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                String host = req.getUrl().getHost();
                if ("app.local".equals(host) || "tiles.local".equals(host)) {
                    try {
                        java.util.List<String> p = req.getUrl().getPathSegments();
                        String kind = p.isEmpty() ? "" : p.get(0);
                        if (kind.equals("vec") && p.size() >= 4) {
                            File f = new File(new File(new File(getFilesDir(), "tiles"), "vec"),
                                    p.get(1) + "/" + p.get(2) + "/" + p.get(3) + ".pbf");
                            if (f.exists())
                                return localResp("application/x-protobuf", new FileInputStream(f), 200);
                            return localResp("text/plain", null, 404);
                        }
                        if (kind.equals("glyphs") && p.size() >= 3) {
                            String safe = p.get(1).replaceAll("[^A-Za-z0-9]", "_");
                            File f = new File(new File(new File(getFilesDir(), "glyphs"), safe), p.get(2));
                            if (f.exists())
                                return localResp("application/x-protobuf", new FileInputStream(f), 200);
                            return localResp("text/plain", null, 404);
                        }
                        if (kind.equals("sprites") && p.size() >= 2) {
                            String name = p.get(1);
                            String mime = name.endsWith(".json") ? "application/json" : "image/png";
                            return localResp(mime, getAssets().open("www/sprites/" + name), 200);
                        }
                        if (kind.equals("sat") && p.size() >= 4) {
                            File f = new File(new File(new File(getFilesDir(), "tiles"), "sat"),
                                    p.get(1) + "/" + p.get(2) + "/" + p.get(3) + ".jpg");
                            if (f.exists() && f.length() > 0)
                                return localResp("image/jpeg", new FileInputStream(f), 200);
                            byte[] empty = android.util.Base64.decode(
                                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=",
                                    android.util.Base64.DEFAULT);
                            return localResp("image/png", new ByteArrayInputStream(empty), 200);
                        }
                        if ("app.local".equals(host)) {
                            // The app itself is served from assets over this https origin (1.30):
                            // a real https origin lets MapLibre use fetch + Web Workers, which
                            // a file:// page may refuse — the "engine alive, data dead" fault.
                            String path = req.getUrl().getPath();
                            if (path == null || path.equals("/")) path = "/index.html";
                            String mime = mimeFor(path);
                            try {
                                return localResp(mime, getAssets().open("www" + path), 200);
                            } catch (Exception e) {
                                return localResp("text/plain", null, 404);
                            }
                        }
                    } catch (Exception ignored) {}
                    byte[] empty = android.util.Base64.decode(
                            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=",
                            android.util.Base64.DEFAULT);
                    return localResp("image/png", new ByteArrayInputStream(empty), 200);
                }
                return super.shouldInterceptRequest(v, req);
            }
        });
        web.addJavascriptInterface(new Bridge(), "GN");
        setContentView(web);
        web.loadUrl("https://app.local/index.html");
        // 1.28: legacy Esri raster "roads" tiles are obsolete (vector engine now) — reclaim the space.
        new Thread(() -> deleteRecursive(new File(getFilesDir(), "tiles/roads"))).start();
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
                o.put("sent", G.sent(MainActivity.this));
                o.put("sentAt", sp.getLong("sent_at", 0));
                o.put("sendError", G.sendError(MainActivity.this));
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
                .putLong("sent_at", 0).putLong("last_attempt_at", 0)
                .putInt("send_error", 0).putInt("reject_streak", 0)
                .putLong("armed_at", System.currentTimeMillis()).apply();
            startWatcher();
            G.tryFire(MainActivity.this);
        }

        @JavascriptInterface public void cancelSos() {
            // Queue «أنا بخير» if the SOS was delivered — or merely sent, since a
            // sent-but-unconfirmed message may still reach the recipient (1.50).
            boolean wasDelivered = G.delivered(MainActivity.this);
            boolean wasSent = G.sent(MainActivity.this);
            android.content.SharedPreferences.Editor e = G.p(MainActivity.this).edit()
                .putBoolean("armed", false);
            if (wasDelivered || wasSent) e.putBoolean("safe_pending", true);
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

        /** Silent disarm (1.59): clear an armed state WITHOUT queueing the
            «أنا بخير» message — used when the SOS button became a pure
            composer opener at Hilal's order, so no send of any kind remains. */
        @JavascriptInterface public void disarmSilent() {
            G.p(MainActivity.this).edit()
                .putBoolean("armed", false).putBoolean("safe_pending", false).apply();
        }

        /** 1.57 fallback: hand the ready-built SOS to the stock Messages app —
            the one channel proven to send on every phone. One tap here opens
            its composer with text + recipients filled; his tap on Send fires. */
        /** Force a fresh modem measurement (1.61) — the meter's refresh button. */
        @JavascriptInterface public void refreshSignal() { G.requestFreshCells(MainActivity.this); }

        @JavascriptInterface public void sendViaComposer() {
            try {
                java.util.List<String> rcpts = G.recipients(MainActivity.this);
                if (rcpts.isEmpty()) return;
                String addr = android.text.TextUtils.join(";", rcpts);
                Intent i = new Intent(Intent.ACTION_SENDTO,
                        android.net.Uri.parse("smsto:" + addr));
                i.putExtra("sms_body", G.fillTemplate(MainActivity.this, G.template(MainActivity.this)));
                startActivity(i);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface public void openNetworkSettings() {
            try { startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
        }

        /* ---------- offline map packs ---------- */

        @JavascriptInterface public String packInfo(double lat, double lng, int radiusKm) {
            try {
                int vec = countTiles(lat, lng, radiusKm, true);
                int sat = countTiles(lat, lng, radiusKm, false);
                int gl = missingGlyphs().size();
                JSONObject o = new JSONObject();
                o.put("tiles", vec + sat + gl);
                o.put("mb", Math.round((vec * 30000L + sat * 14000L + gl * 89000L) / 104857.6) / 10.0);
                o.put("glyphs", gl > 0);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public void downloadPack(final String name, final double lat,
                                                       final double lng, final int radiusKm) {
            if (packThread != null && packThread.isAlive()) return;
            packCancel = false; packDiscard = false;
            synchronized (sessionFiles) { sessionFiles.clear(); }
            packThread = new Thread(() -> {
                String[] layers = { "vec", "sat" };
                final int total = countTiles(lat, lng, radiusKm, true)
                        + countTiles(lat, lng, radiusKm, false) + missingGlyphs().size();
                int done = 0, fails = 0, consecFails = 0, fresh = 0;
                long bytes = 0;
                boolean aborted = false;
                try {
                    // Vector tiles live under a dated path published in the TileJSON — learn it first.
                    String tpl = null;
                    String tj = fetchText("https://tiles.openfreemap.org/planet");
                    if (tj != null) {
                        try { tpl = new JSONObject(tj).getJSONArray("tiles").getString(0); }
                        catch (Exception ignored) {}
                    }
                    if (tpl == null) aborted = true;
                    // Label glyphs (Arabic + Latin) — downloaded once per device, kept across packs.
                    if (!aborted) {
                        for (String[] g : missingGlyphs()) {
                            if (packCancel) break;
                            String url = "https://tiles.openfreemap.org/fonts/"
                                    + g[0].replace(" ", "%20") + "/" + g[1] + ".pbf";
                            long got = fetchTile(url, glyphFile(g[0], g[1]));
                            if (got >= 0) { bytes += got; fresh++; }
                            done++;
                            final int d = done;
                            pushJs("window.__onPackProgress&&window.__onPackProgress({done:" + d
                                    + ",total:" + total + ",layer:'glyphs'})");
                        }
                    }
                    for (String layer : layers) {
                        if (aborted) break;
                        boolean vec = layer.equals("vec");
                        int zMax = vec ? 13 : 15;
                        for (int z = 7; z <= zMax && !packCancel && !aborted; z++) {
                            int[] r = tileRange(lat, lng,
                                    vec ? radiusForZVec(radiusKm, z) : radiusForZSAT(radiusKm, z), z);
                            for (int x = r[0]; x <= r[1] && !packCancel && !aborted; x++) {
                                for (int y = r[2]; y <= r[3]; y++) {
                                    if (packCancel) break;
                                    File f = new File(new File(new File(getFilesDir(), "tiles"), layer),
                                            z + "/" + x + "/" + y + (vec ? ".pbf" : ".jpg"));
                                    if (vec ? f.exists() : (f.exists() && f.length() > 0)) { done++; continue; }
                                    String url = vec
                                            ? tpl.replace("{z}", "" + z).replace("{x}", "" + x).replace("{y}", "" + y)
                                            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
                                    long got = fetchTile(url, f);
                                    if (got >= 0) { bytes += got; consecFails = 0; fresh++;
                                        synchronized (sessionFiles) { sessionFiles.add(f); } }
                                    else { fails++; if (++consecFails >= 30) { aborted = true; break; } }
                                    done++;
                                    if (done % 10 == 0) {
                                        final int d = done;
                                        final String ly = layer;
                                        pushJs("window.__onPackProgress&&window.__onPackProgress({done:" + d
                                                + ",total:" + total + ",layer:'" + ly + "'})");
                                    }
                                    try { Thread.sleep(30); } catch (Exception ignored) {}
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
                if (packDiscard) {
                    synchronized (sessionFiles) {
                        for (File f : sessionFiles) f.delete();
                        sessionFiles.clear();
                    }
                }
                JSONObject o = new JSONObject();
                try {
                    o.put("ok", !packCancel && !aborted);
                    o.put("cancelled", packCancel);
                    o.put("discarded", packDiscard);
                    o.put("tiles", done);
                    o.put("fresh", fresh);
                    o.put("fails", fails);
                    if (!packCancel && !aborted) {
                        android.content.SharedPreferences sp = G.p(MainActivity.this);
                        JSONArray packs = new JSONArray(sp.getString("packs", "[]"));
                        JSONObject pk = new JSONObject();
                        pk.put("name", name); pk.put("lat", lat); pk.put("lng", lng);
                        pk.put("radiusKm", radiusKm); pk.put("at", System.currentTimeMillis());
                        pk.put("mb", Math.round(bytes / 104857.6) / 10.0);
                        // Dedupe (1.42): an identical pack (same centre + radius) is
                        // refreshed, not appended as a duplicate row.
                        String key = name + "|" + radiusKm + "|"
                                + Math.round(lat * 100) + "|" + Math.round(lng * 100);
                        JSONArray kept = new JSONArray();
                        for (int i = 0; i < packs.length(); i++) {
                            JSONObject e = packs.optJSONObject(i); if (e == null) continue;
                            String ek = e.optString("name") + "|" + e.optInt("radiusKm") + "|"
                                    + Math.round(e.optDouble("lat") * 100) + "|"
                                    + Math.round(e.optDouble("lng") * 100);
                            if (!ek.equals(key)) kept.put(e);
                        }
                        kept.put(pk);
                        sp.edit().putString("packs", kept.toString()).apply();
                        o.put("mb", Math.round(bytes / 104857.6) / 10.0);
                    }
                } catch (Exception ignored) {}
                pushJs("window.__onPackDone&&window.__onPackDone(" + o.toString() + ")");
            });
            packThread.start();
        }

        /* ---- Country base pack (1.34): all of Oman at wide zooms only, so zooming out
           beyond a detailed pack still shows the country. vec z7-10, sat z7-9. ---- */
        private int[] tileRangeBbox(int z) {
            return new int[]{ tileX(52.0, z), tileX(59.9, z), tileY(26.6, z), tileY(16.4, z) };
        }

        private int countBbox(boolean vec) {
            int t = 0;
            int zMax = vec ? 10 : 9;
            for (int z = 7; z <= zMax; z++) {
                int[] r = tileRangeBbox(z);
                t += (r[1] - r[0] + 1) * (r[3] - r[2] + 1);
            }
            return t;
        }

        @JavascriptInterface public String basePackInfo() {
            try {
                int v = countBbox(true), s = countBbox(false);
                JSONObject o = new JSONObject();
                o.put("vec", v); o.put("sat", s);
                o.put("mb", Math.round((v * 16000.0 + s * 14000.0) / 104857.6) / 10.0);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public void downloadBase() {
            if (packThread != null && packThread.isAlive()) return;
            packCancel = false; packDiscard = false;
            synchronized (sessionFiles) { sessionFiles.clear(); }
            packThread = new Thread(() -> {
                final int total = countBbox(true) + countBbox(false) + missingGlyphs().size();
                int done = 0, fails = 0, consecFails = 0, fresh = 0;
                boolean aborted = false;
                try {
                    String tpl = null;
                    String tj = fetchText("https://tiles.openfreemap.org/planet");
                    if (tj != null) {
                        try { tpl = new JSONObject(tj).getJSONArray("tiles").getString(0); }
                        catch (Exception ignored) {}
                    }
                    if (tpl == null) aborted = true;
                    if (!aborted) {
                        for (String[] g : missingGlyphs()) {
                            if (packCancel) break;
                            String url = "https://tiles.openfreemap.org/fonts/"
                                    + g[0].replace(" ", "%20") + "/" + g[1] + ".pbf";
                            if (fetchTile(url, glyphFile(g[0], g[1])) >= 0) fresh++;
                            done++;
                            final int d = done;
                            pushJs("window.__onPackProgress&&window.__onPackProgress({done:" + d
                                    + ",total:" + total + ",layer:'glyphs'})");
                        }
                    }
                    String[] layers = { "vec", "sat" };
                    for (String layer : layers) {
                        if (aborted) break;
                        boolean vec = layer.equals("vec");
                        int zMax = vec ? 10 : 9;
                        for (int z = 7; z <= zMax && !packCancel && !aborted; z++) {
                            int[] r = tileRangeBbox(z);
                            for (int x = r[0]; x <= r[1] && !packCancel && !aborted; x++) {
                                for (int y = r[2]; y <= r[3]; y++) {
                                    if (packCancel) break;
                                    File f = new File(new File(new File(getFilesDir(), "tiles"), layer),
                                            z + "/" + x + "/" + y + (vec ? ".pbf" : ".jpg"));
                                    if (vec ? f.exists() : (f.exists() && f.length() > 0)) { done++; continue; }
                                    String url = vec
                                            ? tpl.replace("{z}", "" + z).replace("{x}", "" + x).replace("{y}", "" + y)
                                            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
                                    long got = fetchTile(url, f);
                                    if (got >= 0) { consecFails = 0; fresh++;
                                        synchronized (sessionFiles) { sessionFiles.add(f); } }
                                    else { fails++; if (++consecFails >= 30) { aborted = true; break; } }
                                    done++;
                                    if (done % 10 == 0) {
                                        final int d = done;
                                        final String ly = layer;
                                        pushJs("window.__onPackProgress&&window.__onPackProgress({done:" + d
                                                + ",total:" + total + ",layer:'" + ly + "'})");
                                    }
                                    try { Thread.sleep(30); } catch (Exception ignored) {}
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}
                if (packDiscard) {
                    synchronized (sessionFiles) {
                        for (File f : sessionFiles) f.delete();
                        sessionFiles.clear();
                    }
                }
                JSONObject o = new JSONObject();
                try {
                    o.put("ok", !packCancel && !aborted);
                    o.put("cancelled", packCancel);
                    o.put("base", true);
                    o.put("tiles", done);
                    o.put("fresh", fresh);
                    o.put("fails", fails);
                } catch (Exception ignored) {}
                pushJs("window.__onPackDone&&window.__onPackDone(" + o.toString() + ")");
            });
            packThread.start();
        }

        @JavascriptInterface public void cancelPack() { packCancel = true; }

        @JavascriptInterface public void cancelPackDiscard() {
            if (packThread != null && packThread.isAlive()) {
                packDiscard = true; packCancel = true;
            } else {
                synchronized (sessionFiles) {
                    for (File f : sessionFiles) f.delete();
                    sessionFiles.clear();
                }
            }
        }

        @JavascriptInterface public void openLocationSettings() {
            try { startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
        }

        @JavascriptInterface public String mapStats() {
            try {
                JSONObject o = new JSONObject();
                o.put("vec", countFiles(new File(getFilesDir(), "tiles/vec")));
                o.put("sat", countFiles(new File(getFilesDir(), "tiles/sat")));
                o.put("glyphs", countFiles(new File(getFilesDir(), "glyphs")));
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface public String listPacks() {
            try {
                JSONObject o = new JSONObject();
                android.content.SharedPreferences sp = G.p(MainActivity.this);
                // Dedupe (1.42): collapse identical pack entries to the newest one and
                // persist the cleaned list, so what is shown is what deletePack indexes.
                JSONArray rawPacks = new JSONArray(sp.getString("packs", "[]"));
                java.util.LinkedHashMap<String, JSONObject> byKey = new java.util.LinkedHashMap<>();
                for (int i = 0; i < rawPacks.length(); i++) {
                    JSONObject e = rawPacks.optJSONObject(i); if (e == null) continue;
                    String k = e.optString("name") + "|" + e.optInt("radiusKm") + "|"
                            + Math.round(e.optDouble("lat") * 100) + "|"
                            + Math.round(e.optDouble("lng") * 100);
                    byKey.remove(k); byKey.put(k, e);
                }
                JSONArray packs = new JSONArray();
                for (JSONObject e : byKey.values()) packs.put(e);
                if (packs.length() != rawPacks.length())
                    sp.edit().putString("packs", packs.toString()).apply();
                o.put("packs", packs);
                o.put("tilesMB", Math.round(dirSize(new File(getFilesDir(), "tiles")) / 104857.6) / 10.0);
                int partial = 0;
                synchronized (sessionFiles) { for (File f : sessionFiles) if (f.exists()) partial++; }
                o.put("partialTiles", partial);
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        /* Every tile path a regular pack (centre + radius) can own — mirrors the
           downloadPack loops, plus legacy vec z14 from the 1.28–1.31 packs. */
        private java.util.HashSet<String> packTilePaths(double lat, double lng, int radiusKm) {
            java.util.HashSet<String> out = new java.util.HashSet<>();
            for (int z = 7; z <= 14; z++) {
                int[] r = tileRange(lat, lng, radiusForZVec(radiusKm, z), z);
                for (int x = r[0]; x <= r[1]; x++) for (int y = r[2]; y <= r[3]; y++)
                    out.add("tiles/vec/" + z + "/" + x + "/" + y + ".pbf");
            }
            for (int z = 7; z <= 15; z++) {
                int[] r = tileRange(lat, lng, radiusForZSAT(radiusKm, z), z);
                for (int x = r[0]; x <= r[1]; x++) for (int y = r[2]; y <= r[3]; y++)
                    out.add("tiles/sat/" + z + "/" + x + "/" + y + ".jpg");
            }
            return out;
        }

        /* Real pack deletion (1.43): stops a running download first, then deletes the
           tiles that belong ONLY to this pack. Tiles shared with other registered packs
           and the shared far-zoom skeleton (vec z7–10 / sat z7–9 over the Oman bbox,
           which the base pack also uses) are kept — «مسح الكل» remains the nuclear option. */
        @JavascriptInterface public String deletePackTiles(int idx) {
            if (packThread != null && packThread.isAlive()) {
                packCancel = true;
                try { packThread.join(4000); } catch (Exception ignored) {}
            }
            try {
                android.content.SharedPreferences sp = G.p(MainActivity.this);
                JSONArray packs = new JSONArray(sp.getString("packs", "[]"));
                JSONObject victim = packs.optJSONObject(idx);
                if (victim == null) return "{\"ok\":false}";
                java.util.HashSet<String> keep = new java.util.HashSet<>();
                for (int i = 0; i < packs.length(); i++) {
                    if (i == idx) continue;
                    JSONObject e = packs.optJSONObject(i); if (e == null) continue;
                    keep.addAll(packTilePaths(e.optDouble("lat"), e.optDouble("lng"),
                            e.optInt("radiusKm")));
                }
                for (int z = 7; z <= 10; z++) {
                    int[] r = tileRangeBbox(z);
                    for (int x = r[0]; x <= r[1]; x++) for (int y = r[2]; y <= r[3]; y++)
                        keep.add("tiles/vec/" + z + "/" + x + "/" + y + ".pbf");
                }
                for (int z = 7; z <= 9; z++) {
                    int[] r = tileRangeBbox(z);
                    for (int x = r[0]; x <= r[1]; x++) for (int y = r[2]; y <= r[3]; y++)
                        keep.add("tiles/sat/" + z + "/" + x + "/" + y + ".jpg");
                }
                java.util.HashSet<String> mine = packTilePaths(victim.optDouble("lat"),
                        victim.optDouble("lng"), victim.optInt("radiusKm"));
                mine.removeAll(keep);
                long freed = 0; int del = 0;
                File root = getFilesDir();
                for (String rel : mine) {
                    File f = new File(root, rel);
                    if (f.exists()) { freed += f.length(); if (f.delete()) del++; }
                }
                JSONArray keptPacks = new JSONArray();
                for (int i = 0; i < packs.length(); i++) if (i != idx) keptPacks.put(packs.get(i));
                sp.edit().putString("packs", keptPacks.toString()).apply();
                JSONObject o = new JSONObject();
                o.put("ok", true); o.put("deleted", del);
                o.put("mb", Math.round(freed / 104857.6) / 10.0);
                return o.toString();
            } catch (Exception e) { return "{\"ok\":false}"; }
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
    private volatile boolean packDiscard = false;
    private Thread packThread = null;
    private final java.util.List<File> sessionFiles = new java.util.ArrayList<>();

    /* MapLibre fetches tiles/glyphs via fetch/XHR from a file:// page — without an
       Access-Control-Allow-Origin header the WebView refuses the intercepted
       responses as cross-origin and the map stays blank. Every local response
       therefore carries ACAO:* (1.29). */
    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    private WebResourceResponse localResp(String mime, InputStream data, int status) {
        java.util.Map<String, String> h = new java.util.HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse(mime, null, status,
                status == 200 ? "OK" : "Not Found", h, data);
    }

    private void pushJs(final String js) {
        if (web == null) return;
        web.post(() -> { try { web.evaluateJavascript(js, null); } catch (Exception ignored) {} });
    }

    /* Smart taper for the 500 km pack: full detail near the centre, coarser far away. */
    static double radiusForZ(int radiusKm, int z) {
        if (radiusKm >= 500) return z <= 10 ? 500 : (z <= 12 ? 150 : 50);
        return radiusKm;
    }

    /* Vector taper: z14 street detail only near the centre, z13 a bit wider. */
    static double radiusForZVec(int radiusKm, int z) {
        if (z >= 14) return Math.min(radiusKm, 30);
        if (z == 13) return Math.min(radiusKm, 60);
        if (z >= 11) return Math.min(radiusKm, 150);
        return radiusKm;
    }

    /* Satellite depth: full pack radius to z13, then street-level detail near the centre —
       z14 within 25 km, z15 within 10 km — so deep zoom stays readable (1.33). */
    static double radiusForZSAT(int radiusKm, int z) {
        if (z == 14) return Math.min(radiusKm, 25);
        if (z == 15) return Math.min(radiusKm, 10);
        return radiusForZ(radiusKm, z);
    }

    private int countTiles(double lat, double lng, int radiusKm, boolean vec) {
        int t = 0;
        int zMax = vec ? 13 : 15;
        for (int z = 7; z <= zMax; z++) {
            int[] r = tileRange(lat, lng, vec ? radiusForZVec(radiusKm, z) : radiusForZSAT(radiusKm, z), z);
            t += (r[1] - r[0] + 1) * (r[3] - r[2] + 1);
        }
        return t;
    }

    /* ---------- label glyphs (downloaded once per device) ---------- */
    static final String[] GLYPH_FONTS = { "Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic" };
    static final String[] GLYPH_RANGES = { "0-255", "256-511", "512-767", "768-1023", "1024-1279",
            "1280-1535", "1536-1791", "1792-2047", "2048-2303", "2304-2559", "2560-2815", "8192-8447",
            "8448-8703", "8704-8959", "64256-64511", "64512-64767", "64768-65023", "65024-65279",
            "65280-65535" };

    private File glyphFile(String font, String range) {
        return new File(new File(new File(getFilesDir(), "glyphs"),
                font.replaceAll("[^A-Za-z0-9]", "_")), range + ".pbf");
    }

    private java.util.List<String[]> missingGlyphs() {
        java.util.List<String[]> out = new java.util.ArrayList<>();
        for (String f : GLYPH_FONTS) for (String r : GLYPH_RANGES)
            if (!glyphFile(f, r).exists()) out.add(new String[] { f, r });
        return out;
    }

    private String fetchText(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(12000); c.setReadTimeout(12000);
            c.setRequestProperty("User-Agent", "AlHaris-Guardian/1.28 (free offline safety maps)");
            if (c.getResponseCode() != 200) return null;
            InputStream in = c.getInputStream();
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int r;
            while ((r = in.read(buf)) > 0) bos.write(buf, 0, r);
            in.close();
            return bos.toString("UTF-8");
        } catch (Exception e) { return null; }
        finally { if (c != null) c.disconnect(); }
    }

    static int tileX(double lng, int z) {
        int n = 1 << z;
        return Math.max(0, Math.min(n - 1, (int) Math.floor((lng + 180) / 360.0 * n)));
    }

    static int tileY(double lat, int z) {
        int n = 1 << z;
        return Math.max(0, Math.min(n - 1, (int) Math.floor((1 - Math.log(Math.tan(Math.toRadians(lat))
                + 1 / Math.cos(Math.toRadians(lat))) / Math.PI) / 2 * n)));
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
            c.setRequestProperty("User-Agent", "AlHaris-Guardian/1.28 (free offline safety maps)");
            if (c.getResponseCode() != 200) return -1;
            dest.getParentFile().mkdirs();
            File tmp = new File(dest.getPath() + ".tmp");
            InputStream in = c.getInputStream();
            FileOutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[8192]; int r; long total = 0;
            while ((r = in.read(buf)) > 0) { out.write(buf, 0, r); total += r; }
            out.close(); in.close();
            // A 200 with an empty body is a legitimately empty vector tile — keep it as done.
            if (!tmp.renameTo(dest)) { tmp.delete(); return -1; }
            return total;
        } catch (Exception e) { return -1; }
        finally { if (c != null) c.disconnect(); }
    }

    static int countFiles(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return 1;
        int n = 0;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) n += countFiles(k);
        return n;
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
