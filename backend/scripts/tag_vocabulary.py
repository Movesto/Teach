"""Tag every lesson and reader with the target-list words it contains, and write
data/wordlists/content-index.json.

The coverage endpoint reads this index: a user's "words learned" = the union of
target words across the lessons (and readers) they have completed. Deterministic,
no AI, no DB — re-run whenever content changes.

    python backend/scripts/tag_vocabulary.py
"""
import json
import os
import sys
from glob import glob

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

from core import wordlists  # noqa: E402

OUT = os.path.join(BACKEND, "data", "wordlists", "content-index.json")


def all_strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from all_strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from all_strings(v)


def words_in_json(path, text_only_keys=None):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    blob = " ".join(all_strings(data))
    return data, wordlists.target_words_in(blob)


def main():
    lessons = {}
    for path in sorted(glob(os.path.join(BACKEND, "unit-*", "lesson-*.json"))):
        try:
            data, words = words_in_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        lid = data.get("id")
        if lid is not None:
            lessons[str(lid)] = sorted(words)

    readers = {}          # reader_id -> all target words (union, for reference/ceiling)
    reader_chapters = {}  # chapter_id -> target words (coverage credits per chapter read)
    for path in sorted(glob(os.path.join(BACKEND, "readers", "reader-*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        rid = data.get("id")
        if not rid:
            continue
        rwords = set()
        for ch in data.get("chapters", []):
            cwords = wordlists.target_words_in(" ".join(all_strings(ch)))
            cid = ch.get("id")
            if cid:
                reader_chapters[cid] = sorted(cwords)
            rwords |= cwords
        readers[rid] = sorted(rwords)

    # ceiling: how many target words appear anywhere in the content at all
    covered = set()
    for words in list(lessons.values()) + list(readers.values()):
        covered.update(words)
    by_list = {name: 0 for name in wordlists.LISTS}
    for w in covered:
        lst = wordlists.which_list(w)
        if lst:
            by_list[lst] += 1

    index = {
        "target_total": wordlists.TARGET_TOTAL,
        "list_totals": wordlists.LIST_TOTALS,
        "content_coverage": {**by_list, "total": len(covered)},
        "lessons": lessons,
        "readers": readers,
        "reader_chapters": reader_chapters,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    print(f"target words: {wordlists.TARGET_TOTAL} ({wordlists.LIST_TOTALS})")
    print(f"tagged {len(lessons)} lessons, {len(readers)} readers")
    print(f"content covers {len(covered)}/{wordlists.TARGET_TOTAL} target words: {by_list}")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
