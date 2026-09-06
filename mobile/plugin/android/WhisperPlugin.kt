package com.echoscribe.whisper

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject

@CapacitorPlugin(name = "WhisperPlugin")
class WhisperPlugin : Plugin() {

    private val native = WhisperNative()

    @android.webkit.JavascriptInterface
    fun transcribeFile(call: PluginCall) {
        val path = call.getString("path") ?: ""
        try {
            val text = native.transcribeFile(path)
            val ret = JSObject()
            ret.put("text", text)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Transcription failed: ${e.message}")
        }
    }

    @android.webkit.JavascriptInterface
    fun transcribeBuffer(call: PluginCall) {
        val b64 = call.getString("base64") ?: ""
        try {
            val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
            val text = native.transcribeBuffer(bytes)
            val ret = JSObject()
            ret.put("text", text)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Transcription failed: ${e.message}")
        }
    }
}
