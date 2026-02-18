#!/usr/bin/env bash
# Build the Kokoro TTS CPU base image (kokoro-tts-cpu:local)
#
# This creates a Docker image with:
#   - Python 3.11 + PyTorch (CPU) + Kokoro dependencies
#   - Kokoro v1.0 model weights (~330MB from HuggingFace)
#   - All 67 voice files
#   - ffmpeg for MP3 encoding
#
# Requirements: Docker, ~4GB disk space, internet connection
# Time: 5-15 minutes depending on connection speed
#
# Usage:
#   bash build-base-image.sh
#
# The resulting image (kokoro-tts-cpu:local) is used by docker-compose.yml

set -euo pipefail

IMAGE_NAME="kokoro-tts-cpu:local"
BUILD_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

echo "=== Building Kokoro TTS Base Image ==="
echo "Build directory: $BUILD_DIR"
echo ""

# Check Docker is available
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed or not in PATH"
  exit 1
fi

# Check if image already exists
if docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Image $IMAGE_NAME already exists."
  if [[ -t 0 ]] && [[ "${1:-}" != "--force" ]]; then
    read -p "Rebuild? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Keeping existing image."
      exit 0
    fi
  else
    echo "Non-interactive mode or --force flag: rebuilding."
  fi
fi

# Create Dockerfile for base image
cat > "$BUILD_DIR/Dockerfile" << 'DOCKERFILE'
FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CPU and Kokoro dependencies
RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir \
    kokoro>=0.8 \
    soundfile \
    numpy \
    ordered_set

# Clone Kokoro repo for model and voice files
RUN git clone --depth 1 https://github.com/hexgrad/kokoro.git /tmp/kokoro

# Create directory structure matching expected paths
RUN mkdir -p /app/api/src/models/v1_0 /app/api/src/voices/v1_0

# Download model weights from HuggingFace
RUN pip install --no-cache-dir huggingface_hub && \
    python3 -c "from huggingface_hub import hf_hub_download; \
    hf_hub_download('hexgrad/Kokoro-82M', 'kokoro-v1_0.pth', \
    local_dir='/app/api/src/models/v1_0')"

# Download voice files from HuggingFace (repo may use voices/*.pt or voices/v1_0/*.pt)
RUN python3 -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('hexgrad/Kokoro-82M', \
    allow_patterns='voices/*.pt', \
    local_dir='/tmp/kokoro-files')" && \
    find /tmp/kokoro-files/voices -name '*.pt' -exec cp {} /app/api/src/voices/v1_0/ \; && \
    rm -rf /tmp/kokoro-files

# Cleanup (keep huggingface_hub — runtime dependency of kokoro via transformers)
RUN rm -rf /tmp/kokoro && \
    pip cache purge

EXPOSE 7880
DOCKERFILE

echo "Building Docker image (this may take 5-15 minutes)..."
echo ""

docker build -t "$IMAGE_NAME" "$BUILD_DIR"

echo ""
echo "=== Build Complete ==="
echo "Image: $IMAGE_NAME"
echo ""

# Verify
echo "Verification:"
docker run --rm "$IMAGE_NAME" python3 -c "
from kokoro import KPipeline
import os
model = '/app/api/src/models/v1_0/kokoro-v1_0.pth'
vdir = '/app/api/src/voices/v1_0'
voices = [f.replace('.pt','') for f in os.listdir(vdir) if f.endswith('.pt')]
print(f'  Model exists: {os.path.exists(model)}')
print(f'  Voices found: {len(voices)}')
print(f'  Sample voices: {voices[:5]}')
print('  KPipeline importable: True')
" && echo "  Status: READY" || echo "  Status: FAILED (check errors above)"
