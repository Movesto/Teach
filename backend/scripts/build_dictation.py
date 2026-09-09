"""Build a dictation sentence bank from the graded readers (per CEFR level) →
backend/data/dictation.json = {level: [{"id","text"}]}.

Dictation: the app plays a sentence (TTS), the learner types what they hear, and
the server scores it against the hidden text. Sentences come from existing reader
prose, so no new content is generated. Deterministic; re-run when readers change.

    python backend/scripts/build_dictation.py
"""
import json
import os
import re
from glob import glob

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
OUT = os.path.join(BACKEND, "data", "dictation.json")

_SENT = re.compile(r"(?<=[.!?])\s+")
# clean, self-contained sentences make good dictation: reasonable length, plain
# punctuation, start with a capital letter, no dialogue quotes or list fragments.
_OK = re.compile(r"^[A-Z][^\"“”\n]*[.!?]$")


def sentences(text):
    for s in _SENT.split(text or ""):
        s = s.strip()
        n = len(s.split())
        if 6 <= n <= 16 and _OK.match(s) and "—" not in s and ":" not in s and ";" not in s:
            yield s


def main():
    by_level = {"A2": [], "B1": [], "B2": [], "C1": []}
    seen = set()
    for path in sorted(glob(os.path.join(BACKEND, "readers", "reader-*.json"))):
        data = json.load(open(path, encoding="utf-8"))
        level = data.get("level")
        if level not in by_level:
            continue
        for ch in data.get("chapters", []):
            for s in sentences(ch.get("text", "")):
                key = s.lower()
                if key in seen:
                    continue
                seen.add(key)
                by_level[level].append(s)

    out = {}
    for level, sents in by_level.items():
        # keep a manageable, varied bank per level
        picked = sents[:120]
        out[level] = [{"id": f"dict-{level}-{i+1}", "text": s} for i, s in enumerate(picked)]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("dictation bank:", {k: len(v) for k, v in out.items()}, "->", OUT)


if __name__ == "__main__":
    main()
