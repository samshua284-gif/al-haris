package com.hilalsameer.guardian;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** The watcher survives reboot: if an SOS was armed (or a safe-message
 *  queued) — or the salawat reminder is on (1.101, from the full audit:
 *  the background prayer rides this same service and used to stay dead
 *  after a reboot until the app was opened once) — it restarts itself. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        // 1.200 (Hilal's field report, 2026-11-27 18:48): after a phone
        // restart the system showed "the Guardian keeps stopping". The
        // only Guardian code that runs at boot is this receiver, and its
        // one fragile act is starting the location-type WatchService
        // from a background (boot) context: on Android 14 the platform
        // refuses that start without background-location permission,
        // which the Guardian deliberately does not hold, and the refusal
        // exception crashed the app at every boot. The start is now
        // guarded: a refused start can no longer crash anything — the
        // watcher simply resumes the next time the app is opened.
        try {
            if (G.armed(c) || G.safePending(c) || G.salawatOn(c)) {
                Intent s = new Intent(c, WatchService.class);
                if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
                else c.startService(s);
            }
        } catch (Exception ignored) {}
    }
}
