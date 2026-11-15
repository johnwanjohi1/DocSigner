"""
Generates DocSigner's app icons, native launch screens and the in-app splash illustrations.

    python tools/generate_assets.py

Everything is drawn with Pillow at 4x and down-sampled, so it can be re-run after tweaking colours.
Outputs:
  - Android: adaptive icon foreground + legacy launcher icons (all densities), splash logo/background,
             Android 12+ splash icon
  - iOS:     AppIcon.appiconset, LaunchScreen.AspectFill / LaunchScreen.Center images
  - App:     src/assets/splash/*.png illustrations used by the animated in-app splash
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "App_Resources", "Android", "src", "main", "res")
IOS = os.path.join(ROOT, "App_Resources", "iOS", "Assets.xcassets")
APP_ASSETS = os.path.join(ROOT, "src", "assets", "splash")

INDIGO = (79, 70, 229)
VIOLET = (124, 58, 237)
INDIGO_DARK = (55, 48, 163)
INK = (49, 46, 129)
LINE = (199, 210, 254)
GOLD = (245, 158, 11)
GOLD_DARK = (180, 83, 9)
WHITE = (255, 255, 255)
SS = 4  # supersampling factor


# ------------------------------------------------------------------ helpers

def gradient(size, c1=INDIGO, c2=VIOLET):
    """Diagonal gradient (top-left c1 -> bottom-right c2)."""
    w, h = size
    small = Image.new("RGB", (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x + y) / 126
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return small.resize((w, h), Image.BICUBIC)


def bezier(p0, p1, p2, p3, n=40):
    pts = []
    for i in range(n + 1):
        t = i / n
        a = (1 - t) ** 3
        b = 3 * (1 - t) ** 2 * t
        c = 3 * (1 - t) * t ** 2
        d = t ** 3
        pts.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return pts


def stroke(draw, pts, width, fill):
    draw.line(pts, fill=fill, width=int(width), joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def signature_points(x, y, w, h):
    """A flowing cursive-looking signature inside the box (x, y, w, h)."""
    def P(u, v):
        return (x + u * w, y + v * h)

    segs = [
        # tall looped capital
        (P(0.02, 0.85), P(0.00, 0.10), P(0.14, -0.10), P(0.12, 0.45)),
        (P(0.12, 0.45), P(0.10, 0.95), P(0.02, 0.75), P(0.10, 0.55)),
        # lower-case flow
        (P(0.10, 0.55), P(0.20, 0.30), P(0.22, 0.85), P(0.30, 0.60)),
        (P(0.30, 0.60), P(0.36, 0.30), P(0.40, 0.95), P(0.47, 0.55)),
        (P(0.47, 0.55), P(0.52, 0.15), P(0.56, 0.20), P(0.55, 0.60)),
        (P(0.55, 0.60), P(0.54, 0.95), P(0.66, 0.80), P(0.70, 0.50)),
        (P(0.70, 0.50), P(0.76, 0.20), P(0.80, 0.80), P(0.88, 0.45)),
        # flourish back underneath
        (P(0.88, 0.45), P(0.98, 0.10), P(1.00, 1.05), P(0.60, 0.95)),
        (P(0.60, 0.95), P(0.40, 0.92), P(0.25, 1.00), P(0.18, 1.02)),
    ]
    pts = []
    for s in segs:
        pts += bezier(*s)
    return pts


def shadow(layer, radius, offset, opacity=90):
    """Soft drop shadow from a layer's alpha."""
    a = layer.split()[-1].point(lambda v: v * opacity // 255)
    sh = Image.new("RGBA", layer.size, (17, 12, 60, 0))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(radius))
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.alpha_composite(sh, offset)
    return out


