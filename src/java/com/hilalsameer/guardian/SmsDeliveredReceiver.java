package com.hilalsameer.guardian;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives the carrier's SMS delivery report for a fired SOS (1.50). */
public class SmsDeliveredReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        G.onDeliveryReport(c, getResultCode() == Activity.RESULT_OK);
    }
}
