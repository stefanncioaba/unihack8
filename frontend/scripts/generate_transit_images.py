"""Draws the live-transit map images (vehicle badges per line, generic badge per vehicle type, stop dots) and writes
src/features/transit/transitImages.ts. Same reason as generate_marker_images.py: a marker with an `image` is drawn from
a finished bitmap, so it can never come out cut off, blank, late or a different size from its neighbours.

Line names and their types come from backend/src/test/resources/stpt/route-manifest.json (STPT's own list, 74 lines);
colours are the app's own (FAMILY_PALETTES + the shade rule of lineColor in src/features/transit/lines.ts, read from
that file, so the images match the line tiles and route lines). A test (map.transitImages.test.tsx) checks the two stay
in step. Vehicles of a line that is not in the list get the generic badge of their type.

Run from frontend/:  python scripts/generate_transit_images.py   (needs Pillow; run generate_marker_images.py's
requirements first: Ionicons font from node_modules). Re-run when lines or colours change.
"""
import json
import re
from pathlib import Path

from PIL import ImageDraw, ImageFont

import generate_marker_images as base

ROOT = base.ROOT
OUT = ROOT / "assets/transit"
INDEX = ROOT / "src/features/transit/transitImages.ts"
LINES_TS = ROOT / "src/features/transit/lines.ts"
MANIFEST = ROOT.parent / "backend/src/test/resources/stpt/route-manifest.json"

# Manifest category -> LineFamily (as in the app's route types).
FAMILY_OF = {"tram": "TRAM", "trolleybus": "TROLLEYBUS", "urban": "BUS", "express": "EXPRESS", "scolar": "SCHOOL",
             "metropolitan": "METROPOLITAN", "vaporetto": "BOAT"}
FAMILY_ICON = {"TRAM": "train", "TROLLEYBUS": "flash", "BUS": "bus", "EXPRESS": "bus", "SCHOOL": "bus",
               "METROPOLITAN": "bus", "BOAT": "boat"}  # mirrors vehicleIcon() in lines.ts
SIGNAL = "#8EC5FF"


def palettes():
    """FAMILY_PALETTES read from lines.ts."""
    src = LINES_TS.read_text(encoding="utf-8")
    block = src[src.index("export const FAMILY_PALETTES"):src.index("/** Every colour a line can get")]
    out = {}
    for fam, arr in re.findall(r"(\w+): \[([^\]]*)\]", block):
        out[fam] = re.findall(r"#[0-9A-Fa-f]{6}", arr)
    return out


def js_hash(s):
    """The hash() of lines.ts (31 multiplier, 32-bit)."""
    h = 0
    for c in s.upper():
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return h


def shade_index(route, shades):
    """shadeIndex() of lines.ts."""
    rid = route.strip().upper()
    m = re.search(r"(\d+)", rid)
    if not m:
        return js_hash(rid) % shades
    letters = rid.replace(m.group(1), "", 1)
    return (int(m.group(1)) + (js_hash(letters) if letters else 0)) % shades


def text_on(hexcolor):
    """textOnColor() of lines.ts: ink on light colours, white on the rest."""
    n = int(hexcolor[1:], 16)
    r, g, b = (n >> 16) & 255, (n >> 8) & 255, n & 255
    return "#000814" if 0.299 * r + 0.587 * g + 0.114 * b > 160 else "#FFFFFF"


def rgba(hexcolor, alpha):
    """#rrggbb + opacity as an RGBA tuple."""
    n = int(hexcolor[1:], 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255, round(255 * alpha))


def badge_size(name, selected):
    """badgeSize() of VehicleMarker.tsx: round for short names, a pill for long ones."""
    h = 34 if selected else 28
    return (max(h, 12 + max(1, len(name)) * 7) if name else h), h


def vehicle_image(path, name, family, color, selected):
    """Round (or pill) badge in the line colour: white ring, soft halo, type icon over the line number (icon only when
    `name` is empty: the generic badge)."""
    bw, bh = badge_size(name, selected)
    halo = 4
    w, h = bw + 2 * halo + 4, bh + 2 * halo + 4
    img, k = base.canvas(w, h)
    d = ImageDraw.Draw(img)
    layer = base.Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([2 * k, 2 * k, (w - 2) * k - 1, (h - 2) * k - 1], radius=(bh + 2 * halo) * k / 2, fill=rgba(color, 0.3))
    img.alpha_composite(layer)
    x0, y0 = (w - bw) / 2 * k, (h - bh) / 2 * k
    ring = (2.5 if selected else 1.5) * k
    d.rounded_rectangle([x0, y0, x0 + bw * k - 1, y0 + bh * k - 1], radius=bh * k / 2, fill="#FFFFFF")
    d.rounded_rectangle([x0 + ring, y0 + ring, x0 + bw * k - 1 - ring, y0 + bh * k - 1 - ring], radius=(bh * k - 2 * ring) / 2, fill=color)
    fg = text_on(color)
    cx, cy = w * k / 2, h * k / 2
    icon_font = ImageFont.truetype(str(base.ICON_FONT), round((12 if selected else 10) * k) if name else round(15 * k))
    glyph = chr(base.GLYPHS[FAMILY_ICON[family]])
    if name:
        d.text((cx, cy - bh * k * 0.2), glyph, font=icon_font, fill=fg, anchor="mm")
        d.text((cx, cy + bh * k * 0.2), name, font=ImageFont.truetype(base.DIGIT_FONT, round(10 * k)), fill=fg, anchor="mm")
    else:
        d.text((cx, cy), glyph, font=icon_font, fill=fg, anchor="mm")
    base.finish(img, w, h, path)


