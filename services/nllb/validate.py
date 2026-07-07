"""Quick A/B check for the NLLB translation service.

Run it against the running service, once per backend, and diff the output to
confirm the CTranslate2 int8 model matches your fine-tune's quality.

Workflow:
    1. Service up with NLLB_BACKEND=ct2 (default):
           python validate.py > ct2.txt
    2. Flip to the original model — set NLLB_BACKEND=transformers in
       docker-compose.yml, `docker compose up -d nllb`, then:
           python validate.py > transformers.txt
    3. Compare:  diff transformers.txt ct2.txt

Override the endpoint with NLLB_URL if needed.
"""
import os
import json
import urllib.request

URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")

# Add a handful of your own real lesson sentences here for a meaningful check.
SAMPLES = [
    ("eng_to_som", "Hello, how are you today?"),
    ("eng_to_som", "Open your book to page ten and read the first paragraph."),
    ("eng_to_som", "The present continuous tense describes actions happening now."),
    ("eng_to_som", "Well done! You answered every question correctly."),
    ("som_to_eng", "Waan fahmay casharkan."),
    ("som_to_eng", "Maxaad samaynaysaa maanta?"),
]


def translate(text: str, direction: str) -> str:
    data = json.dumps({"text": text, "direction": direction}).encode()
    req = urllib.request.Request(
        URL, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["translation"]


if __name__ == "__main__":
    for direction, text in SAMPLES:
        print(f"[{direction}] {text}")
        print(f"    -> {translate(text, direction)}\n")
