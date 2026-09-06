# Content Roadmap: Zero → C1

Goal: a learner with no money can go from zero English to **C1 — genuinely
college-ready** — using only this app. "C1" is defined measurably: able to pass
the app's full-length C1 capstone assessment (IELTS ~6.5–7 / TOEFL ~95 task
shapes). Beyond C1, the app's job is the bridge: teaching learners to work with
authentic materials on their own (Phase 7).

This roadmap fixes the content gaps found in the 2026-07 audit and adds the
learner-experience features that make an ~18-month journey survivable —
retention is a C1 requirement, not a nice-to-have. Work through phases in
order; each phase is independently shippable.

**Audit summary (2026-07-28):** structure is complete (all 94 lessons have
reading, listening w/ transcript, speaking, writing, grammar, quiz) and quality
at both ends is high. The gaps are: (1) input volume — total learner-facing text
≈ 40–50K words vs ~1–2M words of cumulative reading needed for C1; (2) upper-unit
texts are ~265 words vs the 700–900-word C1 exam standard; (3) units 5–8 (the
B1–B2 plateau, the longest part of the climb) have the fewest lessons and 4-question
quizzes; (4) Somali support ends at unit 2 though units 3–7 are designed as
"Somali on demand".

**Where things run:** this dev machine has no GPU. NLLB (Somali baking) runs on
the GPU box. All authoring, script changes, review, and commits happen here;
steps marked **[GPU box]** are run there and the output JSON is copied back /
committed here.

**Content production workflow (applies to every phase):**
1. Generate drafts in batches offline (strong LLM, one-time cost) → JSON matching
   the existing lesson/reader schemas
2. Validate: every file loads through `normalize_lesson()` without errors;
   listening items have `transcript`; quiz `correct` indices in range
3. Human review (you) for pedagogy + level fit; native-speaker review for all
   baked Somali before commit
4. Commit per batch with a clear message; never commit unreviewed Somali

---

## Phase 1 — Somali scaffolding for units 3–7 (free "on demand" support without runtime AI)

- [x] Extend `backend/scripts/generate_bilingual.py` to cover units 3–7 and the
      fields their templates use: `grammar_focus` / `language_focus` explanations,
      `objectives`, `cultural_notes`, and quiz `explanation` fields
      (field-driven, resumable, `--units`/`--force` args, string cache, retries)
- [x] Add vocabulary glossing to the script: every `target_phrases` /
      `vocabulary` / `vocabulary_in_context` entry gets a stored Somali gloss
      (these also feed the SRS in Phase 5)
- [x] Frontend: `LessonView` + `IntermediateLesson` + `Quiz` render the baked
      Somali as on-demand reveals for tier `english_first` (a "Soomaali" toggle;
      always-on for `bilingual` units 1–2, hidden for `immersion`). Backend
      `normalize_lesson` mirrors `somali.grammar_focus` → `somali.grammar_discovery`
- [ ] **[GPU box]** Run the extended script against live NLLB for units 3–7:
      `NLLB_URL=http://localhost:8001/translate python backend/scripts/generate_bilingual.py --units 3-7`
- [ ] Native-speaker review of all generated Somali; correct and re-run as needed
- [ ] Commit baked `somali` blocks into unit-3..7 lesson JSON

**Done when:** a free user in units 3–7 can get Somali help on grammar
explanations and vocabulary with zero runtime AI calls.

## Phase 2 — Exam-calibre input in units 9–13 (upgrade 33 existing lessons)

**Method (proven on unit-9 lessons 1–2): expand by APPENDING, never rewrite.**
`critical_reading` answers, `quiz` explanations, and `advanced_grammar` examples
quote the `authentic_text` verbatim — a rewrite breaks them. So: keep every
existing paragraph intact, append 3–4 new paragraphs that deepen the argument
(worked example → structural cause → the written channel / nuance → a reframing
close), then ADD ~4 new questions targeting only the new material (existing Qs
stay valid automatically). Extend each listening transcript by continuing the
same speaker's talk (opening preserved, so the existing question stays
answerable). Patch with a per-lesson Python script (load JSON → append with real
`\n\n` → dump) to avoid JSON-escape errors; validate each via `_validate_lesson`
+ `normalize_lesson`, and confirm no verbatim quote was lost.

Progress: **ALL 33 LESSONS COMPLETE (units 9–13)** — done 2026-07-28.
authentic_text 663–948 words (avg 777); critical_reading 9 questions each;
listening transcripts 306–493 words (avg 378, ~2.5–3.5 min lectures). All 33
validate via `_validate_lesson` + `normalize_lesson`, and the full on-disk lesson
index builds cleanly. Genre-authentic throughout: essays extended as essays,
the escalation email (11.2) and civic-planning letter (12.3) as full
correspondences, the performance review (11.3) and dispute memo (11.6) with
further sections. Append-only — every verbatim phrase quoted by existing
questions/grammar preserved. NOT yet committed.

