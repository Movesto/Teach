"""Tests for the folded tutor (routers/translate.py /chat and /explain) and the
ask_folded primary→fallback→cap logic (core/ai_client.py)."""
import asyncio
from unittest.mock import AsyncMock

import pytest

import core.ai_client as ai


# ── /chat and /explain endpoints (ask_folded mocked) ─────────────────────────

def test_chat_requires_auth(client):
    client.cookies.clear()
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401


def test_chat_returns_folded_shape(client, auth_headers, monkeypatch):
    monkeypatch.setattr("routers.translate.ask_folded",
                        AsyncMock(return_value="Waan ku caawin karaa!"))
    r = client.post("/api/chat", json={"message": "Ma i caawin kartaa?", "unit_id": 1},
                    headers=auth_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["reply"] == "Waan ku caawin karaa!"
    # In folded mode the *_english fields mirror the reply / raw message (history seed)
    assert d["reply_english"] == d["reply"]
    assert d["user_message_english"] == "Ma i caawin kartaa?"


def test_chat_lower_tier_prompts_for_somali(client, auth_headers, monkeypatch):
    spy = AsyncMock(return_value="…")
    monkeypatch.setattr("routers.translate.ask_folded", spy)
    client.post("/api/chat", json={"message": "hi", "unit_id": 1}, headers=auth_headers)
    system = spy.call_args.args[0][0]["content"]
    assert "Somali" in system  # bilingual/english_first tiers reply in Somali


def test_chat_immersion_prompts_for_english_only(client, auth_headers, monkeypatch):
    spy = AsyncMock(return_value="…")
    monkeypatch.setattr("routers.translate.ask_folded", spy)
    client.post("/api/chat", json={"message": "hi", "unit_id": 9}, headers=auth_headers)
    system = spy.call_args.args[0][0]["content"]
    assert "English only" in system  # immersion tier stays English


def test_chat_history_is_passed_through(client, auth_headers, monkeypatch):
    spy = AsyncMock(return_value="ok")
    monkeypatch.setattr("routers.translate.ask_folded", spy)
    client.post("/api/chat", json={
        "message": "next", "unit_id": 1,
        "history": [{"role": "user", "content": "hello", "content_english": "hello"},
                    {"role": "assistant", "content": "hi there", "content_english": "hi there"}],
    }, headers=auth_headers)
    msgs = spy.call_args.args[0]
    # system + 2 history + the new user message
    assert [m["role"] for m in msgs] == ["system", "user", "assistant", "user"]
    assert msgs[-1]["content"] == "next"


def test_explain_returns_folded_shape(client, auth_headers, monkeypatch):
    monkeypatch.setattr("routers.translate.ask_folded",
                        AsyncMock(return_value="Sharaxaad Soomaali ah."))
    r = client.post("/api/explain",
                    json={"english": "reliable", "type": "phrase", "unit_id": 1},
                    headers=auth_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["explanation"] == "Sharaxaad Soomaali ah."
    assert d["explanation_english"] == d["explanation"]


# ── ask_folded logic (primary → fallback → cap) ──────────────────────────────

@pytest.fixture(autouse=True)
def _reset_spend():
    ai._spend.update({"date": None, "usd": 0.0})
    yield


def test_ask_folded_uses_primary_and_tracks_spend(monkeypatch):
    call = AsyncMock(return_value=("primary reply", {"prompt_tokens": 1000, "completion_tokens": 300}))
    monkeypatch.setattr(ai, "_call_model", call)
    monkeypatch.setattr(ai, "LLM_DAILY_SPEND_CAP_USD", 5.0)
    out = asyncio.run(ai.ask_folded([{"role": "user", "content": "hi"}]))
    assert out == "primary reply"
    assert call.call_args.args[0] == ai.FOLDED_MODEL
    assert ai.folded_spend_today() > 0  # cost recorded


def test_ask_folded_falls_back_on_primary_failure(monkeypatch):
    async def side(model, *a, **k):
        if model == ai.FOLDED_MODEL:
            raise RuntimeError("boom")
        return ("free reply", {})
    monkeypatch.setattr(ai, "_call_model", AsyncMock(side_effect=side))
    monkeypatch.setattr(ai, "LLM_DAILY_SPEND_CAP_USD", 5.0)
    out = asyncio.run(ai.ask_folded([{"role": "user", "content": "hi"}]))
    assert out == "free reply"


def test_ask_folded_skips_primary_when_cap_zero(monkeypatch):
    seen = []
    async def side(model, *a, **k):
        seen.append(model)
        return ("free reply", {})
    monkeypatch.setattr(ai, "_call_model", AsyncMock(side_effect=side))
    monkeypatch.setattr(ai, "LLM_DAILY_SPEND_CAP_USD", 0.0)  # never use paid
    out = asyncio.run(ai.ask_folded([{"role": "user", "content": "hi"}]))
    assert out == "free reply"
    assert ai.FOLDED_MODEL not in seen  # primary never called
    assert seen == [ai.FOLDED_FALLBACK_MODEL]
