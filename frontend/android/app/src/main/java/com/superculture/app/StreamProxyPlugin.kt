package com.superculture.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "StreamProxy")
class StreamProxyPlugin : Plugin() {

    @PluginMethod
    fun getProxyPort(call: PluginCall) {
        val port = LocalStreamProxy.port
        val ret = JSObject()
        ret.put("port", port)
        call.resolve(ret)
    }

    @PluginMethod
    fun startForegroundService(call: PluginCall) {
        val title = call.getString("title", "Super Culture") ?: "Super Culture"
        val artist = call.getString("artist", "Playing Audio") ?: "Playing Audio"
        context?.let { ctx ->
            MediaPlaybackService.start(ctx, title, artist)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopForegroundService(call: PluginCall) {
        context?.let { ctx ->
            MediaPlaybackService.stop(ctx)
        }
        call.resolve()
    }
}
