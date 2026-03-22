"""
Text sanitization utilities for user-supplied strings embedded in PDF output.

Strips HTML tags and control characters that could corrupt PDF layout or
cause unexpected behavior in ReportLab. Does NOT attempt XSS prevention
(irrelevant for server-side PDF generation) — focus is on output integrity.
"""
import re

# Control characters except tab (\x09), newline (\x0a), carriage return (\x0d)
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# HTML/XML tags — linear-time pattern; upstream max_length limits bound runtime.
# These fields are PDF metadata (names, locations) where angle-brackets have no
# legitimate use, so stripping any <...> sequence is intentional.
_HTML_TAGS = re.compile(r"<[^>]*>")


def sanitize_text(value: str) -> str:
    """Strip control characters and HTML tags from a user-supplied string.

    Intended for structured fields (name, location, label) where angle brackets
    have no legitimate use.  Do NOT apply to free-form prose fields — use
    sanitize_notes() instead.
    """
    value = _CONTROL_CHARS.sub("", value)
    value = _HTML_TAGS.sub("", value)
    return value


def sanitize_notes(value: str) -> str:
    """Strip only control characters from free-form prose fields.

    Notes fields can legitimately contain angle brackets (e.g. 'flow < 500 vph'),
    so HTML-tag stripping is skipped.
    """
    return _CONTROL_CHARS.sub("", value)