def stop_image(path, color, selected):
    """Stop dot: 12 dp in `color` with a dark ring; 18 dp with a white ring when selected. Square 22 dp canvas."""
    size = 22
    img, k = base.canvas(size, size)
    d = ImageDraw.Draw(img)
    c = size * k / 2
    r = (9 if selected else 6) * k
    d.ellipse([c - r, c - r, c + r, c + r], fill="#FFFFFF" if selected else "#000814")
    r2 = r - 2 * k
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=color)
    base.finish(img, size, size, path)


def trip_image(path, color, glyph_name, ring_color, fill, glyph_color):
    """Board / get-off badge of the trip guidance: a 30 dp round badge with a white ring (32 dp canvas)."""
    size = 34
    img, k = base.canvas(size, size)
    d = ImageDraw.Draw(img)
    c = size * k / 2
    r = 15 * k
    d.ellipse([c - r, c - r, c + r, c + r], fill=ring_color)
    r2 = r - 2.5 * k
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=fill)
    font = ImageFont.truetype(str(base.ICON_FONT), round(16 * k))
    d.text((c, c), chr(base.GLYPHS[glyph_name]), font=font, fill=glyph_color, anchor="mm")
    base.finish(img, size, size, path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    pal = palettes()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = {}  # NAME(upper) -> (display name, family)
    for cat, info in manifest["categories"].items():
        for r in info["routes"]:
            names.setdefault(r.strip().upper(), (r.strip(), FAMILY_OF.get(cat, "BUS")))

    def req(n):
        return f"require('../../../assets/transit/{n}.png')"

    vehicles, generic, stops = [], [], []
    for key, (name, fam) in sorted(names.items()):
        color = pal[fam][shade_index(name, len(pal[fam]))]
        safe = re.sub(r"[^A-Za-z0-9]", "_", key)
        for sel in (False, True):
            vehicle_image(OUT / f"vehicle-{safe}{'-selected' if sel else ''}@3x.png", name, fam, color, sel)
        vehicles.append(f"  {key!r}: {{ family: {fam!r}, color: {color!r}, normal: {req(f'vehicle-{safe}')}, selected: {req(f'vehicle-{safe}-selected')} }},")
    for fam, colors_ in pal.items():
        color = colors_[0]
        for sel in (False, True):
            vehicle_image(OUT / f"type-{fam}{'-selected' if sel else ''}@3x.png", "", fam, color, sel)
        generic.append(f"  {fam}: {{ normal: {req(f'type-{fam}')}, selected: {req(f'type-{fam}-selected')} }},")
    stop_colors = sorted({c.lower() for cs in pal.values() for c in cs} | {SIGNAL.lower()})
    for c in stop_colors:
        for sel in (False, True):
            stop_image(OUT / f"stop-{c[1:]}{'-selected' if sel else ''}@3x.png", c, sel)
        stops.append(f"  {c!r}: {{ normal: {req(f'stop-{c[1:]}')}, selected: {req(f'stop-{c[1:]}-selected')} }},")

    # Trip guidance badges per line colour: board = the type icon in the line colour, get off = exit icon on dark with a
    # ring in the line colour. 'default' is for a colour that is not a line colour.
    trips = []
    fam_of_color = {c.lower(): fam for fam, cs in pal.items() for c in cs}
    for c in sorted(fam_of_color) + ["default"]:
        color = "#ffd60a" if c == "default" else c
        fam = "BUS" if c == "default" else fam_of_color[c]
        tag = c.lstrip("#")
        trip_image(OUT / f"trip-board-{tag}@3x.png", color, FAMILY_ICON[fam], "#FFFFFF", color, text_on(color))
        trip_image(OUT / f"trip-alight-{tag}@3x.png", color, "log-out", color, "#000814", "#FFFFFF")
        trips.append(f"  {c!r}: {{ board: {req(f'trip-board-{tag}')}, alight: {req(f'trip-alight-{tag}')} }},")

    INDEX.write_text(
        "// GENERATED by scripts/generate_transit_images.py. Do not edit by hand: re-run the script.\n"
        "// Pre-drawn live-transit images: a badge per line (with its type icon and number), a generic badge per type and a\n"
        "// stop dot per line colour. Images, not views, so no vehicle or stop can be cut off or differ in size.\n"
        "type Pair = { normal: number; selected: number };\n\n"
        "/** Badge per line name (upper case), with the family and colour it was drawn in. */\n"
        "export const VEHICLE_IMAGES: Record<string, Pair & { family: string; color: string }> = {\n" + "\n".join(vehicles) + "\n};\n\n"
        "/** Badge without a number per vehicle type, for a line that is not in the list above. */\n"
        "export const TYPE_IMAGES: Record<string, Pair> = {\n" + "\n".join(generic) + "\n};\n\n"
        "/** Trip guidance badges (board / get off) per line colour (lower case hex), and 'default' for any other colour. */\n"
        "export const TRIP_IMAGES: Record<string, { board: number; alight: number }> = {\n" + "\n".join(trips) + "\n};\n\n"
        "/** Stop dot per colour (lower case hex): every line colour plus the signal blue of the plain stops. */\n"
        "export const STOP_IMAGES: Record<string, Pair> = {\n" + "\n".join(stops) + "\n};\n",
        encoding="utf-8",
    )
    print(f"{len(vehicles)} lines, {len(generic)} types, {len(stops)} stop colours; index {INDEX.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
