# NLLB CTranslate2 int8 backend

The NLLB service can serve your fine-tuned Somali↔English model two ways, selected
by the `NLLB_BACKEND` env var (set in `docker-compose.yml`):

| Backend | What it loads | VRAM | Speed |
|---|---|---|---|
| `ct2` (default) | LoRA merged into base → converted to CTranslate2 **int8** | ~1.3 GB | ~2× faster |
| `transformers` | Base NLLB-1.3B (fp16) + LoRA via PEFT (original path) | ~3 GB | baseline |

## Your fine-tune is preserved

The `ct2` path does **not** swap models. On first startup it:
1. merges your LoRA adapter (`/app/model`) into `facebook/nllb-200-1.3B` with
   `merge_and_unload()` — an exact operation that bakes your training into the weights, then
2. converts that merged model to CTranslate2 with int8 quantization.

int8 adds a small, uniform rounding error across all weights (typically a fraction
of a BLEU point for MT) — it does not target or erode your Somali fine-tune. The
only thing that would discard your training is swapping the *base* model, which this
does not do.

The converted model is cached at `/root/.cache/huggingface/ct2-nllb-som` (on the
`huggingface-cache` volume), so the merge/convert only happens once. Delete that
directory to force a rebuild.

## First run

```bash
docker compose up -d --build nllb
docker logs -f nllb-translator   # watch: "Merging..." → "Converting..." → "CT2 backend ready"
curl http://localhost:8001/health   # shows "backend":"ct2" and the active "device"
```

First boot is slower (downloads the base model if not cached, then merges + converts).
Subsequent boots load the cached CT2 model directly.

## Validate quality before trusting it

Add a few of your own real lesson sentences to `SAMPLES` in `validate.py`, then A/B:

```bash
# with ct2 (default)
python validate.py > ct2.txt
# flip NLLB_BACKEND=transformers in docker-compose.yml, then:
docker compose up -d nllb
python validate.py > transformers.txt
diff transformers.txt ct2.txt
```

If int8 output ever looks off, set `NLLB_CT2_QUANTIZATION=float16` (lossless vs. your
fp16 model — keeps the ~2× speedup but not the memory saving), or roll back entirely
with `NLLB_BACKEND=transformers`.

## GPU note (RTX 5070 Ti / Blackwell)

CTranslate2's released GPU wheels may not yet include kernels for the newest GPUs
(Blackwell, sm_120). If GPU init fails, the service automatically falls back to CPU
(logged as "CT2 CUDA init failed … falling back to CPU"). CPU int8 is fine for short
tutoring strings and takes NLLB to **0 GB VRAM** — freeing the GPU further. Force a
choice with `NLLB_DEVICE=cuda|cpu` if you prefer.
