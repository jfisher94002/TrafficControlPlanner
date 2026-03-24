import os
import re
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_export_pdf_returns_pdf(sample_plan):
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content[:4] == b"%PDF"


def test_export_pdf_content_disposition(sample_plan):
    res = client.post("/export-pdf", json=sample_plan)
    assert "attachment" in res.headers["content-disposition"]
    assert ".pdf" in res.headers["content-disposition"]


def test_export_pdf_missing_canvas_state(sample_plan):
    bad = dict(sample_plan)
    del bad["canvasState"]
    res = client.post("/export-pdf", json=bad)
    assert res.status_code == 422


def test_export_pdf_unknown_object_type_passes_through(sample_plan):
    # OtherCanvasObject accepts unknown types gracefully (passthrough design)
    plan = dict(sample_plan)
    plan["canvasState"] = {"objects": [{"id": "x", "type": "unknown_thing", "extra_field": 42}]}
    res = client.post("/export-pdf", json=plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_export_pdf_no_signs(plan_no_signs):
    res = client.post("/export-pdf", json=plan_no_signs)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_create_issue_returns_503_when_token_missing(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    res = client.post("/create-issue", json={
        "issue_type": "bug",
        "title": "Test issue",
        "body": "Test body",
        "priority": "medium",
        "submitter_name": "Tester",
    })
    assert res.status_code == 503


def test_create_issue_validates_input():
    res = client.post("/create-issue", json={
        "issue_type": "invalid_type",
        "title": "x",
        "body": "x",
        "priority": "medium",
        "submitter_name": "x",
    })
    assert res.status_code == 422


# ─── Security / Input Sanitization Tests ─────────────────────────────────────

def test_pdf_name_too_long_rejected(sample_plan):
    sample_plan["name"] = "A" * 201
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 422


def test_pdf_location_too_long_rejected(sample_plan):
    sample_plan["metadata"]["location"] = "X" * 201
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 422


def test_pdf_html_tags_stripped_from_name(sample_plan):
    sample_plan["name"] = "<script>alert(1)</script>My Plan"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_pdf_name_empty_after_sanitization_uses_fallback_filename(sample_plan):
    # Tags-only name: sanitize_text strips tags, leaving an empty string → fallback "plan"
    sample_plan["name"] = "<b></b>"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    cd = res.headers.get("content-disposition", "")
    assert 'filename="plan.pdf"' in cd


def test_pdf_control_chars_stripped_from_name(sample_plan):
    sample_plan["name"] = "Plan\x00\x01\x1f Name"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_pdf_html_tags_stripped_from_location(sample_plan):
    sample_plan["metadata"]["location"] = "<b>Bold</b> Street"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_pdf_too_many_objects_rejected(sample_plan):
    obj = {"id": "x", "type": "road", "x": 0, "y": 0}
    sample_plan["canvasState"]["objects"] = [
        {**obj, "id": f"obj-{i}"} for i in range(1001)
    ]
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 422


def test_pdf_oversized_image_rejected(sample_plan):
    sample_plan["canvas_image_b64"] = "A" * 10_000_001
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 422


# ── Boundary: values exactly at the limit should be accepted ─────────────────

def test_pdf_name_at_limit_accepted(sample_plan):
    sample_plan["name"] = "A" * 200
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200


def test_pdf_location_at_limit_accepted(sample_plan):
    sample_plan["metadata"]["location"] = "X" * 200
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200


def test_pdf_canvas_objects_at_limit_accepted(sample_plan):
    obj = {"id": "x", "type": "road", "x": 0, "y": 0}
    sample_plan["canvasState"]["objects"] = [
        {**obj, "id": f"obj-{i}"} for i in range(1000)
    ]
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200


def test_pdf_canvas_image_b64_at_limit_accepted(sample_plan):
    sample_plan["canvas_image_b64"] = "A" * 10_000_000
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200


# ── Unicode: filename in Content-Disposition must be ASCII-only ───────────────

def test_pdf_unicode_in_metadata(sample_plan):
    sample_plan["name"] = "Pläne für Straßen 🚧"
    sample_plan["metadata"]["location"] = "Zürich, Hauptstraße"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
    cd = res.headers.get("content-disposition", "")
    match = re.search(r'filename="?([^";]+)"?', cd)
    assert match is not None
    filename = match.group(1)
    assert all(ord(c) < 128 for c in filename), f"Non-ASCII chars in filename: {filename!r}"
    for disallowed in ("ä", "ü", "ö", "ß", "🚧"):
        assert disallowed not in filename


# ── CreateIssueRequest length limits ─────────────────────────────────────────

def test_create_issue_title_too_long_rejected():
    res = client.post("/create-issue", json={
        "issue_type": "bug", "title": "T" * 201, "body": "x",
        "priority": "low", "submitter_name": "x",
    })
    assert res.status_code == 422


def test_create_issue_body_too_long_rejected():
    res = client.post("/create-issue", json={
        "issue_type": "bug", "title": "x", "body": "B" * 5001,
        "priority": "low", "submitter_name": "x",
    })
    assert res.status_code == 422


def test_create_issue_submitter_name_too_long_rejected():
    res = client.post("/create-issue", json={
        "issue_type": "bug", "title": "x", "body": "x",
        "priority": "low", "submitter_name": "N" * 101,
    })
    assert res.status_code == 422


def test_create_issue_at_limits_accepted(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token-for-limit-test")
    res = client.post("/create-issue", json={
        "issue_type": "bug",
        "title": "T" * 200,
        "body": "B" * 5000,
        "priority": "low",
        "submitter_name": "N" * 100,
    })
    # Token is fake so GitHub call will fail, but validation should pass (not 422)
    assert res.status_code != 422


# ── Model-level sanitization unit tests ──────────────────────────────────────

def test_pdf_sanitize_plan_meta_fields():
    from models import PlanMeta
    meta = PlanMeta(
        projectNumber="<script>PN-001</script>\x00",
        client="Client\x00Name<b>",
        location="<b>Main St</b>\x01",
        notes="Note<script>x</script>\x00",
    )
    for field in (meta.projectNumber, meta.client, meta.location, meta.notes):
        assert "<" not in field
        assert ">" not in field
        assert "\x00" not in field
    assert "PN-001" in meta.projectNumber
    assert "Client" in meta.client
    assert "Main St" in meta.location
    assert "Note" in meta.notes


def test_pdf_sanitize_sign_data_label():
    from models import SignData
    sign = SignData(
        id="s1", label="<b>STOP</b>\x00<script>x</script>",
        shape="octagon", color="#ef4444", textColor="#fff",
    )
    assert "<" not in sign.label
    assert ">" not in sign.label
    assert "\x00" not in sign.label
    assert "STOP" in sign.label


def test_pdf_sign_data_label_too_long_rejected():
    import pytest
    from pydantic import ValidationError
    from models import SignData
    with pytest.raises(ValidationError):
        SignData(
            id="s1", label="L" * 51,
            shape="octagon", color="#ef4444", textColor="#fff",
        )


def test_pdf_sanitize_export_request_name():
    from models import ExportRequest
    req = ExportRequest(
        id="t", name="<script>alert('x')</script> Valid-Name\x00",
        createdAt="2024-01-01T00:00:00Z", updatedAt="2024-01-01T00:00:00Z",
        canvasState={"objects": []},
    )
    assert "<" not in req.name
    assert "\x00" not in req.name
    assert "Valid-Name" in req.name
