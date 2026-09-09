"""Generate the units 11-13 exam-shape writing assessments with DeepSeek:
a timed C1 essay + an integrated listen-then-write task per unit. Output:
services/placement_test/writing-exams.json. Grading reuses /api/writing/assess.

    python backend/scripts/generate_writing_exams.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_capstone as gc  # reuse call()

OUT = os.path.join(gc.BACKEND, "..", "services", "placement_test", "writing-exams.json")

UNITS = {
    11: "Academic English — argue a thesis with evidence and academic register",
    12: "Professional Mastery — executive/diplomatic communication and persuasion",
    13: "American Life & Social Fluency — culture, society, and informal register",
}
SYS = ("You write CEFR C1 exam tasks for adult learners. Output ONLY valid minified "
       "JSON, no prose, no code fences.")


def make(unit, theme):
    essay = gc.call(SYS, f"""Write ONE timed C1 essay exam task for the theme: {theme}.
JSON: {{"prompt":"a demanding, specific essay question (2-3 sentences)","minutes":40,
"min_words":250,"max_words":350}}""")
    lw = gc.call(SYS, f"""Write ONE integrated 'listen then write' C1 task for: {theme}.
Give a 90-140 word spoken transcript (a short lecture/briefing) and a writing prompt asking
the learner to summarise and respond to it. JSON: {{"transcript":"...","prompt":"...",
"minutes":25,"min_words":150,"max_words":250}}""", max_tokens=2000)
    return {
        "unit": unit,
        "essay": {"prompt": essay["prompt"], "minutes": essay.get("minutes", 40),
                  "min_words": essay.get("min_words", 250), "max_words": essay.get("max_words", 350)},
        "listen_write": {"transcript": lw["transcript"], "prompt": lw["prompt"],
                         "minutes": lw.get("minutes", 25), "min_words": lw.get("min_words", 150),
                         "max_words": lw.get("max_words", 250)},
    }


def main():
    exams = {}
    if os.path.exists(OUT):
        exams = json.load(open(OUT, encoding="utf-8"))
    for unit, theme in UNITS.items():
        if str(unit) in exams:
            print(f"skip unit {unit}"); continue
        print(f"generating unit {unit} exam…", flush=True)
        exams[str(unit)] = make(unit, theme)
        json.dump(exams, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"done: {len(exams)} unit exams -> {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
