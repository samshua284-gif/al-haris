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

/** The tireless watcher: keeps location warm, catches the first flicker, looses the bow. */
public class WatchService extends Service {
    private Handler h = new Handler(Looper.getMainLooper());
    private LocationManager lm;
    private boolean wasNoService = false;

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
            if (svc && wasNoService) G.logWhisper(WatchService.this, "لمعة");
            if (!svc) wasNoService = true; else wasNoService = false;
            G.tryFire(WatchService.this);
            updateNotification();
            h.postDelayed(this, armed ? 8000 : 30000);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(7, buildNotification("الحارس يراقب"));
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
                        G.tryFire(WatchService.this);
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

    private Notification buildNotification(String text) {
        PendingIntent pi = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, "guard")
            .setContentTitle("الحارس")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pi)
            .build();
    }

    private void updateNotification() {
        String t;
        if (G.armed(this) && !G.delivered(this)) t = "الاستغاثة مُسلَّحة — أراقب الإشارة";
        else if (G.armed(this) && G.delivered(this)) t = "وصلت رسالة الاستغاثة ✓";
        else if (G.safePending(this)) t = "رسالة الطمأنة تنتظر إشارة";
        else t = "الحارس يراقب";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(7, buildNotification(t));
    }

    @Override public int onStartCommand(Intent i, int flags, int id) { return START_STICKY; }
    @Override public void onDestroy() { h.removeCallbacks(tick); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
