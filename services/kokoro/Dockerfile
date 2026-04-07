# Start from the working CPU image — all complex deps (kokoro, misaki, spacy, etc.) are pre-installed.
# We just replace the CPU-only torch with a CUDA 12.8 build that supports RTX 5070 Ti (Blackwell sm_120).
FROM ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.1

# Install CUDA runtime libraries needed by PyTorch GPU
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcuda1 \
    && rm -rf /var/lib/apt/lists/* 2>/dev/null || true

# Swap torch: CPU → CUDA 12.8 with Blackwell (sm_120) support.
# UV_HTTP_TIMEOUT=600 gives each large NVIDIA package (cublas ~566MB, cudnn ~627MB) enough time.
USER root
RUN UV_HTTP_TIMEOUT=600 uv pip install \
    --python /app/.venv/bin/python3 \
    torch torchaudio \
    --index-url https://download.pytorch.org/whl/cu128 \
    --extra-index-url https://pypi.nvidia.com \
    --reinstall-package torch \
    --reinstall-package torchaudio

ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility
