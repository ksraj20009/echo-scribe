#!/usr/bin/env bash
set -e
# build_whisper.sh - run inside the native-build container
# This script clones whisper.cpp (ggml) and attempts to build shared libraries for Android ABIs.

OUT_DIR=/out
NDK_ROOT=${NDK_ROOT:-/opt/android-ndk}
BUILD_DIR=/build/whisper-build
REPO=https://github.com/ggerganov/whisper.cpp.git

mkdir -p ${OUT_DIR}
rm -rf ${BUILD_DIR}
mkdir -p ${BUILD_DIR}
cd ${BUILD_DIR}

echo "Cloning whisper.cpp..."
if [ ! -d whisper.cpp ]; then
  git clone --depth 1 ${REPO}
else
  cd whisper.cpp && git pull && cd ..
fi

cd whisper.cpp

# Build shared library for each ABI
ABIS=("arm64-v8a" "armeabi-v7a")
for ABI in "${ABIS[@]}"; do
  echo "Building for ABI: ${ABI}"
  BUILD_ABI_DIR=build-${ABI}
  rm -rf ${BUILD_ABI_DIR}
  mkdir -p ${BUILD_ABI_DIR}
  cd ${BUILD_ABI_DIR}
  cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DANDROID_ABI=${ABI} \
    -DANDROID_PLATFORM=android-21 \
    -DCMAKE_TOOLCHAIN_FILE=${NDK_ROOT}/build/cmake/android.toolchain.cmake \
    -DWHISPER_BUILD_EXAMPLES=OFF \
    -DWHISPER_BUILD_TESTS=OFF \
    -DBUILD_SHARED_LIBS=ON
  make -j"$(nproc)"

  # Copy any produced .so into the output directory under ABI
  mkdir -p ${OUT_DIR}/${ABI}
  find . -type f -name "lib*.so" -exec cp -v {} ${OUT_DIR}/${ABI}/ \; || true
  cd ..
done

# If build artifacts exist at other expected locations, try to copy them
# (tolerant script; on some forks the library names differ)
echo "Build finished. Output in ${OUT_DIR}"
ls -la ${OUT_DIR}
