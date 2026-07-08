"""Curriculum-aware helpers shared across routers: load a lesson by id, build a
lesson-scoped conversation scenario (Phase 4), and apply the support-tier / Somali
scaffolding policy that fades from bottom to top (Phase 5).

See docs/curriculum-architecture.md.
"""
import json
import re
from typing import Optional

from core.config import LESSONS_DIR, support_level_for_unit


def _numeric_id(raw) -> int:
    return int(re.sub(r"\D", "", str(raw)) or "0")


def load_lesson(lesson_id: int) -> Optional[dict]:
    """Return the raw lesson dict for a numeric lesson id, or None."""
    for unit_dir in LESSONS_DIR.glob("unit-*"):
        for lf in sorted(unit_dir.glob("lesson-*.json")):
            try:
                with open(lf, encoding="utf-8") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if _numeric_id(data.get("id", "")) == lesson_id:
                return data
    return None


def support_level_for_lesson(lesson: dict) -> str:
    uid = lesson.get("unit_id")
    return support_level_for_unit(uid) if isinstance(uid, int) else "english_first"


# ── Phase 4: lesson-anchored conversation ────────────────────────────────────

def lesson_scenario_prompt(lesson: dict) -> str:
    """Build a system-prompt suffix that scopes a conversation to one lesson —
    its scenario, goals, and target phrases — so 'practice convo' and the lesson
    go hand in hand instead of being a free-for-all."""
    title = lesson.get("title", "this lesson")
    objectives = [o for o in lesson.get("objectives", []) if isinstance(o, str)]
    tl = lesson.get("target_language") or {}
    phrases = [
        p for p in (tl.get("phrases") or lesson.get("target_phrases") or [])
        if isinstance(p, str)
    ]
    story = lesson.get("story") or {}
    context = story.get("context", "")

    parts = [
        f'The student has just studied the lesson "{title}". '
        "Anchor this whole conversation to that lesson: run a realistic role-play that makes the "
        "student use its language. Stay on this scenario; do not drift to unrelated topics."
    ]
    if context:
        parts.append(f"Scene to role-play: {context}")
    if objectives:
        parts.append("Practise these goals: " + "; ".join(objectives[:6]) + ".")
    if phrases:
        parts.append("Naturally draw out and reinforce these target phrases: "
                     + "; ".join(phrases[:10]) + ".")
    parts.append("Open by setting the scene in one or two short sentences and inviting the student to begin.")
    return " ".join(parts)


# ── Phase 5: scaffolding fade (how much Somali each tier gets) ────────────────

_CONVO_POLICY = {
    "bilingual": (
        "The student is a true beginner. Use the simplest, shortest English. If they write in Somali, "
        "accept it warmly, give them the English phrase they need, and invite them to repeat it."
    ),
    "english_first": (
        "The student is at an intermediate level. Speak in clear, simple English. "
        "Only offer a Somali word if they are truly stuck."
    ),
    "immersion": (
        "The student is at an advanced immersion level. Speak only in English, at a natural and challenging "
        "pace. Do not use Somali and do not invite it — push them to express everything in English."
    ),
}


def conversation_support_directive(support_level: str) -> str:
    return _CONVO_POLICY.get(support_level, _CONVO_POLICY["english_first"])


# For the in-lesson tutor (explain/chat): the suffix tunes tone; the bool decides
# whether the reply is rendered into Somali (bilingual/english_first) or kept in
# English (immersion).
_TUTOR_POLICY = {
    "bilingual": (
        "The student is a true beginner — use the simplest possible English and very short sentences.",
        True,
    ),
    "english_first": ("", True),
    "immersion": (
        "The student is at an advanced immersion level. Answer in clear English only and do not depend on Somali.",
        False,
    ),
}


def tutor_support_policy(support_level: str) -> tuple[str, bool]:
    """(system_suffix, translate_reply_to_somali) for the given tier."""
    return _TUTOR_POLICY.get(support_level, _TUTOR_POLICY["english_first"])


def strip_english_markers(text: str) -> str:
    """Drop the {{ }} markers the translation layer uses, for English-only output."""
    return text.replace("{{", "").replace("}}", "")
