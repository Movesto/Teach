"""
Tests for public content endpoints:
  GET /api/units
  GET /api/lessons/{lesson_id}
  GET /api/health
"""


def test_get_units_returns_list(client):
    resp = client.get("/api/units")
    assert resp.status_code == 200
    units = resp.json()
    assert isinstance(units, list)
    assert len(units) > 0


def test_get_units_have_required_fields(client):
    units = client.get("/api/units").json()
    for unit in units:
        assert "id" in unit
        assert "title" in unit
        assert "lessons" in unit


def test_get_units_authenticated_includes_progress(client, auth_headers):
    """Authenticated requests return completion metadata alongside unit data."""
    resp = client.get("/api/units", headers=auth_headers)
    assert resp.status_code == 200
    units = resp.json()
    assert len(units) > 0
    # Each lesson should carry a 'completed' field when a user is logged in
    first_unit = units[0]
    if first_unit["lessons"]:
        lesson = first_unit["lessons"][0]
        assert "completed" in lesson


def test_get_lesson_valid(client):
    # Unit 1 lesson 1 must always exist; numeric ID only (strips non-digits)
    resp = client.get("/api/lessons/1")
    assert resp.status_code == 200
    data = resp.json()
    assert "title" in data or "id" in data


def test_get_lesson_invalid_returns_404(client):
    resp = client.get("/api/lessons/999-999")
    assert resp.status_code == 404


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
