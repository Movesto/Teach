"""Pre-translate learner-facing scaffolding text into Somali and store it inside
each lesson JSON under a "somali" block.

We store (rather than translate live) so lessons don't depend on NLLB being up
at request time, and so the output can be human-reviewed before it ships.

Coverage by tier (fields are detected per lesson, so mixed templates are fine):
  units 1-2  (bilingual):      description, objectives, grammar_discovery
                               explanations, target_language phrase glosses
  units 3-4  (template A):     objectives, target_phrases glosses, grammar_focus
                               title+explanation, vocabulary word glosses +
                               definitions, cultural_notes
  units 5-7  (template B):     objectives, language_focus title+explanation,
                               vocabulary_in_context word glosses + definitions,
                               quiz answer explanations

Run on the machine where the fine-tuned NLLB service is reachable (the GPU box):

    NLLB_URL=http://localhost:8001/translate python backend/scripts/generate_bilingual.py
    # specific units / re-bake existing blocks:
    python backend/scripts/generate_bilingual.py --units 3-7
    python backend/scripts/generate_bilingual.py --units 1-2 --force   # adds phrase glosses to beginner units

Lessons that already have a "somali" block are skipped unless --force is given,
so an interrupted run can simply be restarted. Files are written after each
lesson. Review the "somali" blocks (native-speaker pass for all Somali), then
commit.
"""
import argparse
import json
import glob
import os
import sys
import time
import urllib.request

NLLB_URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")
DEFAULT_UNITS = "3-7"  # phase-1 target; units 1-2 were baked earlier
RETRIES = 3

_cache: dict = {}


def translate(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    if text in _cache:
        return _cache[text]
    payload = json.dumps({"text": text, "direction": "eng_to_som"}).encode()
    req = urllib.request.Request(
        NLLB_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    last_err = None
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)["translation"]
            _cache[text] = out
            return out
        except Exception as e:  # noqa: BLE001 - retry any transport error
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"NLLB failed after {RETRIES} attempts: {last_err}")


def _gloss_vocab(entries: list) -> list:
    """Word gloss + translated definition. The English word is kept as the key
    so review and the SRS can join back to the source entry."""
    out = []
    for entry in entries:
        if not isinstance(entry, dict) or not entry.get("word"):
            continue
        out.append(
            {
                "word": entry["word"],
                "somali": translate(entry["word"]),
                "definition": translate(entry.get("definition", "")),
            }
        )
    return out


def build_somali(lesson: dict) -> dict:
    somali: dict = {}

    if lesson.get("description"):
        somali["description"] = translate(lesson["description"])

    objectives = [o for o in lesson.get("objectives", []) if isinstance(o, str)]
    if objectives:
        somali["objectives"] = [translate(o) for o in objectives]

    # -- units 1-2 ----------------------------------------------------------
    gd = lesson.get("grammar_discovery")
    sections = gd.get("sections") if isinstance(gd, dict) else None
    if sections:
        somali["grammar_discovery"] = {
            "sections": [
                {"explanation": translate(s.get("explanation", ""))}
                for s in sections
            ]
        }

    tl = lesson.get("target_language")
    tl_phrases = tl.get("phrases") if isinstance(tl, dict) else None
    if tl_phrases:
        somali["target_phrases"] = [translate(p) for p in tl_phrases if isinstance(p, str)]

    # -- template A (units 3-4, unit-5/lesson-7) ----------------------------
    phrases = lesson.get("target_phrases")
    if isinstance(phrases, list) and phrases:
        somali["target_phrases"] = [translate(p) for p in phrases if isinstance(p, str)]

    gf = lesson.get("grammar_focus")
    if isinstance(gf, list) and gf:
        somali["grammar_focus"] = [
            {
                "title": translate(item.get("title", "")),
                "explanation": translate(item.get("explanation", "")),
            }
            for item in gf
            if isinstance(item, dict)
        ]

    if isinstance(lesson.get("vocabulary"), list):
        glosses = _gloss_vocab(lesson["vocabulary"])
        if glosses:
            somali["vocabulary"] = glosses

    notes = lesson.get("cultural_notes")
    if isinstance(notes, list) and notes:
        somali["cultural_notes"] = [translate(n) for n in notes if isinstance(n, str)]

    # -- template B (units 5-8) ---------------------------------------------
    lf = lesson.get("language_focus")
    if isinstance(lf, dict) and (lf.get("explanation") or lf.get("title")):
        somali["language_focus"] = {
            "title": translate(lf.get("title", "")),
            "explanation": translate(lf.get("explanation", "")),
        }

    if isinstance(lesson.get("vocabulary_in_context"), list):
        glosses = _gloss_vocab(lesson["vocabulary_in_context"])
        if glosses:
            somali["vocabulary_in_context"] = glosses

    quiz = lesson.get("quiz")
    questions = quiz.get("questions") if isinstance(quiz, dict) else quiz
    if isinstance(questions, list):
        explanations = {}
        for idx, q in enumerate(questions):
            if isinstance(q, dict) and q.get("explanation"):
                key = str(q.get("id", idx))
                explanations[key] = translate(q["explanation"])
        if explanations:
            somali["quiz_explanations"] = explanations

    return somali


def parse_units(spec: str) -> list:
    units = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            lo, hi = part.split("-", 1)
            units.update(range(int(lo), int(hi) + 1))
        elif part:
            units.add(int(part))
    return sorted(units)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--units", default=DEFAULT_UNITS,
                    help=f"units to bake, e.g. '3-7' or '3,5,7' (default: {DEFAULT_UNITS})")
    ap.add_argument("--force", action="store_true",
                    help="re-translate lessons that already have a 'somali' block")
    args = ap.parse_args()

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    written = 0
    skipped = 0
    for unit in parse_units(args.units):
        pattern = os.path.join(backend_dir, f"unit-{unit}", "lesson-*.json")
        for path in sorted(glob.glob(pattern)):
            rel = os.path.relpath(path, backend_dir)
            with open(path, encoding="utf-8") as fh:
                lesson = json.load(fh)
            if lesson.get("somali") and not args.force:
                skipped += 1
                continue
            print(f"Translating {rel} ...", flush=True)
            try:
                lesson["somali"] = build_somali(lesson)
            except RuntimeError as e:
                print(f"  ABORTED on {rel}: {e}", file=sys.stderr)
                print("  Fix NLLB and re-run — already-written lessons are skipped.",
                      file=sys.stderr)
                sys.exit(1)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(lesson, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
            written += 1
    print(f"\nDone — wrote 'somali' blocks into {written} lesson file(s)"
          f" ({skipped} already baked, skipped).")
    print("Review the translations (native-speaker pass), then commit.")


if __name__ == "__main__":
    main()
