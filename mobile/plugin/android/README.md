# Android Capacitor plugin stubs for on-device Whisper (JNI) — Quick start

This directory provides Kotlin and JNI stubs you can copy into your Capacitor Android project to expose native on‑device Whisper/ggml transcription to the web layer.

Goal
- Provide ready-to-paste Kotlin + JNI stubs that load a native `libwhisper.so` (or similar) and expose two methods to JS:
  - transcribeFile({ path }) -> { text }
  - transcribeBuffer({ base64 }) -> { text }

What you must do locally
1. Produce native .so libraries (see mobile/native-build/run_build.sh). Place them in your Android app under:
   android/app/src/main/jniLibs/arm64-v8a/libwhisper.so
   android/app/src/main/jniLibs/armeabi-v7a/libwhisper.so

2. Copy these Kotlin files into your Android app Java/Kotlin source tree, e.g.:
   android/app/src/main/java/com/echoscribe/whisper/WhisperPlugin.kt
   android/app/src/main/java/com/echoscribe/whisper/WhisperNative.kt

3. Copy the JNI C++ file into a jni/ or cpp/ build area if you plan to build the native wrapper as part of the Android NDK build, or keep it as reference and adapt to your native build system.

4. Build the Android project in Android Studio. The plugin uses Capacitor's Plugin API. If the plugin class isn't auto-registered, add it to your MainActivity as described in Capacitor docs.

Notes
- The C++ file here is a stub to compile against; you must adapt it to call into the actual whisper/ggml APIs available in your chosen native library.
- JNI and native library names must match: System.loadLibrary("whisper") expects libwhisper.so.
- This is a developer-focused scaffold — adjust package names and Gradle settings as needed.
