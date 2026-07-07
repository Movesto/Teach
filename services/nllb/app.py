"""
NLLB v3 Translation API Server

Serves the fine-tuned Somali<->English NLLB model. Two selectable backends:

  - "ct2" (default): CTranslate2 int8. On first startup the fine-tuned LoRA adapter
    is merged into the base NLLB-1.3B and the merged model is converted to
    CTranslate2 (cached under the HF cache volume). ~1.3 GB and ~2x faster than the
    transformers path; int8 is near-lossless for translation.
  - "transformers": original base NLLB-1.3B (fp16) + LoRA via PEFT. Kept as a
    drop-in rollback — set NLLB_BACKEND=transformers.

Both backends use identical generation settings (beam=5, repetition_penalty=1.5,
no_repeat_ngram_size=3, max_length=512) so output matches aside from int8 rounding.

Env vars:
  NLLB_BACKEND            ct2 | transformers          (default: ct2)
  NLLB_CT2_QUANTIZATION   int8 | float16              (default: int8)
  NLLB_DEVICE             auto | cuda | cpu           (default: auto)
  NLLB_CT2_DIR            converted-model cache dir   (default under HF cache)
"""

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import NllbTokenizer
import uvicorn

app = FastAPI(title="NLLB Somali-English Translator")

# Language codes
SOM_CODE = "som_Latn"
ENG_CODE = "eng_Latn"

# Configuration
BACKEND = os.environ.get("NLLB_BACKEND", "ct2").lower()
QUANT = os.environ.get("NLLB_CT2_QUANTIZATION", "int8").lower()
BASE_MODEL = "facebook/nllb-200-1.3B"
LORA_DIR = "/app/model"
CT2_DIR = os.environ.get("NLLB_CT2_DIR", "/root/.cache/huggingface/ct2-nllb-som")

# Generation parameters — kept identical across backends for quality parity.
CT2_GEN = dict(
    beam_size=5,
    repetition_penalty=1.5,
    no_repeat_ngram_size=3,
    max_decoding_length=512,
)

# Global state
tokenizer = None
translator = None      # CTranslate2 backend
model = None           # transformers backend
active_device = None


class TranslationRequest(BaseModel):
    text: str
    direction: str = "eng_to_som"  # or "som_to_eng"


class TranslationResponse(BaseModel):
    translation: str
    direction: str


# ── Backend loading ──────────────────────────────────────────────────────────

def _resolve_device() -> str:
    dev = os.environ.get("NLLB_DEVICE", "auto").lower()
    if dev == "auto":
        dev = "cuda" if torch.cuda.is_available() else "cpu"
    return dev


def _compute_type(dev: str) -> str:
    if dev == "cuda":
        return "int8_float16" if QUANT == "int8" else "float16"
    return "int8" if QUANT == "int8" else "float32"


def build_ct2_model() -> None:
    """One-time: merge the LoRA adapter into the base model and convert the merged
    model to CTranslate2. The merge is exact (bakes the fine-tune into the weights);
    int8 is applied only at conversion time."""
    from transformers import AutoModelForSeq2SeqLM
    from peft import PeftModel
    import ctranslate2.converters

    merged_dir = "/tmp/nllb-merged"
    print("Merging LoRA adapter into base model (fp32)...", flush=True)
    base = AutoModelForSeq2SeqLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float32)
    merged = PeftModel.from_pretrained(base, LORA_DIR).merge_and_unload()
    merged.save_pretrained(merged_dir)
    tokenizer.save_pretrained(merged_dir)
    del base, merged

    print(f"Converting merged model to CTranslate2 (quantization={QUANT})...", flush=True)
    ctranslate2.converters.TransformersConverter(merged_dir).convert(
        CT2_DIR, quantization=QUANT, force=True
    )
    print(f"CT2 model ready at {CT2_DIR}", flush=True)


