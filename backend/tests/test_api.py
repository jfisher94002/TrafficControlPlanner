import os
import re
import pytest
from unittest.mock import MagicMock, patch
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


def test_create_issue_returns_503_when_token_missing(monkeypatch, valid_issue):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    res = client.post("/create-issue", json=valid_issue)
    assert res.status_code == 503


def test_create_issue_validates_input():
    res = client.post("/create-issue", json={
        "issue_type": "invalid_type",
        "title": "x",
        "body": "x",
        "priority": "medium",
        "submitter_name": "x",
        "time_on_form": 10.0,
    })
    assert res.status_code == 422


# ─── Spam protection tests ────────────────────────────────────────────────────

def test_honeypot_rejects_submission(valid_issue):
    """Requests with the honeypot field filled in are rejected with 400."""
    valid_issue["website"] = "http://spammer.example.com"
    res = client.post("/create-issue", json=valid_issue)
    assert res.status_code == 400


def test_too_fast_submission_rejected(valid_issue):
    """Submissions under 3 seconds on-form are rejected."""
    valid_issue["time_on_form"] = 1.5
    res = client.post("/create-issue", json=valid_issue)
    assert res.status_code == 400


def test_exactly_3s_is_accepted(monkeypatch, valid_issue):
    """Exactly 3 seconds on-form should pass the time check."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    valid_issue["time_on_form"] = 3.0
    res = client.post("/create-issue", json=valid_issue)
    assert res.status_code == 503  # token missing, not rejected for timing


def test_missing_time_on_form_uses_default_and_is_rejected(valid_issue):
    """Omitting time_on_form should fail the anti-bot timing check (default=0.0)."""
    payload = dict(valid_issue)
    payload.pop("time_on_form")
    res = client.post("/create-issue", json=payload)
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid submission."


def test_rate_limit_blocks_fourth_submission_from_same_ip(monkeypatch, valid_issue):
    """After 3 hits in the window, the 4th submission from same IP is rejected."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    headers = {"x-forwarded-for": "203.0.113.10"}
    for _ in range(3):
        res = client.post("/create-issue", json=valid_issue, headers=headers)
        assert res.status_code == 503  # token missing means request reached token check

    blocked = client.post("/create-issue", json=valid_issue, headers=headers)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many submissions. Please try again later."


def test_rate_limit_scoped_per_ip(monkeypatch, valid_issue):
    """Rate limiting one client IP must not block another IP."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    ip_one = {"x-forwarded-for": "198.51.100.8"}
    ip_two = {"x-forwarded-for": "198.51.100.9"}

    for _ in range(3):
        assert client.post("/create-issue", json=valid_issue, headers=ip_one).status_code == 503
    assert client.post("/create-issue", json=valid_issue, headers=ip_one).status_code == 429

    # Different IP should still proceed beyond rate limit check.
    assert client.post("/create-issue", json=valid_issue, headers=ip_two).status_code == 503


def test_rate_limit_window_allows_after_expiry(monkeypatch, valid_issue):
    """Old hits outside the 1-hour window should no longer count."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    headers = {"x-forwarded-for": "192.0.2.44"}
    # Seed three old hits; at time 4605 they're all outside the rolling window.
    with patch("main.time.time", return_value=4605):
        import main
        main._ip_submissions["192.0.2.44"] = [1000, 1001, 1002]
        res = client.post("/create-issue", json=valid_issue, headers=headers)
        assert res.status_code == 503


