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
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.Surface;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
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
    /* 1.138: UI language for the native JS-dialog buttons. */
    boolean uiEn() {
        try { return "en".equals(G.p(this).getString("uiLang", "ar")); }
        catch (Exception e) { return false; }
    }

    private WebView web;
    private LocationManager lm;
    private Ringtone alarm;
    private boolean alarmOn = false;

    private final LocationListener uiLoc = new LocationListener() {
        @Override public void onLocationChanged(Location l) {
            G.saveFix(MainActivity.this, l);
            /* 1.181: push THIS fix, not the cached one. Since 1.179
               saveFix keeps the BEST fix for the flicker/record cache
               and refuses merely-newer ones — but pushLoc() read that
               same cache, so while walking, every live fix with
               slightly worse accuracy than the cached best was
               swallowed and the return-distance counter froze (the
               owner's field report: stuck at 30/20 m, neither falling
               nor rising). The cache keeps its gate for records; the
               live feed now carries the fix that just arrived. */
            pushLoc(l);
        }
        @Override public void onStatusChanged(String p, int s, Bundle e) {}
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {}
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        // 1.185: the manifest theme is the launch theme (dusk splash as the
        // window background, shown by the system from the moment the icon
        // is tapped until the first frame). Restore the stock theme now,
        // before any view exists, so the running app is unchanged.
        setTheme(android.R.style.Theme_Material_NoActionBar);
        requestPerms();
        web = new WebView(this);
        // 1.185: any pre-paint moment of the WebView itself takes the
        // page's own deep navy (#04060d), never black.
        web.setBackgroundColor(0xFF04060D);
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
                        .setPositiveButton(uiEn() ? "OK" : "حسنًا", (d, w) -> res.confirm())
                        .setOnCancelListener(d -> res.confirm())
                        .show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg,
                    final android.webkit.JsResult res) {
                new android.app.AlertDialog.Builder(MainActivity.this)
                        .setMessage(msg)
                        .setPositiveButton(uiEn() ? "Yes" : "نعم", (d, w) -> res.confirm())
                        .setNegativeButton(uiEn() ? "No" : "لا", (d, w) -> res.cancel())
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
                            // 1.123: deep-zoom fallback — where no z16-18 detail tile was
                            // downloaded, serve the z15 ancestor cropped + upscaled, so
                            // the satellite layer stretches as before and never blanks.
                            try {
                                int z = Integer.parseInt(p.get(1)), x = Integer.parseInt(p.get(2)), y = Integer.parseInt(p.get(3));
                                if (z > 15) {
                                    int sh = z - 15, n = 1 << sh, cell = 256 / n;
                                    File anc = new File(new File(new File(getFilesDir(), "tiles"), "sat"),
                                            "15/" + (x >> sh) + "/" + (y >> sh) + ".jpg");
                                    if (anc.exists() && anc.length() > 0) {
                                        android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeFile(anc.getPath());
                                        if (bmp != null) {
                                            android.graphics.Bitmap crop = android.graphics.Bitmap.createBitmap(bmp, (x & (n - 1)) * cell, (y & (n - 1)) * cell, cell, cell);
                                            android.graphics.Bitmap up = android.graphics.Bitmap.createScaledBitmap(crop, 256, 256, true);
                                            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                                            up.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, bos);
                                            return localResp("image/jpeg", new ByteArrayInputStream(bos.toByteArray()), 200);
                                        }
                                    }
                                }
                            } catch (Exception ignored) {}
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
        // 1.204: the direct-send verdict receiver (see directPress below).
        try {
            android.content.IntentFilter dsf = new android.content.IntentFilter(DS_ACTION);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(dsReceiver, dsf, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(dsReceiver, dsf);
        } catch (Exception ignored) {}
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
        // 1.204: the SOS permission answer goes back to the page, which
        // tells him plainly — granted means "press the button again to
        // send" (the press-again flow: a grant never sends by itself).
        if (rc == DS_PERM_RC) {
            boolean g = false;
            for (int k = 0; k < perms.length; k++)
                if (Manifest.permission.SEND_SMS.equals(perms[k]))
                    g = k < results.length && results[k] == PackageManager.PERMISSION_GRANTED;
            postJs("window.__onSmsPerm&&window.__onSmsPerm(" + g + ")");
        }
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

    /* 1.155: a REAL compass feed. The WebView's deviceorientation value on
       Hilal's phone sits a constant ~90 degrees away from the direction the
       phone's front actually faces (proven in the field 2026-11-24: facing
       west 270, the dial read south 180). Android's own rotation-vector
       sensor computes the azimuth properly, so the azimuth is computed
       natively and pushed to window.__onAz; the page prefers it over
       deviceorientation for the dial and both return arrows. */
    private SensorManager smgr;
    private Sensor rotSensor;
    private float lastAz = -1f;
    private final float[] rotMat = new float[9];
    private final float[] remapped = new float[9];
    private final float[] orient = new float[3];
    private final SensorEventListener azListener = new SensorEventListener() {
        @Override public void onSensorChanged(SensorEvent e) {
            float az;
            if (e.sensor.getType() == Sensor.TYPE_ORIENTATION) {
                az = e.values[0];
            } else {
                SensorManager.getRotationMatrixFromVector(rotMat, e.values);
                int rot = Surface.ROTATION_0;
                try { rot = getWindowManager().getDefaultDisplay().getRotation(); } catch (Exception ignored) {}
                int ax = SensorManager.AXIS_X, ay = SensorManager.AXIS_Y;
                if (rot == Surface.ROTATION_90) { ax = SensorManager.AXIS_Y; ay = SensorManager.AXIS_MINUS_X; }
                else if (rot == Surface.ROTATION_180) { ax = SensorManager.AXIS_MINUS_X; ay = SensorManager.AXIS_MINUS_Y; }
                else if (rot == Surface.ROTATION_270) { ax = SensorManager.AXIS_MINUS_Y; ay = SensorManager.AXIS_X; }
                SensorManager.remapCoordinateSystem(rotMat, ax, ay, remapped);
                SensorManager.getOrientation(remapped, orient);
                az = (float) Math.toDegrees(orient[0]);
            }
            if (az < 0) az += 360f;
            if (lastAz >= 0) { float d = Math.abs(az - lastAz); if (d > 180) d = 360 - d; if (d < 1f) return; }
            lastAz = az;
            if (web == null) return;
            final String js = "window.__onAz&&window.__onAz(" + az + ")";
            web.post(() -> web.evaluateJavascript(js, null));
        }
        @Override public void onAccuracyChanged(Sensor s, int a) {}
    };

    @Override protected void onResume() {
        super.onResume();
        G.setUiAlive(this, true);
        try {
            if (smgr == null) {
                smgr = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
                rotSensor = smgr.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
                if (rotSensor == null) rotSensor = smgr.getDefaultSensor(Sensor.TYPE_ORIENTATION);
            }
            if (rotSensor != null) smgr.registerListener(azListener, rotSensor, SensorManager.SENSOR_DELAY_UI);
        } catch (Exception ignored) {}
        registerLoc();
        pushLoc();
    }
    @Override protected void onPause() {
        super.onPause();
        G.setUiAlive(this, false);
        try { if (smgr != null) smgr.unregisterListener(azListener); } catch (Exception ignored) {}
        try { lm.removeUpdates(uiLoc); } catch (Exception ignored) {}
    }

    /* 1.168: smart location cadence — fast (1 s / 1 m) while the map is
       open or guidance is active, relaxed on the other pages, so the
       1.166 responsiveness does not tax the battery all day. The web
       layer asks via GN.setLocFast. */
    private boolean locFast = true;
    private void registerLoc() {
        try { lm.removeUpdates(uiLoc); } catch (Exception ignored) {}
        try {
            if (locFast) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 1, uiLoc);
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000, 2, uiLoc);
            } else {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4000, 4, uiLoc);
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 8000, 8, uiLoc);
            }
        } catch (Exception ignored) {}
    }
    private void pushLoc() {
        pushLoc(G.lastFix(this));
    }

    private void pushLoc(Location l) {
        if (l == null || web == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("lat", l.getLatitude()); o.put("lng", l.getLongitude());
            o.put("at", l.getTime()); o.put("acc", l.getAccuracy());
            final String js = "window.__onLoc&&window.__onLoc(" + o.toString() + ")";
            web.post(() -> web.evaluateJavascript(js, null));
        } catch (Exception ignored) {}
    }

    /* ---------- 1.204 direct send (Hilal's reopened SOS spec) ----------
       «رسالة واحدة تذهب عند الضغط فقط لا تلقائيًا» — one message, sent at
       the press only, never automatically. pressSos/pressSafe (Bridge)
       submit ONE send per configured recipient through G.sendOnce; the
       radio's per-part verdicts land in dsReceiver and are aggregated
       here: «sent» is claimed only when every part of every recipient
       reported RESULT_OK, the first failure verdict is reported at once
       with its code, and 45 s of radio silence is reported as a timeout.
       On any failure the page keeps the composer one tap away, so the
       message is never silently lost. One session at a time: a press
       while a send is in flight is refused ("busy"), in Java as well as
       in the page — one press can never produce two sends. */
    private static final String DS_ACTION = "com.hilalsameer.guardian.DIRECT_SENT";
    private static final int DS_PERM_RC = 9;
    private final Object dsLock = new Object();
    private boolean dsActive = false;
    private int dsToken = 0, dsExpected = 0, dsArrived = 0;
    private String dsKind = "sos";
    private final android.os.Handler dsHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable dsTimeout = () -> {
        String js = null;
        synchronized (dsLock) {
            if (dsActive) { dsActive = false; js = directResultJs(dsKind, false, -1); }
        }
        if (js != null) postJs(js);
    };
    private final android.content.BroadcastReceiver dsReceiver = new android.content.BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            onDirectSent(i.getIntExtra("tk", -1), getResultCode());
        }
    };

    private void postJs(final String js) {
        if (web == null) return;
        web.post(() -> { try { web.evaluateJavascript(js, null); } catch (Exception ignored) {} });
    }

    private static String directResultJs(String kind, boolean ok, int code) {
        return "window.__onDirectResult&&window.__onDirectResult('" + kind + "'," + ok + "," + code + ")";
    }

    private void onDirectSent(int tk, int resultCode) {
        String js = null;
        synchronized (dsLock) {
            if (!dsActive || tk != dsToken) return; // stale or duplicate verdict
            if (resultCode != Activity.RESULT_OK) {
                dsActive = false;
                js = directResultJs(dsKind, false, resultCode);
            } else if (++dsArrived >= dsExpected) {
                dsActive = false;
                js = directResultJs(dsKind, true, 0);
            }
            if (!dsActive) dsHandler.removeCallbacks(dsTimeout);
        }
        if (js != null) postJs(js);
    }

    /* The press itself. Returns a status word the page renders honestly:
       "busy" (a send is already in flight), "norecip" (no recipient
       configured), "needperm" (SEND_SMS not granted — the page explains,
       and the next press asks the system), "sendfail" (the submission
       itself threw), or "sending" (submitted; the verdict arrives via
       __onDirectResult). The composition is the composer's own:
       fillTemplate over the same template — never forked. */
    private String directPress(boolean safe) {
        synchronized (dsLock) {
            if (dsActive) return "busy";
            if (G.recipients(this).isEmpty()) return "norecip";
            if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED)
                return "needperm";
            String text = G.fillTemplate(this, safe ? G.safeTemplate(this) : G.template(this));
            dsToken++;
            Intent i = new Intent(DS_ACTION).setPackage(getPackageName());
            i.putExtra("tk", dsToken);
            android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(this,
                    7000 + (dsToken % 500), i,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT
                            | android.app.PendingIntent.FLAG_IMMUTABLE);
            int expected = G.sendOnce(this, text, pi);
            if (expected <= 0) return "sendfail";
            dsKind = safe ? "safe" : "sos";
            dsExpected = expected; dsArrived = 0; dsActive = true;
            // A stale safe_pending from the retired bow is superseded by
            // this very press — the all-clear no longer waits for a flicker.
            if (safe) G.p(this).edit().putBoolean("safe_pending", false).apply();
            dsHandler.postDelayed(dsTimeout, 45000);
            return "sending";
        }
    }

    public class Bridge {
        @JavascriptInterface public String getSignal() { return G.signalJson(MainActivity.this).toString(); }
        @JavascriptInterface public void setSalawatOn(boolean on) { G.setSalawatOn(MainActivity.this, on); }
        /* 1.138: the UI language, shared with the WatchService so its
           persistent notification speaks the same language. */
        @JavascriptInterface public void setUiLang(String l) {
            try { G.p(MainActivity.this).edit()
                    .putString("uiLang", "en".equals(l) ? "en" : "ar").apply(); }
            catch (Exception ignored) {}
        }

        @JavascriptInterface public String getSalawatState() {
            try {
                JSONObject o = new JSONObject();
                o.put("on", G.salawatOn(MainActivity.this));
                o.put("min", G.salawatMin(MainActivity.this));
                o.put("last", G.salawatLast(MainActivity.this));
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public void setSalawatInterval(int m) { G.setSalawatMin(MainActivity.this, m); }
        @JavascriptInterface public void markSalawatPlayed() { G.setSalawatLast(MainActivity.this, System.currentTimeMillis()); }
        @JavascriptInterface public void playBell() { G.playBellClip(MainActivity.this); }
        @JavascriptInterface public void setLocFast(final boolean fast) {
            if (fast == locFast) return;
            locFast = fast;
            runOnUiThread(() -> registerLoc());
        }
        @JavascriptInterface public void uiPing() { G.uiPing(MainActivity.this); }
        @JavascriptInterface public void setImmersive(final boolean on) {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= 30) {
                        WindowInsetsController c = getWindow().getInsetsController();
                        if (c != null) {
                            if (on) { c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
                            else c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                        }
                    } else {
                        View d = getWindow().getDecorView();
                        d.setSystemUiVisibility(on
                            ? View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            : View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
                    }
                } catch (Exception e) {}
            });
        }

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


        @JavascriptInterface public void cancelSos() {
            // 1.204: a cancel press now ONLY cancels. The retired bow used
            // to queue «أنا بخير» here (safe_pending, if the SOS had been
            // delivered or merely sent — 1.50) and fire it automatically
            // at the next flicker via tryFire. Under Hilal's reopened
            // spec — one message, at the press only, never automatically —
            // the all-clear is sent solely by its own button (pressSafe),
            // so nothing is queued and nothing is fired from here.
            G.p(MainActivity.this).edit()
                .putBoolean("armed", false).putBoolean("safe_pending", false).apply();
            startWatcher();
        }

        @JavascriptInterface public String addWhisper() { return String.valueOf(G.logWhisperEx(MainActivity.this, "يدوي")); }

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

        /* 1.142 (Hilal's order): the all-clear gets the same honest
           channel as the SOS — a button that opens the stock Messages
           composer with the SAFE template built and addressed; his own
           tap on Send there is the only send. Until now the safe text
           had no living send path at all: its only sender was the
           retired automatic bow (safe_pending), whose trigger state a
           composer-sent SOS never sets. */
        @JavascriptInterface public void sendSafeViaComposer() {
            try {
                java.util.List<String> rcpts = G.recipients(MainActivity.this);
                if (rcpts.isEmpty()) return;
                String addr = android.text.TextUtils.join(";", rcpts);
                Intent i = new Intent(Intent.ACTION_SENDTO,
                        android.net.Uri.parse("smsto:" + addr));
                i.putExtra("sms_body", G.fillTemplate(MainActivity.this, G.safeTemplate(MainActivity.this)));
                startActivity(i);
            } catch (Exception ignored) {}
        }

        /* 1.204 (Hilal's reopened spec): the SOS button sends the message
           ITSELF at the press — one message per configured recipient, via
           the same SmsManager road Tamanina proved on his own phone. No
           default-SMS role, no automatic anything: these two methods and
           the permission request below are reachable only from the two
           buttons' own press handlers in the page. The verdict returns
           through __onDirectResult; on any failure the composer methods
           above remain one tap away as the fallback. */
        @JavascriptInterface public String pressSos() { return directPress(false); }
        @JavascriptInterface public String pressSafe() { return directPress(true); }

        /* The permission ask is its own press (see the page flow): the
           first press explains, the second press calls this, and after
           the system's answer he presses the send button once more —
           a grant never turns into a send by itself. */
        @JavascriptInterface public void requestSmsPermission() {
            runOnUiThread(() -> requestPermissions(
                    new String[] { Manifest.permission.SEND_SMS }, DS_PERM_RC));
        }

        @JavascriptInterface public void openNetworkSettings() {
            try { startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
        }

        /* 1.144: the project-repository row — opening hands the URL to
           the phone's browser (this app itself holds no INTERNET
           permission), copying puts it on the clipboard for sharing. */
        @JavascriptInterface public void openRepo() {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://github.com/samshua284-gif/al-haris")));
            } catch (Exception e) { /* no browser: the visible link text still serves */ }
        }

        @JavascriptInterface public void copyRepoLink() {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("al-haris",
                        "https://github.com/samshua284-gif/al-haris"));
            } catch (Exception e) { /* clipboard unavailable */ }
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
                                                       final double lng, final int radiusKm,
                                                       final boolean refresh,
                                                       final boolean smart) {
            if (packThread != null && packThread.isAlive()) return;
            packCancel = false; packDiscard = false;
            synchronized (sessionFiles) { sessionFiles.clear(); }
            packThread = new Thread(() -> {
                if (smart) { smartPackDownload(name, lat, lng, radiusKm); return; }
                String[] layers = { "vec", "sat" };
                final int total = countTiles(lat, lng, radiusKm, true)
                        + countTiles(lat, lng, radiusKm, false) + missingGlyphs().size();
                int done = 0, fails = 0, consecFails = 0, fresh = 0;
                long bytes = 0;
                boolean aborted = false;
                String tpl = null; // 1.133: declared at thread level so the completion block can store it as the pack's vec baseline
                try {
                    // Vector tiles live under a dated path published in the TileJSON — learn it first.
                    tpl = null;
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
                        int zMax = vec ? 13 : 18;
                        for (int z = 7; z <= zMax && !packCancel && !aborted; z++) {
                            int[] r = tileRange(lat, lng,
                                    vec ? radiusForZVec(radiusKm, z) : radiusForZSAT(radiusKm, z), z);
                            for (int x = r[0]; x <= r[1] && !packCancel && !aborted; x++) {
                                for (int y = r[2]; y <= r[3]; y++) {
                                    if (packCancel) break;
                                    File f = new File(new File(new File(getFilesDir(), "tiles"), layer),
                                            z + "/" + x + "/" + y + (vec ? ".pbf" : ".jpg"));
                                    if (!refresh && f.exists() && f.length() > 0) { done++; continue; } // 1.131: refresh (Update button) disables the skip — every tile re-fetched fresh, a real sync // 1.65: vec used to skip on existence alone — a 0-byte shell saved in a flaky fetch was then skipped forever and rendered as a blank tile at deep zoom
                                    String url = vec
                                            ? tpl.replace("{z}", "" + z).replace("{x}", "" + x).replace("{y}", "" + y)
                                            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
                                    long got = fetchTile(url, f);
                                    if (got >= 0) { bytes += got; consecFails = 0; fresh++;
                                        synchronized (sessionFiles) { sessionFiles.add(f); } }
                                    else if (got == -2) { consecFails = 0; } // 1.136: a 404 proves the connection works — it must never trip the failure abort
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
                        try { pk.put("vecTpl", tpl); } catch (Exception ignored) {} // 1.133: baseline for smart checks
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
                saveTileETags(); // 1.133: persist sat fingerprints gathered this run
                saveTileVerified(); // 1.141
            pushJs("window.__onPackDone&&window.__onPackDone(" + o.toString() + ")");
            });
            packThread.start();
        }

        /* ---- Smart update (1.133; ONE PASS since 1.137): every tile of
           the pack is classified and, when needed, fetched in a single
           pass — one progress counter, no phases. Vector sync is decided
           by the published build stamp inside the TileJSON template;
           satellite tiles are verified by HEAD/ETag and re-fetched in
           place when changed; tiles the source answered 404 for are
           remembered and skipped; legitimately empty vector tiles are
           valid tiles, not failures. ---- */
        private void smartPackDownload(final String name, final double lat,
                                       final double lng, final int radiusKm) {
            final java.util.concurrent.atomic.AtomicInteger processed = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger updated = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger newC = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger changedC = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger syncedC = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger unverifiable = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger fastC = new java.util.concurrent.atomic.AtomicInteger(0); // 1.141
            final java.util.concurrent.atomic.AtomicInteger sourceMissing = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger fails = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicInteger consecFails = new java.util.concurrent.atomic.AtomicInteger(0);
            final java.util.concurrent.atomic.AtomicLong bytes = new java.util.concurrent.atomic.AtomicLong(0);
            final java.util.concurrent.atomic.AtomicBoolean abortedF = new java.util.concurrent.atomic.AtomicBoolean(false);
            boolean baseline = false;
            String tplNow = null, storedTpl = null;
            double storedMb = -1;
            int planTotal = 0;
            try {
                String tj = null;
                for (int attempt = 0; attempt < 2 && tj == null; attempt++) {
                    tj = fetchText("https://tiles.openfreemap.org/planet");
                    if (tj == null && attempt == 0) { try { Thread.sleep(1500); } catch (Exception ignored) {} }
                }
                if (tj != null) {
                    try { tplNow = new JSONObject(tj).getJSONArray("tiles").getString(0); }
                    catch (Exception ignored) {}
                }
                if (tplNow == null) abortedF.set(true);
                if (!abortedF.get()) {
                    for (String[] g : missingGlyphs()) {
                        if (packCancel) break;
                        String url = "https://tiles.openfreemap.org/fonts/"
                                + g[0].replace(" ", "%20") + "/" + g[1] + ".pbf";
                        long got = fetchTile(url, glyphFile(g[0], g[1]));
                        if (got >= 0) bytes.addAndGet(got);
                    }
                }
                android.content.SharedPreferences sp = G.p(MainActivity.this);
                JSONArray packs0 = new JSONArray(sp.getString("packs", "[]"));
                String key = name + "|" + radiusKm + "|"
                        + Math.round(lat * 100) + "|" + Math.round(lng * 100);
                for (int i = 0; i < packs0.length(); i++) {
                    JSONObject e = packs0.optJSONObject(i); if (e == null) continue;
                    String ek = e.optString("name") + "|" + e.optInt("radiusKm") + "|"
                            + Math.round(e.optDouble("lat") * 100) + "|" + Math.round(e.optDouble("lng") * 100);
                    if (ek.equals(key)) {
                        if (e.has("vecTpl")) storedTpl = e.optString("vecTpl");
                        storedMb = e.optDouble("mb", -1);
                    }
                }
                baseline = (storedTpl == null);
                final boolean vecChanged = !baseline && !storedTpl.equals(tplNow);
                final String tplF = tplNow;
                final int planHolder[] = new int[1];
                java.util.List<Runnable> tasks = new java.util.ArrayList<>();
                if (!abortedF.get()) {
                    for (int pass = 0; pass < 2; pass++) {
                        final boolean vec = pass == 0;
                        int zMax = vec ? 13 : 18;
                        for (int z = 7; z <= zMax; z++) {
                            int[] r = tileRange(lat, lng,
                                    vec ? radiusForZVec(radiusKm, z) : radiusForZSAT(radiusKm, z), z);
                            for (int x = r[0]; x <= r[1]; x++) {
                                for (int y = r[2]; y <= r[3]; y++) {
                                    planTotal++;
                                    final File f = new File(new File(new File(getFilesDir(), "tiles"), vec ? "vec" : "sat"),
                                            z + "/" + x + "/" + y + (vec ? ".pbf" : ".jpg"));
                                    final String url = vec
                                            ? tplF.replace("{z}", "" + z).replace("{x}", "" + x).replace("{y}", "" + y)
                                            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
                                    boolean missing = !f.exists() || (f.length() == 0 && !(vec && etagFor(f) != null && !"404".equals(etagFor(f)))); // 1.137: a 0-byte vec file with a recorded fingerprint/marker is a known empty tile, not a missing one
                                    if (missing && "404".equals(etagFor(f)) && !(vec && vecChanged)) {
                                        sourceMissing.incrementAndGet(); processed.incrementAndGet();
                                    } else if (vec && !missing && !vecChanged) {
                                        syncedC.incrementAndGet(); processed.incrementAndGet();
                                    } else if (missing) {
                                        newC.incrementAndGet();
                                        tasks.add(() -> fetchSmartTile(f, url, processed, updated, newC, changedC, sourceMissing, bytes, fails, consecFails, abortedF, planHolder[0]));
                                    } else if (vec) { // existing vec, build changed
                                        changedC.incrementAndGet();
                                        tasks.add(() -> fetchSmartTile(f, url, processed, updated, newC, changedC, sourceMissing, bytes, fails, consecFails, abortedF, planHolder[0]));
                                    } else { // existing satellite tile: verify, fetch in place if changed
                                        tasks.add(() -> {
                                            boolean fetched = false;
                                            if (!packCancel && !abortedF.get()) {
                                                Long va = verifiedAt(f);
                                                if (va != null && System.currentTimeMillis() - va.longValue() < VERIFIED_TTL_MS) {
                                                    fastC.incrementAndGet(); syncedC.incrementAndGet(); // 1.141: verified within 7 days — no server round-trip
                                                } else {
                                                    String et = headETag(url);
                                                    String stored = etagFor(f);
                                                    if (et == null || stored == null || "404".equals(stored)) unverifiable.incrementAndGet();
                                                    else if (!et.equals(stored)) {
                                                        changedC.incrementAndGet();
                                                        fetchSmartTile(f, url, processed, updated, newC, changedC, sourceMissing, bytes, fails, consecFails, abortedF, planHolder[0]);
                                                        fetched = true;
                                                    } else { recordVerified(f); syncedC.incrementAndGet(); }
                                                }
                                            }
                                            if (!fetched) {
                                                int d = processed.incrementAndGet();
                                                if (d % 25 == 0) pushSmartProgress(d, planHolder[0], updated.get());
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                planHolder[0] = planTotal;
                if (!abortedF.get() && !tasks.isEmpty() && !packCancel) {
                    java.util.concurrent.ExecutorService pool =
                            java.util.concurrent.Executors.newFixedThreadPool(10);
                    for (Runnable t : tasks) pool.execute(t);
                    pool.shutdown();
                    try { pool.awaitTermination(60, java.util.concurrent.TimeUnit.MINUTES); }
                    catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
            if (packDiscard) {
                synchronized (sessionFiles) {
                    for (File f : sessionFiles) f.delete();
                    sessionFiles.clear();
                }
            }
            saveTileETags();
            saveTileVerified();
            JSONObject o = new JSONObject();
            try {
                boolean aborted = abortedF.get();
                o.put("ok", !packCancel && !aborted);
                o.put("cancelled", packCancel);
                o.put("discarded", packDiscard);
                o.put("smart", true);
                o.put("tiles", planTotal);
                o.put("fresh", updated.get());
                o.put("fails", fails.get());
                o.put("ready", newC.get() + changedC.get());
                o.put("newTiles", newC.get());
                o.put("changedTiles", changedC.get());
                o.put("synced", syncedC.get());
                o.put("unverifiable", unverifiable.get());
                o.put("fast", fastC.get());
                o.put("sourceMissing", sourceMissing.get());
                o.put("baseline", baseline);
                if (!packCancel && !aborted) {
                    android.content.SharedPreferences sp = G.p(MainActivity.this);
                    JSONArray packs = new JSONArray(sp.getString("packs", "[]"));
                    JSONObject pk = new JSONObject();
                    pk.put("name", name); pk.put("lat", lat); pk.put("lng", lng);
                    pk.put("radiusKm", radiusKm); pk.put("at", System.currentTimeMillis());
                    pk.put("vecTpl", tplNow);
                    double mb = storedMb >= 0 ? storedMb : Math.round(bytes.get() / 104857.6) / 10.0;
                    pk.put("mb", mb);
                    String key = name + "|" + radiusKm + "|"
                            + Math.round(lat * 100) + "|" + Math.round(lng * 100);
                    JSONArray kept = new JSONArray();
                    for (int i = 0; i < packs.length(); i++) {
                        JSONObject e = packs.optJSONObject(i); if (e == null) continue;
                        String ek = e.optString("name") + "|" + e.optInt("radiusKm") + "|"
                                + Math.round(e.optDouble("lat") * 100) + "|" + Math.round(e.optDouble("lng") * 100);
                        if (!ek.equals(key)) kept.put(e);
                    }
                    kept.put(pk);
                    sp.edit().putString("packs", kept.toString()).apply();
                    o.put("mb", mb);
                }
            } catch (Exception ignored) {}
            pushJs("window.__onPackDone&&window.__onPackDone(" + o.toString() + ")");
        }

        private void pushSmartProgress(int done, int total, int updatedCount) {
            pushJs("window.__onPackProgress&&window.__onPackProgress({done:" + done
                    + ",total:" + total + ",updated:" + updatedCount + "})");
        }

        private void fetchSmartTile(File f, String url,
                java.util.concurrent.atomic.AtomicInteger processed,
                java.util.concurrent.atomic.AtomicInteger updated,
                java.util.concurrent.atomic.AtomicInteger newC,
                java.util.concurrent.atomic.AtomicInteger changedC,
                java.util.concurrent.atomic.AtomicInteger sourceMissing,
                java.util.concurrent.atomic.AtomicLong bytes,
                java.util.concurrent.atomic.AtomicInteger fails,
                java.util.concurrent.atomic.AtomicInteger consecFails,
                java.util.concurrent.atomic.AtomicBoolean abortedF,
                int planTotal) {
            if (!packCancel && !abortedF.get()) {
                long got = fetchTile(url, f);
                if (got >= 0) { bytes.addAndGet(got); updated.incrementAndGet(); consecFails.set(0);
                    synchronized (sessionFiles) { sessionFiles.add(f); } }
                else if (got == -2) { consecFails.set(0); sourceMissing.incrementAndGet(); }
                else { fails.incrementAndGet(); if (consecFails.incrementAndGet() >= 30) abortedF.set(true); }
            }
            int d = processed.incrementAndGet();
            if (d % 10 == 0) pushSmartProgress(d, planTotal, updated.get());
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
                                    if (f.exists() && f.length() > 0) { done++; continue; } // 1.65: vec used to skip on existence alone — a 0-byte shell saved in a flaky fetch was then skipped forever and rendered as a blank tile at deep zoom
                                    String url = vec
                                            ? tpl.replace("{z}", "" + z).replace("{x}", "" + x).replace("{y}", "" + y)
                                            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
                                    long got = fetchTile(url, f);
                                    if (got >= 0) { consecFails = 0; fresh++;
                                        synchronized (sessionFiles) { sessionFiles.add(f); } }
                                    else if (got == -2) { consecFails = 0; } // 1.136: a 404 proves the connection works — it must never trip the failure abort
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
            for (int z = 7; z <= 18; z++) {
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
        if (path.endsWith(".mp3")) return "audio/mpeg";
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
       z14 within 25 km, z15 within 10 km — so deep zoom stays readable (1.33).
       1.123: building-level detail z16-18 within 2 km of the centre — Esri serves
       native imagery there (measured ~2.3x the detail of an upscaled parent). */
    static double radiusForZSAT(int radiusKm, int z) {
        if (z == 14) return Math.min(radiusKm, 25);
        if (z == 15) return Math.min(radiusKm, 10);
        if (z >= 16) return Math.min(radiusKm, 2);
        return radiusForZ(radiusKm, z);
    }

    private int countTiles(double lat, double lng, int radiusKm, boolean vec) {
        int t = 0;
        int zMax = vec ? 13 : 18;
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
            c.setRequestProperty("Accept-Encoding", "identity"); // 1.67: server declares the gzip-compressed length (631) while the stream delivers the raw tile (729) — transparent gzip made the 1.66 length check fail every tile and abort packs
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

    /* 1.137: one automatic retry for transient failures — on a flaky
       connection a single dropped fetch used to fail a tile until the
       next manual run. 404s are definitive and never retried. */
    private long fetchTile(String url, File dest) {
        long r = fetchTileOnce(url, dest);
        if (r == -1) {
            try { Thread.sleep(700); } catch (Exception ignored) {}
            r = fetchTileOnce(url, dest);
        }
        return r;
    }

    private long fetchTileOnce(String url, File dest) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(12000); c.setReadTimeout(12000);
            c.setRequestProperty("User-Agent", "AlHaris-Guardian/1.28 (free offline safety maps)");
            c.setRequestProperty("Accept-Encoding", "identity"); // 1.67: same as fetchTile
            int rc = c.getResponseCode();
            if (rc != 200) { if (rc == 404) { recordTile404(dest); return -2; } return -1; } // 1.136: -2 = the source simply has no such tile (desert zooms beyond Esri/OSM coverage) — recorded so checks skip it forever
            final String etagHdr = c.getHeaderField("ETag"); // 1.133: sat-tile fingerprint for smart updates
            long declared = c.getContentLengthLong();
            dest.getParentFile().mkdirs();
            File tmp = new File(dest.getPath() + ".tmp");
            InputStream in = c.getInputStream();
            FileOutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[8192]; int r; long total = 0;
            while ((r = in.read(buf)) > 0) { out.write(buf, 0, r); total += r; }
            out.close(); in.close();
            // 1.66: a connection that dies mid-body ends the stream quietly —
            // without this check the truncated half-tile was saved as complete
            // and rendered as a permanently blank map tile (undecodable .pbf).
            if (declared > 0 && total != declared) { tmp.delete(); return -1; }
            // 1.65: an empty body is a FAILED fetch, never a tile — a 0-byte
            // .pbf saved as "done" renders as a permanently blank map tile.
            if (total == 0 && !dest.getPath().contains("/tiles/vec/")) { tmp.delete(); return -1; } // 1.137: a 0-byte VECTOR tile is a legitimate empty tile (nothing mapped there — measured: exactly the 13 perpetually failing z13 desert tiles); sat/glyph empties stay failures. A mid-body drop is still caught by the declared-length check above or by an exception.
            if (!tmp.renameTo(dest)) { tmp.delete(); return -1; }
            if (etagHdr != null) recordTileETag(dest, etagHdr); // 1.133
            if (dest.getPath().contains("/tiles/sat/")) recordVerified(dest); // 1.141: freshly fetched = verified now
            else if (total == 0) recordTileETag(dest, "EMPTY"); // 1.137: a deliberately saved empty vec tile
            return total;

        } catch (Exception e) { return -1; }
        finally { if (c != null) c.disconnect(); }
    }

    /* ---- Tile fingerprints (1.133): ETags of satellite tiles, recorded at
       fetch time so a later smart update can verify each tile with a HEAD
       request instead of re-downloading it. ---- */
    private java.util.Map<String, String> tileETags = null;

    private synchronized java.util.Map<String, String> etagMap() {
        if (tileETags == null) {
            tileETags = new java.util.HashMap<>();
            try {
                File f = new File(getFilesDir(), "tile-etags.json");
                if (f.exists()) {
                    java.io.FileInputStream in = new java.io.FileInputStream(f);
                    byte[] buf = new byte[(int) f.length()];
                    int off = 0, r;
                    while ((r = in.read(buf, off, buf.length - off)) > 0) off += r;
                    in.close();
                    JSONObject o = new JSONObject(new String(buf, "UTF-8"));
                    java.util.Iterator<String> it = o.keys();
                    while (it.hasNext()) { String k = it.next(); tileETags.put(k, o.optString(k)); }
                }
            } catch (Exception ignored) {}
        }
        return tileETags;
    }

    private static String etagKeyFor(File dest) {
        String pp = dest.getPath();
        int i = pp.indexOf("/tiles/sat/");
        if (i >= 0) return "sat/" + pp.substring(i + 11).replace(".jpg", "");
        i = pp.indexOf("/tiles/vec/");
        if (i >= 0) return "vec/" + pp.substring(i + 11).replace(".pbf", "");
        return null;
    }

    /* 1.136: tiles the source answered 404 for are remembered under the
       sentinel etag "404" so future checks/downloads skip them at once. */
    private void recordTile404(File dest) {
        String k = etagKeyFor(dest);
        if (k == null) return;
        synchronized (etagMap()) { etagMap().put(k, "404"); }
    }

    private void recordTileETag(File dest, String etag) {
        String k = etagKeyFor(dest);
        if (k == null) return;
        synchronized (etagMap()) { etagMap().put(k, etag); }
    }

    private String etagFor(File dest) {
        String k = etagKeyFor(dest);
        if (k == null) return null;
        synchronized (etagMap()) { return etagMap().get(k); }
    }

    /* 1.141: satellite verification cache (approved by Hilal in the
       1.140 audit). Esri offers no change feed, so a smart check HEADs
       every fingerprinted sat tile — minutes on a 500 km pack. A tile
       whose HEAD matched, or which was freshly fetched, within the
       last 7 days is trusted without asking the server. The first
       check on a device still verifies everything once and plants
       the stamps; a failed HEAD never plants one. */
    private java.util.Map<String, Long> verifiedMap;
    private volatile boolean verifiedDirty;
    private static final long VERIFIED_TTL_MS = 7L * 24 * 3600 * 1000;
    private synchronized java.util.Map<String, Long> verifiedMap() {
        if (verifiedMap == null) {
            verifiedMap = new java.util.HashMap<>();
            try {
                File f = new File(getFilesDir(), "tile-verified.json");
                if (f.isFile()) {
                    byte[] b = new byte[(int) f.length()];
                    java.io.FileInputStream in = new java.io.FileInputStream(f);
                    int off = 0;
                    while (off < b.length) { int r = in.read(b, off, b.length - off); if (r < 0) break; off += r; }
                    in.close();
                    JSONObject o = new JSONObject(new String(b, "UTF-8"));
                    java.util.Iterator<String> it = o.keys();
                    while (it.hasNext()) { String k = it.next(); verifiedMap.put(k, o.optLong(k, 0)); }
                }
            } catch (Exception ignored) {}
        }
        return verifiedMap;
    }
    private Long verifiedAt(File dest) {
        String k = etagKeyFor(dest);
        if (k == null) return null;
        synchronized (verifiedMap()) { return verifiedMap().get(k); }
    }
    private void recordVerified(File dest) {
        String k = etagKeyFor(dest);
        if (k == null) return;
        synchronized (verifiedMap()) { verifiedMap().put(k, System.currentTimeMillis()); }
        verifiedDirty = true;
    }
    private void saveTileVerified() {
        if (!verifiedDirty) return;
        try {
            java.util.Map<String, Long> m;
            synchronized (verifiedMap()) { m = new java.util.HashMap<>(verifiedMap()); }
            JSONObject o = new JSONObject();
            for (java.util.Map.Entry<String, Long> e : m.entrySet())
                o.put(e.getKey(), e.getValue().longValue());
            File f = new File(getFilesDir(), "tile-verified.json");
            java.io.FileOutputStream out = new java.io.FileOutputStream(f);
            out.write(o.toString().getBytes("UTF-8"));
            out.close();
            verifiedDirty = false;
        } catch (Exception ignored) {}
    }

    private void saveTileETags() {
        try {
            java.util.Map<String, String> m;
            synchronized (etagMap()) { m = new java.util.HashMap<>(etagMap()); }
            JSONObject o = new JSONObject(m);
            File f = new File(getFilesDir(), "tile-etags.json");
            java.io.FileOutputStream out = new java.io.FileOutputStream(f);
            out.write(o.toString().getBytes("UTF-8"));
            out.close();
        } catch (Exception ignored) {}
    }

    private String headETag(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod("HEAD");
            c.setConnectTimeout(8000); c.setReadTimeout(8000);
            c.setRequestProperty("User-Agent", "AlHaris-Guardian/1.133 (smart map update check)");
            if (c.getResponseCode() != 200) return null;
            return c.getHeaderField("ETag");
        } catch (Exception e) { return null; }
        finally { /* 1.136: no disconnect() — the runtime pools the connection, so the next HEAD to the same host reuses it instead of a fresh TLS handshake */ }
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
