#!/usr/bin/env python3
"""Regenerate the PitchFlap app icon from Palette.swift colours.

    pip install Pillow
    python3 studio/art/make_app_icon.py

Writes PitchFlap/Assets.xcassets/AppIcon.appiconset/AppIcon.png (1024x1024,
RGB, no alpha). Rendered at 4x and downsampled with Lanczos.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "PitchFlap/Assets.xcassets/AppIcon.appiconset/AppIcon.png"

S, F = 1024, 4
W = S * F

def c(r, g, b):  # Palette.swift fractions -> 8-bit
    return (int(r * 255), int(g * 255), int(b * 255))

SKY_TOP, SKY_BOTTOM = c(0.13, 0.42, 0.72), c(0.44, 0.76, 0.93)
GRASS, GRASS_DARK = c(0.20, 0.56, 0.29), c(0.16, 0.47, 0.24)
POST, POST_SHADE, TRIM = c(0.96, 0.97, 0.99), c(0.78, 0.82, 0.88), c(0.90, 0.24, 0.29)
INK, WHITE = c(0.07, 0.10, 0.16), (255, 255, 255)

img = Image.new("RGB", (W, W))
d = ImageDraw.Draw(img)

horizon = int(W * 0.72)
for y in range(horizon):
    t = y / horizon
    d.line([(0, y), (W, y)], fill=tuple(int(SKY_TOP[i] * (1 - t) + SKY_BOTTOM[i] * t) for i in range(3)))
d.rectangle([0, horizon, W, W], fill=GRASS)
for i in range(0, 6, 2):
    d.rectangle([i * W // 6, horizon, (i + 1) * W // 6, W], fill=GRASS_DARK)
d.rectangle([0, horizon + int(0.012 * W), W, horizon + int(0.02 * W)], fill=WHITE)

pw = int(W * 0.13); gap_top, gap_bot = int(W * 0.36), int(W * 0.60); x0 = int(W * 0.60)
for y0, y1 in ((0, gap_top), (gap_bot, horizon)):
    d.rectangle([x0, y0, x0 + pw, y1], fill=POST)
    d.rectangle([x0 + int(pw * 0.62), y0, x0 + pw, y1], fill=POST_SHADE)
cap_h, cap_over = int(W * 0.035), int(pw * 0.12)
d.rectangle([x0 - cap_over, gap_top - cap_h, x0 + pw + cap_over, gap_top], fill=TRIM)
d.rectangle([x0 - cap_over, gap_bot, x0 + pw + cap_over, gap_bot + cap_h], fill=TRIM)

cx, cy, r = int(W * 0.36), int(W * 0.47), int(W * 0.17)
shadow = Image.new("RGB", (W, W), (0, 0, 0))
ImageDraw.Draw(shadow).ellipse([cx - r, cy - r + int(r * 0.18), cx + r, cy + r + int(r * 0.18)], fill=(60, 60, 60))
shadow = shadow.filter(ImageFilter.GaussianBlur(r * 0.18))
img = Image.composite(Image.new("RGB", (W, W), (0, 0, 0)), img,
                      shadow.convert("L").point(lambda v: min(255, int(v * 0.35))))
d = ImageDraw.Draw(img)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE, outline=INK, width=int(r * 0.07))
d.polygon([(cx + math.cos(math.pi / 2 + i * 2 * math.pi / 5) * r * 0.42,
            cy + math.sin(math.pi / 2 + i * 2 * math.pi / 5) * r * 0.42) for i in range(5)], fill=INK)
for i in range(5):
    a = i * 2 * math.pi / 5 - math.pi / 2
    dx, dy = cx + math.cos(a) * r * 0.75, cy + math.sin(a) * r * 0.75
    d.ellipse([dx - r * 0.17, dy - r * 0.17, dx + r * 0.17, dy + r * 0.17], fill=INK)
for off, ln, th in ((0.05, 0.28, 0.035), (0.0, 0.22, 0.03), (-0.06, 0.18, 0.028)):
    yy = cy + int(r * off * 4)
    d.rounded_rectangle([cx - r - int(W * ln), yy - int(W * th / 2), cx - r - int(W * 0.04), yy + int(W * th / 2)],
                        radius=int(W * th / 2), fill=WHITE)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.resize((S, S), Image.LANCZOS).save(OUT, "PNG", optimize=True)
print("wrote", OUT.relative_to(ROOT))