def test_rate_limit_uses_first_forwarded_ip(monkeypatch, valid_issue):
    """When x-forwarded-for has multiple IPs, limiter should use the first one."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    first_ip_chain = {"x-forwarded-for": "203.0.113.20, 10.0.0.4"}
    same_first_new_proxy = {"x-forwarded-for": "203.0.113.20, 10.0.0.99"}

    for _ in range(3):
        assert client.post("/create-issue", json=valid_issue, headers=first_ip_chain).status_code == 503

    # Same first IP should still be blocked even when downstream proxy IP changes.
    assert client.post("/create-issue", json=valid_issue, headers=same_first_new_proxy).status_code == 429


def test_rate_limit_uses_request_client_host_when_forwarded_ip_absent(monkeypatch, valid_issue):
    """Without x-forwarded-for header, limiter should still apply per client host."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    for _ in range(3):
        assert client.post("/create-issue", json=valid_issue).status_code == 503

    blocked = client.post("/create-issue", json=valid_issue)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many submissions. Please try again later."


def test_anonymous_submission_accepted_without_uid(monkeypatch):
    """Submissions without submitter_id (anonymous users) should no longer be blocked."""
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    res = client.post("/create-issue", json={
        "issue_type": "bug",
        "title": "Test",
        "body": "Test body",
        "priority": "medium",
        "submitter_name": "Anonymous",
        "time_on_form": 10.0,
    })
    assert res.status_code == 503  # token missing, not 403


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
    sample_plan["canvas_image_b64"] = "A" * (_MAX_IMAGE_B64_LEN + 1)
    res = client.post("/export-pdf", json=sample_plan)
    assert res.status_code == 422


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


def test_image_b64_limit_enforced_at_model_level():
    """Model-level boundary check avoids expensive HTTP decode path."""
    from pydantic import ValidationError
    from models import ExportRequest, CanvasState
    # At limit: accepted
    req = ExportRequest(
        id="1", name="x",
        createdAt="2026-01-01T00:00:00Z", updatedAt="2026-01-01T00:00:00Z",
        canvasState=CanvasState(objects=[]),
        canvas_image_b64="A" * _MAX_IMAGE_B64_LEN,
    )
    assert req.canvas_image_b64 is not None
    # Over limit: rejected
    with pytest.raises(ValidationError):
        ExportRequest(
            id="1", name="x",
            createdAt="2026-01-01T00:00:00Z", updatedAt="2026-01-01T00:00:00Z",
            canvasState=CanvasState(objects=[]),
            canvas_image_b64="A" * (_MAX_IMAGE_B64_LEN + 1),
        )


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
        "submitter_id": "user-123",
        "time_on_form": 10.0,
    })
    assert res.status_code == 503  # validation passed; fails only on missing token


# ─── _md_escape — submitter field sanitization ───────────────────────────────

def test_md_escape_strips_newlines(monkeypatch):
    """Newlines in submitter fields must not break the GitHub issue body."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    from unittest.mock import patch, MagicMock
    mock_resp = MagicMock()
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = False
    mock_resp.read.return_value = b'{"number": 1, "html_url": "https://github.com/x"}'
    with patch("urllib.request.urlopen", return_value=mock_resp) as mock_open:
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium",
            "submitter_name": "Line1\nLine2",
            "submitter_email": "evil\r\nhdr@x.com",
            "submitter_id": "user-123",
            "time_on_form": 10.0,
        })
    assert res.status_code == 200
    call_args = mock_open.call_args[0][0]
    import json as _json
    body_sent = _json.loads(call_args.data)["body"]
    # Injected newlines must be stripped from the submitter fields
    assert "Line1\nLine2" not in body_sent
    assert "evil\r\nhdr" not in body_sent
    # Content should still appear (without the injected newlines)
    assert "Line1 Line2" in body_sent


def test_md_escape_escapes_markdown_special_chars(monkeypatch):
    """Markdown special characters in submitter fields must be escaped."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    from unittest.mock import patch, MagicMock
    mock_resp = MagicMock()
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = False
    mock_resp.read.return_value = b'{"number": 1, "html_url": "https://github.com/x"}'
    with patch("urllib.request.urlopen", return_value=mock_resp) as mock_open:
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium",
            "submitter_name": "[Injection](http://evil.com)",
            "submitter_email": "test@example.com",
            "submitter_id": "user-123",
            "time_on_form": 10.0,
        })
    assert res.status_code == 200
    call_args = mock_open.call_args[0][0]
    import json as _json
    body_sent = _json.loads(call_args.data)["body"]
    assert "[Injection](http://evil.com)" not in body_sent
    assert "\\[Injection\\]" in body_sent


