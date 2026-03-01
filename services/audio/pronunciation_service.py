"""
Pronunciation Assessment Service - Production Version
Meta MMS (Somali) + Faster-Whisper (English)
Optimized for NVIDIA RTX 5070 Ti with CUDA 12.6

Features:
- GPU acceleration (10x faster than CPU)
- Support for English and Somali
- Word-level pronunciation scoring
- Real-time feedback (<0.5 seconds)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import Wav2Vec2ForCTC, AutoProcessor
from faster_whisper import WhisperModel
import librosa
import numpy as np
from pathlib import Path
import tempfile
import difflib
from typing import Literal, Optional
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Pronunciation Assessment API",
    description="Meta MMS (Somali) + Faster-Whisper (English)",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instances
WHISPER_MODEL = None
MMS_MODEL = None
MMS_PROCESSOR = None

# Device configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

# Log GPU information
logger.info(f"{'='*60}")
logger.info(f"DEVICE CONFIGURATION")
logger.info(f"{'='*60}")
logger.info(f"Device: {DEVICE}")
logger.info(f"Compute Type: {COMPUTE_TYPE}")

if torch.cuda.is_available():
    logger.info(f"GPU Name: {torch.cuda.get_device_name(0)}")
    logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    logger.info(f"CUDA Version: {torch.version.cuda}")
else:
    logger.warning("GPU not available - falling back to CPU")


def load_models():
    """Load Faster-Whisper and Meta MMS models with GPU acceleration"""
    global WHISPER_MODEL, MMS_MODEL, MMS_PROCESSOR
    
    logger.info(f"{'='*60}")
    logger.info("LOADING MODELS")
    logger.info(f"{'='*60}")
    
    # Load Faster-Whisper (English)
    logger.info("Loading Faster-Whisper (English)...")
    start_time = time.time()
    
    try:
        # Use "small" model for best balance of speed/quality on GPU
        # Options: tiny, base, small, medium, large-v2, large-v3
        WHISPER_MODEL = WhisperModel(
            "small",
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            download_root="/root/.cache/whisper"
        )
        
        elapsed = time.time() - start_time
        logger.info(f"✓ Faster-Whisper loaded in {elapsed:.2f}s")
        logger.info(f"  Model: small")
        logger.info(f"  Device: {DEVICE}")
        logger.info(f"  Compute Type: {COMPUTE_TYPE}")
        
    except Exception as e:
        logger.error(f"Failed to load Faster-Whisper: {e}")
        raise
    
    # Load Meta MMS (Somali)
    logger.info("\nLoading Meta MMS (Somali)...")
    start_time = time.time()
    
    try:
        # Load model and processor
        MMS_MODEL = Wav2Vec2ForCTC.from_pretrained(
            "facebook/mms-1b-all",
            cache_dir="/root/.cache/huggingface"
        )
        MMS_PROCESSOR = AutoProcessor.from_pretrained(
            "facebook/mms-1b-all",
            cache_dir="/root/.cache/huggingface"
        )
        
        # Set target language to Somali
        MMS_PROCESSOR.tokenizer.set_target_lang("som")
        MMS_MODEL.load_adapter("som")
        
        # Move to GPU if available
        if DEVICE == "cuda":
            MMS_MODEL = MMS_MODEL.to(DEVICE)
            logger.info(f"  Moved to GPU: {torch.cuda.get_device_name(0)}")
        
        elapsed = time.time() - start_time
        logger.info(f"✓ Meta MMS loaded in {elapsed:.2f}s")
        logger.info(f"  Model: facebook/mms-1b-all")
        logger.info(f"  Language: Somali (som)")
        logger.info(f"  Device: {DEVICE}")
        
    except Exception as e:
        logger.error(f"Failed to load Meta MMS: {e}")
        raise
    
    logger.info(f"{'='*60}")
    logger.info("✅ ALL MODELS LOADED SUCCESSFULLY")
    logger.info(f"{'='*60}\n")


@app.on_event("startup")
async def startup_event():
    """Initialize models on service startup"""
    logger.info("Starting Pronunciation Assessment Service...")
    load_models()
    logger.info("Service ready to accept requests\n")


def load_audio(audio_path: str, target_sr: int = 16000) -> tuple:
    """Load and preprocess audio file"""
    try:
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        return audio, sr
    except Exception as e:
        logger.error(f"Error loading audio: {e}")
        raise


def transcribe_english(audio_path: str) -> dict:
    """
    Transcribe English audio using Faster-Whisper with GPU acceleration
    
    Returns:
        dict with transcription, language, confidence, and word-level data
    """
    logger.info(f"Transcribing English audio: {Path(audio_path).name}")
    start_time = time.time()
    
    try:
        segments, info = WHISPER_MODEL.transcribe(
            audio_path,
            language="en",
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,  # Voice activity detection
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        full_text = ""
        words = []
        
        for segment in segments:
            full_text += segment.text + " "
            
            # Extract word-level information
            if hasattr(segment, 'words') and segment.words:
                for word in segment.words:
                    words.append({
                        "word": word.word.strip(),
                        "start": round(word.start, 2),
                        "end": round(word.end, 2),
                        "probability": round(word.probability, 3)
                    })
        
        elapsed = time.time() - start_time
        logger.info(f"English transcription completed in {elapsed:.3f}s")
        
        return {
            "text": full_text.strip(),
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "words": words,
            "processing_time": round(elapsed, 3)
        }
        
    except Exception as e:
        logger.error(f"Error in English transcription: {e}")
        raise


def transcribe_somali(audio_path: str) -> dict:
    """
    Transcribe Somali audio using Meta MMS with GPU acceleration
    
    Returns:
        dict with transcription and metadata
    """
    logger.info(f"Transcribing Somali audio: {Path(audio_path).name}")
    start_time = time.time()
    
    try:
        # Load audio
        audio, sr = load_audio(audio_path, target_sr=16000)
        
        # Process audio
        inputs = MMS_PROCESSOR(
            audio,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True
        )
        
        # Move to GPU if available
        if DEVICE == "cuda":
            inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        # Get predictions
        with torch.no_grad():
            outputs = MMS_MODEL(**inputs).logits
        
        # Decode
        predicted_ids = torch.argmax(outputs, dim=-1)
        transcription = MMS_PROCESSOR.batch_decode(predicted_ids)[0]
        
        elapsed = time.time() - start_time
        logger.info(f"Somali transcription completed in {elapsed:.3f}s")
        
        return {
            "text": transcription,
            "language": "som",
            "processing_time": round(elapsed, 3)
        }
        
    except Exception as e:
        logger.error(f"Error in Somali transcription: {e}")
        raise


def calculate_similarity(reference: str, hypothesis: str) -> dict:
    """
    Calculate pronunciation similarity with detailed word-level scoring
    
    Args:
        reference: Expected text
        hypothesis: What the user said
        
    Returns:
        dict with overall score, word scores, and feedback
    """
    # Normalize text
    ref = reference.lower().strip()
    hyp = hypothesis.lower().strip()
    
    # Overall similarity using sequence matching
    similarity = difflib.SequenceMatcher(None, ref, hyp).ratio()
    
    # Word-level comparison
    ref_words = ref.split()
    hyp_words = hyp.split()
    
    word_scores = []
    correct_words = 0
    
    for i, ref_word in enumerate(ref_words):
        if i < len(hyp_words):
            word_sim = difflib.SequenceMatcher(None, ref_word, hyp_words[i]).ratio()
            is_correct = word_sim > 0.8
            
            if is_correct:
                correct_words += 1
            
            word_scores.append({
                "expected": ref_word,
                "spoken": hyp_words[i],
                "score": round(word_sim * 100, 1),
                "correct": is_correct
            })
        else:
            # Word was not spoken
            word_scores.append({
                "expected": ref_word,
                "spoken": None,
                "score": 0,
                "correct": False
            })
    
    # Calculate overall score (0-100)
    overall_score = round(similarity * 100, 1)
    
    # Word accuracy percentage
    word_accuracy = round((correct_words / len(ref_words)) * 100, 1) if ref_words else 0
    
    # Generate feedback based on score
    if overall_score >= 95:
        feedback = "🎉 Excellent! Perfect pronunciation!"
        level = "perfect"
    elif overall_score >= 85:
        feedback = "⭐ Great job! Very close to perfect."
        level = "great"
    elif overall_score >= 70:
        feedback = "👍 Good! Keep practicing."
        level = "good"
    elif overall_score >= 50:
        feedback = "📚 Not bad, but try to match the sounds more closely."
        level = "okay"
    else:
        feedback = "💪 Keep practicing! Listen carefully to the target pronunciation."
        level = "needs_work"
    
    return {
        "overall_score": overall_score,
        "word_accuracy": word_accuracy,
        "similarity": round(similarity, 3),
        "word_scores": word_scores,
        "feedback": feedback,
        "level": level,
        "expected": reference,
        "spoken": hypothesis,
        "words_correct": correct_words,
        "words_total": len(ref_words)
    }


@app.post("/api/pronunciation/assess")
async def assess_pronunciation(
    audio: UploadFile = File(...),
    language: str = "english",
    expected_text: str = ""
):
    """
    Assess pronunciation from uploaded audio file
    
    Args:
        audio: Audio file (WAV, MP3, etc.)
        language: "english" or "somali"
        expected_text: Text the user should have said
        
    Returns:
        Pronunciation assessment with scores and feedback
    """
    if not expected_text:
        raise HTTPException(status_code=400, detail="expected_text is required")
    
    language = language.lower()
    if language not in ["english", "somali"]:
        raise HTTPException(status_code=400, detail="Language must be 'english' or 'somali'")
    
    logger.info(f"Pronunciation assessment request - Language: {language}")
    
    # Save uploaded file temporarily
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Transcribe based on language
        if language == "english":
            result = transcribe_english(tmp_path)
        else:
            result = transcribe_somali(tmp_path)
        
        # Calculate pronunciation score
        assessment = calculate_similarity(expected_text, result["text"])
        
        # Add transcription metadata
        assessment["transcription"] = result["text"]
        assessment["language"] = language
        assessment["processing_time"] = result.get("processing_time", 0)
        
        if "words" in result:
            assessment["word_timestamps"] = result["words"]
        if "language_probability" in result:
            assessment["confidence"] = result["language_probability"]
        
        # Clean up temp file
        Path(tmp_path).unlink()
        
        logger.info(f"Assessment complete - Score: {assessment['overall_score']}/100")
        
        return assessment
        
    except Exception as e:
        logger.error(f"Assessment error: {e}")
        # Clean up temp file on error
        if 'tmp_path' in locals():
            Path(tmp_path).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """
    Health check endpoint with GPU information
    
    Returns service status and GPU details
    """
    gpu_info = {}
    
    if torch.cuda.is_available():
        gpu_info = {
            "gpu_available": True,
            "gpu_name": torch.cuda.get_device_name(0),
            "gpu_memory_total": f"{torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB",
            "gpu_memory_allocated": f"{torch.cuda.memory_allocated(0) / 1e9:.2f} GB",
            "gpu_memory_reserved": f"{torch.cuda.memory_reserved(0) / 1e9:.2f} GB",
            "cuda_version": torch.version.cuda
        }
    else:
        gpu_info = {
            "gpu_available": False,
            "message": "Running on CPU"
        }
    
    return {
        "status": "healthy",
        "service": "pronunciation-assessment",
        "version": "2.0.0",
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "whisper_loaded": WHISPER_MODEL is not None,
        "mms_loaded": MMS_MODEL is not None,
        **gpu_info
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Pronunciation Assessment API",
        "version": "2.0.0",
        "models": {
            "english": "Faster-Whisper (small)",
            "somali": "Meta MMS (facebook/mms-1b-all)"
        },
        "endpoints": {
            "health": "/health",
            "assess": "/api/pronunciation/assess"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    logger.info("\n" + "="*60)
    logger.info("🚀 PRONUNCIATION ASSESSMENT SERVICE")
    logger.info("Meta MMS (Somali) + Faster-Whisper (English)")
    logger.info("="*60 + "\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5002,
        log_level="info"
    )
