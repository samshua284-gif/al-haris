package com.hilalsameer.guardian;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Salawat alarm mode (1.111): one wake-up per interval while the app is
 *  swiped away — plays the clip, stamps the time, re-arms the next one.
 *  When the app is reopened, WatchService cancels the pending alarm and
 *  its own heartbeat takes over again. */
public class SalawatAlarm extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (!G.salawatOn(c)) return;
        G.setSalawatLast(c, System.currentTimeMillis());
        G.playSalawatClip(c);
        G.scheduleSalawatAlarm(c);
    }
}
