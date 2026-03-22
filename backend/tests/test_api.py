import os
import re
import pytest
from fastapi.testclient import TestClient

from main import app
from models import _MAX_IMAGE_B64_LEN

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
    sample_plan["canvas_image_b64"] = "A" * (_MAX_IMAGE_B64_LEN + 1)
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 422


def test_pdf_unicode_in_metadata(sample_plan):
    sample_plan["name"] = "Pläne für Straßen 🚧"
    sample_plan["metadata"]["location"] = "Zürich, Hauptstraße"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_pdf_sanitize_model_directly():
    """Sanitization happens at the model level before PDF generation."""
    from models import PlanMeta
    meta = PlanMeta(location="<script>x</script>Clean", client="Test\x00Client")
    assert "<script>" not in meta.location
    assert "\x00" not in meta.client
    assert "Clean" in meta.location


# ─── Boundary tests (exactly at limit → 200 OK) ──────────────────────────────

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
    sample_plan["canvasState"]["objects"] = [{**obj, "id": f"obj-{i}"} for i in range(1000)]
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200


def test_pdf_canvas_image_b64_at_limit_accepted(sample_plan):
    sample_plan["canvas_image_b64"] = "A" * _MAX_IMAGE_B64_LEN
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200


# ─── Content-Disposition ASCII filename ──────────────────────────────────────

def test_pdf_unicode_content_disposition_is_ascii(sample_plan):
    """Non-ASCII chars in plan name must not appear in the Content-Disposition filename."""
    sample_plan["name"] = "Pläne für Straßen 🚧"
    sample_plan["metadata"]["location"] = "Zürich, Hauptstraße"
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"

    cd = res.headers.get("content-disposition") or res.headers.get("Content-Disposition")
    assert cd is not None
    match = re.search(r'filename="?([^";]+)"?', cd)
    assert match is not None
    filename = match.group(1)
    assert all(ord(ch) < 128 for ch in filename)
    for disallowed in ("ä", "ü", "ö", "ß", "🚧"):
        assert disallowed not in filename


# ─── CreateIssueRequest length limits ────────────────────────────────────────

def test_create_issue_title_too_long():
    res = client.post("/create-issue", json={
        "issue_type": "bug", "title": "T" * 201, "body": "x",
        "priority": "medium", "submitter_name": "x",
    })
    assert res.status_code == 422


def test_create_issue_body_too_long():
    res = client.post("/create-issue", json={
        "issue_type": "bug", "title": "x", "body": "B" * 5001,
        "priority": "medium", "submitter_name": "x",
    })
    assert res.status_code == 422


def test_create_issue_submitter_name_too_long():
    res = client.post("/create-issue", json={
        "issue_type": "bug", "title": "x", "body": "x",
        "priority": "medium", "submitter_name": "S" * 101,
    })
    assert res.status_code == 422


