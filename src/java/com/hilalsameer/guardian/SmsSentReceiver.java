package com.hilalsameer.guardian;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives the radio-level send result for a fired SOS (1.52): tells us WHY
    a send was rejected (no service, generic failure, limit, radio off...)
    instead of leaving the panel to guess for 3 minutes. */
public class SmsSentReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        int code = getResultCode();
        G.onSentResult(c, code == Activity.RESULT_OK, code);
    }
}
