FROM nvidia/cuda:12.8.0-runtime-ubuntu22.04

WORKDIR /app

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch 2.6+ with CUDA 12.8 support for RTX 5070 Ti
RUN pip3 install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cu128

# Install other dependencies
RUN pip3 install --no-cache-dir \
    fastapi \
    uvicorn \
    transformers>=4.48.0 \
    peft \
    accelerate \
    sentencepiece \
    protobuf \
    ctranslate2

# Copy the API server
COPY app.py /app/

# Expose port
EXPOSE 8001

# Run the server
CMD ["python3", "app.py"]
