"""Generate TTS audio for all listening exercises that reference /audio/*.mp3 files."""
import asyncio
import json
import glob
import re
import sys
from pathlib import Path

AUDIO_DIR = Path(__file__).parent / "audio"
VOICE = "en-US-JennyNeural"

# Manual overrides for exercises where explanation text can't be auto-extracted
OVERRIDES = {
    "/audio/lesson5-listen3.mp3":  "The fare is two dollars.",
    "/audio/lesson7-listen3.mp3":  "I would like to leave a message, please.",
    "/audio/lesson10-listen3.mp3": "He is wearing a blue shirt and jeans.",
    "/audio/lesson13-listen1.mp3": "How about Sunday? Saturday does not work for me.",
    "/audio/lesson13-listen3.mp3": "Great, let us meet at 2 PM then.",
    # unit-2 patterns without quotes (add more here if needed)
}


def extract_text(ex: dict) -> str:
    """Get the spoken text for a listening exercise."""
    audio_path = ex.get("audio", "")

    # Manual override
    if audio_path in OVERRIDES:
        return OVERRIDES[audio_path]

    # Prefer explicit transcript field (units 3+)
    text = ex.get("transcript", "").strip()
    if text:
        return text

    # Fall back: extract quoted text from explanation (units 1-2)
    expl = ex.get("explanation", "")
    m = re.search(r"'(.+?)'", expl)
    if m:
        return m.group(1)

    # Last resort: use explanation as-is
    return expl.strip()


async def generate_one(filename: str, text: str, edge_tts) -> bool:
    dest = AUDIO_DIR / filename
    if dest.exists():
        print(f"  SKIP  {filename} (already exists)")
        return True
    if not text:
        print(f"  SKIP  {filename} (no text)")
        return False
    try:
        communicate = edge_tts.Communicate(text, VOICE, rate="-5%")
        await communicate.save(str(dest))
        print(f"  OK    {filename}")
        return True
    except Exception as e:
        print(f"  FAIL  {filename}: {e}")
        return False


async def main():
    try:
        import edge_tts
    except ImportError:
        print("ERROR: edge-tts not installed. Run: pip install edge-tts")
        sys.exit(1)

    AUDIO_DIR.mkdir(exist_ok=True)

    # Collect all exercises
    tasks = {}  # filename -> text
    lesson_files = sorted(glob.glob(
        str(Path(__file__).parent / "unit-*" / "lesson-*.json")
    ))

    for path in lesson_files:
        d = json.load(open(path, encoding="utf-8"))
        listening = d.get("listening_exercises", d.get("listening", []))
        for ex in listening:
            audio_path = ex.get("audio", "")
            if not audio_path.startswith("/audio/"):
                continue
            filename = audio_path.lstrip("/audio/")  # e.g. "lesson1-listen1.mp3"
            filename = Path(audio_path).name
            if filename not in tasks:
                tasks[filename] = extract_text(ex)

    print(f"Generating {len(tasks)} audio files...\n")
    ok = fail = skip = 0
    for filename, text in tasks.items():
        result = await generate_one(filename, text, edge_tts)
        if result:
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} generated, {fail} failed, {skip} skipped.")


if __name__ == "__main__":
    asyncio.run(main())
