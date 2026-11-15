"""
Builds every Google Play listing graphic for DocSigner:

    python tools/make_store_assets.py

  store/play-icon-512.png              512x512 hi-res icon (same artwork as the launcher icon)
  store/feature-graphic-1024x500.png   feature graphic
  store/screenshots/NN-*.png           phone screenshots, 1080x1920, upload in file-name order

Screenshots use raw phone captures from store/raw/ (adb exec-out screencap -p > store/raw/02-sign-pdf.png).
The real status bar and navigation bar are always cropped off, so no notifications or personal details can appear;
a clean status bar is drawn instead. Two frames (hero and scanner) need only 02-sign-pdf.png or nothing at all.
Edit SHOTS to change headlines, colours, stickers or order. Wrap a word in *stars* to highlight it.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_assets as art  # noqa: E402  (document / pen / photo / signature drawings)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "store", "raw")
STORE = os.path.join(ROOT, "store")
SHOTS_DIR = os.path.join(STORE, "screenshots")

W, H = 1080, 1920
STATUS_BAR, NAV_BAR = 120, 112  # px on the 1080x2400 raw captures
WHITE = (255, 255, 255)
ACCENT = (253, 230, 138)  # warm yellow highlight for *words*
INK = (30, 27, 75)

# ------------------------------------------------------------------ fonts

_fonts = {}


def font(px, weight="bold"):
    names = {
        "black": ["seguibl.ttf", "segoeuib.ttf", "arialbd.ttf"],
        "bold": ["segoeuib.ttf", "arialbd.ttf"],
        "semi": ["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"],
        "regular": ["segoeui.ttf", "arial.ttf"],
    }[weight]
    key = (px, weight)
    if key not in _fonts:
        for n in names:
            try:
                _fonts[key] = ImageFont.truetype(n, px)
                break
            except OSError:
                continue
        else:
            _fonts[key] = ImageFont.load_default()
    return _fonts[key]


# ------------------------------------------------------------------ drawing helpers

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def linear(size, stops, angle=0.62):
    """Multi-stop gradient; angle mixes x (0) and y (1)."""
    w, h = size
    sw, sh = 96, max(2, int(96 * h / w))
    small = Image.new("RGB", (sw, sh))
    px = small.load()
    for y in range(sh):
        for x in range(sw):
            t = (x / (sw - 1)) * (1 - angle) + (y / (sh - 1)) * angle
            for i in range(len(stops) - 1):
                t0, c0 = stops[i]
                t1, c1 = stops[i + 1]
                if t <= t1 or i == len(stops) - 2:
                    px[x, y] = lerp(c0, c1, min(1, max(0, (t - t0) / max(1e-6, t1 - t0))))
                    break
    return small.resize((w, h), Image.BICUBIC).convert("RGBA")


def glow(canvas, xy, r, color, alpha):
    """Big soft coloured light."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    x, y = xy
    ImageDraw.Draw(layer).ellipse((x - r, y - r, x + r, y + r), fill=color + (alpha,))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(r * 0.55)))


def dot_grid(canvas, box, gap=34, r=2.4, alpha=40):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    for y in range(int(y0), int(y1), gap):
        for x in range(int(x0), int(x1), gap):
            d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, alpha))
    canvas.alpha_composite(layer)


def background(size, c1, c2, c3=None):
    """Rich brand background: 3-stop gradient, coloured glows, faint dot texture."""
    w, h = size
    c3 = c3 or lerp(c2, (20, 12, 60), 0.35)
    bg = linear(size, [(0, c1), (0.55, c2), (1, c3)])
    glow(bg, (w * 0.12, h * 0.08), w * 0.55, lerp(c1, WHITE, 0.45), 70)
    glow(bg, (w * 0.95, h * 0.62), w * 0.50, lerp(c2, (236, 72, 153), 0.35), 60)
    glow(bg, (w * 0.20, h * 0.98), w * 0.45, lerp(c3, (14, 165, 233), 0.30), 50)
    dot_grid(bg, (w * 0.62, h * 0.02, w * 0.98, h * 0.20), alpha=34)
    dot_grid(bg, (w * 0.03, h * 0.70, w * 0.30, h * 0.86), alpha=26)
    return bg


