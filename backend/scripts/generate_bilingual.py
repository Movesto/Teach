"""Pre-translate the learner-facing text of the beginner units (1–2) into Somali
and store it inside each lesson JSON under a "somali" block.

We store (rather than translate live) so the most critical lessons don't depend on
NLLB being up at request time, and so the output can be human-reviewed before it
ships. Run this on the machine where the fine-tuned NLLB service is reachable:

    NLLB_URL=http://localhost:8001/translate python backend/scripts/generate_bilingual.py

Then review the "somali" blocks it writes and commit them.
"""
import os
import json
import glob
import urllib.request

NLLB_URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")
UNITS = [1, 2]  # the "bilingual" tier — keep in sync with BILINGUAL_MAX_UNIT in config.py


def translate(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    payload = json.dumps({"text": text, "direction": "eng_to_som"}).encode()
    req = urllib.request.Request(
        NLLB_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["translation"]


def build_somali(lesson: dict) -> dict:
    """Translate the fields a true beginner needs to read to get started:
    the lesson description, the objectives, and the grammar-discovery explanations."""
    somali: dict = {}

    if lesson.get("description"):
        somali["description"] = translate(lesson["description"])

    objectives = [o for o in lesson.get("objectives", []) if isinstance(o, str)]
    if objectives:
        somali["objectives"] = [translate(o) for o in objectives]

    gd = lesson.get("grammar_discovery")
    sections = gd.get("sections") if isinstance(gd, dict) else None
    if sections:
        somali["grammar_discovery"] = {
            "sections": [
                {"explanation": translate(s.get("explanation", ""))}
                for s in sections
            ]
        }

    return somali


def main() -> None:
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    total = 0
    for unit in UNITS:
        pattern = os.path.join(backend_dir, f"unit-{unit}", "lesson-*.json")
        for path in sorted(glob.glob(pattern)):
            with open(path, encoding="utf-8") as fh:
                lesson = json.load(fh)
            print(f"Translating {os.path.relpath(path, backend_dir)} ...")
            lesson["somali"] = build_somali(lesson)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(lesson, fh, ensure_ascii=False, indent=2)
            total += 1
    print(f"\nDone — wrote 'somali' blocks into {total} lesson file(s).")
    print("Review the translations, then commit the changes.")


if __name__ == "__main__":
    main()
