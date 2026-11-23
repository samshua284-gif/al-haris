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
        if (G.armed(c) || G.safePending(c) || G.salawatOn(c)) {
            Intent s = new Intent(c, WatchService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
            else c.startService(s);
        }
    }
}
