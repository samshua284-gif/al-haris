package com.hilalsameer.guardian;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telephony.PhoneStateListener;
import android.telephony.ServiceState;
import android.telephony.TelephonyManager;
import android.content.res.AssetFileDescriptor;
import android.media.MediaPlayer;

/** The tireless watcher: keeps location warm, catches the first flicker, looses the bow. */
public class WatchService extends Service {
    private Handler h = new Handler(Looper.getMainLooper());
    private LocationManager lm;
    private MediaPlayer salPlayer;
    private boolean wasNoService = false;
    /* 1.179: a flicker the accuracy gate refused (fix coarser than 300 m)
       stays pending — retried on later ticks while the service lasts, so
       the pin is planted by the first good fix instead of being lost. */
    private boolean whisperPending = false;
    private long whisperPendingSince = 0;

    private final LocationListener locListener = new LocationListener() {
        @Override public void onLocationChanged(Location l) { G.saveFix(WatchService.this, l); }
        @Override public void onStatusChanged(String p, int s, Bundle e) {}
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {}
    };

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            boolean armed = G.armed(WatchService.this);
            boolean svc = G.hasService(WatchService.this);
            if (svc && (wasNoService || whisperPending)) {
                if (G.logWhisper(WatchService.this, "لمعة")) { whisperPending = false; }
                else {
                    if (!whisperPending) whisperPendingSince = System.currentTimeMillis();
                    whisperPending = System.currentTimeMillis() - whisperPendingSince < 900000L;
                }
            }
            if (!svc) { wasNoService = true; whisperPending = false; } else wasNoService = false;
            // 1.204: no tryFire here — under Hilal's reopened SOS spec
            // (one message, at the press only, never automatically)
            // nothing in the app sends without a press; the watcher
            // only watches, logs flickers and minds the salawat.
            updateNotification();
            h.postDelayed(this, armed ? 8000 : 30000);
        }
    };

    /* Salawat (1.97): 60 s heartbeat; plays the chosen clip when the
       configured interval (5/10/15/30 min) has elapsed and the UI is away.
       UI presence is freshness-checked, so a killed app can never mute
       the watcher forever. */
    private final Runnable salawatTick = new Runnable() {
        @Override public void run() {
            try {
                if (G.salawatOn(WatchService.this) && !G.uiAliveFresh(WatchService.this)) {
                    long now = System.currentTimeMillis();
                    if (now - G.salawatLast(WatchService.this) >= G.salawatMin(WatchService.this) * 60000L) {
                        G.setSalawatLast(WatchService.this, now);
                        playSalawat();
                    }
                }
            } catch (Exception ignored) {}
            h.postDelayed(this, 60000);
        }
    };

    private void playSalawat() {
        try {
            if (salPlayer != null) { salPlayer.release(); salPlayer = null; }
            AssetFileDescriptor afd = getAssets().openFd("www/salawat2.mp3");
            final MediaPlayer mp = new MediaPlayer();
            salPlayer = mp;
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mp.setOnCompletionListener(m -> {
                try { m.release(); } catch (Exception ignored) {}
                if (salPlayer == m) salPlayer = null;
            });
            mp.prepare();
            mp.start();
        } catch (Exception ignored) {}
    }

    @Override public void onCreate() {
        super.onCreate();
        G.cancelSalawatAlarm(this);
        h.postDelayed(salawatTick, 60000);
        createChannel();
        startForeground(7, buildNotification(en() ? "The Guardian is watching" : "الحارس يراقب"));
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 30000, 10, locListener, Looper.getMainLooper());
        } catch (Exception ignored) {}
        try {
            lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 60000, 25, locListener, Looper.getMainLooper());
        } catch (Exception ignored) {}
        try {
            TelephonyManager tm = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            tm.listen(new PhoneStateListener() {
                @Override public void onServiceStateChanged(ServiceState ss) {
                    if (ss != null && ss.getState() == ServiceState.STATE_IN_SERVICE) {
                        G.logWhisper(WatchService.this, "لمعة");
                        // 1.204: the flicker is logged, never fired —
                        // sends happen only at a button press.
                    }
                }
            }, PhoneStateListener.LISTEN_SERVICE_STATE);
        } catch (Exception ignored) {}
        h.post(tick);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel(
                "guard", "الحارس", NotificationManager.IMPORTANCE_LOW));
        }
    }

    /* 1.138: the persistent notification follows the UI language. */
    private boolean en() {
        try { return "en".equals(G.p(this).getString("uiLang", "ar")); }
        catch (Exception e) { return false; }
    }

    private Notification buildNotification(String text) {
        PendingIntent pi = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, "guard")
            .setContentTitle(en() ? "The Guardian" : "الحارس")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pi)
            .build();
    }

    private void updateNotification() {
        String t;
        boolean en = en();
        if (G.armed(this) && !G.delivered(this)) t = en ? "SOS armed — watching the signal" : "الاستغاثة مُسلَّحة — أراقب الإشارة";
        else if (G.armed(this) && G.delivered(this)) t = en ? "The SOS message arrived ✓" : "وصلت رسالة الاستغاثة ✓";
        else if (G.safePending(this)) t = en ? "The I-am-fine message is waiting for signal" : "رسالة الطمأنة تنتظر إشارة";
        else t = en ? "The Guardian is watching" : "الحارس يراقب";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(7, buildNotification(t));
    }

    @Override public int onStartCommand(Intent i, int flags, int id) { return START_STICKY; }

    /* 1.111: swiping the app away from Recents stops the background watch
       too (Hilal's order) — unless an SOS state needs the watcher, which
       outranks tidiness. The salawat hands over to alarm mode so it still
       arrives with no permanent background presence. Pressing Home or
       locking the screen does NOT fire this: the watch stays, as before. */
    @Override public void onTaskRemoved(Intent rootIntent) {
        if (!G.armed(this) && !G.safePending(this)) {
            if (G.salawatOn(this)) G.scheduleSalawatAlarm(this);
            stopForeground(true);
            stopSelf();
        }
        super.onTaskRemoved(rootIntent);
    }
    @Override public void onDestroy() {
        h.removeCallbacks(tick);
        h.removeCallbacks(salawatTick);
        if (salPlayer != null) { try { salPlayer.release(); } catch (Exception ignored) {} salPlayer = null; }
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent i) { return null; }
}
