# Graded Reader schema (Phase 4 — in-app reading library)

Readers are **original, in-app** graded texts (unlike `books/book-library.json`,
which references external PDFs). Each reader holds its full prose so the app can
display it and synthesize audio on demand (same `synthesize()` cache pattern as
lessons). One reader = one JSON file under `backend/readers/<id>.json`.

The question/writing shapes are reused verbatim from `books/question-banks.json`
so the frontend and grading logic can be shared.

```jsonc
{
  "id": "reader-1",                     // unique, "reader-N"
  "title": "The New Neighbour",
  "author": "Barashada Ingiriisiga",    // original content, not a real author
  "level": "A2",                        // A2 | B1 | B2 | C1
  "cefr": "elementary",                 // elementary|intermediate|upper-intermediate|advanced
  "interest_tags": ["everyday life", "community"],  // from the fixed tag set below
  "genre": "Short fiction",
  "description": "One-sentence blurb for the catalog card.",
  "word_count": 1480,                   // sum of chapter word_counts (filled by harness)
  "reading_time_minutes": 8,            // word_count / 180, rounded
  "chapters": [
    {
      "id": "reader-1-ch-1",
      "title": "Moving day",
      "text": "Full prose. Real paragraphs separated by \\n\\n.",
      "word_count": 500,                // filled by harness
      "questions": [
        {
          "id": "reader-1-ch-1-q1",
          "type": "comprehension",      // comprehension | vocabulary
          "question": "Why did Amina move?",
          "options": ["...", "...", "...", "..."],   // exactly 4
          "correct": 2,                 // 0-based index into options; MUST be in range
          "explanation": "Quotes/paraphrases the text so grading is defensible."
        }
      ],
      "vocabulary": [                    // optional; key words introduced in this chapter
        { "word": "landlord", "definition": "the person who owns a rented home" }
      ]
    }
  ],
  "writing_prompt": {                    // one per reader (optional)
    "prompt": "Write about a time you moved to a new place.",
    "word_count_min": 60,
    "word_count_max": 120
  }
}
```

## Fixed interest-tag set
`everyday life`, `work`, `sport`, `tech`, `history`, `faith & culture`,
`science & nature`, `health`, `travel`, `money`.

## Level → target dimensions (per roadmap Phase 4)
| level | total words | chapters | words/chapter | questions/chapter |
|-------|-------------|----------|---------------|-------------------|
| A2    | 1000–2000   | 3        | ~350–500      | 4                 |
| B1    | 3000–5000   | 4–5      | ~700–900      | 5                 |
| B2    | 5000–8000   | 5–6      | ~1000–1300    | 6                 |
| C1    | 8000–12000  | 6–8      | ~1300–1600    | 7                 |

## Validation (enforced by `generate_readers.py` and re-checkable standalone)
- JSON parses; all required fields present.
- `level` in {A2,B1,B2,C1}; `interest_tags` ⊆ the fixed set.
- Each chapter `text` non-empty; word count within ±25% of the level target.
- Each question has exactly 4 `options`, `type` in {comprehension,vocabulary},
  and `0 <= correct < len(options)`.
- All ids unique within the reader; chapter ids prefixed by the reader id.