def load_ct2() -> None:
    global translator, active_device
    import ctranslate2

    if not os.path.exists(os.path.join(CT2_DIR, "model.bin")):
        print("No converted CT2 model found — building it (one-time, ~minutes)...", flush=True)
        build_ct2_model()

    dev = _resolve_device()
    try:
        translator = ctranslate2.Translator(CT2_DIR, device=dev, compute_type=_compute_type(dev))
    except Exception as e:
        # CTranslate2 GPU wheels may not yet ship kernels for the newest GPUs
        # (e.g. Blackwell sm_120). Fall back to CPU rather than crash — this also
        # takes NLLB to 0 GB VRAM, at some latency cost.
        if dev == "cuda":
            print(f"CT2 CUDA init failed ({e}); falling back to CPU.", flush=True)
            dev = "cpu"
            translator = ctranslate2.Translator(CT2_DIR, device=dev, compute_type=_compute_type(dev))
        else:
            raise
    active_device = dev
    print(f"CT2 backend ready (device={dev}, quantization={QUANT}).", flush=True)


def load_transformers() -> None:
    global model, active_device
    from transformers import AutoModelForSeq2SeqLM
    from peft import PeftModel

    print("Loading base model...", flush=True)
    base_model = AutoModelForSeq2SeqLM.from_pretrained(
        BASE_MODEL, torch_dtype=torch.float16, device_map="auto"
    )
    print("Loading LoRA adapter...", flush=True)
    model = PeftModel.from_pretrained(base_model, LORA_DIR)
    model.eval()
    active_device = str(model.device)
    print("Transformers backend ready.", flush=True)


def load_model() -> None:
    global tokenizer
    print("Loading tokenizer...", flush=True)
    tokenizer = NllbTokenizer.from_pretrained(BASE_MODEL)
    if BACKEND == "ct2":
        load_ct2()
    else:
        load_transformers()
    print("Model loaded successfully!", flush=True)


# ── Translation ──────────────────────────────────────────────────────────────

def _codes_for(direction: str):
    if direction == "eng_to_som":
        return ENG_CODE, SOM_CODE
    if direction == "som_to_eng":
        return SOM_CODE, ENG_CODE
    raise HTTPException(status_code=400, detail="Invalid direction. Use 'eng_to_som' or 'som_to_eng'")


def _translate_ct2(text: str, src_code: str, tgt_code: str) -> str:
    tokenizer.src_lang = src_code
    source = tokenizer.convert_ids_to_tokens(
        tokenizer.encode(text, truncation=True, max_length=512)
    )
    results = translator.translate_batch([source], target_prefix=[[tgt_code]], **CT2_GEN)
    target = results[0].hypotheses[0][1:]  # drop the forced target-language token
    return tokenizer.decode(tokenizer.convert_tokens_to_ids(target), skip_special_tokens=True)


def _translate_transformers(text: str, src_code: str, tgt_code: str) -> str:
    tokenizer.src_lang = src_code
    inputs = tokenizer(
        text, return_tensors="pt", padding=True, truncation=True, max_length=512
    ).to(model.device)
    with torch.no_grad():
        generated = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_code),
            max_length=512,
            num_beams=5,
            repetition_penalty=1.5,
            no_repeat_ngram_size=3,
            early_stopping=True,
        )
    return tokenizer.decode(generated[0], skip_special_tokens=True)


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model": "nllb-somali-english-v3",
        "backend": BACKEND,
        "device": active_device,
    }


@app.post("/translate", response_model=TranslationResponse)
async def translate(request: TranslationRequest):
    """Translate text between Somali and English"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    src_code, tgt_code = _codes_for(request.direction)

    if BACKEND == "ct2":
        translation = _translate_ct2(request.text, src_code, tgt_code)
    else:
        translation = _translate_transformers(request.text, src_code, tgt_code)

    return TranslationResponse(translation=translation, direction=request.direction)


@app.post("/v1/translate")
async def translate_v1(request: TranslationRequest):
    """Alias endpoint for compatibility"""
    return await translate(request)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
