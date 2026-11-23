package com.hilalsameer.guardian;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Latched arming survives reboot: if an SOS was armed (or a safe-message queued),
 *  the watcher restarts itself after boot and keeps its promise. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (G.armed(c) || G.safePending(c)) {
            Intent s = new Intent(c, WatchService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
            else c.startService(s);
        }
    }
}
