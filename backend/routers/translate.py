import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.rate_limit import ai_rate_limit
from core.security import get_current_user
from core.config import support_level_for_unit
from core.ai_client import (
    translate_text, ask_qwen, translate_preserving_english,
    sanitize_user_message,
)
from core.curriculum import tutor_support_policy, strip_english_markers
from core.prompts import QWEN_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ai"])


class TranslateRequest(BaseModel):
    text: str = Field("", max_length=2000)
    direction: Optional[str] = Field(None, max_length=20)
    source_lang: Optional[str] = Field(None, max_length=20)
    target_lang: Optional[str] = Field(None, max_length=20)


class ExplainRequest(BaseModel):
    english: str = Field("", max_length=1000)
    context: str = Field("", max_length=500)
    type: str = Field("phrase", max_length=20)
    unit_id: Optional[int] = Field(None, ge=1)   # drives the support tier (Phase 5)


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)
    history: list = Field(default_factory=list, max_length=50)
    lesson_context: str = Field("", max_length=500)
    units_context: str = Field("", max_length=2000)
    unit_id: Optional[int] = Field(None, ge=1)   # drives the support tier (Phase 5)


def _support_level(unit_id: Optional[int]) -> str:
    return support_level_for_unit(unit_id) if unit_id else "english_first"


@router.post("/translate")
async def translate(req: TranslateRequest, _=Depends(ai_rate_limit)):
    direction = req.direction
    if not direction:
        source = req.source_lang or ""
        target = req.target_lang or ""
        if "eng" in source and "som" in target:
            direction = "eng_to_som"
        elif "som" in source and "eng" in target:
            direction = "som_to_eng"
        else:
            direction = "eng_to_som"
    translation = await translate_text(req.text, direction)
    return {"translation": translation, "direction": direction}


@router.post("/explain")
async def explain(req: ExplainRequest, _=Depends(ai_rate_limit), user=Depends(get_current_user)):
    english = sanitize_user_message(req.english)
    context = sanitize_user_message(req.context)
    brevity = "Remember: answer in 3 to 5 short plain sentences only. No lists. No formatting."

    if req.type == "question":
        user_prompt = (
            f'The student sees this quiz question: "{english}"\n'
            f"Context: {context}\n\n"
            f"Help them understand what the question is asking. Explain any hard words simply. "
            f"Give a small hint but not the answer. {brevity}"
        )
    elif req.type == "drill":
        user_prompt = (
            f'The student is practicing: "{english}"\n'
            f"Instructions: {context}\n\n"
            f"Explain what they need to do and show one example. {brevity}"
        )
    elif req.type == "lesson":
        user_prompt = (
            f'The student is learning about: "{english}"\n'
            f"Context: {context}\n\n"
            f"Explain the main idea simply. If there is a grammar pattern, show one example. {brevity}"
        )
    else:
        user_prompt = (
            f'The student wants to understand: "{english}"\n'
            f"Context: {context}\n\n"
            f"Tell them what it means and give one example sentence. {brevity}"
        )

    suffix, translate_reply = tutor_support_policy(_support_level(req.unit_id))
    system_prompt = QWEN_SYSTEM_PROMPT + (f"\n\n{suffix}" if suffix else "")
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    explanation_english = await ask_qwen(messages, max_tokens=400)
    # Immersion tier keeps the reply in English; lower tiers render it into Somali.
    if translate_reply:
        explanation_combined = await translate_preserving_english(explanation_english)
    else:
        explanation_combined = strip_english_markers(explanation_english)
    return {"explanation": explanation_combined, "explanation_english": explanation_english}


@router.post("/chat")
async def chat(req: ChatRequest, _=Depends(ai_rate_limit), user=Depends(get_current_user)):
    message = sanitize_user_message(req.message)
    suffix, translate_reply = tutor_support_policy(_support_level(req.unit_id))
    # Immersion students type in English, so don't run their message through som_to_eng.
    user_english = message if not translate_reply else await translate_text(message, "som_to_eng")

    system_parts = [QWEN_SYSTEM_PROMPT + (f"\n\n{suffix}" if suffix else "")]
    if req.units_context:
        system_parts.append(f"The full curriculum the student is working through: {req.units_context}")
    if req.lesson_context:
        system_parts.append(f"The student is currently studying: {req.lesson_context}")

    qwen_messages = [{"role": "system", "content": "\n\n".join(system_parts)}]
    for msg in req.history:
        qwen_messages.append({"role": msg["role"], "content": msg.get("content_english") or msg["content"]})
    qwen_messages.append({"role": "user", "content": user_english})

    reply_english = await ask_qwen(qwen_messages, max_tokens=350)
    reply_combined = (
        await translate_preserving_english(reply_english)
        if translate_reply else strip_english_markers(reply_english)
    )

    return {
        "reply": reply_combined,
        "reply_english": reply_english,
        "user_message_english": user_english,
    }
