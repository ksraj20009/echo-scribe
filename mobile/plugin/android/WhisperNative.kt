package com.echoscribe.whisper

class WhisperNative {
    companion object {
        init {
            // Expect the native library to be named libwhisper.so
            System.loadLibrary("whisper")
        }
    }

    external fun transcribeFile(path: String): String
    external fun transcribeBuffer(buffer: ByteArray): String
}
