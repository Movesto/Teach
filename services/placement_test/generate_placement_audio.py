"""
Generate Audio Files for Placement Test Listening Section
Uses Edge TTS to create the listening comprehension audio files
"""

import edge_tts
import asyncio
from pathlib import Path

# Audio content for placement test listening section
PLACEMENT_AUDIO = {
    "placement-listen1.mp3": {
        "text": "My name is Sarah. I am 25 years old. I live in Portland.",
        "voice": "en-US-JennyNeural"
    },
    "placement-listen2.mp3": {
        "text": "I work at a hospital. I am a nurse. I help sick people.",
        "voice": "en-US-GuyNeural"
    },
    "placement-listen3.mp3": {
        "text": "Last weekend, I went to the park with my family. We had a picnic and played soccer. It was very fun.",
        "voice": "en-US-JennyNeural"
    },
    "placement-listen4.mp3": {
        "text": "I've been studying English for two years now. At first, it was really difficult, but I'm making progress. My goal is to speak fluently by next year.",
        "voice": "en-US-GuyNeural"
    },
    "placement-listen5.mp3": {
        "text": "The economic implications of the policy shift remain unclear. While proponents argue it will stimulate growth, critics contend that the potential risks outweigh the benefits, particularly for vulnerable populations.",
        "voice": "en-US-AriaNeural"  # More formal voice for academic content
    }
}


async def generate_audio(filename, text, voice):
    """Generate a single audio file using Edge TTS"""
    print(f"Generating {filename}...")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(filename)
    print(f"✓ Created {filename}")


async def generate_all_audio():
    """Generate all audio files for placement test"""
    # Create audio directory if it doesn't exist
    audio_dir = Path("audio")
    audio_dir.mkdir(exist_ok=True)
    
    # Generate each audio file
    tasks = []
    for filename, config in PLACEMENT_AUDIO.items():
        filepath = audio_dir / filename
        task = generate_audio(str(filepath), config["text"], config["voice"])
        tasks.append(task)
    
    # Run all tasks concurrently
    await asyncio.gather(*tasks)
    
    print(f"\n✅ Generated {len(PLACEMENT_AUDIO)} audio files in ./audio/")
    print("\nNext steps:")
    print("1. Copy the ./audio/ folder to your backend directory")
    print("2. Make sure backend serves audio files at /audio/")
    print("3. Test the placement test in your browser!")


if __name__ == "__main__":
    print("=" * 60)
    print("Placement Test Audio Generator")
    print("=" * 60)
    print()
    
    asyncio.run(generate_all_audio())