# ─── Model-level sanitization unit tests ─────────────────────────────────────

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
    from pydantic import ValidationError
    from models import SignData
    with pytest.raises(ValidationError):
        SignData(
            id="s1", label="L" * 51,
            shape="octagon", color="#ef4444", textColor="#fff",
        )


def test_device_data_label_is_sanitized():
    from models import DeviceData
    dev = DeviceData(id="cone", label="<script>Cone</script>\x00", icon="▲", color="#f97316")
    assert "<script>" not in dev.label
    assert "\x00" not in dev.label
    assert "Cone" in dev.label


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

def test_sign_counts_returns_zero_for_empty_canvas(sample_plan):
    from pdf_generator import _sign_counts
    from models import ExportRequest
    sample_plan["canvasState"]["objects"] = []
    req = ExportRequest(**sample_plan)
    assert _sign_counts(req) == []


def test_sign_counts_returns_one_entry_for_one_sign(sample_plan):
    from pdf_generator import _sign_counts
    from models import ExportRequest
    sign = {"id": "s1", "type": "sign", "x": 0, "y": 0, "rotation": 0, "scale": 1,
            "signData": {"id": "stop", "label": "STOP", "shape": "octagon", "color": "#FF0000", "textColor": "#FFFFFF"}}
    sample_plan["canvasState"]["objects"] = [sign]
    req = ExportRequest(**sample_plan)
    counts = _sign_counts(req)
    assert len(counts) == 1
    assert counts[0][1] == 1  # count is 1


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


# ─── SES email notification tests ────────────────────────────────────────────

def _mock_urlopen_success():
    mock_resp = MagicMock()
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.__exit__.return_value = False
    mock_resp.read.return_value = b'{"number": 42, "html_url": "https://github.com/x/y/issues/42"}'
    return mock_resp


def test_ses_not_called_when_sender_not_configured(monkeypatch):
    """When SES_SENDER_EMAIL is unset, no boto3 call should be made."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.delenv("SES_SENDER_EMAIL", raising=False)
    with patch("urllib.request.urlopen", return_value=_mock_urlopen_success()), \
         patch("boto3.client") as mock_boto:
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium", "submitter_name": "Tester",
            "submitter_email": "user@example.com", "submitter_id": "u-1", "time_on_form": 10.0,
        })
    assert res.status_code == 200
    mock_boto.assert_not_called()


def test_ses_sends_email_with_reply_to_when_email_provided(monkeypatch):
    """When submitter_email is present, Reply-To should be set to that address."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("SES_SENDER_EMAIL", "jfisher@fisherconsulting.org")
    mock_ses = MagicMock()
    with patch("urllib.request.urlopen", return_value=_mock_urlopen_success()), \
         patch("boto3.client", return_value=mock_ses):
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium", "submitter_name": "Tester",
            "submitter_email": "user@example.com", "submitter_id": "u-1", "time_on_form": 10.0,
        })
    assert res.status_code == 200
    mock_ses.send_email.assert_called_once()
    call_kwargs = mock_ses.send_email.call_args[1]
    assert call_kwargs["ReplyToAddresses"] == ["user@example.com"]
    assert call_kwargs["Source"] == "jfisher@fisherconsulting.org"
    assert call_kwargs["Destination"]["ToAddresses"] == ["jfisher@fisherconsulting.org"]


