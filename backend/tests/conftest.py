import copy
import pytest
import main


SAMPLE_PLAN_PAYLOAD: dict = {
    "id": "sample-plan-id",
    "name": "Sample Plan",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "mapCenter": {"lat": 37.77, "lng": -122.41, "zoom": 14},
    "canvasOffset": {"x": 0, "y": 0},
    "canvasZoom": 1,
    "canvasState": {
        "objects": [
            {
                "id": "sign-1",
                "type": "sign",
                "x": 100,
                "y": 200,
                "rotation": 0,
                "scale": 1,
                "signData": {
                    "id": "W20-1",
                    "label": "ROAD WORK",
                    "shape": "diamond",
                    "color": "#f59e0b",
                    "textColor": "#000000",
                },
            },
            {
                "id": "sign-2",
                "type": "sign",
                "x": 200,
                "y": 200,
                "rotation": 0,
                "scale": 1,
                "signData": {
                    "id": "R1-1",
                    "label": "STOP",
                    "shape": "octagon",
                    "color": "#ef4444",
                    "textColor": "#ffffff",
                },
            },
            # Duplicate of sign-1 to verify legend deduplication
            {
                "id": "sign-3",
                "type": "sign",
                "x": 300,
                "y": 200,
                "rotation": 0,
                "scale": 1,
                "signData": {
                    "id": "W20-1",
                    "label": "ROAD WORK",
                    "shape": "diamond",
                    "color": "#f59e0b",
                    "textColor": "#000000",
                },
            },
        ],
    },
    "metadata": {
        "projectNumber": "P-001",
        "client": "Test Client",
        "location": "Test Location",
        "notes": "",
    },
}


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear in-memory rate limit state between tests so tests don't interfere."""
    main._ip_submissions.clear()
    yield
    main._ip_submissions.clear()


@pytest.fixture
def sample_plan() -> dict:
    """Deterministic sample plan payload used in tests."""
    # Return a deep copy so tests can mutate the plan without side effects.
    return copy.deepcopy(SAMPLE_PLAN_PAYLOAD)


VALID_ISSUE_PAYLOAD: dict = {
    "issue_type": "bug",
    "title": "Test issue",
    "body": "Test body",
    "priority": "medium",
    "submitter_name": "Tester",
    "submitter_id": "user-123",
    "time_on_form": 10.0,  # satisfies the >= 3s check
}


@pytest.fixture
def valid_issue() -> dict:
    """Minimal valid /create-issue payload, deep-copied so tests can mutate it."""
    return copy.deepcopy(VALID_ISSUE_PAYLOAD)


@pytest.fixture
def plan_no_signs(sample_plan) -> dict:
    """Plan with all sign objects stripped out."""
    plan = dict(sample_plan)
    plan["canvasState"] = {
        "objects": [
            obj for obj in sample_plan["canvasState"]["objects"]
            if obj.get("type") != "sign"
        ]
    }
    return plan
