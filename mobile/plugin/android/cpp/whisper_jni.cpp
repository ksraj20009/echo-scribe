// JNI stub for whisper native bindings (C++)
// Place this file in your NDK project and implement the bridge to the whisper/ggml APIs.

#include <jni.h>
#include <string>

extern "C" JNIEXPORT jstring JNICALL
Java_com_echoscribe_whisper_WhisperNative_transcribeFile(JNIEnv* env, jobject /* this */, jstring jpath) {
    const char* path = env->GetStringUTFChars(jpath, 0);
    std::string result = ""; // TODO: call the native whisper/ggml transcribe API on 'path'

    // Example placeholder response until you implement the native call
    result = std::string("(native stub) received file: ") + path;

    env->ReleaseStringUTFChars(jpath, path);
    return env->NewStringUTF(result.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_echoscribe_whisper_WhisperNative_transcribeBuffer(JNIEnv* env, jobject /* this */, jbyteArray jbuf) {
    jsize len = env->GetArrayLength(jbuf);
    jbyte* bytes = env->GetByteArrayElements(jbuf, NULL);

    // TODO: convert bytes to audio buffer and run transcription via whisper/ggml
    std::string result = std::string("(native stub) buffer length: ") + std::to_string(len);

    env->ReleaseByteArrayElements(jbuf, bytes, JNI_ABORT);
    return env->NewStringUTF(result.c_str());
}
