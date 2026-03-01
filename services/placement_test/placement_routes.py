"""
Placement Test API Endpoints
Backend routes for serving and scoring the placement test
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/api/placement", tags=["placement"])

# Load placement test data
PLACEMENT_TEST_FILE = Path(__file__).parent / "placement-test.json"

def load_placement_test():
    """Load placement test from JSON file"""
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
    """
    Get the complete placement test
    
    Returns the test structure without correct answers
    """
    try:
        test_data = load_placement_test()
        
        # Remove correct answers from the response
        for section in test_data.get("sections", []):
            if "questions" in section:
                for question in section["questions"]:
                    if "correct" in question:
                        del question["correct"]
            
            if "passages" in section:
                for passage in section["passages"]:
                    for question in passage.get("questions", []):
                        if "correct" in question:
                            del question["correct"]
        
        return test_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading placement test: {str(e)}")


@router.post("/submit", response_model=PlacementResult)
async def submit_placement_test(submission: SubmitTestRequest):
    """
    Submit completed placement test and get results
    
    Calculates score and provides placement recommendation
    """
    try:
        test_data = load_placement_test()
        
        # Calculate scores
        total_score = 0
        max_score = test_data["scoring"]["total_points"]
        breakdown = {
            "grammar": {"score": 0, "max": 30, "questions_answered": 0, "questions_total": 0},
            "listening": {"score": 0, "max": 25, "questions_answered": 0, "questions_total": 0},
            "reading": {"score": 0, "max": 25, "questions_answered": 0, "questions_total": 0},
            "speaking": {"score": 0, "max": 20, "questions_answered": 0, "questions_total": 0}
        }
        
        # Create answer map
        answer_map = {answer.question_id: answer for answer in submission.answers}
        
        # Score grammar section
        grammar_section = next((s for s in test_data["sections"] if s["id"] == "grammar"), None)
        if grammar_section:
            for question in grammar_section["questions"]:
                breakdown["grammar"]["questions_total"] += 1
                answer = answer_map.get(question["id"])
                if answer and answer.selected_option is not None:
                    breakdown["grammar"]["questions_answered"] += 1
                    if answer.selected_option == question["correct"]:
                        points = question["points"]
                        total_score += points
                        breakdown["grammar"]["score"] += points
        
        # Score listening section
        listening_section = next((s for s in test_data["sections"] if s["id"] == "listening"), None)
        if listening_section:
            for question in listening_section["questions"]:
                breakdown["listening"]["questions_total"] += 1
                answer = answer_map.get(question["id"])
                if answer and answer.selected_option is not None:
                    breakdown["listening"]["questions_answered"] += 1
                    if answer.selected_option == question["correct"]:
                        points = question["points"]
                        total_score += points
                        breakdown["listening"]["score"] += points
        
        # Score reading section
        reading_section = next((s for s in test_data["sections"] if s["id"] == "reading"), None)
        if reading_section:
            for passage in reading_section["passages"]:
                for question in passage["questions"]:
                    breakdown["reading"]["questions_total"] += 1
                    answer = answer_map.get(question["id"])
                    if answer and answer.selected_option is not None:
                        breakdown["reading"]["questions_answered"] += 1
                        if answer.selected_option == question["correct"]:
                            points = question["points"]
                            total_score += points
                            breakdown["reading"]["score"] += points
        
        # Score speaking section
        # Note: Speaking requires manual review or AI assessment
        # For now, give partial credit if audio was submitted
        speaking_section = next((s for s in test_data["sections"] if s["id"] == "speaking"), None)
        if speaking_section:
            for prompt in speaking_section["prompts"]:
                breakdown["speaking"]["questions_total"] += 1
                answer = answer_map.get(prompt["id"])
                if answer and answer.audio_url:
                    breakdown["speaking"]["questions_answered"] += 1
                    # Give 60% credit for attempting (will be manually reviewed)
                    points = int(prompt["points"] * 0.6)
                    total_score += points
                    breakdown["speaking"]["score"] += points
        
        # Calculate percentage
        percentage = round((total_score / max_score) * 100, 1)
        
        # Determine placement level
        placement_level = None
        for level in test_data["scoring"]["levels"]:
            if level["min_score"] <= percentage <= level["max_score"]:
                placement_level = level
                break
        
        if not placement_level:
            # Default to beginner if no match
            placement_level = test_data["scoring"]["levels"][0]
        
        # Create result
        result = PlacementResult(
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
            certificate_available=percentage >= 70
        )
        
        # TODO: Save result to database
        # if submission.user_id:
        #     save_placement_result(submission.user_id, result)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing placement test: {str(e)}")


@router.get("/results/{user_id}")
async def get_placement_results(user_id: str):
    """
    Get placement test results for a user
    
    Returns most recent placement test result
    """
    # TODO: Implement database query
    raise HTTPException(status_code=501, detail="Not implemented - requires database integration")


# Add these routes to your main.py:
# from routes.placement import router as placement_router
# app.include_router(placement_router)