- [x] Expand each `authentic_text` from ~265 to 700–900 words — *33/33 done*
- [x] Expand each listening transcript toward 400–600 words (~3–4 min audio) —
      *33/33* (avg 378; units 12–13 landing 400–490)
- [x] Units 11–13 **note-taking task** (2026-07-28): added a `note_taking`
      block (`prompt` + telegraphic `model_notes`) to all 18 lessons, and a
      renderable panel in `AdvancedLesson.jsx` listening section — focus prompt,
      a notes textarea (persisted to localStorage), and a "compare with model
      notes" self-check reveal. Data-driven (renders only when present, so
      units 9–10 are unaffected). `normalize_lesson` passes the field through.
- [ ] Regenerate/clear stale listening audio cache for changed transcripts
      (on-demand endpoint regenerates; or clear cache on GPU box).
- [ ] Units 11–13: convert at least one listening per lesson to lecture-style
      (monologue, academic register) and add a note-taking task to `speaking_task`
      or a new `listening_task` field
- [ ] QA: verify every comprehension/critical_reading answer is still supported
      by the expanded text (regenerate answers alongside texts, then spot-check)
- [ ] **[GPU box or runtime]** Regenerate cached audio for changed transcripts
      (or just delete stale cache — `/api/lessons/{id}/listen/{idx}` regenerates
      on demand)

**Done when:** upper-unit reading/listening lengths match IELTS/TOEFL task
dimensions.

## Phase 3 — Thicken the B1–B2 plateau (units 5–8: 6 → 10 lessons each)

**Done 2026-07-29.** Decision: the units.json catalog themes for 5–8 did NOT
match the actual lesson content, so new lessons deepen the REAL themes and the
stale catalog titles/descriptions/counts were corrected. New themes: unit 5
Transport, 6 Housing, 7 Food, 8 Education & Technology. New lesson ids 107–122
(max prior id was 106); lesson numbers continue the existing sequence.
Committed one unit per commit, plus a final quiz-expansion commit.

- [x] Author +4 lessons per unit (+16 total) using the units 5–8 intermediate
      template (all 8 sections). Passages 409–498 words; two listening dialogues
      each (~120–165 words per dialogue, matching the existing unit 5–8 register);
      8-question quizzes.
- [x] New reading passages at 400–500 words *(listening kept to the existing
      intermediate ~120–165-word dialogue length rather than the 200–300 in the
      original plan — matches the surrounding lessons; revisit if longer wanted)*
- [x] Bring ALL unit 5–8 quizzes (existing + new) from 4 to 8+ questions —
      24 existing lessons each got +4 questions grounded in their own passage,
      vocab definitions, and grammar focus (96 new questions); new lessons ship
      with 8. Validated: no dup quiz ids, correct-indices in range.
- [ ] *(Deferred)* Grow the existing 24 passages toward 400+ words — NOT done;
      they remain ~205–280 words. Lower priority than the +16 lessons and quizzes.
- [x] Update `backend/units.json` `total_lessons` (5:11, 6:10, 7:10, 8:10) and
      retitle to match content. Unit-tests in `backend/unit-tests/` are
      self-contained (own 10-question set, no lesson-count/id references) so they
      still pass unchanged; *(optional, deferred)* extend them to cover new topics.
- [x] Verified lesson numbering/IDs: all 110 lessons load, no duplicate ids,
      catalog counts match on-disk counts, full index builds.

**Done when:** the A2→B2 stretch has proportionate volume (no more 6-lesson
units in the longest part of the climb). ✅ Units 5–8 now have 11/10/10/10
lessons with 8-question quizzes.

## Phase 4 — In-app graded reading library (the volume engine)

Content:
- [ ] Define reader JSON schema (id, title, level, interest tags, chapters[],
      per-chapter question bank — reuse the `books/question-banks.json` shapes)
- [ ] Wave 1: 20 readers — A2 ×10 (1–2K words), B1 ×10 (3–5K words); mix of
      original graded stories and adapted public-domain texts; spread across
      interest tags (everyday life, work, sport, tech, history, faith & culture)
- [ ] Wave 2: +20 readers — B2 ×10 (5–8K), C1 ×10 (8–12K, incl. essays and
      non-fiction — the shelf that carries the final climb to C1)
- [ ] Question bank per chapter (comprehension + vocabulary), answers embedded
      for deterministic grading

App work:
- [ ] Backend: readers catalog + chapter endpoints; per-chapter audio via the
      existing `synthesize()` cache pattern
- [ ] Frontend: reader view with bookmark ("your current book"), chapter
      questions, level/interest filters; surface "reading period" on the dashboard
- [ ] Track words-read per user (feeds the progress display in Phase 5/6)

**Done when:** a learner at any level from A2 up always has a next book, in-app,
with audio, for free.

## Phase 5 — Vocabulary with a destination

