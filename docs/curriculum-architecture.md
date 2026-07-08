# Curriculum Architecture

How the learning experience is organized — the mental model that ties the lessons,
the conversation practice, and the audio together into one coherent, bottom-to-top
path. Read this before adding content or features so everything stays aligned.

## The problem this solves

The app grew three separate learning "silos" that don't know about each other:

- **Lessons** (`/api/lessons`, units 1–13) — structured skill-building
- **Conversation** (`/api/conversation`) — a free-form, time-limited daily chat that
  isn't tied to any lesson
- **Books** (`/api/books`) — a separate reading track

…plus a **vocabulary SRS** and a **placement test** floating alongside. Progression
wasn't gated (every unit was `locked: false`), so there was no "start here → finish
there" path, and the earliest beginner lessons were English-only — unusable for a
true Somali monolingual without leaning entirely on live translation.

## The goal

An English course for Somali speakers that reads like school: a clear path from the
bottom (survival English, heavily supported in Somali) to the top (full English
immersion), where every feature we already built has one obvious job.

## The mental model: one spine, three stages

Stop thinking "lessons vs. conversation." There is **one curriculum spine**, and
every lesson runs the same three stages — the classic "I do → we do → you do":

```
PLACEMENT TEST → recommends your starting UNIT
      │
      ▼   (SOFT gate: recommended path + "you are here" progress; learners CAN jump)
   UNITS 1─────2─────3─────────7─────8────────────13
   tier: │ bilingual │  English-first  │   immersion   │   ← Somali support fades
      │
      └── each LESSON = Receive → Practice → Produce
            Receive : story/reading + listening audio (Kokoro TTS ← transcript)
                      new words seed the VOCABULARY SRS
            Practice: drills · grammar discovery · quiz · speaking (pronunciation svc)
                      SRS reviews
            Produce : CONVERSATION, scoped to THIS lesson's scenario + phrases
      │
      ▼
   END-OF-UNIT TEST (unit-tests/) → marks mastery, recommends the next unit
```

Every existing piece now has one home:

| Component | Role in the spine |
|---|---|
| Lessons (units 1–13) | The spine itself — the ordered path |
| Kokoro TTS (`/api/tts`) | The **voice** of Receive (listening) + Produce (tutor turns) |
| Pronunciation service | The **ear** of Practice + Produce (scores the learner speaking) |
| Conversation | The **Produce** stage — scoped to the current lesson |
| Vocabulary SRS | **Memory** across lessons — fed by each lesson's new words |
| Placement test | The **entry point** — sets the recommended starting unit |
| Books | Optional **extensive-reading** enrichment, tagged by level |

## The three design decisions

### 1. Conversation is lesson-anchored
Each lesson builds a **scoped** conversation: the system prompt is assembled from the
lesson's objectives, target phrases, and story scenario. Lesson 1 ("Meeting Your
Neighbor") → role-play meeting the neighbor, reusing its phrases. This is how the
"practice conversation" and the "audio lessons" finally go hand in hand: conversation
is the *Produce* stage of the same pipeline, not a separate product.

The old free-form daily chat survives as an optional **"open gym,"** surfaced mainly
in the immersion tier (units 8–13) where free practice is the point.

### 2. Progression is soft-gated
No hard locks. The school-like feel comes from a clear linear map, progress tracking,
and a recommended "next lesson/unit" — but a motivated learner can jump ahead. The
placement test drops them at the right unit; from there the path is *suggested*, not
enforced.

### 3. Somali support fades from bottom to top
A single `support_level` — derived from the unit — is the **one source of truth** for
how much Somali appears everywhere (lesson rendering, tutor defaults, conversation
language policy):

| Tier | Units | Somali support |
|---|---|---|
| `bilingual` | 1–2 | Objectives/instructions shown in Somali **+** English (baked in); tutor offers Somali proactively; conversation accepts Somali input |
| `english_first` | 3–7 | English instructions; "Get Help in Somali" **on demand only** (today's behavior) |
| `immersion` | 8–13 | English-only; Somali disabled / last-resort |

This is the answer to "support the beginner, but don't hold their hand to the top":
one system (NLLB + Qwen + conversation) with a level parameter, weaning the learner
off Somali as they climb.

## Data-model implications

These are the concrete shape changes each phase introduces (details in each phase):

- **Canonical level field** — today lessons split between `level` (69) and
  `difficulty` (24). Pick one; derive `support_level` from it.
- **`transcript` on listening items** — TTS needs source text to speak; the audio
  file stays generated-and-cached (never committed), which is why `backend/audio/`
  is empty and gitignored.
- **Bilingual fields for units 1–2** — store Somali objectives/instructions
  (pre-translated with the fine-tuned NLLB, then human-checked) so the most critical
  lessons don't depend on live translation.
- **`lesson_id` on conversation** — to build the scoped scenario prompt.

## Build order

Each phase ships independently and reuses what's already built.

| Phase | What | Notes |
|---|---|---|
| **1. Spine legibility** | `support_level(unit)` helper · canonical level field · "you are here" progress map | Foundation; low risk |
| **2. Beginner fix** | Bake Somali into units 1–2 (pre-translated, stored) | Unblocks monolinguals |
| **3. Listening** | Add `transcript` to listening items; Kokoro generates + caches on first access | Turns on a whole skill |
| **4. Lesson-anchored convo** | Conversation takes `lesson_id` → scoped scenario prompt; reuse session/TTS/pronunciation | Connects the silos |
| **5. Scaffolding fade** | Wire `support_level` into tutor + conversation language policy | Delivers bottom→top weaning |

## Non-goals / deferred

- **Hard gating / enforced prerequisites** — chosen soft-gate instead.
- **Removing the free daily chat** — kept as the immersion-tier "open gym."
- **Rewriting the 4 authored lesson schemas** — the normalization layer in
  `backend/routers/lessons.py` already unifies them at read time; a single canonical
  schema is a nice-to-have, not required for this architecture.
