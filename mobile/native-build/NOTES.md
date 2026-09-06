I added a Docker-based native build scaffold to produce Android shared libraries (.so) for whisper.cpp / ggml. Run `mobile/native-build/run_build.sh` locally (requires Docker) to build libraries into `mobile/native-libs/` which you can then copy into your Android project's `jniLibs`.

This is a reproducible starting point — cross-compilation may require adjustments depending on the particular whisper.cpp fork and NDK behavior. See `mobile/native-build/README.md` for details.
