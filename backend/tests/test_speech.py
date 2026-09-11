"""Tests for core/speech.py synthesize(): flux-tts primary, edge-tts fallback."""
import asyncio
import types
from unittest.mock import AsyncMock, MagicMock

import core.speech as speech


def _fake_client(post):
    c = MagicMock()
    c.post = post
    return c


def test_flux_primary_writes_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(speech, "AUDIO_DIR", tmp_path)
    resp = types.SimpleNamespace(status_code=200, content=b"ID3fakeaudio", text="")
    post = AsyncMock(return_value=resp)
    monkeypatch.setattr(speech, "get_client", lambda: _fake_client(post))

    url = asyncio.run(speech.synthesize("Hello there.", "kv", "en-US-JennyNeural", prefix="t"))
    assert url and url.startswith("/audio/")
    assert (tmp_path / url.split("/")[-1]).read_bytes() == b"ID3fakeaudio"
    assert post.call_args.kwargs["json"]["model"] == speech.TTS_MODEL  # flux was used


def test_falls_back_to_edge_when_flux_fails(monkeypatch, tmp_path):
    monkeypatch.setattr(speech, "AUDIO_DIR", tmp_path)
    monkeypatch.setattr(speech, "get_client",
                        lambda: _fake_client(AsyncMock(side_effect=RuntimeError("flux down"))))

    saved = {}
    class FakeComm:
        def __init__(self, text, voice, rate=None):
            saved["voice"] = voice
        async def save(self, path):
            open(path, "wb").write(b"edgeaudio")
    monkeypatch.setattr("edge_tts.Communicate", FakeComm)

    url = asyncio.run(speech.synthesize("Hi.", "kv", "en-GB-SoniaNeural", prefix="t"))
    assert url and (tmp_path / url.split("/")[-1]).read_bytes() == b"edgeaudio"
    assert saved["voice"] == "en-GB-SoniaNeural"  # edge voice used on fallback


def test_force_edge_skips_flux(monkeypatch, tmp_path):
    monkeypatch.setattr(speech, "AUDIO_DIR", tmp_path)
    post = AsyncMock()
    monkeypatch.setattr(speech, "get_client", lambda: _fake_client(post))
    class FakeComm:
        def __init__(self, *a, **k): pass
        async def save(self, path): open(path, "wb").write(b"edge")
    monkeypatch.setattr("edge_tts.Communicate", FakeComm)

    url = asyncio.run(speech.synthesize("Accent test.", "kv", "en-KE-AsiliaNeural",
                                        prefix="t", force_edge=True))
    assert url
    post.assert_not_called()  # flux never attempted when force_edge


def test_empty_text_returns_none(monkeypatch, tmp_path):
    monkeypatch.setattr(speech, "AUDIO_DIR", tmp_path)
    assert asyncio.run(speech.synthesize("   ", "kv", "en-US-JennyNeural")) is None
