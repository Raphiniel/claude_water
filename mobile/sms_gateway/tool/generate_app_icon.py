"""Generate launcher icons matching the WaterWise admin sidebar brand mark (Layout.jsx)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Layout.jsx: outer #a3e635, inner / page bg #0d0d0d; outer 28px, inner dot 10px.
LIME = (163, 230, 53, 255)
DARK = (13, 13, 13, 255)
TRANSPARENT = (0, 0, 0, 0)


def draw_mark(cx: float, cy: float, outer_r: float, draw: ImageDraw.ImageDraw) -> None:
    inner_r = outer_r * (10 / 28)
    draw.ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], fill=LIME)
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=DARK)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    assets = root / "assets" / "images"
    assets.mkdir(parents=True, exist_ok=True)

    size = 1024
    cx = cy = size / 2
    outer_r = size * 0.35

    # Full-bleed icon (legacy mipmaps)
    full = Image.new("RGBA", (size, size), DARK)
    d = ImageDraw.Draw(full)
    draw_mark(cx, cy, outer_r, d)
    full.save(assets / "app_icon.png", "PNG")

    # Adaptive foreground: transparent outside the mark
    fg = Image.new("RGBA", (size, size), TRANSPARENT)
    d2 = ImageDraw.Draw(fg)
    draw_mark(cx, cy, outer_r, d2)
    fg.save(assets / "app_icon_foreground.png", "PNG")

    print(f"Wrote {assets / 'app_icon.png'}")
    print(f"Wrote {assets / 'app_icon_foreground.png'}")


if __name__ == "__main__":
    main()
