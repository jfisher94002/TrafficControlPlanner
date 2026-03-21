import copy
import pytest


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


@pytest.fixture
def sample_plan() -> dict:
    """Deterministic sample plan payload used in tests."""
    # Return a deep copy so tests can mutate the plan without side effects.
    return copy.deepcopy(SAMPLE_PLAN_PAYLOAD)


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
