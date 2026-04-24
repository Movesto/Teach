from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/api/placement", tags=["placement"])

PLACEMENT_TEST_FILE = Path(__file__).parent / "placement-test.json"


def load_placement_test():
    with open(PLACEMENT_TEST_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


class Answer(BaseModel):
    question_id: str
    selected_option: Optional[int] = None
    audio_url: Optional[str] = None
    text_response: Optional[str] = None


class SubmitTestRequest(BaseModel):
    user_id: Optional[str] = None
    answers: List[Answer]
    time_taken_minutes: int


class PlacementResult(BaseModel):
    total_score: int
    max_score: int
    percentage: float
    level: str
    cefr: str
    description: str
    recommended_unit: int
    unit_name: str
    message: str
    breakdown: Dict[str, dict]
    completed_at: str
    can_retake: bool
    certificate_available: bool


@router.get("/test")
async def get_placement_test():
    try:
        test_data = load_placement_test()
        for section in test_data.get("sections", []):
            if "questions" in section:
                for question in section["questions"]:
                    question.pop("correct", None)
            if "passages" in section:
                for passage in section["passages"]:
                    for question in passage.get("questions", []):
                        question.pop("correct", None)
        return test_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading placement test: {str(e)}")


@router.post("/submit", response_model=PlacementResult)
async def submit_placement_test(submission: SubmitTestRequest):
    try:
        test_data = load_placement_test()
        total_score = 0
        max_score = test_data["scoring"]["total_points"]
        breakdown = {
            "grammar":   {"score": 0, "max": 30, "questions_answered": 0, "questions_total": 0},
            "listening": {"score": 0, "max": 25, "questions_answered": 0, "questions_total": 0},
            "reading":   {"score": 0, "max": 25, "questions_answered": 0, "questions_total": 0},
            "speaking":  {"score": 0, "max": 20, "questions_answered": 0, "questions_total": 0},
        }

        answer_map = {a.question_id: a for a in submission.answers}

        for section_id in ("grammar", "listening"):
            section = next((s for s in test_data["sections"] if s["id"] == section_id), None)
            if section:
                for q in section["questions"]:
                    breakdown[section_id]["questions_total"] += 1
                    ans = answer_map.get(q["id"])
                    if ans and ans.selected_option is not None:
                        breakdown[section_id]["questions_answered"] += 1
                        if ans.selected_option == q["correct"]:
                            pts = q["points"]
                            total_score += pts
                            breakdown[section_id]["score"] += pts

        reading_section = next((s for s in test_data["sections"] if s["id"] == "reading"), None)
        if reading_section:
            for passage in reading_section["passages"]:
                for q in passage["questions"]:
                    breakdown["reading"]["questions_total"] += 1
                    ans = answer_map.get(q["id"])
                    if ans and ans.selected_option is not None:
                        breakdown["reading"]["questions_answered"] += 1
                        if ans.selected_option == q["correct"]:
                            pts = q["points"]
                            total_score += pts
                            breakdown["reading"]["score"] += pts

        speaking_section = next((s for s in test_data["sections"] if s["id"] == "speaking"), None)
        if speaking_section:
            for prompt in speaking_section["prompts"]:
                breakdown["speaking"]["questions_total"] += 1
                ans = answer_map.get(prompt["id"])
                if ans and ans.audio_url:
                    breakdown["speaking"]["questions_answered"] += 1
                    pts = int(prompt["points"] * 0.6)
                    total_score += pts
                    breakdown["speaking"]["score"] += pts

        percentage = round((total_score / max_score) * 100, 1)

        placement_level = next(
            (lv for lv in test_data["scoring"]["levels"] if lv["min_score"] <= percentage <= lv["max_score"]),
            test_data["scoring"]["levels"][0],
        )

        return PlacementResult(
            total_score=total_score,
            max_score=max_score,
            percentage=percentage,
            level=placement_level["level"],
            cefr=placement_level["cefr"],
            description=placement_level["description"],
            recommended_unit=placement_level["recommended_unit"],
            unit_name=placement_level["unit_name"],
            message=placement_level["message"],
            breakdown=breakdown,
            completed_at=datetime.now().isoformat(),
            can_retake=True,
            certificate_available=percentage >= 70,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing placement test: {str(e)}")


@router.get("/results/{user_id}")
async def get_placement_results(user_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")
