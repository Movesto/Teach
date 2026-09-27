import re
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.rate_limit import ai_rate_limit
from core.ai_client import ask_qwen, sanitize_text
from core.prompts import WRITING_ASSESSMENT_PROMPT, DRILL_ASSESSMENT_PROMPT

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


class DrillAssessRequest(BaseModel):
    sentence: str = Field(..., max_length=300)   # the fill-in-blank sentence, contains "___"
    scenario: str = Field("", max_length=200)    # lesson/scenario context, e.g. "At the grocery store"
    answer: str = Field(..., max_length=100)     # the student's submitted text for the blank


def _similarity_ratio(a: str, b: str) -> float:
    a_words = set(a.lower().split())
    b_words = set(b.lower().split())
    if not a_words or not b_words:
        return 0.0
    return len(a_words & b_words) / max(len(a_words), len(b_words))


TOO_SHORT_EN = "Your response is too short. Please write at least a few sentences addressing the prompt."
TOO_SHORT_SO = "Jawaabtaadu way gaaban tahay. Fadlan qor ugu yaraan dhawr jumladood oo ka jawaabaya su'aasha."

COPIED_PROMPT_EN = (
    "It looks like you copied the question instead of answering it. "
    "Please write your own original response to the prompt in your own words."
)
COPIED_PROMPT_SO = (
    "Waxay u egtahay inaad koobtay su'aasha halkii aad ka jawaabi lahayd. "
    "Fadlan qor jawaab adiga kuu gaar ah oo ku qoran ereyadaada."
)

COPIED_EXAMPLE_EN = (
    "It looks like you copied the example answer instead of writing your own. "
    "Please write your own original response using your own words and ideas."
)
COPIED_EXAMPLE_SO = (
    "Waxay u egtahay inaad koobtay jawaabta tusaalaha ah halkii aad qori lahayd jawaab adiga kuu gaar ah. "
    "Fadlan qor jawaab adiga kuu gaar ah oo adeegsada ereyadaada iyo fikradahaada."
)


async def run_writing_assessment(
    writing_text: str,
    prompt_instruction: str,
    example: str = "",
    min_words: int = 20,
) -> dict:
    text = writing_text.strip()
    word_count = len(text.split())

    if word_count < 10:
        return {"score": 0, "passed": False, "feedback": TOO_SHORT_EN, "feedback_somali": TOO_SHORT_SO}

    if _similarity_ratio(text, prompt_instruction.strip()) > 0.70:
        return {"score": 0, "passed": False, "feedback": COPIED_PROMPT_EN, "feedback_somali": COPIED_PROMPT_SO}

    if example and _similarity_ratio(text, example.strip()) > 0.80:
        return {"score": 0, "passed": False, "feedback": COPIED_EXAMPLE_EN, "feedback_somali": COPIED_EXAMPLE_SO}

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
    # temperature=0.2: grading must be near-deterministic -- the same submission
    # scoring very differently across resubmissions (e.g. 40 then 85 for identical
    # text) was a real reported bug caused by the default chat temperature (0.7).
    response = await ask_qwen(messages, max_tokens=450, temperature=0.2)

    score_match = re.search(r'SCORE:\s*(\d+)', response, re.IGNORECASE)
    feedback_match = re.search(r'FEEDBACK:\s*(.+?)(?=\nFEEDBACK_SOMALI:|\Z)', response, re.DOTALL)
    feedback_so_match = re.search(r'FEEDBACK_SOMALI:\s*(.+)', response, re.DOTALL)

    score = int(score_match.group(1)) if score_match else 50
    score = max(0, min(100, score))
    feedback_english = feedback_match.group(1).strip() if feedback_match else response.strip()
    feedback_somali = feedback_so_match.group(1).strip() if feedback_so_match else feedback_english

    return {
        "score": score,
        "passed": score >= 60,
        "feedback": feedback_english,
        "feedback_somali": feedback_somali,
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

    # The score above is deterministic. AI only writes the feedback sentence, so a
    # failure there must NOT lose the grade — fall back to canned encouragement.
    try:
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
    except Exception as e:
        logger.warning("speaking feedback unavailable, using fallback: %s", e)
        missed = [w["word"] for w in word_scores if not w["correct"]][:2]
        if score >= 80:
            feedback = "Great job! Your speaking was clear."
        elif missed:
            feedback = f"Good effort — try practising: {', '.join(missed)}."
        else:
            feedback = "Good effort — keep practising, you're improving!"

    return {"score": score, "transcript": transcript, "feedback": feedback, "word_scores": word_scores}


@router.post("/writing/assess")
async def assess_writing(req: WritingAssessRequest, _=Depends(ai_rate_limit)):
    return await run_writing_assessment(
        sanitize_text(req.writing_text),
        sanitize_text(req.prompt_instruction, max_len=1000),
        sanitize_text(req.example, max_len=500),
        req.min_words,
    )


@router.post("/drill/assess")
async def assess_drill(req: DrillAssessRequest, _=Depends(ai_rate_limit)):
    answer = sanitize_text(req.answer, max_len=100).strip()
    if not answer:
        return {"correct": False, "feedback": "Please write an answer."}

    user_prompt = (
        f'Scenario: {req.scenario or "general English practice"}\n'
        f'Sentence with blank: "{req.sentence}"\n'
        f'Student\'s answer for the blank: "{answer}"\n\n'
        f"Grade this answer."
    )
    messages = [
        {"role": "system", "content": DRILL_ASSESSMENT_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = await ask_qwen(messages, max_tokens=280)
    except Exception as e:
        logger.warning("drill assessment unavailable: %s", e)
        return {"correct": True, "feedback": "Good effort! (Grading is temporarily unavailable.)"}

    result_match = re.search(r'RESULT:\s*(CORRECT|INCORRECT)', response, re.IGNORECASE)
    feedback_match = re.search(r'FEEDBACK:\s*(.+?)(?=\nFEEDBACK_SOMALI:|\Z)', response, re.DOTALL)
    feedback_so_match = re.search(r'FEEDBACK_SOMALI:\s*(.+)', response, re.DOTALL)

    correct = bool(result_match) and result_match.group(1).upper() == "CORRECT"
    feedback = feedback_match.group(1).strip() if feedback_match else response.strip()
    feedback_somali = feedback_so_match.group(1).strip() if feedback_so_match else feedback

    return {
        "correct": correct,
        "feedback": feedback,
        "feedback_somali": feedback_somali,
    }
