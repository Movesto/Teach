"""
NLLB v3 Translation API Server
Loads base NLLB 1.3B + your fine-tuned LoRA adapter
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoModelForSeq2SeqLM, NllbTokenizer
from peft import PeftModel
import uvicorn

app = FastAPI(title="NLLB Somali-English Translator")

# Language codes
SOM_CODE = "som_Latn"
ENG_CODE = "eng_Latn"

# Global model variables
model = None
tokenizer = None


class TranslationRequest(BaseModel):
    text: str
    direction: str = "eng_to_som"  # or "som_to_eng"


class TranslationResponse(BaseModel):
    translation: str
    direction: str


def load_model():
    """Load NLLB base model + LoRA adapter"""
    global model, tokenizer
    
    print("Loading tokenizer...")
    tokenizer = NllbTokenizer.from_pretrained("facebook/nllb-200-1.3B")
    
    print("Loading base model...")
    base_model = AutoModelForSeq2SeqLM.from_pretrained(
        "facebook/nllb-200-1.3B",
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    print("Loading LoRA adapter...")
    model = PeftModel.from_pretrained(base_model, "/app/model")
    model.eval()
    
    print("Model loaded successfully!")


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/health")
async def health():
    return {"status": "healthy", "model": "nllb-somali-english-v3"}


@app.post("/translate", response_model=TranslationResponse)
async def translate(request: TranslationRequest):
    """Translate text between Somali and English"""
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    
    # Set language direction
    if request.direction == "eng_to_som":
        tokenizer.src_lang = ENG_CODE
        target_lang = SOM_CODE
    elif request.direction == "som_to_eng":
        tokenizer.src_lang = SOM_CODE
        target_lang = ENG_CODE
    else:
        raise HTTPException(status_code=400, detail="Invalid direction. Use 'eng_to_som' or 'som_to_eng'")
    
    # Tokenize
    inputs = tokenizer(
        request.text,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512
    ).to(model.device)
    
    # Get target token id
    target_token_id = tokenizer.convert_tokens_to_ids(target_lang)
    
    # Generate
    with torch.no_grad():
        generated = model.generate(
            **inputs,
            forced_bos_token_id=target_token_id,
            max_length=512,
            num_beams=5,
            repetition_penalty=1.5,
            no_repeat_ngram_size=3,
            early_stopping=True
        )
    
    # Decode
    translation = tokenizer.decode(generated[0], skip_special_tokens=True)
    
    return TranslationResponse(
        translation=translation,
        direction=request.direction
    )


@app.post("/v1/translate")
async def translate_v1(request: TranslationRequest):
    """Alias endpoint for compatibility"""
    return await translate(request)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
