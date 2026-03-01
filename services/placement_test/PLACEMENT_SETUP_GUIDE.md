# Placement Test Setup Guide

Complete guide to add the placement test to your English learning platform.

---

## 📦 What You're Getting

A complete **4-section placement test**:
1. **Grammar & Vocabulary** (15 questions) - 30 points
2. **Listening Comprehension** (5 audio clips) - 25 points  
3. **Reading Comprehension** (2 passages, 10 questions) - 25 points
4. **Speaking Assessment** (3 prompts) - 20 points

**Total:** 100 points, ~15 minutes

**Placement Levels:**
- 0-30%: Unit 1 (Beginner - A1)
- 31-50%: Unit 3 (Elementary - A2)
- 51-70%: Unit 5 (Intermediate - B1)
- 71-85%: Unit 8 (Upper-Intermediate - B2)
- 86-100%: Unit 11 (Advanced - C1)

---

## 🚀 Installation (5 Steps)

### Step 1: Place Backend Files

```
Teach/
└── backend/
    ├── placement-test.json          # Test structure
    ├── routes/
    │   └── placement_routes.py      # API endpoints
    └── audio/
        ├── placement-listen1.mp3    # Generated audio files
        ├── placement-listen2.mp3
        ├── placement-listen3.mp3
        ├── placement-listen4.mp3
        └── placement-listen5.mp3
```

### Step 2: Generate Audio Files

```bash
# Install edge-tts if not already installed
pip install edge-tts

# Navigate to backend directory
cd C:\Users\pscad\Documents\Teach\backend

# Run audio generator
python generate_placement_audio.py
```

This creates 5 audio files in `./audio/` directory.

### Step 3: Update Backend (main.py)

Add these lines to your `backend/main.py`:

```python
# Add to imports
from routes.placement_routes import router as placement_router

# Add to app initialization (after creating app)
app.include_router(placement_router)
```

### Step 4: Place Frontend Component

```
Teach/
└── app/
    └── src/
        ├── components/
        │   └── PlacementTest.jsx    # Main component
        └── App.jsx                  # Add route
```

Update `App.jsx` to add the route:

```javascript
import PlacementTest from './components/PlacementTest';

// In your routes:
<Route path="/placement-test" element={<PlacementTest />} />
```

### Step 5: Restart Services

```bash
# Restart backend
cd C:\Users\pscad\Documents\Teach\backend
python main.py

# Restart frontend (if needed)
cd C:\Users\pscad\Documents\Teach\app
npm run dev
```

---

## 🧪 Testing

### Test the API

```bash
# Get placement test
curl http://localhost:8000/api/placement/test

# Should return test structure without answers
```

### Test in Browser

```
http://localhost:3000/placement-test
```

You should see:
1. Test instructions
2. All 4 sections navigable
3. Audio players for listening section
4. Recording interface for speaking section
5. Results page with placement recommendation

---

## 📊 Test Structure

### Section 1: Grammar & Vocabulary (30 points)
- 15 multiple choice questions
- Tests: verb tenses, articles, prepositions, conditionals
- Ranges from beginner (is/am/are) to advanced (subjunctive)

### Section 2: Listening (25 points)
- 5 audio clips with questions
- Progressive difficulty:
  - L1-L2: Simple statements (beginner)
  - L3-L4: Short narratives (intermediate)
  - L5: Academic content (advanced)

### Section 3: Reading (25 points)
- 2 passages with questions
- Passage 1: Personal narrative (beginner level)
- Passage 2: Academic/news article (advanced level)

### Section 4: Speaking (20 points)
- 3 prompts with recording
- Automatic scoring (60% credit for attempting)
- Manual review option for detailed assessment

---

## 🎯 Scoring Logic

### Automatic Scoring:
- **Grammar:** Exact match = full points
- **Listening:** Exact match = full points
- **Reading:** Exact match = full points
- **Speaking:** Attempt = 60% points (placeholder for manual review)

### Placement Algorithm:
```python
percentage = (total_score / 100) * 100

if 0 <= percentage <= 30:
    level = "beginner"
    start_unit = 1
elif 31 <= percentage <= 50:
    level = "elementary"
    start_unit = 3
# ... etc
```

---

## 🔧 Customization

### Add More Questions

Edit `placement-test.json`:

```json
{
  "sections": [
    {
      "id": "grammar",
      "questions": [
        {
          "id": "g16",
          "question": "Your new question here",
          "options": ["A", "B", "C", "D"],
          "correct": 0,
          "points": 2,
          "level": "intermediate"
        }
      ]
    }
  ]
}
```

### Adjust Scoring Thresholds

Edit `placement-test.json` → `scoring` → `levels`:

```json
{
  "min_score": 0,
  "max_score": 35,  // Change from 30 to 35
  "level": "beginner",
  "recommended_unit": 1
}
```

### Change Audio Voices

Edit `generate_placement_audio.py`:

```python
"placement-listen1.mp3": {
    "text": "Your text here",
    "voice": "en-US-AriaNeural"  // Change voice
}
```

Available voices:
- `en-US-JennyNeural` (Female, friendly)
- `en-US-GuyNeural` (Male, clear)
- `en-US-AriaNeural` (Female, professional)
- `en-US-DavisNeural` (Male, formal)

---

## 💡 Advanced Features

### Save Results to Database

Update `placement_routes.py`:

```python
@router.post("/submit")
async def submit_placement_test(submission: SubmitTestRequest):
    # ... existing code ...
    
    # Save to database
    if submission.user_id:
        db_result = PlacementResult(
            user_id=submission.user_id,
            score=total_score,
            level=placement_level["level"],
            completed_at=datetime.now()
        )
        db.session.add(db_result)
        db.session.commit()
    
    return result
```

### Add Adaptive Testing

Make test adjust difficulty based on answers:

```python
def get_next_question(current_score, answered_questions):
    # If doing well, show harder questions
    if current_score > 80:
        return get_advanced_questions()
    # If struggling, show easier questions
    elif current_score < 40:
        return get_beginner_questions()
    # Otherwise, show medium difficulty
    else:
        return get_intermediate_questions()
```

### Certificate Generation

```python
from reportlab.pdfgen import canvas

@router.get("/certificate/{user_id}")
async def generate_certificate(user_id: str):
    result = get_placement_result(user_id)
    
    pdf = canvas.Canvas(f"certificate_{user_id}.pdf")
    pdf.drawString(100, 750, f"Certificate of Achievement")
    pdf.drawString(100, 700, f"Level: {result.level.upper()}")
    pdf.drawString(100, 650, f"Score: {result.percentage}%")
    pdf.save()
    
    return FileResponse(f"certificate_{user_id}.pdf")
```

---

## 🐛 Troubleshooting

### Audio Files Not Playing

**Problem:** Listening section shows broken audio players

**Solution:**
```bash
# 1. Check audio files exist
ls backend/audio/placement-listen*.mp3

# 2. Verify backend serves static files
# In main.py:
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# 3. Test direct access
curl http://localhost:8000/audio/placement-listen1.mp3
```

### Recording Not Working

**Problem:** Speaking section doesn't record

**Solution:**
1. Check browser permissions (allow microphone)
2. Use HTTPS (some browsers require it)
3. Check console for errors (F12 → Console)

### Wrong Placement

**Problem:** Student gets wrong level recommendation

**Solution:**
1. Review question difficulty distribution
2. Adjust scoring thresholds in `placement-test.json`
3. Add more questions for better accuracy

---

## 📈 Analytics & Insights

### Track Common Mistakes

```python
# Add to placement_routes.py
@router.get("/analytics/common-mistakes")
async def get_common_mistakes():
    # Query database for most missed questions
    mistakes = db.query(
        Answer.question_id,
        func.count(Answer.id).label('count')
    ).filter(
        Answer.is_correct == False
    ).group_by(
        Answer.question_id
    ).order_by(
        desc('count')
    ).limit(10).all()
    
    return mistakes
```

### Track Average Scores

```python
@router.get("/analytics/average-scores")
async def get_average_scores():
    avg_scores = {
        "grammar": db.query(func.avg(Result.grammar_score)).scalar(),
        "listening": db.query(func.avg(Result.listening_score)).scalar(),
        "reading": db.query(func.avg(Result.reading_score)).scalar(),
        "speaking": db.query(func.avg(Result.speaking_score)).scalar()
    }
    return avg_scores
```

---

## ✅ Complete Checklist

Before going live:

- [ ] All 5 audio files generated
- [ ] Backend routes added to main.py
- [ ] Frontend component integrated
- [ ] Test completes successfully
- [ ] Results show correct placement
- [ ] Audio plays in listening section
- [ ] Recording works in speaking section
- [ ] Database saves results (if implemented)
- [ ] Certificates generate (if implemented)

---

## 🎉 You're Done!

Your placement test is now live at: `http://localhost:3000/placement-test`

**Features you have:**
- ✅ 4-section comprehensive test
- ✅ Automatic scoring
- ✅ Level placement (A1-C1)
- ✅ Audio listening comprehension
- ✅ Speaking recording
- ✅ Beautiful results page
- ✅ Unit recommendations

**Next steps:**
1. Test with real students
2. Gather feedback
3. Adjust difficulty/thresholds
4. Add database integration
5. Generate certificates

**Questions?** Check the troubleshooting section or reach out for help! 🚀
