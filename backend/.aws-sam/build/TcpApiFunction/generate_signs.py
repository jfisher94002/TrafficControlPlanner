"""
Generate SVG files for all traffic control signs and optionally upload to S3.

Usage (from repo root):
    python backend/generate_signs.py              # write SVGs to backend/signs/
    python backend/generate_signs.py --upload     # write + upload to $ASSETS_BUCKET

Or from within backend/:
    python generate_signs.py              # write SVGs to signs/
    python generate_signs.py --upload     # write + upload to $ASSETS_BUCKET

Geometry: viewBox 0 0 100 100, center (50,50), radius s=40.
Math mirrors drawSign() in traffic-control-planner.tsx and sign_renderer.py.
"""
import argparse
import math
import os
import sys
from pathlib import Path

# ─── SIGN DATA ────────────────────────────────────────────────────────────────
# Each entry: (id, label, shape, fill_color, text_color, border_or_None)
# shape: octagon | diamond | triangle | circle | shield | rect

_SPEED_SIGNS = [
    (f"speed{mph}", f"{mph} MPH", "rect", "#fff", "#111", "#111")
    for mph in (15, 20, 25, 30, 35, 40, 45, 50, 55, 65)
]

ALL_SIGNS = [
    # ── Regulatory ──────────────────────────────────────────────────────────
    ("stop",         "STOP",         "octagon",  "#ef4444", "#fff",  None),
    ("yield",        "YIELD",        "triangle", "#ef4444", "#fff",  None),
    *_SPEED_SIGNS,
    ("noentry",      "NO ENTRY",     "circle",   "#ef4444", "#fff",  None),
    ("oneway",       "ONE WAY",      "rect",     "#111",    "#fff",  None),
    ("donotenter",   "DO NOT ENTER", "rect",     "#ef4444", "#fff",  None),
    ("noleftturn",   "NO LEFT TRN",  "circle",   "#ef4444", "#fff",  None),
    ("norightturn",  "NO RIGHT TRN", "circle",   "#ef4444", "#fff",  None),
    ("noparking",    "NO PARKING",   "circle",   "#ef4444", "#fff",  None),
    ("nopassing",    "NO PASSING",   "rect",     "#fff",    "#111",  "#111"),
    ("wrongway",     "WRONG WAY",    "rect",     "#ef4444", "#fff",  None),
    # ── Warning ─────────────────────────────────────────────────────────────
    ("roadwork",       "ROAD WORK",    "diamond",  "#f97316", "#111",  None),
    ("flagahead",      "FLAGGER",      "diamond",  "#f97316", "#111",  None),
    ("merge",          "MERGE",        "diamond",  "#f97316", "#111",  None),
    ("curve",          "CURVE",        "diamond",  "#f97316", "#111",  None),
    ("narrow",         "NARROW",       "diamond",  "#f97316", "#111",  None),
    ("bump",           "BUMP",         "diamond",  "#f97316", "#111",  None),
    ("pedestrian",     "PED XING",     "diamond",  "#f97316", "#111",  None),
    ("signal",         "SIGNAL AHEAD", "diamond",  "#f97316", "#111",  None),
    ("schoolzone",     "SCHOOL ZONE",  "diamond",  "#f97316", "#111",  None),
    ("schoolxing",     "SCHOOL XING",  "diamond",  "#f97316", "#111",  None),
    ("bikexing",       "BIKE XING",    "diamond",  "#f97316", "#111",  None),
    ("deerxing",       "DEER XING",    "diamond",  "#f97316", "#111",  None),
    ("slippery",       "SLIPPERY",     "diamond",  "#f97316", "#111",  None),
    ("loosegravel",    "LOOSE GRAVEL", "diamond",  "#f97316", "#111",  None),
    ("dividedroad",    "DIVIDED RD",   "diamond",  "#f97316", "#111",  None),
    ("endsdivided",    "ENDS DIVIDED", "diamond",  "#f97316", "#111",  None),
    ("lowclearance",   "LOW CLEAR",    "diamond",  "#f97316", "#111",  None),
    ("rightcurve",     "RIGHT CURVE",  "diamond",  "#f97316", "#111",  None),
    ("leftcurve",      "LEFT CURVE",   "diamond",  "#f97316", "#111",  None),
    ("winding",        "WINDING RD",   "diamond",  "#f97316", "#111",  None),
    ("hillgrade",      "HILL/GRADE",   "diamond",  "#f97316", "#111",  None),
    ("workers",        "WORKERS",      "diamond",  "#f97316", "#111",  None),
    # ── Temporary / Work Zone ───────────────────────────────────────────────
    ("roadclosed",   "ROAD CLOSED",   "rect",     "#f97316", "#111",  None),
    ("detour",       "DETOUR",        "rect",     "#f97316", "#111",  None),
    ("laneclosed",   "LANE CLOSED",   "rect",     "#f97316", "#111",  None),
    ("endwork",      "END ROAD WORK", "rect",     "#f97316", "#111",  None),
    ("slowtraffic",  "SLOW TRAFFIC",  "rect",     "#f97316", "#111",  None),
    ("workzone",     "WORK ZONE",     "rect",     "#f97316", "#111",  None),
    ("workahead",    "WORK AHEAD",    "diamond",  "#f97316", "#111",  None),
    ("preparestop",  "PREP TO STOP",  "rect",     "#f97316", "#111",  None),
    ("onelane",      "ONE LANE RD",   "rect",     "#f97316", "#111",  None),
    ("surveyors",    "SURVEYORS",     "diamond",  "#f97316", "#111",  None),
    ("rightlane",    "RIGHT LANE",    "rect",     "#f97316", "#111",  None),
    ("leftlane",     "LEFT LANE",     "rect",     "#f97316", "#111",  None),
    ("centerlane",   "CENTER LANE",   "rect",     "#f97316", "#111",  None),
    ("flaggerahead", "FLAGGER AHD",   "diamond",  "#f97316", "#111",  None),
    ("reducespeed",  "REDUCE SPEED",  "rect",     "#f97316", "#111",  None),
    ("endworkahead", "END WORK AHD",  "rect",     "#f97316", "#111",  None),
    # ── Guide & Info ────────────────────────────────────────────────────────
    ("parking",       "P",            "rect",     "#3b82f6", "#fff",  None),
    ("hospital",      "H",            "rect",     "#3b82f6", "#fff",  None),
    ("info",          "INFO",         "rect",     "#3b82f6", "#fff",  None),
    ("interstate",    "I-95",         "shield",   "#3b82f6", "#fff",  None),
    ("exitramp",      "EXIT",         "rect",     "#22c55e", "#fff",  None),
    ("speedadvisory", "ADVISORY",     "rect",     "#f59e0b", "#111",  None),
    ("distanceahead", "1 MILE",       "rect",     "#22c55e", "#fff",  None),
    ("noparkingnorth","NO PARKING",   "rect",     "#fff",    "#111",  "#111"),
    ("restarea",      "REST AREA",    "rect",     "#3b82f6", "#fff",  None),
    ("foodgas",       "FOOD/GAS",     "rect",     "#3b82f6", "#fff",  None),
    # ── School Zone ─────────────────────────────────────────────────────────
    ("school",        "SCHOOL",       "rect",     "#f59e0b", "#111",  None),
    ("schoolspeed",   "15 SCHOOL",    "rect",     "#f59e0b", "#111",  None),
    ("slowschool",    "SLOW SCHOOL",  "rect",     "#f59e0b", "#111",  None),
    ("schoolbus",     "SCHOOL BUS",   "rect",     "#f59e0b", "#111",  None),
    ("schoolbusxing", "BUS XING",     "diamond",  "#f59e0b", "#111",  None),
    ("crosswalk",     "CROSSWALK",    "rect",     "#f59e0b", "#111",  None),
    ("pedxing",       "PED XING",     "diamond",  "#f59e0b", "#111",  None),
    # ── Bicycle & Pedestrian ────────────────────────────────────────────────
    ("bikeroute",    "BIKE ROUTE",    "rect",     "#22c55e", "#fff",  None),
    ("bikexingped",  "BIKE XING",     "diamond",  "#22c55e", "#111",  None),
    ("pedxingbike",  "PED XING",      "diamond",  "#22c55e", "#111",  None),
    ("sharedpath",   "SHARED PATH",   "rect",     "#22c55e", "#fff",  None),
    ("hikerbiker",   "HIKE/BIKE",     "rect",     "#22c55e", "#fff",  None),
    ("bikepath",     "BIKE PATH",     "rect",     "#22c55e", "#fff",  None),
]