def draw_document(size, badge=None, badge_color=None, signed=True, lines=4):
    """White document sheet with folded corner, text lines and a signature."""
    W, H = size[0] * SS, size[1] * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(W * 0.08)
    fold = int(W * 0.24)
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=r, fill=WHITE)
    # folded corner: cut the top-right triangle away, then draw the turned-over flap
    d.polygon([(W - fold, 0), (W, 0), (W, fold)], fill=(0, 0, 0, 0))
    d.polygon([(W - fold, 0), (W - fold, fold), (W, fold)], fill=(224, 231, 255))

    pad = int(W * 0.13)
    top = int(H * 0.16)
    if badge:
        bw, bh = int(W * 0.36), int(H * 0.11)
        d.rounded_rectangle((pad, top, pad + bw, top + bh), radius=bh // 3, fill=badge_color)
        _text(d, badge, (pad + bw // 2, top + bh // 2), int(bh * 0.62), WHITE)
        top += bh + int(H * 0.07)
    lh = int(H * 0.045)
    widths = [0.74, 0.62, 0.70, 0.48, 0.66, 0.55][:lines]
    for i, f in enumerate(widths):
        y = top + i * int(lh * 2.1)
        d.rounded_rectangle((pad, y, pad + int((W - 2 * pad) * f), y + lh), radius=lh // 2, fill=LINE)

    base = int(H * 0.84)
    d.rounded_rectangle((pad, base, W - pad, base + int(H * 0.012)), radius=4, fill=(165, 180, 252))
    if signed:
        pts = signature_points(pad + W * 0.02, base - H * 0.17, (W - 2 * pad) * 0.92, H * 0.15)
        stroke(d, pts, W * 0.022, INK)
    return img.resize(size, Image.LANCZOS)


_FONT_CACHE = {}


def _font(px):
    from PIL import ImageFont

    if px not in _FONT_CACHE:
        for name in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
            try:
                _FONT_CACHE[px] = ImageFont.truetype(name, px)
                break
            except OSError:
                continue
        else:
            _FONT_CACHE[px] = ImageFont.load_default()
    return _FONT_CACHE[px]


def _text(d, text, center, px, fill):
    f = _font(px)
    box = d.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text((center[0] - w / 2 - box[0], center[1] - h / 2 - box[1]), text, font=f, fill=fill)


def draw_pen(length, angle_deg=-50):
    """Gold fountain-style pen pointing down-left, on transparent background."""
    L = length * SS
    Wd = int(L * 0.16)
    img = Image.new("RGBA", (L, Wd * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cy = Wd
    tip = int(L * 0.18)
    # body
    d.rounded_rectangle((tip, cy - Wd // 2, L - 1, cy + Wd // 2), radius=Wd // 2, fill=GOLD)
    d.rectangle((tip, cy - Wd // 2, tip + Wd // 2, cy + Wd // 2), fill=GOLD)
    # highlight + band
    d.rounded_rectangle((tip + Wd, cy - Wd // 2 + Wd // 8, L - Wd, cy - Wd // 2 + Wd // 4), radius=Wd // 10, fill=(253, 230, 138))
    d.rectangle((int(L * 0.62), cy - Wd // 2, int(L * 0.66), cy + Wd // 2), fill=GOLD_DARK)
    # nib
    d.polygon([(0, cy), (tip, cy - Wd // 2), (tip, cy + Wd // 2)], fill=(31, 41, 55))
    d.polygon([(int(tip * 0.25), cy), (tip, cy - Wd // 4), (tip, cy + Wd // 4)], fill=(209, 213, 219))
    d.line([(int(tip * 0.2), cy), (tip, cy)], fill=(31, 41, 55), width=max(2, Wd // 14))
    img = img.rotate(angle_deg, resample=Image.BICUBIC, expand=True)
    return img.resize((img.width // SS, img.height // SS), Image.LANCZOS)


def draw_photo(size):
    """Polaroid-style landscape photo with a small signature."""
    W, H = size[0] * SS, size[1] * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(W * 0.06)
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=r, fill=WHITE)
    m = int(W * 0.07)
    ph = int(H * 0.68)
    sky = gradient((W - 2 * m, ph), (125, 211, 252), (196, 181, 253)).convert("RGBA")
    mask = Image.new("L", sky.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sky.width - 1, sky.height - 1), radius=r // 2, fill=255)
    img.paste(sky, (m, m), mask)
    sw, sh = sky.size
    ox, oy = m, m
    d.ellipse((ox + sw * 0.66, oy + sh * 0.14, ox + sw * 0.84, oy + sh * 0.14 + sw * 0.18), fill=(253, 224, 71))
    d.polygon([(ox, oy + sh), (ox + sw * 0.30, oy + sh * 0.38), (ox + sw * 0.58, oy + sh)], fill=(16, 185, 129))
    d.polygon([(ox + sw * 0.32, oy + sh), (ox + sw * 0.64, oy + sh * 0.50), (ox + sw, oy + sh * 0.88), (ox + sw, oy + sh)], fill=(5, 150, 105))
    pts = signature_points(W * 0.40, H * 0.80, W * 0.50, H * 0.12)
    stroke(d, pts, W * 0.02, INK)
    return img.resize(size, Image.LANCZOS)


def icon_content(size):
    """Document + pen composition (transparent background), used by every icon variant."""
    S = size
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    doc = draw_document((int(S * 0.50), int(S * 0.64)), signed=True, lines=4)
    dx, dy = int(S * 0.20), int(S * 0.16)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    layer.alpha_composite(doc, (dx, dy))
    canvas.alpha_composite(shadow(layer, S * 0.025, (0, int(S * 0.02)), 110))
    canvas.alpha_composite(layer)
    pen = draw_pen(int(S * 0.52), angle_deg=-48)
    pl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    pl.alpha_composite(pen, (int(S * 0.53), int(S * 0.50)))
    canvas.alpha_composite(shadow(pl, S * 0.015, (int(S * 0.01), int(S * 0.02)), 100))
    canvas.alpha_composite(pl)
    return canvas


def draw_pro_badge(size):
    """Gold crown on a white rounded badge with a PRO ribbon."""
    W = H = size * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=int(W * 0.24), fill=WHITE)
    # crown
    cx, top, bot = W / 2, H * 0.22, H * 0.58
    left, right = W * 0.20, W * 0.80
    pts = [(left, bot), (left, top + H * 0.10), (W * 0.35, top + H * 0.22), (cx, top), (W * 0.65, top + H * 0.22), (right, top + H * 0.10), (right, bot)]
    d.polygon(pts, fill=GOLD)
    d.polygon([(left, bot - H * 0.08), (right, bot - H * 0.08), (right, bot), (left, bot)], fill=GOLD_DARK)
    for x, y in ((left, top + H * 0.10), (cx, top), (right, top + H * 0.10)):
        r = W * 0.05
        d.ellipse((x - r, y - r, x + r, y + r), fill=(253, 224, 71))
    d.ellipse((cx - W * 0.05, bot - H * 0.20, cx + W * 0.05, bot - H * 0.10), fill=(239, 68, 68))
    # ribbon
    d.rounded_rectangle((W * 0.22, H * 0.66, W * 0.78, H * 0.84), radius=int(H * 0.06), fill=INDIGO)
    _text(d, "PRO", (W / 2, H * 0.75), int(H * 0.13), WHITE)
    return img.resize((size, size), Image.LANCZOS)


def draw_share(size):
    """Share graphic: three connected nodes on a soft circle."""
    W = H = size * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, W - 1, H - 1), fill=WHITE)
    a, b, c = (W * 0.68, H * 0.28), (W * 0.30, H * 0.50), (W * 0.68, H * 0.72)
    d.line([a, b, c], fill=(165, 180, 252), width=int(W * 0.05), joint="curve")
    for (x, y), col in ((a, (16, 185, 129)), (b, INDIGO), (c, (239, 68, 68))):
        r = W * 0.11
        d.ellipse((x - r, y - r, x + r, y + r), fill=col)
    return img.resize((size, size), Image.LANCZOS)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print("  ", os.path.relpath(path, ROOT))


# ------------------------------------------------------------------ builds

def build_master():
    S = 1024
    bg = gradient((S, S)).convert("RGBA")
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((-S * 0.3, -S * 0.4, S * 0.8, S * 0.5), fill=(255, 255, 255, 40))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.08)))
    content = icon_content(int(S * 1.06))
    bg.alpha_composite(content, ((S - content.width) // 2 - int(S * 0.04), (S - content.height) // 2 - int(S * 0.06)))
    return bg


def build_android(master):
    print("Android launcher icons")
    densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    # legacy (pre-API 26) icon: rounded square
    for name, k in densities.items():
        px = int(48 * k)
        big = master.resize((px * 4, px * 4), Image.LANCZOS)
        mask = Image.new("L", big.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((px * 0.33, px * 0.33, px * 3.67, px * 3.67), radius=px * 0.7, fill=255)
        out = Image.new("RGBA", big.size, (0, 0, 0, 0))
        out.paste(big, (0, 0), mask)
        save(out.resize((px, px), Image.LANCZOS), os.path.join(RES, f"mipmap-{name}", "ic_launcher.png"))
    # adaptive foreground: 108dp canvas, artwork inside the 66dp safe zone
    fg_master = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    content = icon_content(int(1024 * 0.66))
    fg_master.alpha_composite(content, ((1024 - content.width) // 2, (1024 - content.height) // 2))
    for name, k in densities.items():
        px = int(108 * k)
        save(fg_master.resize((px, px), Image.LANCZOS), os.path.join(RES, f"mipmap-{name}", "ic_launcher_foreground.png"))

    print("Android splash")
    for name, k in {**densities, "ldpi": 0.75}.items():
        px = int(200 * k)
        save(icon_content(px), os.path.join(RES, f"drawable-{name}", "logo.png"))
        bw, bh = int(360 * k), int(640 * k)
        save(gradient((bw, bh), INDIGO, VIOLET), os.path.join(RES, f"drawable-{name}", "background.png"))
    # Android 12+ system splash icon: 288dp canvas, artwork inside the 192dp circle
    canvas = Image.new("RGBA", (1152, 1152), (0, 0, 0, 0))
    c = icon_content(int(1152 * 0.62))
    canvas.alpha_composite(c, ((1152 - c.width) // 2, (1152 - c.height) // 2))
    save(canvas, os.path.join(RES, "drawable-nodpi", "splash_icon.png"))


def build_ios(master):
    print("iOS icons")
    rgb = master.convert("RGB")  # App Store icons must not have alpha
    sizes = {
        "icon-20.png": 20, "icon-20@2x.png": 40, "icon-20@3x.png": 60,
        "icon-29.png": 29, "icon-29@2x.png": 58, "icon-29@3x.png": 87,
        "icon-40.png": 40, "icon-40@2x.png": 80, "icon-40@3x.png": 120,
        "icon-60@2x.png": 120, "icon-60@3x.png": 180,
        "icon-76.png": 76, "icon-76@2x.png": 152, "icon-83.5@2x.png": 167,
        "icon-1024.png": 1024,
    }
    for name, px in sizes.items():
        save(rgb.resize((px, px), Image.LANCZOS), os.path.join(IOS, "AppIcon.appiconset", name))
    print("iOS launch screen")
    for suffix, k in (("", 1), ("@2x", 2), ("@3x", 3)):
        save(gradient((768 * k, 1024 * k)), os.path.join(IOS, "LaunchScreen.AspectFill.imageset", f"LaunchScreen-AspectFill{suffix}.png"))
        canvas = Image.new("RGBA", (384 * k, 512 * k), (0, 0, 0, 0))
        c = icon_content(int(220 * k))
        canvas.alpha_composite(c, ((canvas.width - c.width) // 2, (canvas.height - c.height) // 2))
        save(canvas, os.path.join(IOS, "LaunchScreen.Center.imageset", f"LaunchScreen-Center{suffix}.png"))


def build_splash_illustrations():
    print("In-app splash illustrations")
    save(draw_document((360, 460), badge="PDF", badge_color=(239, 68, 68), signed=True), os.path.join(APP_ASSETS, "doc-pdf.png"))
    save(draw_document((360, 460), badge="DOC", badge_color=(37, 99, 235), signed=True, lines=4), os.path.join(APP_ASSETS, "doc-word.png"))
    save(draw_photo((380, 440)), os.path.join(APP_ASSETS, "photo.png"))
    save(draw_pen(300, angle_deg=-40), os.path.join(APP_ASSETS, "pen.png"))
    # white signature used for the "being written" reveal under the title
    W, H = 720 * SS, 160 * SS
    sig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    stroke(ImageDraw.Draw(sig), signature_points(W * 0.03, H * 0.12, W * 0.94, H * 0.76), W * 0.012, WHITE)
    save(sig.resize((720, 160), Image.LANCZOS), os.path.join(APP_ASSETS, "signature-white.png"))
    save(icon_content(512), os.path.join(APP_ASSETS, "logo.png"))
    save(draw_pro_badge(300), os.path.join(APP_ASSETS, "pro-badge.png"))
    save(draw_share(220), os.path.join(APP_ASSETS, "share.png"))


def build_store(master):
    """Google Play listing graphics: 512x512 hi-res icon and 1024x500 feature graphic."""
    print("Play Store graphics")
    out = os.path.join(ROOT, "store")
    save(master.convert("RGB").resize((512, 512), Image.LANCZOS), os.path.join(out, "play-icon-512.png"))
    W, H = 1024, 500
    fg = gradient((W, H), (67, 56, 202), (109, 40, 217)).convert("RGBA")
    blobs = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blobs)
    bd.ellipse((-120, -160, 300, 260), fill=(255, 255, 255, 22))
    bd.ellipse((820, 300, 1160, 640), fill=(255, 255, 255, 22))
    fg.alpha_composite(blobs)
    # illustration on the right
    photo = draw_photo((190, 220)).rotate(12, resample=Image.BICUBIC, expand=True)
    word = draw_document((180, 230), badge="DOC", badge_color=(37, 99, 235), signed=True, lines=4).rotate(-10, resample=Image.BICUBIC, expand=True)
    pdf = draw_document((210, 268), badge="PDF", badge_color=(239, 68, 68), signed=True)
    pen = draw_pen(150, angle_deg=-40)
    for img, xy in ((photo, (560, 140)), (word, (800, 120)), (pdf, (660, 110)), (pen, (800, 300))):
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer.alpha_composite(img, xy)
        fg.alpha_composite(shadow(layer, 10, (0, 8), 90))
        fg.alpha_composite(layer)
    d = ImageDraw.Draw(fg)
    from PIL import ImageFont
    def font(px, bold=True):
        for name in (("segoeuib.ttf" if bold else "segoeui.ttf"), "arialbd.ttf", "arial.ttf"):
            try:
                return ImageFont.truetype(name, px)
            except OSError:
                continue
        return ImageFont.load_default()
    d.text((60, 120), "DocSigner", font=font(76), fill=WHITE)
    d.text((62, 215), "Sign PDFs, Word docs", font=font(36, False), fill=(221, 214, 254))
    d.text((62, 260), "& photos in seconds", font=font(36, False), fill=(221, 214, 254))
    d.rounded_rectangle((62, 330, 330, 390), radius=30, fill=WHITE)
    d.text((88, 340), "Scan · Sign · Share", font=font(28), fill=(67, 56, 202))
    save(fg.convert("RGB"), os.path.join(out, "feature-graphic-1024x500.png"))


if __name__ == "__main__":
    master = build_master()
    save(master, os.path.join(ROOT, "tools", "icon-master.png"))
    build_android(master)
    build_ios(master)
    build_splash_illustrations()
    build_store(master)
    print("done")
