# Native build README

This directory contains a Docker-based reproducible build for native Android libraries (whisper.cpp / ggml) used by the EchoScribe mobile app.

Purpose
- Produce shared libraries (.so) for Android ABIs (arm64-v8a and armeabi-v7a) that can be bundled into an Android app's jniLibs folder.

Prerequisites
- Docker installed locally
- Sufficient disk space (several hundred MB) and CPU

How to build
1. Create an output directory on your host where built libraries will be placed:

   mkdir -p mobile/native-libs

2. Build the Docker image:

   docker build -t echoscribe-native-build mobile/native-build

3. Run the container, mounting the output directory as /out:

   docker run --rm -v "$(pwd)/mobile/native-libs:/out" echoscribe-native-build

4. After the container exits, you should find ABI subdirectories with .so files in mobile/native-libs

Notes
- This build script is a best-effort scaffold. Building C++ libraries cross-compiled for Android may require tweaks depending on the whisper.cpp fork, NDK version, and dependencies. If you hit errors, inspect the container logs and adjust CMake options.
- The produced libraries should be copied into android/app/src/main/jniLibs/<abi>/ before building the APK.