# ─── SVG GENERATOR ───────────────────────────────────────────────────────────

def _text_size(label: str) -> int:
    n = len(label)
    if n <= 4:
        return 18
    if n <= 7:
        return 13
    if n <= 11:
        return 10
    return 8


def _octagon_points(cx: float, cy: float, s: float) -> str:
    pts = []
    for i in range(8):
        a = math.pi / 8 + i * math.pi / 4
        pts.append(f"{cx + math.cos(a) * s:.2f},{cy + math.sin(a) * s:.2f}")
    return " ".join(pts)


def make_svg(sign_id: str, label: str, shape: str, fill: str, text_color: str, border: str | None) -> str:
    cx, cy, s = 50.0, 50.0, 40.0
    # Match drawSign() stroke logic: diamonds use dark stroke, others use white (or border color)
    if shape == "diamond":
        stroke = "#111"
    elif border:
        stroke = border
    else:
        stroke = "#fff" if fill not in ("#fff", "#ffffff") else "#333"
    stroke_w = 2.5

    if shape == "octagon":
        pts = _octagon_points(cx, cy, s)
        body = f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'

    elif shape == "diamond":
        pts = f"{cx},{cy-s} {cx+s},{cy} {cx},{cy+s} {cx-s},{cy}"
        body = f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'

    elif shape == "triangle":
        pts = f"{cx},{cy-s} {cx+s},{cy+s*0.7:.2f} {cx-s},{cy+s*0.7:.2f}"
        body = f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'

    elif shape == "circle":
        body = f'<circle cx="{cx}" cy="{cy}" r="{s}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'

    elif shape == "shield":
        pts = (
            f"{cx-s*0.7:.2f},{cy-s:.2f} "
            f"{cx+s*0.7:.2f},{cy-s:.2f} "
            f"{cx+s*0.8:.2f},{cy-s*0.3:.2f} "
            f"{cx},{cy+s:.2f} "
            f"{cx-s*0.8:.2f},{cy-s*0.3:.2f}"
        )
        body = f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'

    else:  # rect
        x = cx - s
        y = cy - s * 0.65
        w = s * 2
        h = s * 1.3
        body = f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'

    # Text position: triangle has slight downward offset
    text_y = cy + 4 if shape == "triangle" else cy
    font_size = _text_size(label)

    text = (
        f'<text x="{cx}" y="{text_y}" '
        f'dominant-baseline="middle" text-anchor="middle" '
        f'font-family="Arial, Helvetica, sans-serif" font-weight="bold" '
        f'font-size="{font_size}" fill="{text_color}">'
        f'{label}</text>'
    )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
        f'width="100" height="100" role="img" aria-label="{label}">\n'
        f'  {body}\n'
        f'  {text}\n'
        '</svg>\n'
    )


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate sign SVGs and optionally upload to S3")
    parser.add_argument("--upload", action="store_true", help="Upload SVGs to $ASSETS_BUCKET S3 bucket")
    args = parser.parse_args()

    out_dir = Path(__file__).parent / "signs"
    out_dir.mkdir(exist_ok=True)

    print(f"Generating {len(ALL_SIGNS)} SVGs → {out_dir}")
    for sign_id, label, shape, fill, text_color, border in ALL_SIGNS:
        svg = make_svg(sign_id, label, shape, fill, text_color, border)
        path = out_dir / f"{sign_id}.svg"
        path.write_text(svg, encoding="utf-8")

    print(f"Done. {len(ALL_SIGNS)} SVG files written.")

    if not args.upload:
        return

    bucket = os.environ.get("ASSETS_BUCKET")
    if not bucket:
        print("ERROR: $ASSETS_BUCKET is not set. Set it and re-run with --upload.", file=sys.stderr)
        sys.exit(1)

    try:
        import boto3
    except ImportError:
        print("ERROR: boto3 not installed. Run: pip install boto3", file=sys.stderr)
        sys.exit(1)

    s3 = boto3.client("s3")
    print(f"Uploading {len(ALL_SIGNS)} SVGs to s3://{bucket}/signs/")
    failed = []
    for sign_id, *_ in ALL_SIGNS:
        key = f"signs/{sign_id}.svg"
        try:
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=(out_dir / f"{sign_id}.svg").read_bytes(),
                ContentType="image/svg+xml",
                CacheControl="public, max-age=31536000",
            )
        except Exception as exc:
            print(f"ERROR: failed to upload {key}: {exc}", file=sys.stderr)
            failed.append(key)
    if failed:
        print(f"{len(failed)} upload(s) failed — see errors above.", file=sys.stderr)
        sys.exit(1)
    print("Upload complete.")


if __name__ == "__main__":
    main()