- [ ] Add word lists to the repo: NGSL core (~2,800 words) mapped to units 1–8;
      Academic Word List (~570 families) mapped to units 9–13
- [ ] Tag each lesson and reader with the list-words it introduces (script over
      existing content; new content tagged at authoring time)
- [ ] Somali glosses for all list words (from Phase 1 script output; fill any
      remainder **[GPU box]**)
- [ ] SRS upgrades: seed from tagged content; example sentence + audio per card
- [ ] Coverage display: "you know N of ~8,500 C1-level words" on dashboard/progress

**Done when:** vocabulary progress is a visible number tied to a real C1 target.

## Phase 6 — Prove it: C1 exam alignment + checkpoints

- [ ] Checkpoint test after every 2 units, built on the placement-test machinery
      (score → CEFR estimate); show "then vs now" against their placement result
- [ ] Units 11–13 assessments in exam shapes: timed essay (30–40 min) in
      `extended_writing`, long passage with 10+ mixed-type questions, integrated
      listen-then-write task
- [ ] Add can-do statements per unit (CEFR descriptors), checked off at unit
      completion
- [ ] **C1 capstone**: a full-length practice assessment (reading + listening +
      writing + speaking prompts) assembled from unit 12–13 content and C1-shelf
      readers, timed, scored against C1 band descriptors. Passing it = the app's
      "college-ready" claim, stated in-app in those words
- [ ] Checkpoint **certificates**: a shareable/printable certificate per
      checkpoint and for the C1 capstone — tangible proof of level for jobs and
      applications

**Done when:** "finished unit 13 and passed the capstone" is a measurable,
defensible C1 claim.

## Phase 7 — Learner experience: retention + the authentic bridge

The features that keep a learner alive for 18 months and carry them past what
TTS-and-lessons can teach. All deterministic, all free-tier.

Daily engine ("school feeling"):
- [ ] Daily plan generator on the dashboard: today's lesson + reading period
      (current book) + conversation practice + SRS review, sized to the user's
      available minutes
- [ ] Homework loop: the lesson's writing task is assigned, due "tomorrow", and
      reviewed on return (self-check against model answer)
- [ ] Weekly auto-review session assembled from that week's mistakes and due vocab
- [ ] Monthly "report card": words learned, words read, hours listened, level line

Practice modes (built from existing transcripts/audio/mic code):
- [ ] **Dictation**: TTS plays a transcript sentence, learner types it; exact-match
      scoring with diff highlighting. Highest value-per-effort feature available
- [ ] **Mistake notebook**: wrong quiz answers and corrected errors auto-collected
      into a personal SRS deck
- [ ] **Shadowing**: play a dialogue line, record, play both back-to-back
- [ ] Audio variety: multiple edge-tts voices (US/UK + Kenyan/Nigerian/Tanzanian
      English) and playback speed control on all audio — authenticity training
      for B1+

The authentic-materials bridge (how learners finish the climb to C1):
- [ ] Per-level "real world" assignments from B1 up: curated authentic materials
      (news article, talk, podcast episode, academic excerpt) wrapped in the
      app's own task apparatus (comprehension Qs, vocab extraction, summary task).
      Content cost ≈ 0 — we author tasks, not texts
- [ ] Frame it as the unlock/reward: "you are ready to read this real thing"

Access + feedback (mission-critical for the free user):
- [ ] PWA / offline mode: downloadable lessons, readers, and audio for low-data
      Android use — for the target audience this rivals any pedagogical feature
- [ ] Basic AI writing feedback **free at 1/day** (costs ~a penny; at C1 feedback
      is load-bearing, not a luxury — the paid tier keeps unlimited + deeper
      feedback and AI conversation). Depends on the platform work (cloud LLM)
- [ ] Speaking-club prompts: a weekly discussion prompt per level band that
      learners can take to any partner/group (Telegram/WhatsApp community link)

**Done when:** a learner opens the app any day and knows exactly what to do,
sees their progress monthly, practices all four skills without AI, and from B1
up is regularly succeeding with real-world English.

---

## Sequencing notes

- Phases 1–3 are pure content on the existing app — no schema or feature risk.
  Phase 4 is the first with real backend/frontend work. Phases 5–6 build on 1–4.
- Phase 7 items are independent of each other — cherry-pick early wins any time
  after Phase 1 (dictation and the mistake notebook need nothing from Phases 2–6
  and can ship whenever app-side work is on the table; the free-writing-feedback
  item waits for the cloud-LLM swap).
- The separately-agreed platform work (drop local Qwen → cloud LLM, plan flag,
  scripted conversations — see plan `dazzling-munching-glacier.md` and memory
  `drop-qwen-direction`) can proceed in parallel; nothing here depends on it
  except that Phase 1 removes the free tier's dependence on runtime AI for
  Somali help.
- Keep the GPU box's NLLB alive at least through Phases 1 and 5 (last baking
  runs). After that, nothing at runtime needs it except the on-demand translate
  button.
