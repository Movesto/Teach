"""Generate the 6 progress-checkpoint tests (after units 2,4,6,8,10,12) with DeepSeek,
in the placement schema so they reuse the placement engine + UI. Each is a short,
level-calibrated check (grammar + reading + listening); we hand-write the CEFR bands.

    python backend/scripts/generate_checkpoints.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_capstone as gc  # reuse call() / parsing

PT_DIR = os.path.join(gc.BACKEND, "..", "services", "placement_test")

# after_unit -> (target cefr, one below, one above, next-unit-if-below)
CHECKPOINTS = [
    (2,  "A2", "A1", "B1", 1),
    (4,  "A2", "A1", "B1", 3),
    (6,  "B1", "A2", "B2", 5),
    (8,  "B2", "B1", "C1", 7),
    (10, "B2", "B1", "C1", 9),
    (12, "C1", "B2", "C1", 11),
]
UNIT_NAME = {1: "Daily Life", 3: "Work & Money", 5: "Transport & Travel",
             7: "Food & Eating", 9: "Advanced Communication", 11: "Academic English"}
CEFR_DESC = {"A1": "Beginner", "A2": "Elementary", "B1": "Intermediate",
             "B2": "Upper-Intermediate", "C1": "Advanced"}

SYS = ("You write short CEFR-calibrated English progress tests for adult learners. "
       "Output ONLY valid minified JSON, no prose, no code fences.")


def grammar(cefr):
    o = gc.call(SYS, f"""Write 8 CEFR {cefr} grammar/usage multiple-choice questions
appropriate for that level. JSON: {{"questions":[{{"question":"...","options":["a","b","c","d"],"correct":0}}]}}""")
    return [{"id": f"g{i+1}", "question": q["question"], "options": q["options"],
             "correct": q["correct"], "points": 2, "level": cefr}
            for i, q in enumerate(o["questions"][:8])]


def reading(cefr):
    words = {"A1": "80-120", "A2": "120-180", "B1": "200-280", "B2": "300-380", "C1": "380-450"}[cefr]
    o = gc.call(SYS, f"""Write ONE CEFR {cefr} reading passage ({words} words) and 6 multiple-choice
comprehension questions. JSON: {{"title":"...","text":"...","questions":[
{{"question":"...","options":["a","b","c","d"],"correct":0}}]}}""", max_tokens=4000)
    return [{"id": "rp1", "title": o.get("title", "Reading"), "text": o["text"], "level": cefr,
             "questions": [{"id": f"rp1q{i+1}", "question": q["question"], "options": q["options"],
                            "correct": q["correct"], "points": 3} for i, q in enumerate(o["questions"][:6])]}]


def listening(cefr):
    o = gc.call(SYS, f"""Write 4 CEFR {cefr} listening items. Each: a short level-appropriate
transcript and one question. JSON: {{"items":[{{"transcript":"...","question":"...",
"options":["a","b","c","d"],"correct":0}}]}}""", max_tokens=3000)
    return [{"id": f"l{i+1}", "transcript": q["transcript"], "question": q["question"],
             "options": q["options"], "correct": q["correct"], "points": 3}
            for i, q in enumerate(o.get("items", [])[:4])]


def build(after_unit, target, below, above, next_unit):
    g = grammar(target); r = reading(target); li = listening(target)
    pts = {"grammar": sum(q["points"] for q in g),
           "reading": sum(q["points"] for p in r for q in p["questions"]),
           "listening": sum(q["points"] for q in li)}
    total = sum(pts.values())
    levels = [
        {"min_score": 0, "max_score": 49.9, "level": CEFR_DESC[below], "cefr": below,
         "recommended_unit": next_unit, "unit_name": UNIT_NAME.get(next_unit, "Review"),
         "description": f"Below the {target} target — a little more practice will get you there.",
         "message": f"Keep going — review earlier units, then retake."},
        {"min_score": 50, "max_score": 79.9, "level": CEFR_DESC[target], "cefr": target,
         "recommended_unit": after_unit + 1, "unit_name": UNIT_NAME.get(after_unit + 1, "Next unit"),
         "description": f"Right on track — you are performing at {target}.",
         "message": f"Great work — you are at {target}. Keep moving forward."},
        {"min_score": 80, "max_score": 100, "level": CEFR_DESC[above], "cefr": above,
         "recommended_unit": after_unit + 1, "unit_name": UNIT_NAME.get(after_unit + 1, "Next unit"),
         "description": f"Ahead of schedule — you are already reaching {above}.",
         "message": f"Excellent — you are ahead, performing at {above}."},
    ]
    return {
        "id": f"checkpoint-{after_unit}", "title": f"Unit {after_unit} Checkpoint",
        "description": f"A quick {target} progress check after unit {after_unit}.",
        "version": "1.0", "total_time_minutes": 15, "total_points": total,
        "instructions": "Answer as many as you can — this shows how far you've come.",
        "sections": [
            {"id": "grammar", "title": "Grammar", "description": "", "points": pts["grammar"], "questions": g},
            {"id": "reading", "title": "Reading", "description": "", "points": pts["reading"], "passages": r},
            {"id": "listening", "title": "Listening", "description": "", "points": pts["listening"], "questions": li},
        ],
        "scoring": {"total_points": total, "breakdown": pts, "levels": levels},
    }


def main():
    only = sys.argv[1:] and set(int(x) for x in sys.argv[1:])
    for after_unit, target, below, above, next_unit in CHECKPOINTS:
        if only and after_unit not in only:
            continue
        out = os.path.join(PT_DIR, f"checkpoint-{after_unit}-test.json")
        if os.path.exists(out):
            print(f"skip checkpoint-{after_unit} (exists)")
            continue
        print(f"generating checkpoint-{after_unit} ({target})…", flush=True)
        test = build(after_unit, target, below, above, next_unit)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(test, f, ensure_ascii=False, indent=1)
        print(f"  -> {out} ({test['total_points']} pts)")


if __name__ == "__main__":
    main()
