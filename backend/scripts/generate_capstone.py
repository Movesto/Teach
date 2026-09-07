"""Generate the C1 capstone assessment (DeepSeek/OpenRouter) in the SAME schema as
placement-test.json, so it reuses the placement test UI + scoring. We hand-write the
scoring/levels (pass/fail against C1); DeepSeek writes the C1-level content per
section. Output: services/placement_test/capstone-test.json.

    python backend/scripts/generate_capstone.py
"""
import json
import os
import re
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
OUT = os.path.join(BACKEND, "..", "services", "placement_test", "capstone-test.json")
BASE = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.environ.get("READER_MODEL", "deepseek/deepseek-v4-flash-0731")


def key():
    for path in (os.path.join(BACKEND, "..", ".env"), os.path.join(os.getcwd(), ".env")):
        if os.path.isfile(path):
            for line in open(path, encoding="utf-8"):
                if line.strip().startswith("OPENROUTER_API_KEY"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("OPENROUTER_API_KEY", "")


def call(system, user, max_tokens=4000):
    body = {"model": MODEL, "messages": [{"role": "system", "content": system},
            {"role": "user", "content": user}], "max_tokens": max_tokens,
            "temperature": 0.7, "reasoning": {"max_tokens": 512}}
    for attempt in range(4):
        try:
            req = urllib.request.Request(BASE, data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
            d = json.load(urllib.request.urlopen(req, timeout=180))
            txt = (d["choices"][0]["message"].get("content") or "").strip()
            txt = re.sub(r"^```(?:json)?\s*", "", txt); txt = re.sub(r"\s*```$", "", txt)
            s, e = txt.find("{"), txt.rfind("}")
            return json.loads(txt[s:e + 1])
        except Exception as ex:
            print(f"  ! attempt {attempt+1}: {ex}", file=sys.stderr); time.sleep(2 * (attempt + 1))
    raise RuntimeError("generation failed")


SYS = ("You write a CEFR C1 English exam for adult learners (college-ready level). "
       "Output ONLY valid minified JSON, no prose, no code fences.")


def grammar():
    o = call(SYS, """Write 12 C1 grammar/usage multiple-choice questions (advanced structures:
inversion, cleft sentences, nuanced modals, conditionals, collocation, register).
JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"correct":0}]}""")
    return [{"id": f"g{i+1}", "question": q["question"], "options": q["options"],
             "correct": q["correct"], "points": 2, "level": "advanced"}
            for i, q in enumerate(o["questions"][:12])]


def reading():
    passages = []
    topics = ["a science/technology essay", "a social-science or economics argument",
              "a humanities/culture essay"]
    for pi, topic in enumerate(topics):
        o = call(SYS, f"""Write ONE C1 reading passage: {topic}, 380-450 words, dense and
academic. Then 5 multiple-choice questions testing inference, main idea, vocabulary in
context, and author's stance. JSON: {{"title":"...","text":"...","questions":[
{{"question":"...","options":["a","b","c","d"],"correct":0}}]}}""", max_tokens=5000)
        passages.append({"id": f"rp{pi+1}", "title": o.get("title", f"Passage {pi+1}"),
            "text": o["text"], "level": "advanced",
            "questions": [{"id": f"rp{pi+1}q{i+1}", "question": q["question"],
                "options": q["options"], "correct": q["correct"], "points": 3}
                for i, q in enumerate(o["questions"][:5])]})
    return passages


def listening():
    # Generate in small batches — 6-in-one truncates.
    items = []
    themes = ["an academic lecture snippet", "a radio interview", "a news analysis"]
    for theme in themes:
        o = call(SYS, f"""Write 2 C1 listening items based on {theme}. Each: a 60-110 word
transcript and one inference/detail question. JSON:
{{"items":[{{"transcript":"...","question":"...","options":["a","b","c","d"],"correct":0}}]}}""",
                 max_tokens=2500)
        items += o.get("items", [])[:2]
    return [{"id": f"cl{i+1}", "transcript": q["transcript"], "question": q["question"],
             "options": q["options"], "correct": q["correct"], "points": 3}
            for i, q in enumerate(items)]


def speaking():
    o = call(SYS, """Write 4 C1 speaking prompts (argue a position, compare viewpoints,
speculate, summarise-and-evaluate). Each with a one-sentence model opener.
JSON: {"prompts":[{"prompt":"...","example":"..."}]}""")
    return [{"id": f"s{i+1}", "prompt": p["prompt"], "example": p.get("example", ""), "points": 5}
            for i, p in enumerate(o["prompts"][:4])]


def main():
    print("generating capstone sections via", MODEL)
    g = grammar(); print(f"  grammar: {len(g)}")
    r = reading(); print(f"  reading: {len(r)} passages, {sum(len(p['questions']) for p in r)} q")
    li = listening(); print(f"  listening: {len(li)}")
    sp = speaking(); print(f"  speaking: {len(sp)}")

    pts = {"grammar": sum(q["points"] for q in g),
           "listening": sum(q["points"] for q in li),
           "reading": sum(q["points"] for p in r for q in p["questions"]),
           "speaking": sum(q["points"] for q in sp)}
    total = sum(pts.values())

    test = {
        "id": "c1-capstone", "title": "C1 Capstone Assessment",
        "description": "A full-length C1 (college-ready) assessment: grammar, reading, listening, and speaking.",
        "version": "1.0", "total_time_minutes": 90, "total_points": total,
        "instructions": "Work carefully. Passing (75%+) means you are performing at CEFR C1.",
        "sections": [
            {"id": "grammar", "title": "Grammar & Usage", "description": "Advanced structures", "points": pts["grammar"], "questions": g},
            {"id": "listening", "title": "Listening", "description": "Academic listening", "points": pts["listening"], "questions": li},
            {"id": "reading", "title": "Reading", "description": "C1 academic texts", "points": pts["reading"], "passages": r},
            {"id": "speaking", "title": "Speaking", "description": "Extended C1 speaking", "points": pts["speaking"], "prompts": sp},
        ],
        "scoring": {
            "total_points": total,
            "breakdown": pts,
            "levels": [
                {"min_score": 0, "max_score": 59.9, "level": "Approaching C1", "cefr": "B2",
                 "recommended_unit": 12, "unit_name": "C1 Capstone",
                 "description": "Strong B2 — not yet C1. Keep working through units 12–13 and the C1 readers.",
                 "message": "So close. Review the C1 material and try again."},
                {"min_score": 60, "max_score": 74.9, "level": "Nearly C1", "cefr": "B2",
                 "recommended_unit": 13, "unit_name": "C1 Capstone",
                 "description": "On the C1 threshold. A little more consolidation will get you there.",
                 "message": "Almost there — polish the areas you missed and retake."},
                {"min_score": 75, "max_score": 100, "level": "C1 — College Ready", "cefr": "C1",
                 "recommended_unit": 13, "unit_name": "C1 Capstone",
                 "description": "You are performing at CEFR C1 — genuinely college-ready in English.",
                 "message": "Outstanding. You have reached C1 — college-ready. Claim your certificate."},
            ],
        },
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(test, f, ensure_ascii=False, indent=1)
    print(f"total points {total} -> {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
