"""Generate PWA icons from the AforAudience brand palette.

Icons are drawn programmatically (not from the SVG) so we control
each size exactly — no scaling artifacts. Design is a stylised "A"
formed by three horizontal bars in the brand palette on a dark
background, matching src/app/icon.svg.

Palette (from manifest.ts and design doc):
  bg   = #0E0C0A   (near-black)
  bar1 = #C8441A   (saffron/vermillion — theme_color)
  bar2 = #C9973A   (amber)
  bar3 = #F7F3EE   (off-white — background_color)

Generated:
  public/icon-192x192.png       (any-purpose, primary Android)
  public/icon-512x512.png       (any-purpose, Play Store / TWA)
  public/icon-maskable-192.png  (maskable, safe-zone padded)
  public/icon-maskable-512.png  (maskable, safe-zone padded)
  public/apple-touch-icon.png   (180x180, iOS home-screen)
  public/favicon-32x32.png      (browser tab)
  public/favicon-16x16.png      (browser tab)
"""
from PIL import Image, ImageDraw
import os

BG   = "#0E0C0A"
BAR1 = "#C8441A"
BAR2 = "#C9973A"
BAR3 = "#F7F3EE"

def draw_icon(size, maskable=False):
    """Draw the A icon at the given size.

    For maskable icons, PWA specification reserves an outer safe-zone
    of ~10% on each side — the visible logo must fit inside the inner
    80% because Android may crop to circle/squircle/etc. We accomplish
    that by drawing the whole logo at 80% scale, centered, on a solid
    background that fills the full canvas.
    """
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    if maskable:
        # Reserve 10% safe-zone on each side; logo lives in inner 80%.
        inset = int(size * 0.10)
    else:
        # Non-maskable: match the SVG's 64-unit viewbox with 16-unit
        # corner-radius equivalent inset. Roughly 5%.
        inset = int(size * 0.05)

    inner = size - 2 * inset

    # The SVG has bars at y=18-26, 30-38, 42-50 in a 64-unit box.
    # Widths: 28, 20, 14 (going down). x-start = 18.
    # Rescale to the inner size.
    unit = inner / 64.0
    x0 = inset + 18 * unit

    # Bar 1: y 18-26, w 28
    y = inset + 18 * unit
    draw.rectangle([x0, y, x0 + 28 * unit, y + 8 * unit], fill=BAR1)
    # Bar 2: y 30-38, w 20
    y = inset + 30 * unit
    draw.rectangle([x0, y, x0 + 20 * unit, y + 8 * unit], fill=BAR2)
    # Bar 3: y 42-50, w 14
    y = inset + 42 * unit
    draw.rectangle([x0, y, x0 + 14 * unit, y + 8 * unit], fill=BAR3)

    return img

out_dir = "public"

# Regular (any-purpose) icons — used by Chrome / Firefox / Safari
for size in (16, 32, 192, 512):
    img = draw_icon(size, maskable=False)
    name = {
        16: "favicon-16x16.png",
        32: "favicon-32x32.png",
        192: "icon-192x192.png",
        512: "icon-512x512.png",
    }[size]
    img.save(f"{out_dir}/{name}", "PNG", optimize=True)
    print(f"  wrote {out_dir}/{name}")

# Apple touch icon — 180x180 is the iOS convention
img = draw_icon(180, maskable=False)
img.save(f"{out_dir}/apple-touch-icon.png", "PNG", optimize=True)
print(f"  wrote {out_dir}/apple-touch-icon.png")

# Maskable icons for Android adaptive icons / Play Store
for size in (192, 512):
    img = draw_icon(size, maskable=True)
    name = f"icon-maskable-{size}.png"
    img.save(f"{out_dir}/{name}", "PNG", optimize=True)
    print(f"  wrote {out_dir}/{name}")