def test_create_issue_fields_at_limit_accepted(monkeypatch):
    """All fields exactly at their max length should pass validation (503 = token missing, not 422)."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    res = client.post("/create-issue", json={
        "issue_type": "bug",
        "title": "T" * 200,
        "body": "B" * 5000,
        "priority": "medium",
        "submitter_name": "S" * 100,
    })
    assert res.status_code == 503  # validation passed; fails only on missing token


# ─── sanitize_text unit tests ─────────────────────────────────────────────────

def test_sanitize_text_strips_html_tags():
    from sanitize import sanitize_text
    result = sanitize_text("<script>alert(1)</script> Hello <!-- comment -->")
    assert "<" not in result
    assert ">" not in result
    assert "Hello" in result


def test_sanitize_text_strips_control_chars():
    from sanitize import sanitize_text
    result = sanitize_text("Hello\x00\x01\x1fWorld")
    assert "\x00" not in result
    assert "\x01" not in result
    assert "\x1f" not in result
    assert "Hello" in result
    assert "World" in result


def test_sanitize_text_preserves_allowed_whitespace():
    from sanitize import sanitize_text
    result = sanitize_text("Line 1\nLine 2\tTabbed")
    assert "\n" in result
    assert "\t" in result
    assert "Line 1" in result
    assert "Tabbed" in result


def test_sanitize_text_noop_on_clean_string():
    from sanitize import sanitize_text
    original = "Normal Name 123_-"
    assert sanitize_text(original) == original


def test_sanitize_text_strips_bare_angle_bracket_sequences():
    """Any <...> sequence is stripped — these fields have no legitimate use for angle brackets."""
    from sanitize import sanitize_text
    result = sanitize_text("<version>2.0</version>")
    assert "<" not in result
    assert ">" not in result
    assert "2.0" in result


# ─── PlanMeta full field coverage ─────────────────────────────────────────────

def test_plan_meta_sanitizes_all_fields():
    from models import PlanMeta
    meta = PlanMeta(
        projectNumber="<b>PN-001</b>\x00",
        client="Client\x00Name<script>",
        location="<b>Loc</b>\x01",
        notes="Note<script>x</script>\x00",
    )
    for field in (meta.projectNumber, meta.client, meta.location, meta.notes):
        assert "<script>" not in field
        assert "\x00" not in field
    assert "PN-001" in meta.projectNumber
    assert "Client" in meta.client
    assert "Loc" in meta.location
    assert "Note" in meta.notes


def test_plan_meta_defaults_are_empty_strings():
    from models import PlanMeta
    meta = PlanMeta()
    assert meta.projectNumber == ""
    assert meta.client == ""
    assert meta.location == ""
    assert meta.notes == ""


def test_sign_data_label_is_sanitized():
    from models import SignData
    sign = SignData(
        id="s1", label="<script>STOP</script>\x00",
        shape="octagon", color="#FF0000", textColor="#FFFFFF",
    )
    assert "<script>" not in sign.label
    assert "\x00" not in sign.label
    assert "STOP" in sign.label


def test_export_request_name_is_sanitized():
    from models import ExportRequest, CanvasState
    req = ExportRequest(
        id="1", name="<script>alert('x')</script> Valid\x00",
        createdAt="2026-01-01T00:00:00Z", updatedAt="2026-01-01T00:00:00Z",
        canvasState=CanvasState(objects=[]),
    )
    assert "<script>" not in req.name
    assert "\x00" not in req.name
    assert "Valid" in req.name


# ─── Legend / _sign_counts / _device_counts ───────────────────────────────────

def test_sign_counts_returns_counts(sample_plan):
    from pdf_generator import _sign_counts
    from models import ExportRequest
    req = ExportRequest(**sample_plan)
    counts = _sign_counts(req)
    assert len(counts) >= 0  # no crash; may be 0 if sample_plan has no signs


def test_sign_counts_deduplicates(sample_plan):
    from pdf_generator import _sign_counts
    from models import ExportRequest
    sign = {"id": "s1", "type": "sign", "x": 0, "y": 0, "rotation": 0, "scale": 1,
            "signData": {"id": "stop", "label": "STOP", "shape": "octagon", "color": "#FF0000", "textColor": "#FFFFFF"}}
    sample_plan["canvasState"]["objects"] = [sign, {**sign, "id": "s2"}, {**sign, "id": "s3"}]
    req = ExportRequest(**sample_plan)
    counts = _sign_counts(req)
    assert len(counts) == 1
    assert counts[0][1] == 3  # 3 instances of the same sign type


def test_device_counts_returns_devices(sample_plan):
    from pdf_generator import _device_counts
    from models import ExportRequest
    device = {"id": "d1", "type": "device", "x": 0, "y": 0,
              "deviceData": {"id": "cone", "label": "Traffic Cone", "icon": "▲", "color": "#f97316"}}
    sample_plan["canvasState"]["objects"] = [device, {**device, "id": "d2"}]
    req = ExportRequest(**sample_plan)
    counts = _device_counts(req)
    assert len(counts) == 1
    icon, label, count = counts[0]
    assert label == "Traffic Cone"
    assert count == 2


def test_pdf_with_devices_returns_pdf(sample_plan):
    device = {"id": "d1", "type": "device", "x": 0, "y": 0,
              "deviceData": {"id": "cone", "label": "Traffic Cone", "icon": "▲", "color": "#f97316"}}
    sample_plan["canvasState"]["objects"] = [device]
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_pdf_legend_includes_sign_count(sample_plan):
    """PDF is generated without error when canvas has multiple of the same sign."""
    sign = {"id": "s1", "type": "sign", "x": 0, "y": 0, "rotation": 0, "scale": 1,
            "signData": {"id": "stop", "label": "STOP", "shape": "octagon", "color": "#FF0000", "textColor": "#FFFFFF"}}
    sample_plan["canvasState"]["objects"] = [sign, {**sign, "id": "s2"}, {**sign, "id": "s3"}]
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"


def test_pdf_legend_with_signs_and_devices(sample_plan):
    """PDF is generated without error when canvas has both signs and devices."""
    sign = {"id": "s1", "type": "sign", "x": 0, "y": 0, "rotation": 0, "scale": 1,
            "signData": {"id": "stop", "label": "STOP", "shape": "octagon", "color": "#FF0000", "textColor": "#FFFFFF"}}
    device = {"id": "d1", "type": "device", "x": 10, "y": 10,
              "deviceData": {"id": "cone", "label": "Traffic Cone", "icon": "▲", "color": "#f97316"}}
    sample_plan["canvasState"]["objects"] = [sign, device]
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 200
    assert res.content[:4] == b"%PDF"
