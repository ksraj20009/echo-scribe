#!/usr/bin/env bash
# Host helper script to run the Docker-based native build and list outputs
set -e
mkdir -p mobile/native-libs
docker build -t echoscribe-native-build mobile/native-build
docker run --rm -v "$(pwd)/mobile/native-libs:/out" echoscribe-native-build

echo "Built artifacts:" 
ls -la mobile/native-libs || true