def test_ses_no_reply_to_when_no_submitter_email(monkeypatch):
    """When submitter_email is absent, no Reply-To header should be set."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("SES_SENDER_EMAIL", "jfisher@fisherconsulting.org")
    mock_ses = MagicMock()
    with patch("urllib.request.urlopen", return_value=_mock_urlopen_success()), \
         patch("boto3.client", return_value=mock_ses):
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium", "submitter_name": "Tester",
            "submitter_id": "u-1", "time_on_form": 10.0,
        })
    assert res.status_code == 200
    mock_ses.send_email.assert_called_once()
    call_kwargs = mock_ses.send_email.call_args[1]
    assert "ReplyToAddresses" not in call_kwargs


def test_ses_failure_does_not_break_issue_creation(monkeypatch):
    """SES errors must be swallowed — issue creation should still return 200."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("SES_SENDER_EMAIL", "jfisher@fisherconsulting.org")
    mock_ses = MagicMock()
    from botocore.exceptions import ClientError
    mock_ses.send_email.side_effect = ClientError(
        {"Error": {"Code": "MessageRejected", "Message": "Email address not verified"}}, "SendEmail"
    )
    with patch("urllib.request.urlopen", return_value=_mock_urlopen_success()), \
         patch("boto3.client", return_value=mock_ses):
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium", "submitter_name": "Tester",
            "submitter_email": "user@example.com", "submitter_id": "u-1", "time_on_form": 10.0,
        })
    assert res.status_code == 200
    assert res.json()["issue_number"] == 42


def test_ses_email_subject_and_body_content(monkeypatch):
    """Email subject and body should include issue number, title, URL, and feedback."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("SES_SENDER_EMAIL", "jfisher@fisherconsulting.org")
    mock_ses = MagicMock()
    with patch("urllib.request.urlopen", return_value=_mock_urlopen_success()), \
         patch("boto3.client", return_value=mock_ses):
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "Map crashes on zoom", "body": "Steps to repro here",
            "priority": "high", "submitter_name": "Tester",
            "submitter_email": "user@example.com", "submitter_id": "u-1", "time_on_form": 10.0,
        })
    assert res.status_code == 200
    call_kwargs = mock_ses.send_email.call_args[1]
    subject = call_kwargs["Message"]["Subject"]["Data"]
    assert "42" in subject
    assert "Map crashes on zoom" in subject
    body = call_kwargs["Message"]["Body"]["Text"]["Data"]
    assert "https://github.com/x/y/issues/42" in body
    assert "bug" in body
    assert "high" in body
    assert "Submitter email: user@example.com" in body
    assert "--- Feedback ---" in body
    assert "Steps to repro here" in body


def test_ses_body_omits_submitter_email_line_when_absent(monkeypatch):
    """Email body should not include 'Submitter email:' when no email was provided."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("SES_SENDER_EMAIL", "jfisher@fisherconsulting.org")
    mock_ses = MagicMock()
    with patch("urllib.request.urlopen", return_value=_mock_urlopen_success()), \
         patch("boto3.client", return_value=mock_ses):
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium", "submitter_name": "Tester", "submitter_id": "u-1",
            "time_on_form": 10.0,
        })
    assert res.status_code == 200
    body = mock_ses.send_email.call_args[1]["Message"]["Body"]["Text"]["Data"]
    assert "Submitter email:" not in body


def test_ses_not_called_when_github_fails(monkeypatch):
    """SES must not be called if GitHub issue creation fails."""
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    monkeypatch.setenv("SES_SENDER_EMAIL", "jfisher@fisherconsulting.org")
    import io, urllib.error
    mock_fp = io.BytesIO(b'{"message": "Internal Server Error"}')
    mock_ses = MagicMock()
    with patch("urllib.request.urlopen", side_effect=urllib.error.HTTPError(
        url=None, code=500, msg="Server Error", hdrs=None, fp=mock_fp
    )), patch("boto3.client", return_value=mock_ses):
        res = client.post("/create-issue", json={
            "issue_type": "bug", "title": "t", "body": "b",
            "priority": "medium", "submitter_name": "Tester",
            "submitter_email": "user@example.com", "submitter_id": "u-1", "time_on_form": 10.0,
        })
    assert res.status_code == 502
    mock_ses.send_email.assert_not_called()
