import json
import pathlib
import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SAMPLE_PLAN_PATH = REPO_ROOT / "Jonathan_s_1st_plan.tcp.json"


@pytest.fixture
def sample_plan() -> dict:
    """Real plan payload from the repo root."""
    with open(SAMPLE_PLAN_PATH) as f:
        return json.load(f)


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