def drop_shadow(canvas, layer, blur, offset, opacity=110, color=(12, 8, 40)):
    a = layer.split()[-1].point(lambda v: v * opacity // 255)
    sh = Image.new("RGBA", layer.size, color + (0,))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    out.alpha_composite(sh, offset)
    canvas.alpha_composite(out)


def place(canvas, img, xy, blur=24, offset=(0, 22), opacity=110):
    """Composite with a soft shadow."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.alpha_composite(img, (int(xy[0]), int(xy[1])))
    drop_shadow(canvas, layer, blur, offset, opacity)
    canvas.alpha_composite(layer)


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=r, fill=255)
    return m


def rich_text(d, x, y, text, f, base, accent, align_w=None):
    """Draws text where *words* are highlighted. If align_w is set, centres the line in [x, x+align_w]."""
    parts = text.split("*")
    total = sum(d.textlength(p, font=f) for p in parts)
    cx = x + (align_w - total) / 2 if align_w else x
    for i, p in enumerate(parts):
        d.text((cx, y), p, font=f, fill=accent if i % 2 else base)
        cx += d.textlength(p, font=f)


# ------------------------------------------------------------------ small icons for stickers

def icon(kind, size, color):
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, S - 1, S - 1), fill=color)
    w = int(S * 0.09)
    if kind == "check":
        d.line([(S * 0.28, S * 0.52), (S * 0.44, S * 0.68), (S * 0.73, S * 0.36)], fill=WHITE, width=w, joint="curve")
    elif kind == "lock":
        d.rounded_rectangle((S * 0.30, S * 0.46, S * 0.70, S * 0.76), radius=S * 0.06, fill=WHITE)
        d.arc((S * 0.36, S * 0.24, S * 0.64, S * 0.62), 180, 360, fill=WHITE, width=w)
        d.line([(S * 0.36, S * 0.43), (S * 0.36, S * 0.50)], fill=WHITE, width=w)
        d.line([(S * 0.64, S * 0.43), (S * 0.64, S * 0.50)], fill=WHITE, width=w)
    elif kind == "dots":
        for (cx, cy), c in zip(((0.36, 0.38), (0.64, 0.38), (0.36, 0.64), (0.64, 0.64)),
                               ((254, 202, 202), (191, 219, 254), (187, 247, 208), (253, 230, 138))):
            r = S * 0.11
            d.ellipse((S * cx - r, S * cy - r, S * cx + r, S * cy + r), fill=c)
    elif kind == "share":
        a, b, c = (S * 0.66, S * 0.30), (S * 0.32, S * 0.50), (S * 0.66, S * 0.70)
        d.line([a, b, c], fill=WHITE, width=int(w * 0.8), joint="curve")
        for x, y in (a, b, c):
            r = S * 0.09
            d.ellipse((x - r, y - r, x + r, y + r), fill=WHITE)
    elif kind == "crown":
        pts = [(S * 0.24, S * 0.68), (S * 0.24, S * 0.36), (S * 0.38, S * 0.50), (S * 0.50, S * 0.28),
               (S * 0.62, S * 0.50), (S * 0.76, S * 0.36), (S * 0.76, S * 0.68)]
        d.polygon(pts, fill=WHITE)
    elif kind == "scan":
        L, m = S * 0.16, S * 0.26
        for sx, sy in ((m, m), (S - m, m), (m, S - m), (S - m, S - m)):
            dx = L if sx < S / 2 else -L
            dy = L if sy < S / 2 else -L
            d.line([(sx, sy + dy), (sx, sy), (sx + dx, sy)], fill=WHITE, width=w, joint="curve")
    elif kind == "pen":
        d.line([(S * 0.30, S * 0.70), (S * 0.68, S * 0.32)], fill=WHITE, width=int(w * 1.3))
        d.polygon([(S * 0.24, S * 0.76), (S * 0.27, S * 0.62), (S * 0.38, S * 0.73)], fill=WHITE)
    elif kind == "doc":
        d.rounded_rectangle((S * 0.32, S * 0.24, S * 0.68, S * 0.76), radius=S * 0.05, fill=WHITE)
        for i in range(3):
            y = S * (0.38 + i * 0.11)
            d.line([(S * 0.40, y), (S * 0.60, y)], fill=color, width=int(w * 0.6))
    return im.resize((size, size), Image.LANCZOS)


def sticker(label, kind, color, scale=1.0, rotate=0):
    """White pill with a coloured icon and a label: the floating feature callouts."""
    f = font(int(34 * scale), "bold")
    tw = int(ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(label, font=f))
    h = int(84 * scale)
    ic = int(56 * scale)
    pad = int(14 * scale)
    w = pad + ic + int(16 * scale) + tw + int(28 * scale)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=WHITE)
    im.alpha_composite(icon(kind, ic, color), (pad, (h - ic) // 2))
    box = d.textbbox((0, 0), label, font=f)
    d.text((pad + ic + int(16 * scale), (h - (box[3] - box[1])) / 2 - box[1]), label, font=f, fill=INK)
    if rotate:
        im = im.rotate(rotate, resample=Image.BICUBIC, expand=True)
    return im


# ------------------------------------------------------------------ phone mock-up

def status_bar(width, color):
    """Clean status bar (time, signal, wifi, battery) in the app's header colour."""
    h = int(width * 0.075)
    bar = Image.new("RGBA", (width, h), color + (255,))
    d = ImageDraw.Draw(bar)
    lum = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]
    fg = WHITE if lum < 150 else (17, 24, 39)
    f = font(int(h * 0.44), "semi")
    d.text((int(width * 0.07), int(h * 0.24)), "9:41", font=f, fill=fg)
    x = width - int(width * 0.07)
    # battery
    bw, bh = int(h * 0.62), int(h * 0.32)
    by = (h - bh) // 2 + 2
    d.rounded_rectangle((x - bw, by, x, by + bh), radius=bh // 4, outline=fg, width=max(2, bh // 7))
    d.rounded_rectangle((x - bw + 4, by + 4, x - int(bw * 0.25), by + bh - 4), radius=2, fill=fg)
    x -= bw + int(h * 0.30)
    # wifi
    r = int(h * 0.34)
    cy = by + bh + 2
    for k in (1.0, 0.66, 0.33):
        rr = int(r * k)
        d.pieslice((x - rr * 2, cy - rr, x, cy + rr), 225, 315, fill=fg) if k == 0.33 else d.arc((x - r - rr, cy - rr, x - r + rr, cy + rr), 225, 315, fill=fg, width=max(2, r // 5))
    x -= int(r * 2.4)
    # signal bars
    for i in range(4):
        bh_i = int(h * (0.14 + i * 0.07))
        d.rectangle((x - (3 - i) * int(h * 0.13) - int(h * 0.08), cy - bh_i, x - (3 - i) * int(h * 0.13), cy), fill=fg)
    return bar


def phone(screen, width, header_color=(79, 70, 229)):
    """Modern phone: thin dark bezel, metallic rim, punch-hole camera, side buttons. `screen` = app area (no bars)."""
    bezel = int(width * 0.028)
    inner_w = width - bezel * 2
    sb = status_bar(inner_w, header_color)
    sc = screen.resize((inner_w, int(screen.height * inner_w / screen.width)), Image.LANCZOS).convert("RGBA")
    inner = Image.new("RGBA", (inner_w, sb.height + sc.height), WHITE + (255,))
    inner.alpha_composite(sb, (0, 0))
    inner.alpha_composite(sc, (0, sb.height))
    # punch-hole camera
    d = ImageDraw.Draw(inner)
    cr = int(inner_w * 0.018)
    cx, cy = inner_w // 2, sb.height // 2
    d.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(10, 10, 16))
    d.ellipse((cx - cr * 0.4, cy - cr * 0.5, cx, cy - cr * 0.1), fill=(60, 64, 90))

    H_ = inner.height + bezel * 2
    R = int(width * 0.12)
    body = Image.new("RGBA", (width + 12, H_), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    # side buttons (right edge)
    bd.rounded_rectangle((width - 2, int(H_ * 0.16), width + 8, int(H_ * 0.24)), radius=4, fill=(48, 50, 66))
    bd.rounded_rectangle((width - 2, int(H_ * 0.28), width + 8, int(H_ * 0.33)), radius=4, fill=(48, 50, 66))
    # metallic rim + black bezel
    rim = linear((width, H_), [(0, (120, 124, 150)), (0.5, (40, 42, 58)), (1, (110, 114, 140))], angle=0.15)
    body.paste(rim, (0, 0), rounded_mask((width, H_), R))
    blk = Image.new("RGBA", (width - 6, H_ - 6), (8, 8, 14, 255))
    body.paste(blk, (3, 3), rounded_mask(blk.size, R - 3))
    body.paste(inner, (bezel, bezel), rounded_mask(inner.size, R - bezel))
    # glass sheen
    sheen = Image.new("RGBA", body.size, (0, 0, 0, 0))
    ImageDraw.Draw(sheen).polygon([(0, 0), (int(width * 0.55), 0), (0, int(H_ * 0.35))], fill=(255, 255, 255, 14))
    body.alpha_composite(sheen)
    return body


def app_area(name):
    im = Image.open(os.path.join(RAW, name)).convert("RGB")
    header = im.getpixel((im.width // 2, STATUS_BAR + 4))
    return im.crop((0, STATUS_BAR, im.width, im.height - NAV_BAR)), header


# ------------------------------------------------------------------ screenshot frames

def headline_block(canvas, top, title, sub, align_top=True):
    d = ImageDraw.Draw(canvas)
    hf, sf = font(92, "black"), font(40, "regular")
    y = top
    for line in title.split("\n"):
        rich_text(d, 0, y, line, hf, WHITE, ACCENT, align_w=W)
        y += 106
    sw = d.textlength(sub, font=sf)
    d.text(((W - sw) / 2, y + 18), sub, font=sf, fill=(237, 233, 254))
    return y + 18 + 50


def brand_pill(canvas, y):
    logo = art.icon_content(64)
    f = font(32, "bold")
    label = "DocSigner"
    tw = ImageDraw.Draw(canvas).textlength(label, font=f)
    w = int(64 + 12 + tw + 40)
    pill = Image.new("RGBA", (w, 76), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle((0, 0, w - 1, 75), radius=38, fill=(255, 255, 255, 38), outline=(255, 255, 255, 70), width=2)
    pill.alpha_composite(logo, (14, 6))
    pd.text((14 + 64 + 6, 16), label, font=f, fill=WHITE)
    canvas.alpha_composite(pill, ((W - w) // 2, y))


def frame_phone(spec):
    raw, layout = spec["raw"], spec.get("layout", "top")
    if not os.path.exists(os.path.join(RAW, raw)):
        print("  skip (missing raw):", raw)
        return None
    c1, c2 = spec["colors"]
    canvas = background((W, H), c1, c2)
    screen, header = app_area(raw)
    pw = 780
    ph = phone(screen, pw, header)
    if spec.get("crop"):
        y0, y1 = spec["crop"]
        k = ph.width / screen.width
        ph = ph.crop((0, int(y0 * k), ph.width, int(y1 * k)))
    if layout == "top":
        brand_pill(canvas, 70)
        text_end = headline_block(canvas, 180, spec["title"], spec["sub"])
        py = text_end + 70
        place(canvas, ph, ((W - ph.width) // 2, py), blur=34, offset=(0, 30), opacity=150)
    else:  # phone comes down from the top, text at the bottom
        py = H - 560 - ph.height
        place(canvas, ph, ((W - ph.width) // 2, py), blur=34, offset=(0, 30), opacity=150)
        # fade so the text sits on clean colour
        fade = Image.new("RGBA", (W, 640), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fade)
        base = lerp(c2, (20, 12, 60), 0.30)
        for i in range(640):
            a = int(255 * min(1, max(0, (i - 40) / 220)))
            fd.line([(0, i), (W, i)], fill=base + (a,))
        canvas.alpha_composite(fade, (0, H - 640))
        glow(canvas, (W * 0.5, H - 200), 420, lerp(c2, WHITE, 0.15), 50)
        headline_block(canvas, H - 470, spec["title"], spec["sub"])
        brand_pill(canvas, H - 130)
    for st in spec.get("stickers", []):
        label, kind, color, (x, y), rot = st
        s = sticker(label, kind, color, rotate=rot)
        place(canvas, s, (x if x >= 0 else W + x - s.width, y), blur=18, offset=(0, 14), opacity=120)
    return canvas


def frame_hero(spec):
    """First screenshot: the whole app in one look. Uses the PDF-signing capture inside a tilted phone."""
    c1, c2 = spec["colors"]
    canvas = background((W, H), c1, c2)
    brand_pill(canvas, 70)
    end = headline_block(canvas, 180, spec["title"], spec["sub"])
    if os.path.exists(os.path.join(RAW, spec["raw"])):
        screen, header = app_area(spec["raw"])
        ph = phone(screen, 700, header).rotate(-5, resample=Image.BICUBIC, expand=True)
        place(canvas, ph, ((W - ph.width) // 2 + 40, end + 90), blur=40, offset=(0, 34), opacity=160)
    # floating document cards around the phone
    pdf = art.draw_document((250, 320), badge="PDF", badge_color=(239, 68, 68), signed=True).rotate(9, resample=Image.BICUBIC, expand=True)
    doc = art.draw_document((230, 294), badge="DOC", badge_color=(37, 99, 235), signed=True, lines=4).rotate(-11, resample=Image.BICUBIC, expand=True)
    photo = art.draw_photo((230, 266)).rotate(8, resample=Image.BICUBIC, expand=True)
    place(canvas, doc, (30, end + 200), blur=20, offset=(0, 18), opacity=130)
    place(canvas, photo, (36, end + 900), blur=20, offset=(0, 18), opacity=130)
    place(canvas, pdf, (W - pdf.width - 24, end + 1000), blur=20, offset=(0, 18), opacity=130)
    for st in spec.get("stickers", []):
        label, kind, color, (x, y), rot = st
        s = sticker(label, kind, color, rotate=rot)
        place(canvas, s, (x if x >= 0 else W + x - s.width, y), blur=18, offset=(0, 14), opacity=120)
    return canvas


def frame_scan(spec):
    """Scanner frame, fully illustrated (camera views are never captured): paper photo -> clean PDF."""
    c1, c2 = spec["colors"]
    canvas = background((W, H), c1, c2)
    brand_pill(canvas, 70)
    end = headline_block(canvas, 180, spec["title"], spec["sub"])

    # left: a skewed paper on a desk with scanner corner brackets
    paper = art.draw_document((420, 540), signed=False, lines=6).rotate(-9, resample=Image.BICUBIC, expand=True)
    desk = Image.new("RGBA", (560, 700), (0, 0, 0, 0))
    ImageDraw.Draw(desk).rounded_rectangle((0, 0, 559, 699), radius=48, fill=(30, 27, 75, 120))
    desk.alpha_composite(paper, ((560 - paper.width) // 2, (700 - paper.height) // 2))
    dd = ImageDraw.Draw(desk)
    blue = (56, 189, 248)
    L, m = 70, 52
    for sx, sy in ((m, m), (560 - m, m), (m, 700 - m), (560 - m, 700 - m)):
        dx = L if sx < 280 else -L
        dy = L if sy < 350 else -L
        dd.line([(sx, sy + dy), (sx, sy), (sx + dx, sy)], fill=blue, width=10, joint="curve")
    dd.line([(m + 10, 350), (560 - m - 10, 350)], fill=blue + (200,), width=5)
    desk = desk.rotate(4, resample=Image.BICUBIC, expand=True)
    place(canvas, desk, (40, end + 120), blur=26, offset=(0, 20), opacity=120)

    # arrow
    d = ImageDraw.Draw(canvas)
    ax, ay = 545, end + 520
    d.line([(ax, ay), (ax + 120, ay)], fill=WHITE, width=14)
    d.polygon([(ax + 150, ay), (ax + 108, ay - 30), (ax + 108, ay + 30)], fill=WHITE)

    # right: the clean PDF
    pdf = art.draw_document((400, 512), badge="PDF", badge_color=(239, 68, 68), signed=True, lines=5)
    place(canvas, pdf, (W - pdf.width - 50, end + 300), blur=30, offset=(0, 26), opacity=140)
    for st in spec.get("stickers", []):
        label, kind, color, (x, y), rot = st
        s = sticker(label, kind, color, rotate=rot)
        place(canvas, s, (x if x >= 0 else W + x - s.width, y), blur=18, offset=(0, 14), opacity=120)
    return canvas


INDIGO = (79, 70, 229)
VIOLET = (124, 58, 237)
SKY = (14, 165, 233)
GREEN = (16, 185, 129)
RED = (239, 68, 68)
AMBER = (245, 158, 11)
PINK = (219, 39, 119)

# out-file, builder, spec. Stickers: (label, icon, colour, (x, y) [negative x = from right edge], rotation)
SHOTS = [
    ("01-hero", frame_hero, {
        "raw": "02-sign-pdf.png", "colors": ((67, 56, 202), (124, 58, 237)),
        "title": "Sign any document\nin *seconds*", "sub": "PDF, Word & photos · no printing, no account",
        "stickers": [("PDF · DOCX · JPG", "doc", RED, (-40, 640), 4), ("Private · on your phone", "lock", GREEN, (40, 1240), -3)],
    }),
    ("02-sign-pdf", frame_phone, {
        "raw": "02-sign-pdf.png", "colors": ((79, 70, 229), (37, 99, 235)),
        "title": "Sign PDFs\n*anywhere*", "sub": "Drag your signature onto any page",
        "stickers": [("Every page at once", "check", GREEN, (36, 1130), -4), ("Auto date", "pen", INDIGO, (-36, 1460), 4)],
    }),
    ("03-scan", frame_scan, {
        "colors": ((8, 145, 178), (37, 99, 235)),
        "title": "Scan paper\nto *PDF*", "sub": "Auto-crop & straighten, then sign it",
        "stickers": [("Auto edge detection", "scan", SKY, (60, 1420), -3), ("Multi-page PDF", "doc", RED, (-60, 1600), 3)],
    }),
    ("04-sign-word", frame_phone, {
        "raw": "03-sign-word.png", "colors": ((37, 99, 235), (14, 165, 233)),
        "title": "Sign Word\ndocuments *too*", "sub": "Real pages, signature exactly where you want",
        "stickers": [(".docx support", "doc", (37, 99, 235), (36, 1180), -4)],
    }),
    ("05-signature", frame_phone, {
        "raw": "04-signature.png", "colors": ((109, 40, 217), (192, 38, 211)),
        "title": "Your signature,\nyour *style*", "sub": "20 ink colours and adjustable thickness",
        "stickers": [("20 ink colours", "dots", PINK, (-36, 1140), 4), ("Smooth natural ink", "pen", VIOLET, (36, 1520), -3)],
    }),
    ("06-share", frame_phone, {
        "raw": "06-signed-sheet.png", "colors": ((5, 150, 105), (13, 148, 136)), "layout": "bottom", "crop": (900, 2168),
        "title": "Save anywhere,\nshare *instantly*", "sub": "Downloads, Drive, WhatsApp, email…",
        "stickers": [("WhatsApp & email", "share", GREEN, (-30, 140), 4), ("Google Drive & SD card", "check", SKY, (30, 330), -3)],
    }),
    ("07-pro", frame_phone, {
        "raw": "07-pro.png", "colors": ((217, 119, 6), (190, 24, 93)), "crop": (0, 1500),
        "title": "Go *Pro* for\nunlimited signing", "sub": "No watermark · unlimited Word documents",
        "stickers": [("Monthly, yearly or lifetime", "crown", AMBER, (-30, 1500), 3)],
    }),
]


# ------------------------------------------------------------------ icon & feature graphic

def build_icon():
    S = 1024
    bg = linear((S, S), [(0, (99, 91, 255)), (0.5, (91, 50, 230)), (1, (124, 34, 200))], angle=0.6)
    glow(bg, (S * 0.25, S * 0.18), S * 0.55, (199, 210, 254), 90)
    glow(bg, (S * 0.85, S * 0.95), S * 0.45, (236, 72, 153), 45)
    # icon_content's artwork leans right/down (the pen), so it's shifted back to look centred, inside Play's safe area.
    content = art.icon_content(int(S * 0.80))
    bg.alpha_composite(content, ((S - content.width) // 2 - int(S * 0.06), (S - content.height) // 2 - int(S * 0.05)))
    out = bg.convert("RGB").resize((512, 512), Image.LANCZOS)
    save(out, os.path.join(STORE, "play-icon-512.png"))


def build_feature_graphic():
    FW, FH = 1024, 500
    fg = linear((FW, FH), [(0, (55, 48, 163)), (0.5, (91, 33, 182)), (1, (134, 25, 143))], angle=0.35)
    glow(fg, (180, 60), 360, (129, 140, 248), 90)
    glow(fg, (900, 470), 300, (236, 72, 153), 70)
    glow(fg, (720, 240), 260, (165, 180, 252), 40)
    dot_grid(fg, (430, 24, 600, 140), gap=22, r=1.8, alpha=40)

    # right: tilted phone with the real signing screen + floating cards
    if os.path.exists(os.path.join(RAW, "02-sign-pdf.png")):
        screen, header = app_area("02-sign-pdf.png")
        ph = phone(screen, 240, header)
        ph = ph.crop((0, 0, ph.width, 470)).rotate(-8, resample=Image.BICUBIC, expand=True)
        place(fg, ph, (705, 40), blur=18, offset=(0, 16), opacity=150)
    doc = art.draw_document((150, 192), badge="DOC", badge_color=(37, 99, 235), signed=True, lines=4).rotate(12, resample=Image.BICUBIC, expand=True)
    photo = art.draw_photo((150, 174)).rotate(-10, resample=Image.BICUBIC, expand=True)
    place(fg, photo, (585, 250), blur=12, offset=(0, 10), opacity=120)
    place(fg, doc, (830, 222), blur=12, offset=(0, 10), opacity=120)

    d = ImageDraw.Draw(fg)
    fg.alpha_composite(art.icon_content(84), (52, 70))
    d.text((142, 86), "DocSigner", font=font(44, "bold"), fill=WHITE)
    y = 180
    for line in ("Sign PDFs, Word", "& photos in *seconds*"):
        rich_text(d, 56, y, line, font(52, "black"), WHITE, ACCENT)
        y += 62
    # feature chips
    x, y = 56, 330
    for label, kind, color in (("Scan to PDF", "scan", SKY), ("20 inks", "dots", PINK), ("Private", "lock", GREEN)):
        s = sticker(label, kind, color, scale=0.62)
        place(fg, s, (x, y), blur=8, offset=(0, 6), opacity=90)
        x += s.width + 14
    save(fg.convert("RGB"), os.path.join(STORE, "feature-graphic-1024x500.png"))


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print("  ", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    print("Play Store graphics")
    build_icon()
    build_feature_graphic()
    print("Play Store screenshots")
    os.makedirs(SHOTS_DIR, exist_ok=True)
    for f in os.listdir(SHOTS_DIR):  # old numbering would mix with the new order
        if f.endswith(".png"):
            os.remove(os.path.join(SHOTS_DIR, f))
    for name, builder, spec in SHOTS:
        img = builder(spec)
        if img is not None:
            save(img.convert("RGB"), os.path.join(SHOTS_DIR, f"{name}-1080x1920.png"))
    print("done")
