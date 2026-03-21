"""
ReportLab PDF generator for Traffic Control Plans.

Layout (letter landscape, 11×8.5 in):
  ┌──────────────────────────────────────────┐
  │  Title block (1.2 in)                    │
  ├──────────────────────────────────────────┤
  │  Canvas image (fills remaining height    │
  │  minus legend)                           │
  ├──────────────────────────────────────────┤
  │  Sign legend (dynamic, ≤1.6 in)         │
  └──────────────────────────────────────────┘
"""
import base64
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Table, TableStyle
from reportlab.pdfgen import canvas as pdfgen_canvas

from models import ExportRequest, SignData, SignObject
from sign_renderer import render_sign_to_canvas

MARGIN = 0.5 * inch
PAGE_W, PAGE_H = landscape(letter)  # 792 × 612 pt
CONTENT_W = PAGE_W - 2 * MARGIN
TITLE_H = 1.2 * inch
LEGEND_MAX_H = 1.6 * inch
ICON_DIM = 48.0  # pt — matches Drawing size from sign_renderer


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _unique_signs(request: ExportRequest) -> list[SignData]:
    """Return de-duplicated SignData list ordered by first appearance."""
    seen: set[str] = set()
    result: list[SignData] = []
    for obj in request.canvasState.objects:
        if isinstance(obj, SignObject):
            if obj.signData.id not in seen:
                seen.add(obj.signData.id)
                result.append(obj.signData)
    return result


def _safe_name(text: str, max_len: int = 40) -> str:
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in text)[:max_len].strip()


def _format_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        return iso[:10]


# ─── TITLE BLOCK ──────────────────────────────────────────────────────────────

def _draw_title_block(c: pdfgen_canvas.Canvas, request: ExportRequest) -> None:
    meta = request.metadata
    date_str = _format_date(request.createdAt)
    plan_name = request.name or "Untitled Traffic Control Plan"

    col1 = CONTENT_W * 0.50
    col2 = CONTENT_W * 0.30
    col3 = CONTENT_W * 0.20

    data = [
        [
            f"PROJECT:  {plan_name}",
            f"NUMBER:  {meta.projectNumber or '—'}",
            f"DATE:  {date_str}",
        ],
        [
            f"CLIENT:    {meta.client or '—'}",
            f"LOCATION:  {meta.location or '—'}",
            "",
        ],
    ]

    table = Table(data, colWidths=[col1, col2, col3], rowHeights=[TITLE_H / 2, TITLE_H / 2])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (0, 0), 11),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f4f8")),
    ]))

    y_top = PAGE_H - MARGIN
    table.wrapOn(c, CONTENT_W, TITLE_H)
    table.drawOn(c, MARGIN, y_top - TITLE_H)


# ─── CANVAS IMAGE ─────────────────────────────────────────────────────────────

def _draw_canvas_image(
    c: pdfgen_canvas.Canvas,
    request: ExportRequest,
    image_area_y: float,
    image_area_h: float,
) -> None:
    x = MARGIN
    w = CONTENT_W

    if request.canvas_image_b64:
        try:
            img_bytes = base64.b64decode(request.canvas_image_b64)
            reader = ImageReader(io.BytesIO(img_bytes))
            iw, ih = reader.getSize()
            scale = min(w / iw, image_area_h / ih)
            draw_w = iw * scale
            draw_h = ih * scale
            draw_x = x + (w - draw_w) / 2
            draw_y = image_area_y + (image_area_h - draw_h) / 2
            c.drawImage(reader, draw_x, draw_y, draw_w, draw_h, preserveAspectRatio=True)
            return
        except Exception:
            pass  # fall through to placeholder

    # Placeholder
    c.setFillColor(colors.HexColor("#f5f5f5"))
    c.setStrokeColor(colors.HexColor("#cccccc"))
    c.rect(x, image_area_y, w, image_area_h, fill=1, stroke=1)
    c.setFillColor(colors.grey)
    c.setFont("Helvetica", 12)
    c.drawCentredString(x + w / 2, image_area_y + image_area_h / 2, "No canvas image provided")


# ─── SIGN LEGEND ──────────────────────────────────────────────────────────────

def _draw_legend(
    c: pdfgen_canvas.Canvas,
    unique_signs: list[SignData],
    legend_y: float,
    legend_h: float,
) -> None:
    if not unique_signs:
        return

    header_h = 16.0
    cell_w = 64.0
    cell_h = ICON_DIM + 16.0  # icon + label

    x = MARGIN
    y_header = legend_y + legend_h - header_h

    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.black)
    c.drawString(x, y_header, "SIGN LEGEND")

    y_icons = legend_y + (legend_h - header_h - cell_h) / 2

    for i, sign in enumerate(unique_signs):
        icon_x = x + i * cell_w
        if icon_x + cell_w > PAGE_W - MARGIN:
            break  # only one row for MVP; overflow handled gracefully

        render_sign_to_canvas(c, sign, icon_x, y_icons + 14, size=20)

        label = sign.label if len(sign.label) <= 8 else sign.label[:7] + "\u2026"
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.black)
        c.drawCentredString(icon_x + cell_w / 2, y_icons + 2, label)

    c.setStrokeColor(colors.HexColor("#cccccc"))
    c.line(MARGIN, legend_y + legend_h, PAGE_W - MARGIN, legend_y + legend_h)


# ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

def build_pdf(request: ExportRequest) -> bytes:
    buf = io.BytesIO()
    c = pdfgen_canvas.Canvas(buf, pagesize=landscape(letter))
    c.setTitle(request.name or "Traffic Control Plan")

    unique_signs = _unique_signs(request)
    legend_h = LEGEND_MAX_H if unique_signs else 0.0

    # Vertical zones (bottom-up in ReportLab coordinate system)
    legend_y = MARGIN
    image_area_y = legend_y + legend_h
    image_area_h = PAGE_H - MARGIN - TITLE_H - image_area_y

    _draw_title_block(c, request)
    _draw_canvas_image(c, request, image_area_y, image_area_h)
    if unique_signs:
        _draw_legend(c, unique_signs, legend_y, legend_h)

    c.save()
    return buf.getvalue()
