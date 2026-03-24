"""Unit tests for sanitize.sanitize_text."""
from sanitize import sanitize_text


def test_strips_script_tags():
    assert "<script>" not in sanitize_text("<script>alert(1)</script>Hello")
    assert "Hello" in sanitize_text("<script>alert(1)</script>Hello")


def test_strips_generic_html_tags():
    assert sanitize_text("<b>bold</b>") == "bold"
    assert sanitize_text("<a href='x'>link</a>") == "link"


def test_strips_self_closing_tags():
    assert "<br" not in sanitize_text("line<br/>break")


def test_strips_long_tags():
    # Tags longer than 200 chars must also be stripped (no length cap)
    long_attr = "x" * 300
    assert "<" not in sanitize_text(f"<div {long_attr}>text</div>")


def test_strips_null_byte():
    assert "\x00" not in sanitize_text("hello\x00world")
    assert "helloworld" == sanitize_text("hello\x00world")


def test_strips_control_characters():
    for char in ("\x01", "\x08", "\x0b", "\x0c", "\x1f", "\x7f"):
        assert char not in sanitize_text(f"pre{char}post")


def test_preserves_tab_newline_carriage_return():
    value = "line1\nline2\ttabbed\r\n"
    result = sanitize_text(value)
    assert "\n" in result
    assert "\t" in result
    assert "\r" in result


def test_noop_on_clean_string():
    clean = "Normal plan name 123-_"
    assert sanitize_text(clean) == clean


def test_noop_on_empty_string():
    assert sanitize_text("") == ""


def test_preserves_angle_brackets_without_closing():
    # "1 < 5" has no closing ">", so it's not a tag and should survive
    assert "1 < 5" in sanitize_text("value: 1 < 5")


def test_idempotent():
    dirty = "<b>hello</b> & <script>evil</script>\x00"
    once = sanitize_text(dirty)
    twice = sanitize_text(once)
    assert once == twice


def test_very_long_input_with_tags():
    # Tens of thousands of chars including tags and control chars should not crash
    chunk = "<div>text\x00</div>" * 3000  # ~54 000 chars
    result = sanitize_text(chunk)
    assert "<" not in result
    assert "\x00" not in result
    assert "text" in result
