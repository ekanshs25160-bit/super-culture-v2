package com.superculture.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StreamProxyPlugin.class);
        super.onCreate(savedInstanceState);
        LocalStreamProxy.start(this);
    }

    @Override
    public void onDestroy() {
        LocalStreamProxy.stop();
        super.onDestroy();
    }
}
