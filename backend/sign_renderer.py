"""
Port of drawSign() from traffic-control-planner.tsx to ReportLab.
Returns a Drawing object suitable for embedding in a PDF.
"""
import math
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import (
    Circle,
    Drawing,
    Polygon,
    Rect,
    String,
)
from reportlab.lib.colors import HexColor, white, black

from models import SignData


def _hex(color: str) -> HexColor:
    return HexColor(color)


def _octagon_points(cx: float, cy: float, s: float) -> list[float]:
    pts = []
    for i in range(8):
        a = math.pi / 8 + i * math.pi / 4
        pts.extend([cx + math.cos(a) * s, cy + math.sin(a) * s])
    return pts


def draw_sign_icon(sign_data: SignData, size: float = 28) -> Drawing:
    """Return a 64×64 pt Drawing containing the sign icon centered at (32, 32)."""
    dim = 64.0
    cx, cy = dim / 2, dim / 2
    s = size * 0.9  # slight inset so stroke doesn't clip edge

    d = Drawing(dim, dim)

    fill = _hex(sign_data.color)
    text_color = _hex(sign_data.textColor)
    stroke = white

    shape = sign_data.shape

    if shape == "octagon":
        pts = _octagon_points(cx, cy, s)
        p = Polygon(pts, fillColor=fill, strokeColor=stroke, strokeWidth=2)
        d.add(p)

    elif shape == "diamond":
        pts = [cx, cy - s, cx + s, cy, cx, cy + s, cx - s, cy]
        p = Polygon(pts, fillColor=fill, strokeColor=black, strokeWidth=2)
        d.add(p)

    elif shape == "triangle":
        pts = [cx, cy - s, cx + s, cy + s * 0.7, cx - s, cy + s * 0.7]
        p = Polygon(pts, fillColor=fill, strokeColor=stroke, strokeWidth=2)
        d.add(p)

    elif shape == "circle":
        c = Circle(cx, cy, s, fillColor=fill, strokeColor=stroke, strokeWidth=2)
        d.add(c)

    elif shape == "shield":
        pts = [
            cx - s * 0.7, cy - s,
            cx + s * 0.7, cy - s,
            cx + s * 0.8, cy - s * 0.3,
            cx,           cy + s,
            cx - s * 0.8, cy - s * 0.3,
        ]
        p = Polygon(pts, fillColor=fill, strokeColor=stroke, strokeWidth=2)
        d.add(p)

    else:  # rect (default)
        border = _hex(sign_data.border) if sign_data.border else black
        r = Rect(
            cx - s, cy - s * 0.65, s * 2, s * 1.3,
            fillColor=fill, strokeColor=border, strokeWidth=2,
        )
        d.add(r)

    label = sign_data.label
    if len(label) > 8:
        label = label[:7] + "\u2026"

    label_y = cy + s * 0.04 if shape == "triangle" else cy
    txt = String(
        cx, label_y, label,
        fontName="Helvetica-Bold",
        fontSize=max(9, size * 0.38),
        fillColor=text_color,
        textAnchor="middle",
    )
    d.add(txt)

    return d


def render_sign_to_canvas(pdf_canvas, sign_data: SignData, x: float, y: float, size: float = 28) -> None:
    """Draw a sign icon onto a ReportLab canvas at (x, y) lower-left corner."""
    drawing = draw_sign_icon(sign_data, size)
    renderPDF.draw(drawing, pdf_canvas, x, y)
