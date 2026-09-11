# Decision: folded tutor translation (deepseek-v4-flash-0731 primary, nex free fallback)

**Date:** 2026-09-10
**Status:** Adopted, implemented.

## Context

The in-lesson AI tutor (`/api/chat`, `/api/explain`) needs Somali↔English so the
model can understand a student's Somali and reply in Somali. Until now this ran a
**fine-tuned NLLB** model locally on the GPU (`services/nllb`), with a 3-step
pipeline per turn: NLLB som→eng → chat LLM (English) → NLLB eng→som.

Goals driving the change:
- **Free the GPU** — no translation model resident on the dev/prod GPU (training on
  the GPU is fine; production hosting is not).
- **No paid subscription; scale to many users** — free VMs expire / don't scale, and
  free hosted-GPU inference for multi-user apps effectively doesn't exist.
- **Keep the feature and its quality.**

## What we evaluated

Compared on the team's own article-length examples (`docs/somali_text.md`), both
directions — see the full side-by-side in `docs/translation-model-comparison.md`
(kept local for now). Models: fine-tuned **NLLB**, **nex-n2.5-pro:free**,
**deepseek-v4.1-flash**, **deepseek-v4-flash-0731**.

Findings:
- **NLLB** — good on short/simple sentences, but weak on long-sentence structure and
  how words relate across a clause; some outright errors (e.g. "founded" → "buried").
  It also can't do understand-and-reply in one step (translation only), and it must
  stay on the GPU.
- **deepseek** models — best sentence structure and cohesion in both directions
  (team's judgment); occasional errors but strongest overall.
- **nex-n2.5-pro:free** — strong and free, a notch below deepseek; on the free tier
  it can be rate-limited (429) under load.
- **gemma-4-31b:free** — dropped: near-constant upstream 429s made it unusable.

Live OpenRouter pricing (USD / 1M tokens): deepseek-v4.1-flash 0.15 / 0.60;
**deepseek-v4-flash-0731 0.065 / 0.18** (~⅓ the cost); nex free = 0.

## Decision

Replace the NLLB round-trip with a **single "folded" model call** that understands
the student and replies in the tier's language directly:

- **Primary:** `deepseek/deepseek-v4-flash-0731` — best-value quality, reliable
  (paid, so no free-tier 429s).
- **Fallback:** `nex-agi/nex-n2.5-pro:free` — used on primary failure or once the
  daily spend cap is hit.
- **Last resort:** the existing free `ask_qwen` chain.

**Primary-first, not free-first**, because the free tier's per-account rate cap bites
hardest exactly at scale — free-first would give inconsistent quality, unpredictable
cost, and extra latency (429 → retry). deepseek-0731 is cheap enough that consistent
quality is worth it; free is the safety net, plus a hard **daily spend cap**.

## Why folded (one call), not deepseek-as-translator (three calls)

OpenRouter's free limit is **per-account request count**, shared across all calls.
Doing translation as separate calls would triple the request count per turn. Folding
understand+reply into one call keeps it at **one request/turn** and removes NLLB.

## Cost (every user active every day, 20 turns/day, 30 days)

Folded architecture, `deepseek-v4-flash-0731`:

| Daily users | Monthly cost |
|---|---|
| 10 | ~$0.71 |
| 20 | ~$1.43 |
| 50 | ~$3.57 |
| 100 | ~$7.14 |

Pennies per active user. The daily cap bounds the worst case; over the cap, everyone
is served free for the rest of the day.

## Implementation

- `core/ai_client.py` — `ask_folded()` (primary → free fallback → ask_qwen), a
  per-day in-process spend estimate (`folded_spend_today()`) enforcing the cap, and
  `_call_model()` (single call, returns content + token usage).
- `core/prompts.py` — `FOLDED_TUTOR_SOMALI` / `FOLDED_TUTOR_ENGLISH` (reply in the
  target language directly; no `{{}}` markers, no NLLB).
- `routers/translate.py` — `/chat` and `/explain` use `ask_folded`; lower tiers reply
  in Somali (English teaching terms kept inline), immersion replies in English.
- `core/config.py` — `FOLDED_MODEL`, `FOLDED_FALLBACK_MODEL`, `FOLDED_INPUT_PER_M`,
  `FOLDED_OUTPUT_PER_M`, `LLM_DAILY_SPEND_CAP_USD` (all env-overridable).
- Tests: `tests/test_chat.py` (9) — endpoint shape, tier→language, history
  pass-through, and the primary/fallback/cap logic.

NLLB stays available for the standalone `/api/translate` endpoint and as an offline
content-baking tool; it is no longer on the runtime path for the tutor.

## Paid tier & strict per-user accounting (2026-09-10)

Free-tier users are served the same folded tutor; the difference is a **daily usage
limit**. Enforced by strict per-user accounting so cost is bounded and there's a real
reason to upgrade.

**Accounting** — `user_llm_usage` (migration 0008): one aggregate row per
(user, day, feature), incremented on every folded call with requests + tokens + cost.
Best-effort (an accounting failure never blocks the tutor). This is the source of
truth for limits and cost reporting; the global daily spend cap remains a soft
in-process guardrail (the hard stop is the OpenRouter account billing limit).

**Plan flag** — `users.plan` ('free' | 'paid', default 'free'), read into the user
object and surfaced in `/api/auth/me` alongside a `usage` block
(used today / daily limit / remaining / month cost).

**Limits** (env-configurable):

| Tier | Daily limit (chat + explain) | LLM cost ceiling |
|---|---|---|
| Free (`TUTOR_FREE_DAILY_LIMIT`) | 25/day | ~$0.15/user/month (usually far less) |
| Paid (`TUTOR_PAID_DAILY_LIMIT`) | 500/day (fair-use) | ~$3/user/month worst case; ~$0.90 at a heavy 150/day |

Rationale: 25/day supports real daily practice while capping free cost and giving an
upgrade reason; 500/day is effectively unlimited for a human but blocks scripted
abuse. Even a very active paid user costs under $1/month in LLM, so any price of
$3–5/mo keeps a wide margin. Over the limit, `/chat` and `/explain` return **429**
with a friendly "resets tomorrow / upgrade" message.

Payment integration (Stripe etc.) is out of scope here — flipping `users.plan` to
'paid' is the only hook the limits need; wire a checkout to set it later.

## Notes / follow-ups

- The spend cap is per-process and resets on restart — a guardrail, not billing. If
  strict accounting is needed later, move the counter to the DB.
- `LLM_DAILY_SPEND_CAP_USD=0` disables the paid model entirely (free-only mode).
- If quality ever needs a bump, `deepseek-v4.1-flash` is a drop-in via `FOLDED_MODEL`
  (~3× cost). On-device translation for capable phones remains a future option if
  even the low per-turn cost becomes a concern at very large scale.
