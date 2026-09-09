"""Target vocabulary lists (Phase 5) + lightweight lemmatization.

Loads the NGSL / NAWL / supplementary headword lists (see data/wordlists/README.md)
and maps an inflected content token back to its list headword with rule-based
suffix stripping — good enough for a coverage count without a heavy NLP dependency.

Shared by the tagging script, SRS seeding, and the coverage endpoint so they all
agree on what "a target word" is.
"""
import re
from pathlib import Path

_DIR = Path(__file__).parent.parent / "data" / "wordlists"

LISTS: dict[str, set[str]] = {}
WORD_TO_LIST: dict[str, str] = {}


def _load():
    if LISTS:
        return
    for name in ("ngsl", "nawl", "supplementary"):
        path = _DIR / f"{name}.txt"
        words = set()
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                w = line.strip().lower()
                if w:
                    words.add(w)
        LISTS[name] = words
        for w in words:
            WORD_TO_LIST.setdefault(w, name)


_load()
ALL_WORDS: set[str] = set(WORD_TO_LIST)
TARGET_TOTAL = len(ALL_WORDS)
LIST_TOTALS = {k: len(v) for k, v in LISTS.items()}


def _candidates(w: str):
    """Yield the token and plausible base forms (rule-based, over-generates)."""
    yield w
    # possessive / contraction
    if w.endswith("'s") or w.endswith("’s"):
        yield w[:-2]
    # plural / 3rd-person -s
    if w.endswith("ies") and len(w) > 4:
        yield w[:-3] + "y"
    if w.endswith("es") and len(w) > 3:
        yield w[:-2]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        yield w[:-1]
    # -ing
    if w.endswith("ing") and len(w) > 5:
        base = w[:-3]
        yield base                       # playing -> play
        yield base + "e"                 # making -> make
        if len(base) > 2 and base[-1] == base[-2]:
            yield base[:-1]              # running -> run
    # -ed
    if w.endswith("ied") and len(w) > 4:
        yield w[:-3] + "y"               # studied -> study
    if w.endswith("ed") and len(w) > 4:
        base = w[:-2]
        yield base                       # walked -> walk
        yield base + "e"                 # liked -> like
        if len(base) > 2 and base[-1] == base[-2]:
            yield base[:-1]              # stopped -> stop
    # comparative / superlative / adverb
    if w.endswith("iest") and len(w) > 5:
        yield w[:-4] + "y"               # happiest -> happy
    if w.endswith("est") and len(w) > 5:
        yield w[:-3]
        yield w[:-2]
    if w.endswith("ier") and len(w) > 4:
        yield w[:-3] + "y"               # happier -> happy
    if w.endswith("er") and len(w) > 4:
        yield w[:-2]
        yield w[:-1]
    if w.endswith("ly") and len(w) > 4:
        yield w[:-2]                      # quickly -> quick


def match(token: str) -> str | None:
    """Return the list headword this token maps to, or None."""
    w = token.strip().lower()
    if not w or not w[0].isalpha():
        return None
    for cand in _candidates(w):
        if cand in ALL_WORDS:
            return cand
    return None


_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*")


def target_words_in(text: str) -> set[str]:
    """The set of target-list headwords that appear anywhere in `text`."""
    found = set()
    for tok in _TOKEN_RE.findall(text or ""):
        hw = match(tok)
        if hw:
            found.add(hw)
    return found


def which_list(headword: str) -> str | None:
    return WORD_TO_LIST.get(headword.strip().lower())
