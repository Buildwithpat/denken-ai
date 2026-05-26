"""
Deterministic test-image generator.

Uses Pillow to create in-memory PNG / JPEG / WEBP images containing
known text so that OCR ingestion tests have predictable inputs.
No external fonts required — falls back to PIL's built-in bitmap font.
"""
from __future__ import annotations

import io
from typing import Literal

Format = Literal["PNG", "JPEG", "WEBP"]


def _pil_image(
    text: str,
    width: int = 900,
    height: int = 300,
    font_size: int = 24,
    bg: str = "white",
    fg: str = "black",
):
    """Create a PIL Image with `text` rendered on a plain background."""
    from PIL import Image, ImageDraw, ImageFont  # noqa: PLC0415

    img = Image.new("RGB", (width, height), color=bg)
    draw = ImageDraw.Draw(img)

    # Try to load a truetype font; fall back to the built-in bitmap font
    font = None
    for candidate in (
        "arial.ttf", "Arial.ttf",
        "DejaVuSans.ttf", "LiberationSans-Regular.ttf",
        "FreeSans.ttf",
    ):
        try:
            font = ImageFont.truetype(candidate, size=font_size)
            break
        except (IOError, OSError):
            continue

    if font is None:
        try:
            font = ImageFont.load_default(size=font_size)
        except TypeError:
            font = ImageFont.load_default()

    # Word-wrap so text fits within `width`
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test_line = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] > width - 20:
            if current:
                lines.append(current)
            current = word
        else:
            current = test_line
    if current:
        lines.append(current)

    y = 20
    line_height = font_size + 6
    for line in lines:
        draw.text((10, y), line, fill=fg, font=font)
        y += line_height

    return img


def make_text_image(text: str, fmt: Format = "PNG") -> bytes:
    """
    Return an image encoded as `fmt` bytes containing `text`.
    Suitable for OCR ingestion tests where text content should be extracted.
    """
    img = _pil_image(text, width=900, height=300, font_size=26)
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.save(buf, format="JPEG", quality=95)
    elif fmt == "WEBP":
        img.save(buf, format="WEBP", quality=90)
    else:
        img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


def make_diagram_image(fmt: Format = "PNG") -> bytes:
    """
    Return an image with very little text — simulates a diagram/figure scan.
    Expected to trigger `is_diagram_heavy = True` in the OCR pipeline.
    """
    from PIL import Image, ImageDraw  # noqa: PLC0415

    img = Image.new("RGB", (600, 400), color="white")
    draw = ImageDraw.Draw(img)

    # Draw a simple box diagram (lines/shapes) — mostly visual, minimal text
    draw.rectangle([50, 50, 250, 200], outline="black", width=2)
    draw.rectangle([350, 50, 550, 200], outline="black", width=2)
    draw.line([250, 125, 350, 125], fill="black", width=2)
    draw.polygon([(340, 118), (350, 125), (340, 132)], fill="black")  # arrowhead
    # Very few words — forces is_diagram_heavy = True (< 15 words threshold)
    draw.text((90, 215), "Fig. 1", fill="black")

    buf = io.BytesIO()
    if fmt == "JPEG":
        img.save(buf, format="JPEG", quality=90)
    elif fmt == "WEBP":
        img.save(buf, format="WEBP", quality=85)
    else:
        img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


def make_question_screenshot(question: str, fmt: Format = "PNG") -> bytes:
    """
    Produce an image that looks like a student's question screenshot.
    Includes a question number prefix so the layout matches real exam scans.
    """
    full = f"Q1.  {question}"
    return make_text_image(full, fmt=fmt)


# ---------------------------------------------------------------------------
# Named test fixtures (deterministic content)
# ---------------------------------------------------------------------------

NEWTON_LAW_TEXT = (
    "Newton's Second Law states that force equals mass times acceleration: F = ma. "
    "The net force on an object determines its acceleration in the direction of the force."
)

KINETIC_ENERGY_TEXT = (
    "The kinetic energy of a body is KE = half mv squared. "
    "This energy increases with the square of the velocity of the moving object."
)

QUESTION_TEXT = (
    "A body of mass 5 kg is acted upon by a net force of 20 N. "
    "Calculate the acceleration of the body using Newton's Second Law."
)

# Map fixture name → (text, format)
IMAGE_FIXTURES: dict[str, tuple[str, Format]] = {
    "newton_png":       (NEWTON_LAW_TEXT,      "PNG"),
    "kinetic_jpg":      (KINETIC_ENERGY_TEXT,  "JPEG"),
    "question_webp":    (QUESTION_TEXT,        "WEBP"),
}
