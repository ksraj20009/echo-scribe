# Native build Dockerfile for whisper.cpp and ggml (Android ABIs)
# Usage: build the docker image and run it to produce native .so libraries for Android.
# The container expects an output directory mounted at /out where it will place built .so files

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential cmake wget unzip ca-certificates python3 python3-pip pkg-config libsndfile1-dev \
    && rm -rf /var/lib/apt/lists/*

# Set NDK version to download
ENV ANDROID_NDK_VERSION=r25b
ENV ANDROID_SDK_TOOLS=commandlinetools-linux-9477386_latest.zip
ENV NDK_ROOT=/opt/android-ndk
ENV ANDROID_HOME=/opt/android-sdk

# Download Android NDK and SDK commandline tools
RUN mkdir -p /opt && cd /opt \
    && wget -q https://dl.google.com/android/repository/android-ndk-${ANDROID_NDK_VERSION}-linux.zip -O android-ndk.zip \
    && unzip android-ndk.zip -d /opt && rm android-ndk.zip \
    && mv /opt/android-ndk-${ANDROID_NDK_VERSION} ${NDK_ROOT} || true \
    && mkdir -p ${ANDROID_HOME}/cmdline-tools && cd ${ANDROID_HOME}/cmdline-tools \
    && wget -q https://dl.google.com/android/repository/${ANDROID_SDK_TOOLS} -O sdk-tools.zip \
    && unzip sdk-tools.zip -d ${ANDROID_HOME}/cmdline-tools && rm sdk-tools.zip || true

# Environment for android toolchain
ENV PATH="${NDK_ROOT}:$PATH"

# Workdir
WORKDIR /build

# Clone whisper.cpp and build for arm64-v8a and armeabi-v7a
# The script below will run on container start
COPY build_whisper.sh /build/build_whisper.sh
RUN chmod +x /build/build_whisper.sh

# Default output mount
VOLUME ["/out"]

CMD ["/build/build_whisper.sh"]
