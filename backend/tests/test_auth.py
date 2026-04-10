"""
Tests for authentication endpoints:
  POST /api/auth/register
  POST /api/auth/login
  GET  /api/auth/me
"""


# ── Register ───────────────────────────────────────────────────────────────

def test_register_returns_token_and_user(client):
    resp = client.post("/api/auth/register", json={
        "name": "Faadumo",
        "email": "faadumo@example.com",
        "password": "secure123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == "faadumo@example.com"
    assert data["user"]["name"] == "Faadumo"
    assert "password_hash" not in data["user"]


def test_register_lowercases_email(client):
    resp = client.post("/api/auth/register", json={
        "name": "Ali",
        "email": "ALI@EXAMPLE.COM",
        "password": "secure123",
    })
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "ali@example.com"


def test_register_duplicate_email_returns_400(client):
    payload = {"name": "User", "email": "dup@example.com", "password": "pass1234"}
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


def test_register_missing_name_returns_422(client):
    resp = client.post("/api/auth/register", json={
        "email": "no@name.com",
        "password": "pass1234",
    })
    assert resp.status_code == 422


def test_register_missing_password_returns_422(client):
    resp = client.post("/api/auth/register", json={
        "name": "No Pass",
        "email": "nopass@example.com",
    })
    assert resp.status_code == 422


# ── Login ──────────────────────────────────────────────────────────────────

def test_login_success(client):
    client.post("/api/auth/register", json={
        "name": "Xasan",
        "email": "xasan@example.com",
        "password": "mypassword",
    })
    resp = client.post("/api/auth/login", json={
        "email": "xasan@example.com",
        "password": "mypassword",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == "xasan@example.com"
    assert "password_hash" not in data["user"]


def test_login_wrong_password_returns_401(client):
    client.post("/api/auth/register", json={
        "name": "User",
        "email": "wrong@example.com",
        "password": "correct",
    })
    resp = client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "incorrect",
    })
    assert resp.status_code == 401


def test_login_unknown_email_returns_401(client):
    resp = client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "anything",
    })
    assert resp.status_code == 401


def test_login_is_case_insensitive_on_email(client):
    client.post("/api/auth/register", json={
        "name": "User",
        "email": "case@example.com",
        "password": "pass1234",
    })
    resp = client.post("/api/auth/login", json={
        "email": "CASE@EXAMPLE.COM",
        "password": "pass1234",
    })
    assert resp.status_code == 200


# ── /me ────────────────────────────────────────────────────────────────────

def test_me_returns_user(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "test@example.com"


def test_me_without_token_returns_401(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_invalid_token_returns_401(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401
