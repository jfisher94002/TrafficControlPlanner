"""Tests for generate_signs.py SVG generation."""
import xml.etree.ElementTree as ET

import pytest

from generate_signs import ALL_SIGNS, make_svg


def _parse(svg: str) -> ET.Element:
    """Strip XML declaration and parse."""
    body = svg.split("\n", 1)[1] if svg.startswith("<?xml") else svg
    return ET.fromstring(body)


@pytest.mark.parametrize("shape", ["octagon", "diamond", "triangle", "circle", "shield", "rect"])
def test_make_svg_valid_xml_per_shape(shape: str) -> None:
    svg = make_svg("test", "TEST", shape, "#ef4444", "#fff", None)
    root = _parse(svg)
    assert root.tag == "{http://www.w3.org/2000/svg}svg"


def test_make_svg_all_signs_valid_xml() -> None:
    for sign_id, label, shape, fill, text_color, border in ALL_SIGNS:
        svg = make_svg(sign_id, label, shape, fill, text_color, border)
        _parse(svg)  # raises if malformed


def test_make_svg_viewbox() -> None:
    svg = make_svg("stop", "STOP", "octagon", "#ef4444", "#fff", None)
    root = _parse(svg)
    assert root.get("viewBox") == "0 0 100 100"


def test_make_svg_contains_label() -> None:
    svg = make_svg("stop", "STOP", "octagon", "#ef4444", "#fff", None)
    assert "STOP" in svg


def test_make_svg_diamond_uses_dark_stroke() -> None:
    svg = make_svg("merge", "MERGE", "diamond", "#f97316", "#111", None)
    assert "#111" in svg


def test_all_signs_have_unique_ids() -> None:
    ids = [s[0] for s in ALL_SIGNS]
    assert len(ids) == len(set(ids)), "Duplicate sign IDs found"
