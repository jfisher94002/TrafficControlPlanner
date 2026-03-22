"""
Text sanitization utilities for user-supplied strings embedded in PDF output.

Strips HTML tags and control characters that could corrupt PDF layout or
cause unexpected behavior in ReportLab. Does NOT attempt XSS prevention
(irrelevant for server-side PDF generation) — focus is on output integrity.
"""
import re

# Control characters except tab (\x09), newline (\x0a), carriage return (\x0d)
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# HTML/XML tags — only match real tags/declarations, not arbitrary angle-bracketed
# text like "1 < 5" or "<123>". Bounded attributes prevent catastrophic backtracking.
_HTML_TAGS = re.compile(
    r"""
    (                               # HTML/XML tags:
        </?                         #   opening or closing tag
        [A-Za-z][A-Za-z0-9:_-]*    #   tag name must start with a letter
        (?:\s+[^<>]{0,180})?        #   optional attributes / whitespace
        \s*/?                       #   optional self-closing slash
        >                           #   end of tag
    )
    |
    (                               # Declarations / comments:
        <!                          #   e.g. <!DOCTYPE html>, <!-- comment -->
        [^>]{0,200}
        >
    )
    """,
    re.VERBOSE,
)


def sanitize_text(value: str) -> str:
    """Strip control characters and HTML tags from a user-supplied string."""
    value = _CONTROL_CHARS.sub("", value)
    value = _HTML_TAGS.sub("", value)
    return value
