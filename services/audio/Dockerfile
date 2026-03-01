# Production Dockerfile for Pronunciation Service
# Meta MMS (Somali) + Faster-Whisper (English)
# Optimized for CUDA 12.6 + NVIDIA RTX 5070 Ti (Blackwell sm_120)

# Use NVIDIA CUDA 12.6 runtime base image
FROM nvidia/cuda:12.6.0-runtime-ubuntu22.04

# Metadata
LABEL maintainer="Teach English Learning Platform"
LABEL description="Pronunciation assessment with Meta MMS and Faster-Whisper"
LABEL cuda.version="12.6"

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# System dependencies installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    python3.11-venv \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    curl \
    ca-certificates \
    git \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Upgrade pip, setuptools, and wheel
RUN python3 -m pip install --upgrade --no-cache-dir \
    pip==24.0 \
    setuptools==69.0.3 \
    wheel==0.42.0

# Install PyTorch with CUDA 12.6 support
# torch 2.8.0+ required for RTX 5070 Ti (Blackwell sm_120)
RUN pip3 install --no-cache-dir \
    torch==2.8.0 \
    torchvision==0.23.0 \
    torchaudio==2.8.0 \
    --index-url https://download.pytorch.org/whl/cu126

# Copy requirements file
COPY requirements-pronunciation.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements-pronunciation.txt

# Copy service code
COPY pronunciation_service.py ./pronunciation_service.py

# Create cache directories (run as root so /app and cache are writable)
RUN mkdir -p /app/.cache/huggingface/hub \
    && mkdir -p /app/.cache/torch

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    HF_HOME=/app/.cache/huggingface \
    HF_TOKEN_PATH=/app/.cache/huggingface/token \
    TORCH_HOME=/app/.cache/torch \
    CUDA_VISIBLE_DEVICES=0

# Expose port
EXPOSE 5002

# Health check - wait 2 minutes for models to load on first start
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:5002/health || exit 1

# Run the service
CMD ["python3", "pronunciation_service.py"]
