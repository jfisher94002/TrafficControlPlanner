import base64
import io

import pytest
from PIL import Image

from models import ExportRequest, SignData
from pdf_generator import build_pdf, _sign_counts
from sign_renderer import draw_sign_icon


# ─── PDF GENERATOR ────────────────────────────────────────────────────────────

def test_build_pdf_returns_pdf_bytes(sample_plan):
    request = ExportRequest(**sample_plan)
    pdf = build_pdf(request)
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 1000


def test_build_pdf_with_canvas_image(sample_plan):
    img = Image.new("RGB", (100, 80), color=(200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    plan = dict(sample_plan)
    plan["canvas_image_b64"] = b64
    request = ExportRequest(**plan)
    pdf = build_pdf(request)
    assert pdf[:4] == b"%PDF"


def test_legend_deduplication(sample_plan):
    request = ExportRequest(**sample_plan)
    counts = _sign_counts(request)
    ids = [s.id for s, _ in counts]
    assert len(ids) == len(set(ids)), "Duplicate sign IDs in legend"


def test_legend_empty_when_no_signs(plan_no_signs):
    request = ExportRequest(**plan_no_signs)
    counts = _sign_counts(request)
    assert counts == []
    pdf = build_pdf(request)
    assert pdf[:4] == b"%PDF"


# ─── SIGN RENDERER ────────────────────────────────────────────────────────────

SHAPES = ["octagon", "diamond", "triangle", "circle", "shield", "rect"]

@pytest.mark.parametrize("shape", SHAPES)
def test_sign_icon_all_shapes(shape):
    sign = SignData(
        id=f"test_{shape}",
        label="TEST",
        shape=shape,
        color="#ef4444",
        textColor="#ffffff",
    )
    drawing = draw_sign_icon(sign)
    assert drawing is not None
    assert len(drawing.contents) >= 2  # shape + label
