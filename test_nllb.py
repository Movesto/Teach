"""
Test script for NLLB Translation API
"""

import requests

API_URL = "http://localhost:8001"


def test_translation():
    print("=" * 50)
    print("Testing NLLB v3 Translation API")
    print("=" * 50)
    
    # Test 1: English to Somali
    print("\nTest 1: English → Somali")
    print("-" * 30)
    response = requests.post(f"{API_URL}/translate", json={
        "text": "Hello, how are you today?",
        "direction": "eng_to_som"
    })
    if response.ok:
        result = response.json()
        print(f"English: Hello, how are you today?")
        print(f"Somali:  {result['translation']}")
    else:
        print(f"Error: {response.text}")
    
    # Test 2: Somali to English
    print("\nTest 2: Somali → English")
    print("-" * 30)
    response = requests.post(f"{API_URL}/translate", json={
        "text": "Waan fiicanahay, mahadsanid.",
        "direction": "som_to_eng"
    })
    if response.ok:
        result = response.json()
        print(f"Somali:  Waan fiicanahay, mahadsanid.")
        print(f"English: {result['translation']}")
    else:
        print(f"Error: {response.text}")
    
    # Test 3: Educational content
    print("\nTest 3: Educational Content → Somali")
    print("-" * 30)
    text = "The present tense is used to describe actions happening now."
    response = requests.post(f"{API_URL}/translate", json={
        "text": text,
        "direction": "eng_to_som"
    })
    if response.ok:
        result = response.json()
        print(f"English: {text}")
        print(f"Somali:  {result['translation']}")
    else:
        print(f"Error: {response.text}")
    
    # Test 4: Health check
    print("\nTest 4: Health Check")
    print("-" * 30)
    response = requests.get(f"{API_URL}/health")
    if response.ok:
        print(f"Status: {response.json()}")
    else:
        print(f"Error: {response.text}")
    
    print("\n" + "=" * 50)
    print("Tests complete!")


if __name__ == "__main__":
    test_translation()
