"""Generate in-app graded readers (Phase 4) with a cheap offline LLM via OpenRouter.

The heavy lifting — tens of thousands of words of original reader prose plus
question banks — is done by an inexpensive model (DeepSeek on OpenRouter), NOT by
the coding assistant, to keep that cost down. We author the harness, prompts, and
validator here; the model fills in the prose; a human spot-checks the output.

Schema: see docs/reader-schema.md. One reader per file: backend/readers/<id>.json.

Each reader is built in two stages so responses stay small and reliable (a single
giant JSON tends to truncate or mis-escape):
  1. OUTLINE  — one call: description, chapter titles + summaries + target words,
                writing prompt.
  2. CHAPTERS — one call per chapter: full prose + questions + vocabulary, given
                the premise, the whole outline, and summaries of earlier chapters
                (so the story stays coherent).

Config (env, or a KEY=VALUE line in ./.env or ../.env):
  OPENROUTER_API_KEY   required
  READER_MODEL         default: deepseek/deepseek-v4-flash-0731
  OPENROUTER_BASE      default: https://openrouter.ai/api/v1

Usage:
  python backend/scripts/generate_readers.py --limit 1          # pilot: first pending reader
  python backend/scripts/generate_readers.py --ids reader-1,reader-2
  python backend/scripts/generate_readers.py                    # all pending in the manifest
  python backend/scripts/generate_readers.py --force --ids reader-1   # regenerate
  python backend/scripts/generate_readers.py --validate-only    # re-check existing files only

Readers whose file already exists are skipped unless --force, so an interrupted
run just restarts. Each reader is validated before it is written.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
READERS_DIR = os.path.join(BACKEND, "readers")
MANIFEST = os.path.join(READERS_DIR, "manifest.json")

BASE = os.environ.get("OPENROUTER_BASE", "https://openrouter.ai/api/v1")
MODEL = os.environ.get("READER_MODEL", "deepseek/deepseek-v4-flash-0731")
RETRIES = 4

TAGS = {
    "everyday life", "work", "sport", "tech", "history", "faith & culture",
    "science & nature", "health", "travel", "money",
}
LEVELS = {"A2", "B1", "B2", "C1"}
# level -> (min_words, max_words, chapters, words_per_chapter, questions_per_chapter)
TARGETS = {
    "A2": (1000, 2000, 3, 425, 4),
    "B1": (3000, 5000, 4, 800, 5),
    "B2": (5000, 8000, 5, 1150, 6),
    "C1": (8000, 12000, 6, 1450, 7),
}


def load_env():
    """Populate os.environ from a .env file if OPENROUTER_API_KEY is not already set."""
    if os.environ.get("OPENROUTER_API_KEY"):
        return
    for path in (os.path.join(os.getcwd(), ".env"), os.path.join(BACKEND, "..", ".env"),
                 os.path.join(BACKEND, ".env")):
        if not os.path.isfile(path):
            continue
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def call_llm(system, user, max_tokens):
    """One chat completion. Returns the assistant text (content), retrying on error.

    DeepSeek is a reasoning model: reasoning goes to message.reasoning and the
    answer to message.content, and both share the completion budget. We cap
    reasoning tokens so it can't starve the answer, and give the answer a
    generous max_tokens on top.
    """
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("OPENROUTER_API_KEY not set (put it in .env or the environment)")
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "reasoning": {"max_tokens": 512},
    }
    data = json.dumps(payload).encode()
    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(
                f"{BASE}/chat/completions", data=data,
                headers={"Authorization": f"Bearer {key}",
                         "Content-Type": "application/json",
                         "X-Title": "Teach reader generation"},
            )
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            msg = d["choices"][0]["message"]
            content = (msg.get("content") or "").strip()
            if not content:
                raise ValueError("empty content (reasoning may have consumed the budget)")
            return content
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, KeyError) as e:
            last = e
            detail = ""
            if isinstance(e, urllib.error.HTTPError):
                try:
                    detail = e.read().decode()[:300]
                except Exception:
                    pass
            print(f"    ! call failed (attempt {attempt+1}/{RETRIES}): {e} {detail}",
                  file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"LLM call failed after {RETRIES} attempts: {last}")


def parse_json(text):
    """Extract a JSON object from a model reply (tolerates ```json fences / prose)."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start:end + 1])
    raise ValueError("no JSON object found in reply")


_PUNCT = {
    "’": "'", "‘": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "…": "...", " ": " ",
}


def clean(text):
    """Normalize smart quotes/dashes to ASCII for consistent display, TTS, and search."""
    if not isinstance(text, str):
        return text
    for a, b in _PUNCT.items():
        text = text.replace(a, b)
    return text


def call_json(system, user, max_tokens, attempts=3):
    """call_llm + parse_json, retrying when the model returns malformed JSON
    (the longer B1 question payloads occasionally come back unparseable)."""
    last = None
    for i in range(attempts):
        raw = call_llm(system, user, max_tokens)
        try:
            return parse_json(raw)
        except (ValueError, json.JSONDecodeError) as e:
            last = e
            print(f"    ! bad JSON (attempt {i+1}/{attempts}): {e}", file=sys.stderr)
    raise ValueError(f"could not parse JSON after {attempts} attempts: {last}")


def wc(text):
    return len(re.findall(r"\S+", text or ""))


# ---------------------------------------------------------------- generation ---

def gen_outline(spec):
    lvl = spec["level"]
    lo, hi, nch, wpc, _ = TARGETS[lvl]
    system = (
        "You are an ELT materials writer producing ORIGINAL graded readers for adult "
        "learners of English (many are Somali immigrants). Write clear, level-appropriate, "
        "culturally respectful text. Output ONLY valid minified JSON, no prose, no code fences."
    )
    user = f"""Create the OUTLINE for one original graded reader.

Level: {lvl} (CEFR). Genre: {spec.get('genre','short fiction')}.
Interest tags: {spec.get('interest_tags')}.
Premise / brief: {spec['premise']}
Target: {nch} chapters, ~{wpc} words each, {lo}-{hi} words total.

Return JSON:
{{"description":"one-sentence catalog blurb",
  "chapters":[{{"title":"...","summary":"2-3 sentence summary of what happens","target_words":{wpc}}}],
  "writing_prompt":{{"prompt":"a reflective prompt tied to the story","word_count_min":60,"word_count_max":140}}}}

Exactly {nch} chapters."""
    out = call_json(system, user, max_tokens=3000)
    if len(out.get("chapters", [])) != nch:
        # keep what we got but pad/trim to the target count
        out["chapters"] = (out.get("chapters", []) + [
            {"title": f"Chapter {i+1}", "summary": "", "target_words": wpc}
            for i in range(nch)])[:nch]
    return out


def gen_chapter(spec, outline, idx, prior_summaries):
    """Two calls: (1) prose as PLAIN TEXT (no JSON escaping to break), then
    (2) a small JSON payload of questions + vocabulary grounded in that prose."""
    lvl = spec["level"]
    _, _, _, wpc, nq = TARGETS[lvl]
    ch = outline["chapters"][idx]
    target = ch.get("target_words", wpc)
    prior = "\n".join(f"- Ch{i+1}: {s}" for i, s in enumerate(prior_summaries)) or "(this is chapter 1)"

    # --- 1. prose (plain text) ---
    sys_prose = (
        "You are an ELT materials writer producing ORIGINAL graded reader chapters. "
        f"Write at CEFR {lvl}: control sentence length and vocabulary to that level. "
        "Output ONLY the chapter prose as plain text in real paragraphs. No title, no "
        "notes, no questions, no markdown, no JSON."
    )
    user_prose = f"""Write chapter {idx+1} of "{spec['title']}" ({lvl} reader).

Premise: {spec['premise']}
This chapter ("{ch['title']}"): {ch.get('summary','')}
Earlier chapters:
{prior}

Write about {target} words of level-{lvl} prose in paragraphs. Output the story text only."""
    text = call_llm(sys_prose, user_prose, max_tokens=min(6000, int(target * 2.2) + 1200)).strip()

    # --- 2. questions + vocabulary (small JSON grounded in the prose) ---
    sys_q = (
        f"You write CEFR {lvl} reading-comprehension questions. Output ONLY valid JSON, "
        "no prose, no code fences."
    )
    user_q = f"""Here is a reader chapter:

\"\"\"
{text}
\"\"\"

Write exactly {nq} multiple-choice questions on THIS chapter (mix comprehension and
vocabulary). Each needs exactly 4 options and a 0-based "correct" index that is
genuinely correct, plus a short "explanation" grounded in the text. Also list 3-5
key vocabulary words from the chapter with plain-English definitions.

Return JSON only:
{{"questions":[{{"type":"comprehension","question":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}}],
  "vocabulary":[{{"word":"...","definition":"..."}}]}}"""
    qv = call_json(sys_q, user_q, max_tokens=3500)
    return {"text": text, "questions": qv.get("questions", []),
            "vocabulary": qv.get("vocabulary", [])}


def build_reader(spec):
    rid = spec["id"]
    print(f"  outline…", flush=True)
    outline = gen_outline(spec)
    chapters = []
    prior = []
    for i, ch_meta in enumerate(outline["chapters"]):
        print(f"  chapter {i+1}/{len(outline['chapters'])}…", flush=True)
        ch = gen_chapter(spec, outline, i, prior)
        cid = f"{rid}-ch-{i+1}"
        questions = []
        for j, q in enumerate(ch.get("questions", [])):
            q = dict(q)
            q["id"] = f"{cid}-q{j+1}"
            q["chapter_id"] = cid
            q.setdefault("type", "comprehension")
            questions.append(q)
        chapters.append({
            "id": cid,
            "title": outline["chapters"][i].get("title", f"Chapter {i+1}"),
            "text": ch.get("text", "").strip(),
            "word_count": wc(ch.get("text", "")),
            "questions": questions,
            "vocabulary": ch.get("vocabulary", []),
        })
        prior.append(outline["chapters"][i].get("summary", "") or ch.get("text", "")[:200])
    total = sum(c["word_count"] for c in chapters)
    reader = {
        "id": rid,
        "title": spec["title"],
        "author": "Barashada Ingiriisiga",
        "level": spec["level"],
        "cefr": {"A2": "elementary", "B1": "intermediate",
                 "B2": "upper-intermediate", "C1": "advanced"}[spec["level"]],
        "interest_tags": spec.get("interest_tags", []),
        "genre": spec.get("genre", "Short fiction"),
        "description": outline.get("description", ""),
        "word_count": total,
        "reading_time_minutes": max(1, round(total / 180)),
        "chapters": chapters,
        "writing_prompt": outline.get("writing_prompt"),
    }

    def deep_clean(o):
        if isinstance(o, str):
            return clean(o)
        if isinstance(o, list):
            return [deep_clean(x) for x in o]
        if isinstance(o, dict):
            return {k: deep_clean(v) for k, v in o.items()}
        return o

    return deep_clean(reader)


# ---------------------------------------------------------------- validation ---

def validate(reader):
    """Return a list of problems (empty = valid)."""
    errs = []
    rid = reader.get("id", "?")
    if reader.get("level") not in LEVELS:
        errs.append(f"{rid}: bad level {reader.get('level')!r}")
    lo, hi, _, wpc, _ = TARGETS.get(reader.get("level"), (0, 10**9, 0, 1, 0))
    bad_tags = set(reader.get("interest_tags", [])) - TAGS
    if bad_tags:
        errs.append(f"{rid}: unknown interest_tags {bad_tags}")
    total = reader.get("word_count", 0)
    if not (lo * 0.8 <= total <= hi * 1.25):
        errs.append(f"{rid}: total words {total} outside {int(lo*0.8)}-{int(hi*1.25)}")
    seen = set()
    for c in reader.get("chapters", []):
        cid = c.get("id", "?")
        if cid in seen:
            errs.append(f"{rid}: duplicate chapter id {cid}")
        seen.add(cid)
        if not cid.startswith(rid):
            errs.append(f"{cid}: id not prefixed by reader id {rid}")
        if not (c.get("text") or "").strip():
            errs.append(f"{cid}: empty text")
        cw = c.get("word_count", 0)
        if cw and not (wpc * 0.55 <= cw <= wpc * 1.6):
            errs.append(f"{cid}: chapter words {cw} far from target ~{wpc}")
        qids = set()
        for q in c.get("questions", []):
            qid = q.get("id", "?")
            if qid in qids:
                errs.append(f"{cid}: duplicate question id {qid}")
            qids.add(qid)
            opts = q.get("options", [])
            if len(opts) != 4:
                errs.append(f"{qid}: has {len(opts)} options (need 4)")
            ci = q.get("correct")
            if not isinstance(ci, int) or not (0 <= ci < len(opts)):
                errs.append(f"{qid}: correct index {ci} out of range")
            if q.get("type") not in ("comprehension", "vocabulary"):
                errs.append(f"{qid}: bad type {q.get('type')!r}")
    return errs


def validate_only():
    files = sorted(f for f in os.listdir(READERS_DIR)
                   if f.endswith(".json") and f != "manifest.json") if os.path.isdir(READERS_DIR) else []
    if not files:
        print("no reader files to validate")
        return 0
    bad = 0
    for f in files:
        reader = json.load(open(os.path.join(READERS_DIR, f), encoding="utf-8"))
        errs = validate(reader)
        status = "OK " if not errs else "BAD"
        print(f"  [{status}] {f} — {reader.get('word_count')} words, "
              f"{len(reader.get('chapters', []))} chapters")
        for e in errs:
            print(f"        - {e}")
        bad += bool(errs)
    print(f"{len(files)} readers, {bad} with problems")
    return 1 if bad else 0


# ---------------------------------------------------------------------- main ---

def main():
    ap = argparse.ArgumentParser(description="Generate graded readers via OpenRouter")
    ap.add_argument("--ids", help="comma-separated reader ids to generate")
    ap.add_argument("--limit", type=int, help="generate at most N pending readers")
    ap.add_argument("--force", action="store_true", help="regenerate even if the file exists")
    ap.add_argument("--validate-only", action="store_true", help="only re-validate existing files")
    ap.add_argument("--manifest", default=MANIFEST)
    args = ap.parse_args()

    os.makedirs(READERS_DIR, exist_ok=True)
    if args.validate_only:
        sys.exit(validate_only())

    load_env()
    if not os.path.isfile(args.manifest):
        sys.exit(f"manifest not found: {args.manifest}")
    specs = json.load(open(args.manifest, encoding="utf-8"))
    if args.ids:
        want = set(args.ids.split(","))
        specs = [s for s in specs if s["id"] in want]

    pending = []
    for s in specs:
        path = os.path.join(READERS_DIR, f"{s['id']}.json")
        if os.path.exists(path) and not args.force:
            continue
        pending.append(s)
    if args.limit:
        pending = pending[:args.limit]
    if not pending:
        print("nothing to generate (all present; use --force to regenerate)")
        return

    print(f"model={MODEL}  generating {len(pending)} reader(s)")
    for s in pending:
        rid = s["id"]
        print(f"[{rid}] {s['title']} ({s['level']})")
        try:
            reader = build_reader(s)
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            continue
        errs = validate(reader)
        path = os.path.join(READERS_DIR, f"{rid}.json")
        # write even if invalid, but flag loudly, so a human can inspect/fix
        json.dump(reader, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        if errs:
            print(f"  WROTE WITH {len(errs)} VALIDATION PROBLEM(S) -> {path}")
            for e in errs:
                print(f"     - {e}")
        else:
            print(f"  OK {reader['word_count']} words, {len(reader['chapters'])} chapters -> {path}")


if __name__ == "__main__":
    main()
