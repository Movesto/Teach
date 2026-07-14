# Code Assistant — 6-Day Sprint Plan

## Goal

Build a working personal Python coding assistant by fine-tuning Qwen2.5-Coder-1.5B,
while deeply understanding every step of the architecture and training pipeline.

End state: a QLoRA-tuned model that follows instructions, explains code, fixes bugs,
and completes Python snippets — with full understanding of how every piece works.

## Constraints

- Hardware: single GPU (RTX 5070 Ti, 16 GB VRAM), AMD Ryzen 5 9600X, 32 GB RAM
- Storage: 427 GB free on Windows machine (Teach project location)
- Time: 5-6 hours/day × 6 days = ~30-36 hours total
- Language target: Python only (for v1)
- Compute: local GPU only, no cloud
- Use case: personal tool, not public service

## Stack decisions

| Choice | Reason |
|---|---|
| Base model: **Qwen/Qwen2.5-Coder-1.5B** | Code-pretrained, small enough for QLoRA on 16 GB, strong baseline |
| Fine-tune method: **QLoRA** | Full FT needs ~24 GB optimizer states, won't fit. QLoRA fits in ~5-7 GB. |
| Dataset: **ise-uiuc/Magicoder-OSS-Instruct-75K** | High-quality instruction-code pairs, Python-heavy |
| RL framework: deferred to follow-up project | RL infra alone takes days — out of scope for 6-day sprint |
| Sandboxing: deferred | Tool use is Stage 3, future project |
| Eval: **HumanEval + MBPP** via `evalplus` | Standard, fast, well-understood |

## Why QLoRA specifically

Full fine-tune memory math:
- 1.5B parameters × 16 bytes per param (AdamW mixed precision) = ~24 GB optimizer states
- That alone exceeds 16 GB VRAM. Doesn't fit.

QLoRA memory math:
- Base model in 4-bit NF4: ~800 MB
- LoRA adapters (rank 16, target attn + FFN): ~50-200 MB trainable
- Optimizer states **only on the LoRA params**: tiny
- Plus activations + grads: ~2-4 GB during forward/backward
- **Total: ~5-7 GB.** Leaves room for batch size and longer sequences.

Quality note: QLoRA on a 1.5B base routinely matches full fine-tune quality on
instruction-following. Not a compromise — the right tool.

## Realistic outcome expectations

| Metric | Target |
|---|---|
| HumanEval pass@1, base (before SFT) | ~35-40% |
| HumanEval pass@1, after SFT | ~45-55% |
| Useful for autocomplete / explain / simple fixes | Yes |
| Useful for architecture / design / complex bugs | No |
| Comparable to Claude / GPT-4 | No (different scale entirely) |
| Comparable understanding of internals | Far better than typical user |

## Status tracker

Use this to mark progress as you go. Update day-by-day.

- [ ] Day 1: Foundations
- [ ] Day 2: Qwen architecture deep dive
- [ ] Day 3: Data preparation
- [ ] Day 4: Training run
- [ ] Day 5: Eval, compare, iterate
- [ ] Day 6: Inference wrapper, polish, plan ahead

---

## Day 1 (5-6h): Foundations

**Goal:** Environment works. Karpathy video watched. nanoGPT read once.

| Hour | Task |
|---|---|
| 1 | Environment setup. Install: `torch transformers datasets trl peft bitsandbytes accelerate evalplus`. Verify CUDA: `python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"` |
| 2-3 | Watch karpathy "Let's build GPT" video (3 hours). |
| 4-5 | Read nanoGPT `model.py` line by line. Add your own comments. |
| 6 | Run `python sample.py --init_from=gpt2`. Confirm text generation works. |

**Deliverable:** Can explain a transformer block out loud.

## Day 2 (5-6h): Qwen2.5-Coder architecture

**Goal:** Understand how Qwen2 differs from GPT-2. Load Qwen, run inference.

| Hour | Task |
|---|---|
| 1 | Skim Qwen2.5-Coder technical report. Focus on §2 (architecture), §4 (training data). |
| 2-3 | Read `modeling_qwen2.py` from HuggingFace transformers. Identify: RoPE, GQA, RMSNorm, SwiGLU. Map each to its GPT-2 counterpart in nanoGPT. |
| 4 | Pull model: `AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Coder-1.5B", torch_dtype="bfloat16", device_map="auto")`. Inspect with `print(model)`. |
| 5 | Run base-model inference. Prompt: `"def fibonacci(n):\n"`. Note: base = raw completion, no instruction following yet. |
| 6 | Read the QLoRA paper (~10 pages). |

