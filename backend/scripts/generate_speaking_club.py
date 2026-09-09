"""Generate speaking-club discussion prompts per CEFR level with DeepSeek →
backend/data/speaking-club.json = {level: [prompt, ...]}. A weekly prompt learners
can take to a partner or group (Phase 7).

    python backend/scripts/generate_speaking_club.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_capstone as gc

OUT = os.path.join(gc.BACKEND, "data", "speaking-club.json")
LEVELS = {
    "A2": "everyday topics (family, food, work, daily life)",
    "B1": "opinions and experiences (travel, money, technology, community)",
    "B2": "issues and ideas (education, environment, culture, media)",
    "C1": "abstract and debatable topics (ethics, society, progress, identity)",
}
SYS = ("You write friendly ENGLISH discussion prompts for adult learners to talk about "
       "in a group or with a partner. Output ONLY valid minified JSON, no prose.")


def main():
    out = {}
    if os.path.exists(OUT):
        out = json.load(open(OUT, encoding="utf-8"))
    for level, theme in LEVELS.items():
        if out.get(level):
            print(f"skip {level}"); continue
        print(f"generating {level}…", flush=True)
        o = gc.call(SYS, f"""Write 10 CEFR {level} discussion prompts about {theme}. Each is one
open, engaging question a small group can talk about for a few minutes; simple, inclusive,
culturally respectful. JSON: {{"prompts":["...","..."]}}""")
        out[level] = [p for p in o.get("prompts", []) if isinstance(p, str)][:10]
        json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("done:", {k: len(v) for k, v in out.items()}, "->", OUT)


if __name__ == "__main__":
    main()
