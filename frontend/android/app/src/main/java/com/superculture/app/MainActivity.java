package com.superculture.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StreamProxyPlugin.class);
        super.onCreate(savedInstanceState);
        LocalStreamProxy.start(this);

        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                int currentZoom = settings.getTextZoom();
                settings.setTextZoom(Math.min(currentZoom, 115));
            }
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "Failed to adjust webView text zoom: " + e.getMessage());
        }

        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1002);
            }
        }
    }

    @Override
    public void onDestroy() {
        LocalStreamProxy.stop();
        super.onDestroy();
    }
}
