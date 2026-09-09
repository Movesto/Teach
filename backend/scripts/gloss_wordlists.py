"""Machine-translate the target word lists (NGSL/NAWL/supplementary) into Somali via
NLLB, into data/wordlists/glosses-so.json (word -> Somali).

These are MACHINE glosses — flag for native-speaker review before treating as final
(same policy as the baked lesson Somali). Used as the card translation for seeded
list words. Resumable: existing glosses are skipped unless --force. Run where NLLB
is reachable (the GPU box / the running Docker stack):

    NLLB_URL=http://localhost:8001/translate python backend/scripts/gloss_wordlists.py
    python backend/scripts/gloss_wordlists.py --lists nawl,supplementary
"""
import argparse
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
WL_DIR = os.path.join(BACKEND, "data", "wordlists")
OUT = os.path.join(WL_DIR, "glosses-so.json")

NLLB_URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")
RETRIES = 3


def translate(word):
    payload = json.dumps({"text": word, "direction": "eng_to_som"}).encode()
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(NLLB_URL, data=payload,
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return (json.load(r).get("translation") or "").strip()
        except Exception as e:
            if attempt == RETRIES - 1:
                print(f"  ! {word}: {e}", file=sys.stderr)
            time.sleep(1 + attempt)
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lists", default="ngsl,nawl,supplementary")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    glosses = {}
    if os.path.isfile(OUT):
        with open(OUT, encoding="utf-8") as f:
            glosses = json.load(f)

    words = []
    for name in args.lists.split(","):
        path = os.path.join(WL_DIR, f"{name.strip()}.txt")
        if os.path.isfile(path):
            words += [w.strip() for w in open(path, encoding="utf-8").read().splitlines() if w.strip()]

    pending = [w for w in words if args.force or not glosses.get(w)]
    print(f"glossing {len(pending)} of {len(words)} words via {NLLB_URL}")
    done = 0
    for w in pending:
        so = translate(w)
        if so:
            glosses[w] = so
        done += 1
        if done % 100 == 0:
            with open(OUT, "w", encoding="utf-8") as f:
                json.dump(glosses, f, ensure_ascii=False, indent=1, sort_keys=True)
            print(f"  … {done}/{len(pending)} (saved {len(glosses)})", flush=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(glosses, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"done: {len(glosses)} glosses -> {OUT}")


if __name__ == "__main__":
    main()