**Deliverable:** Can name every architectural difference between nanoGPT's `Block` and Qwen2's `Qwen2DecoderLayer`. Qwen running locally.

## Day 3 (5-6h): Data preparation

**Goal:** Tokenized dataset on disk. Eval baseline measured. Training script ready.

| Hour | Task |
|---|---|
| 1 | Download Magicoder-OSS-Instruct-75K: `datasets.load_dataset("ise-uiuc/Magicoder-OSS-Instruct-75K")`. Inspect 10 examples. |
| 2 | Write a formatter using Qwen's chat template: `tokenizer.apply_chat_template([...], tokenize=False)`. |
| 3 | Tokenize entire dataset, save as HF `Dataset`. Filter or truncate anything >2048 tokens. |
| 4 | **Baseline eval.** Run HumanEval against base Qwen2.5-Coder-1.5B via `evalplus`. Record pass@1 number. |
| 5-6 | Write training script using `trl.SFTTrainer` + `peft.LoraConfig`. See config below. |

### QLoRA training config

```python
from peft import LoraConfig
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype="bfloat16",
    bnb_4bit_use_double_quant=True,
)

lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
)
```

### SFTTrainer args

```python
training_args = SFTConfig(
    output_dir="./qwen-coder-sft",
    num_train_epochs=2,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,        # effective batch 32
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    bf16=True,
    gradient_checkpointing=True,
    logging_steps=10,
    save_steps=500,                        # checkpoint aggressively
    save_total_limit=3,
    max_seq_length=2048,
    report_to="none",
)
```

**Deliverable:** Tokenized dataset on disk. Baseline HumanEval number recorded. Training script ready to launch.

## Day 4 (5-6h): Training run

**Goal:** Trained QLoRA adapter on disk.

| Hour | Task |
|---|---|
| 1 | Final sanity check: smoke-test with `num_train_epochs=0.01` to verify the loop runs end-to-end before committing 3-4 hours. |
| 2 | Kick off real training. ~75K samples / batch 32 ≈ 2300 steps/epoch. 1-2 sec/step → ~1-2h per epoch. **2 epochs ≈ 3-4 hours.** |
| 3-6 | Monitor. Watch loss go from ~1.5 → ~0.7-0.9. Tail logs. |

### Gotchas

| Symptom | Likely cause | Fix |
|---|---|---|
| OOM | Batch too large | Drop `per_device_train_batch_size` to 2, double `gradient_accumulation_steps` |
| Loss plateaus above 1.2 | Wrong chat template / data formatting | Re-inspect tokenized examples — decode them back |
| Loss collapses to ~0 fast | Overfitting on duplicates | Check for data duplication, lower lr |
| Loss spikes mid-run | lr too high | Restart from last checkpoint with lr × 0.5 |
| Training crashes randomly | Single bad sample | Drop sample, restart from checkpoint |

**Deliverable:** LoRA adapter saved to `./qwen-coder-sft/`. Healthy loss curve.

## Day 5 (5-6h): Eval, compare, iterate

**Goal:** Measure improvement. Optional refinement run.

| Hour | Task |
|---|---|
| 1 | Merge LoRA with base: `model.merge_and_unload()`. Save merged checkpoint. |
| 2 | Run HumanEval on SFT'd model. Compare to Day 3 baseline. **Target: +5% pass@1 minimum.** Realistic: +10-15% with Magicoder data. |
| 3 | Run MBPP for a second eval (more diverse problems). Record number. |
| 4 | Look at 20 actual completions side-by-side: base vs SFT. Note where SFT helps and where it hurts. |
| 5-6 | Optional: one more training run with adjusted hyperparams (e.g., lr 1e-4 for 1 more epoch), or fine-tune on CodeAlpaca for instruction diversity. |

**Deliverable:** Concrete numbers — "base scored X% on HumanEval, my SFT'd version scored Y%."

## Day 6 (5-6h): Inference wrapper, polish, roadmap

**Goal:** Usable local tool. Documentation. Next-steps plan.

