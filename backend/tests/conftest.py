import pytest


@pytest.fixture
def sample_plan() -> dict:
    """Minimal but valid ExportRequest payload for testing."""
    return {
        "id": "sample-plan-001",
        "name": "Jonathan's 1st Plan",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z",
        "userId": None,
        "mapCenter": {"lat": 37.7749, "lng": -122.4194, "zoom": 15},
        "canvasOffset": {"x": 0, "y": 0},
        "canvasZoom": 1,
        "canvasState": {
            "objects": [
                {
                    "id": "road-1",
                    "type": "road",
                    "x1": 100, "y1": 100, "x2": 400, "y2": 100,
                    "width": 40, "realWidth": 12, "lanes": 2, "roadType": "local",
                },
                {
                    "id": "sign-1",
                    "type": "sign",
                    "x": 200, "y": 150,
                    "signData": {
                        "id": "stop",
                        "label": "STOP",
                        "shape": "octagon",
                        "color": "#ef4444",
                        "textColor": "#ffffff",
                    },
                    "rotation": 0,
                    "scale": 1,
                },
                {
                    "id": "sign-2",
                    "type": "sign",
                    "x": 300, "y": 150,
                    "signData": {
                        "id": "stop",
                        "label": "STOP",
                        "shape": "octagon",
                        "color": "#ef4444",
                        "textColor": "#ffffff",
                    },
                    "rotation": 0,
                    "scale": 1,
                },
                {
                    "id": "sign-3",
                    "type": "sign",
                    "x": 250, "y": 200,
                    "signData": {
                        "id": "warning",
                        "label": "WARN",
                        "shape": "diamond",
                        "color": "#f59e0b",
                        "textColor": "#000000",
                    },
                    "rotation": 0,
                    "scale": 1,
                },
            ]
        },
        "metadata": {
            "projectNumber": "TCP-001",
            "client": "City of Example",
            "location": "Main St & 1st Ave",
            "notes": "Sample plan for testing",
        },
    }


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
