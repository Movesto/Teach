# Target vocabulary lists (Phase 5)

The measurable vocabulary target for the "you know N of ~3,800 words" coverage
display. One headword (lemma) per line, lowercased.

| File | Words | What |
|------|-------|------|
| `ngsl.txt` | 2801 | **New General Service List** — the ~2,800 highest-value general words (covers the bulk of everyday English). Mapped to units 1–8. |
| `nawl.txt` | 959 | **New Academic Word List** — academic vocabulary built on the same corpus as the NGSL (the modern successor to Coxhead's AWL; paired with it by design). Mapped to units 9–13. |
| `supplementary.txt` | 47 | NGSL supplementary set — numbers, days, months, etc. |

**Total target: ~3,807 words.**

## Source & licence
Extracted from the New General Service List project data (NGSL 1.01 + NAWL),
via the `antdurrant/word.lists` dataset. The NGSL/NAWL are published by
Browne, Culligan & Phillips under Creative Commons (Attribution / ShareAlike) —
see http://www.newgeneralservicelist.org/ . Attribute the NGSL/NAWL when
surfacing the lists to end users.

We use the NAWL rather than Coxhead's original 570-family AWL (which the roadmap
named) because it shares the NGSL corpus and headword conventions, giving one
consistent, non-overlapping general+academic target.

Regenerate: the lists are static; to refresh, re-extract the `Lemma`/`Wordlist`
columns from the NGSL project spreadsheet (one word per line, lowercased).
