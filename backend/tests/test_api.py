import os
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