| Hour | Task |
|---|---|
| 1 | Quantize merged model for inference. Options: AWQ (`autoawq`) or GPTQ (`auto-gptq`). ~30 min job. |
| 2 | Set up local inference. Options: `vllm serve <path>` (fastest), or a thin FastAPI wrapper around `transformers`. |
| 3 | Build a CLI: `python ask.py "fix this code: ..."`. ~50 lines. |
| 4 | Test on real personal code. Fix 3-5 actual bugs in your other projects. Note what works, what doesn't. |
| 5 | Write a 1-page README: what was built, what's in the LoRA, eval numbers, how to use. |
| 6 | Write your own next-steps roadmap based on what you actually learned. |

**Deliverable:** Working personal code helper, eval-validated, with docs.

## Tips throughout

1. **Save checkpoints aggressively.** `save_steps=500`. Power blips happen.
2. **Keep an experiment log.** Markdown file with hyperparams + outcomes. Future-you will thank you.
3. **First training run will probably need a re-run.** Plan for one re-do somewhere.
4. **Don't over-collect data.** 75K samples × 2 epochs is plenty for Stage 1.
5. **Day 5 has slack.** If Day 4 bleeds over (training restarts, debugging), use Day 5's first hours.

## After Day 6: optional next stages

These are **NOT** part of the 6-day sprint. They are real follow-up projects, each weeks long:

### Stage 2: RL with verifiable rewards (R1-style)

- Reward = does generated code pass tests?
- Tools needed: sandboxed Python executor (E2B or Docker), GRPO via TRL
- Dataset: APPS or LiveCodeBench (problems with test cases)
- Realistic timeline: 2-4 weeks
- Realistic outcome: +5-15% absolute HumanEval improvement over Stage 1

### Stage 3: Agentic tool use

- Model can call tools: python_exec, file_read, file_write, web_search
- ReAct-style loop with tool schema
- SFT on tool-use traces, then RL on task success
- Realistic timeline: 3-4 weeks (infrastructure-heavy)
- Realistic outcome: small Claude-Code-like assistant for narrow tasks

### Stage 4+: open frontier

After Stage 3, you're at the research frontier. Possible directions: continual learning,
multimodal inputs, custom architecture experiments (try a Mamba block?), bigger base
model with the same pipeline (7B with QLoRA).

Don't plan these in advance. Decide after living with Stage 3 for a while.

## File and disk layout (suggested)

```
~/projects/code-assistant/
├── README.md
├── data/
│   ├── magicoder-tokenized/      # ~2 GB
│   └── eval/                      # HumanEval, MBPP
├── models/
│   ├── base/                      # cached Qwen2.5-Coder-1.5B (~3 GB)
│   ├── qwen-coder-sft/            # LoRA adapter (~200 MB)
│   ├── qwen-coder-merged/         # merged BF16 (~3 GB)
│   └── qwen-coder-awq/            # quantized inference (~800 MB)
├── scripts/
│   ├── prepare_data.py
│   ├── train_sft.py
│   ├── eval_humaneval.py
│   ├── merge_lora.py
│   ├── quantize_awq.py
│   └── ask.py
├── notes/
│   ├── day1.md
│   ├── day2.md
│   └── ... (one per day, log experiments here)
└── eval_results.json              # baseline + after-SFT numbers
```

Expected total disk: ~10-15 GB. Plenty of headroom on 427 GB.

## Reference links

- Qwen2.5-Coder model: https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B
- Qwen2.5-Coder paper: https://arxiv.org/abs/2409.12186
- QLoRA paper: https://arxiv.org/abs/2305.14314
- Magicoder dataset: https://huggingface.co/datasets/ise-uiuc/Magicoder-OSS-Instruct-75K
- TRL SFTTrainer docs: https://huggingface.co/docs/trl
- PEFT (LoRA) docs: https://huggingface.co/docs/peft
- nanoGPT: https://github.com/karpathy/nanoGPT
- Karpathy "Let's build GPT" video: search YouTube for "Karpathy let's build GPT"
- evalplus (HumanEval+, MBPP+): https://github.com/evalplus/evalplus
- DeepSeek-R1 paper (Stage 2 reference): https://arxiv.org/abs/2501.12948
- DeepSeekMath / GRPO paper: https://arxiv.org/abs/2402.03300
