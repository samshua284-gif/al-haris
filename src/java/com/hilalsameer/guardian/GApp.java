package com.hilalsameer.guardian;

import android.app.Application;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileWriter;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

/** 1.201 diagnostic (Hilal's boot-crash report, 2026-11-27): the
 *  "keeps stopping" dialog after every restart survived the guarded
 *  boot start of 1.200, so the crash is NOT (only) the receiver's
 *  start call. Rather than guess a second time, this Application
 *  class installs a crash recorder before any component runs: the
 *  first uncaught exception in the process is written, with its
 *  full stack trace, to last_crash.txt in the app's files dir, and
 *  a copy is exported to public Downloads as
 *  guardian-last-crash.txt so the owner can forward it. The
 *  previous handler still runs afterwards, so the system's own
 *  crash behaviour is unchanged. */
public class GApp extends Application {
    @Override public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try {
                StringWriter sw = new StringWriter();
                e.printStackTrace(new PrintWriter(sw));
                String body = "Guardian crash " + new java.util.Date().toString()
                        + " on thread " + t.getName() + "\n" + sw.toString();
                FileWriter w = new FileWriter(new File(getFilesDir(), "last_crash.txt"), false);
                w.write(body);
                w.close();
            } catch (Exception ignored) {}
            if (prev != null) prev.uncaughtException(t, e);
        });
        exportCrashCopy();
    }

    /* Copy a recorded crash (if any) to public Downloads for the
       owner to forward, then clear the internal record so a stale
       trace is never mistaken for a new crash. */
    public void exportCrashCopy() {
        try {
            File f = new File(getFilesDir(), "last_crash.txt");
            if (!f.exists()) return;
            java.util.Scanner sc = new java.util.Scanner(f, "UTF-8").useDelimiter("\\A");
            String body = sc.hasNext() ? sc.next() : "";
            sc.close();
            if (body.isEmpty()) { f.delete(); return; }
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, "guardian-last-crash.txt");
                v.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                ContentResolver cr = getContentResolver();
                Uri u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (u != null) {
                    OutputStream os = cr.openOutputStream(u);
                    if (os != null) { os.write(body.getBytes("UTF-8")); os.close(); }
                }
            }
            f.delete();
        } catch (Exception ignored) {}
    }
}
