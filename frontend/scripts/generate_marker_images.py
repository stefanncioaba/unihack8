"""Draws the map pin images (place / event pins, selected pins, cluster bubbles) as PNGs (1x, 2x, 3x) and writes the TypeScript
index that requires them (src/features/map/markerImages.ts).

Why images: Android turns a custom marker *view* into a bitmap at some point after it mounts; pins came out blank, cut
off or late. A marker with an `image` is drawn from a finished bitmap at once, so nothing can be cut off or flicker.

Run from frontend/:  python scripts/generate_marker_images.py   (needs Pillow; icons come from the Ionicons font that
ships with @expo/vector-icons, so they match the rest of the app). Re-run after changing categories or colours.
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons"
ICON_FONT = FONT_DIR / "Fonts/Ionicons.ttf"
GLYPHS = json.loads((FONT_DIR / "glyphmaps/Ionicons.json").read_text(encoding="utf-8"))
DIGIT_FONT = "C:/Windows/Fonts/arialbd.ttf"
OUT = ROOT / "assets/markers"
INDEX = ROOT / "src/features/map/markerImages.ts"

DENSITY = 3  # the drawing is made for @3x, then shrunk for 1x / 2x
SUPER = 2  # drawn at 2x that, then shrunk (smooth edges)
OXFORD, ACCENT, GOLD, SIGNAL, INK, WHITE = "#003566", "#FFC300", "#FFD60A", "#8EC5FF", "#000814", "#FFFFFF"
MAX_CLUSTER = 100  # counts 2..99 get their own image, 100 stands for "99+"

# Mirrors PLACE_META / CATEGORY_META (keep in sync with placeCategories.ts and events/categories.ts).
PLACE_ICONS = {
    "restaurant": "restaurant-outline", "cafe": "cafe-outline", "bar": "beer-outline", "fast_food": "fast-food-outline",
    "club": "musical-notes-outline", "pharmacy": "medkit-outline", "supermarket": "cart-outline", "park": "leaf-outline",
    "attraction": "camera-outline", "atm": "card-outline", "default": "location-outline",
}
EVENT_ICONS = {
    "PARTY": "sparkles-outline", "CONCERT": "musical-notes-outline", "THEATRE": "film-outline", "SPORT": "football-outline",
    "GAMES": "game-controller-outline", "FOOD": "restaurant-outline", "ART": "color-palette-outline",
    "MEETUP": "people-outline", "VOLUNTEER": "leaf-outline", "OTHER": "calendar-outline",
}


def canvas(w_dp, h_dp):
    """A transparent canvas of w x h dp at the drawing resolution."""
    k = DENSITY * SUPER
    return Image.new("RGBA", (round(w_dp * k), round(h_dp * k)), (0, 0, 0, 0)), k


def finish(img, w_dp, h_dp, path):
    """Saves the image at 1x (name.png), 2x (name@2x.png) and 3x (name@3x.png): React Native picks the one that matches
    the screen, and a plain name.png must exist for require() to resolve."""
    stem = str(path)[: -len("@3x.png")]
    for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
        img.resize((round(w_dp * scale), round(h_dp * scale)), Image.LANCZOS).save(f"{stem}{suffix}.png")


def round_pin(path, size_dp, fill, ring_alpha, icon, glyph_dp, glyph_color, slot_dp):
    """Round badge with a translucent white ring and a centred Ionicons glyph, in a square slot (room for the ring)."""
    img, k = canvas(slot_dp, slot_dp)
    d = ImageDraw.Draw(img)
    c = slot_dp * k / 2
    r = size_dp * k / 2
    ring = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, round(255 * ring_alpha)))
    img.alpha_composite(ring)
    inner = r - 2 * k
    d.ellipse([c - inner, c - inner, c + inner, c + inner], fill=fill)
    font = ImageFont.truetype(str(ICON_FONT), round(glyph_dp * k))
    d.text((c, c), chr(GLYPHS[icon]), font=font, fill=glyph_color, anchor="mm")
    finish(img, slot_dp, slot_dp, path)


def cluster(path, count, fill, text_color):
    """Count bubble: same size rule as clusterSize() in ClusterMarker.tsx (height 36, width 20 + 9 per digit)."""
    label = "99+" if count >= MAX_CLUSTER else str(count)
    h = 36
    w = max(h, 20 + len(label) * 9)
    img, k = canvas(w, h)
    d = ImageDraw.Draw(img)
    ring = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle([0, 0, w * k - 1, h * k - 1], radius=h * k / 2, fill=(255, 255, 255, 90))
    img.alpha_composite(ring)
    d.rounded_rectangle([3 * k, 3 * k, (w - 3) * k - 1, (h - 3) * k - 1], radius=(h - 6) * k / 2, fill=fill)
    d.text((w * k / 2, h * k / 2), label, font=ImageFont.truetype(DIGIT_FONT, round(15 * k)), fill=text_color, anchor="mm")
    finish(img, w, h, path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    
    lines = []
    # Place pins: Oxford Navy badge 28 dp, selected 32 dp in School Bus Yellow; slot 34 dp holds both.
    for cat, icon in PLACE_ICONS.items():
        round_pin(OUT / f"place-{cat}@3x.png", 28, OXFORD, 0.85, icon, 14, WHITE, 34)
        round_pin(OUT / f"place-{cat}-selected@3x.png", 32, ACCENT, 0.85, icon, 16, INK, 34)
    # Event pins: gold badge 32 dp, selected 36 dp in signal blue; slot 38 dp.
    for cat, icon in EVENT_ICONS.items():
        round_pin(OUT / f"event-{cat}@3x.png", 32, GOLD, 0.9, icon, 15, INK, 38)
        round_pin(OUT / f"event-{cat}-selected@3x.png", 36, SIGNAL, 0.9, icon, 17, INK, 38)
    for n in range(2, MAX_CLUSTER + 1):
        cluster(OUT / f"cluster-place-{n}@3x.png", n, OXFORD, WHITE)
        cluster(OUT / f"cluster-event-{n}@3x.png", n, GOLD, INK)

    def req(name):
        return f"require('../../../assets/markers/{name}.png')"

    def table(prefix, keys):
        rows = [f"  {k!r}: {{ normal: {req(f'{prefix}-{k}')}, selected: {req(f'{prefix}-{k}-selected')} }}," for k in keys]
        return "\n".join(rows)

    def clusters(kind):
        return "\n".join(f"  {req(f'cluster-{kind}-{n}')}," for n in range(2, MAX_CLUSTER + 1))

    INDEX.write_text(
        "// GENERATED by scripts/generate_marker_images.py. Do not edit by hand: re-run the script.\n"
        "// Pre-drawn map pin images (see the script for why markers use images instead of views).\n"
        "/** A bundled image (what require() of a png returns). */\n"
        "type MarkerImage = number;\n\n"
        "type PinImages = { normal: MarkerImage; selected: MarkerImage };\n\n"
        f"/** Place pins by category ('default' for unknown ones). */\nexport const PLACE_PIN_IMAGES: Record<string, PinImages> = {{\n{table('place', PLACE_ICONS)}\n}};\n\n"
        f"/** Event pins by category. */\nexport const EVENT_PIN_IMAGES: Record<string, PinImages> = {{\n{table('event', EVENT_ICONS)}\n}};\n\n"
        f"/** Largest count with its own bubble; bigger counts use the last image (\"99+\"). */\nexport const MAX_CLUSTER_IMAGE = {MAX_CLUSTER};\n\n"
        f"// Index 0 is the bubble for a count of 2.\nconst PLACE_CLUSTER_IMAGES: MarkerImage[] = [\n{clusters('place')}\n];\n\n"
        f"const EVENT_CLUSTER_IMAGES: MarkerImage[] = [\n{clusters('event')}\n];\n\n"
        "/** Bubble image for a count (places navy, events gold). */\n"
        "export function clusterImage(kind: 'place' | 'event', count: number): MarkerImage {\n"
        "  const list = kind === 'place' ? PLACE_CLUSTER_IMAGES : EVENT_CLUSTER_IMAGES;\n"
        "  return list[Math.min(Math.max(count, 2), MAX_CLUSTER_IMAGE) - 2];\n"
        "}\n",
        encoding="utf-8",
    )
    print(f"{len(list(OUT.glob('*@3x.png')))} images (x3 densities), index written to {INDEX.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
