import re
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.rate_limit import ai_rate_limit
from core.ai_client import ask_qwen, translate_preserving_english, sanitize_text
from core.prompts import WRITING_ASSESSMENT_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["assessment"])


class SpeakingAssessRequest(BaseModel):
    transcript: str = Field("", max_length=500)
    expected: str = Field("", max_length=500)


class WritingAssessRequest(BaseModel):
    writing_text: str = Field(..., max_length=3000)
    prompt_instruction: str = Field(..., max_length=1000)
    example: str = Field("", max_length=500)
    min_words: int = Field(20, ge=1, le=500)


def _similarity_ratio(a: str, b: str) -> float:
    a_words = set(a.lower().split())
    b_words = set(b.lower().split())
    if not a_words or not b_words:
        return 0.0
    return len(a_words & b_words) / max(len(a_words), len(b_words))


async def run_writing_assessment(
    writing_text: str,
    prompt_instruction: str,
    example: str = "",
    min_words: int = 20,
) -> dict:
    text = writing_text.strip()
    word_count = len(text.split())

    if word_count < 10:
        feedback = "Your response is too short. Please write at least a few sentences addressing the prompt."
        return {
            "score": 0, "passed": False,
            "feedback": feedback,
            "feedback_somali": await translate_preserving_english(feedback),
        }

    if _similarity_ratio(text, prompt_instruction.strip()) > 0.70:
        feedback = (
            "It looks like you copied the question instead of answering it. "
            "Please write your own original response to the prompt in your own words."
        )
        return {
            "score": 0, "passed": False,
            "feedback": feedback,
            "feedback_somali": await translate_preserving_english(feedback),
        }

    user_prompt = (
        f'Writing prompt given to student: "{prompt_instruction}"\n'
        + (f'Example answer: {example}\n' if example else "")
        + f'Student\'s writing:\n"{writing_text}"\n\n'
        f"Minimum words required: {min_words}\n"
        f"Assess the student's writing."
    )
    messages = [
        {"role": "system", "content": WRITING_ASSESSMENT_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response = await ask_qwen(messages, max_tokens=200)

    score_match = re.search(r'SCORE:\s*(\d+)', response, re.IGNORECASE)
    feedback_match = re.search(r'FEEDBACK:\s*(.+)', response, re.DOTALL)

    score = int(score_match.group(1)) if score_match else 50
    score = max(0, min(100, score))
    feedback_english = feedback_match.group(1).strip() if feedback_match else response.strip()

    return {
        "score": score,
        "passed": score >= 60,
        "feedback": feedback_english,
        "feedback_somali": await translate_preserving_english(feedback_english),
    }


@router.post("/speaking/assess")
async def assess_speaking(req: SpeakingAssessRequest, _=Depends(ai_rate_limit)):
    transcript = req.transcript.strip()
    expected = req.expected.strip()

    if not transcript:
        return {"score": 0, "transcript": "", "feedback": "No speech detected. Please try again.", "word_scores": []}

    def normalize(s):
        return re.sub(r"[^a-z0-9\s']", "", s.lower()).split()

    t_words = normalize(transcript)
    e_words = normalize(expected)

    if not e_words:
        return {"score": 100, "transcript": transcript, "feedback": "Great job!", "word_scores": []}

    t_copy = list(t_words)
    word_scores = []
    for word in e_words:
        if word in t_copy:
            t_copy.remove(word)
            word_scores.append({"word": word, "correct": True})
        else:
            word_scores.append({"word": word, "correct": False})

    score = round(sum(1 for w in word_scores if w["correct"]) / len(e_words) * 100)

    feedback = await ask_qwen([{
        "role": "user",
        "content": (
            f'A student learning English was asked to say: "{expected}"\n'
            f'They said: "{transcript}"\n'
            f'Score: {score}/100\n'
            f'Give exactly 1 short encouraging sentence of feedback. '
            f'If score is 80+, praise them. If lower, gently name 1-2 words to practise. '
            f'Be warm and simple — this is a beginner.'
        ),
    }], max_tokens=60)

    return {"score": score, "transcript": transcript, "feedback": feedback, "word_scores": word_scores}


@router.post("/writing/assess")
async def assess_writing(req: WritingAssessRequest, _=Depends(ai_rate_limit)):
    return await run_writing_assessment(
        sanitize_text(req.writing_text),
        sanitize_text(req.prompt_instruction, max_len=1000),
        sanitize_text(req.example, max_len=500),
        req.min_words,
    )
