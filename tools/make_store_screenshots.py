"""
Builds Google Play phone screenshots (1080x1920) from raw device captures in store/raw/.

    python tools/make_store_screenshots.py

Each frame: brand gradient, headline + sub-headline, and the app screen inside a phone frame. The status bar and
navigation bar are cropped off the raw capture so no notifications or personal details ever appear.
Edit SHOTS below to change captions/order.
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "store", "raw")
OUT = os.path.join(ROOT, "store", "screenshots")

W, H = 1080, 1920
STATUS_BAR, NAV_BAR = 120, 112  # px on a 1080x2400 capture

# file, headline, sub-headline, gradient (start, end), anchor ('top' | 'bottom' | (y0, y1) crop of the app area)
SHOTS = [
    ("01-home.png", "Sign documents\nin seconds", "PDFs, Word docs & photos in one app", ((67, 56, 202), (124, 58, 237)), "top"),
    ("02-sign-pdf.png", "Sign PDFs\nanywhere", "Drag your signature onto any page", ((79, 70, 229), (37, 99, 235)), "top"),
    ("03-sign-word.png", "Sign Word\ndocuments too", "Real pages, signature exactly where you want", ((37, 99, 235), (14, 165, 233)), "top"),
    ("04-signature.png", "Your signature,\nyour style", "20 ink colours and adjustable thickness", ((109, 40, 217), (192, 38, 211)), "top"),
    ("05-preview.png", "Preview before\nyou send", "Flip through every signed page", ((15, 118, 110), (5, 150, 105)), "top"),
    ("06-signed-sheet.png", "Save anywhere,\nshare instantly", "Downloads, Drive, WhatsApp, email…", ((5, 150, 105), (16, 185, 129)), "bottom"),
    ("07-pro.png", "Go Pro for\nunlimited signing", "No watermark · unlimited Word documents", ((180, 83, 9), (217, 119, 6)), (0, 1500)),
    ("08-help.png", "Help whenever\nyou need it", "Step-by-step guides for every feature", ((79, 70, 229), (124, 58, 237)), "top"),
]


def font(px, bold=True):
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, px)
        except OSError:
            continue
    return ImageFont.load_default()


def gradient(c1, c2):
    g = Image.new("RGB", (W, H))
    px = g.load()
    for y in range(H):
        for x in range(0, W, 4):
            t = (x / W) * 0.35 + (y / H) * 0.65
            col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
            for k in range(4):
                if x + k < W:
                    px[x + k, y] = col
    return g.convert("RGBA")


def app_area(raw_path):
    im = Image.open(raw_path).convert("RGB")
    return im.crop((0, STATUS_BAR, im.width, im.height - NAV_BAR))


def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=r, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def build(fname, headline, sub, grad, anchor):
    src = os.path.join(RAW, fname)
    if not os.path.exists(src):
        print("  skip (missing):", fname)
        return
    canvas = gradient(*grad)
    # soft decorative circles
    deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(deco)
    d.ellipse((-260, -200, 420, 480), fill=(255, 255, 255, 26))
    d.ellipse((760, 1320, 1360, 1920), fill=(255, 255, 255, 22))
    canvas.alpha_composite(deco)

    # headline
    draw = ImageDraw.Draw(canvas)
    hf, sf = font(78), font(36, bold=False)
    y = 92
    for line in headline.split("\n"):
        w = draw.textlength(line, font=hf)
        draw.text(((W - w) / 2, y), line, font=hf, fill=(255, 255, 255))
        y += 92
    w = draw.textlength(sub, font=sf)
    draw.text(((W - w) / 2, y + 14), sub, font=sf, fill=(237, 233, 254))

    # phone with the app screen
    app = app_area(src)
    phone_w = 820
    scale = phone_w / app.width
    screen = app.resize((phone_w, int(app.height * scale)), Image.LANCZOS)
    top = 420
    visible = H - top + 40  # phone may run off the bottom edge
    if anchor == "bottom":
        screen = screen.crop((0, max(0, screen.height - visible), phone_w, screen.height))
    elif isinstance(anchor, tuple):
        y0, y1 = (int(v * scale) for v in anchor)
        screen = screen.crop((0, y0, phone_w, min(y1, screen.height)))
    else:
        screen = screen.crop((0, 0, phone_w, min(visible, screen.height)))

    bezel = 22
    frame = Image.new("RGBA", (phone_w + bezel * 2, screen.height + bezel * 2 + 40), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, frame.width - 1, frame.height + 80), radius=70, fill=(17, 17, 27, 255))
    frame.alpha_composite(rounded(screen.convert("RGBA"), 50), (bezel, bezel))
    # drop shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = (W - frame.width) // 2
    shadow = Image.new("RGBA", frame.size, (10, 8, 40, 110))
    sh.paste(shadow, (x + 6, top + 26), frame.split()[-1])
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(28)))
    canvas.alpha_composite(frame, (x, top))

    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, fname.replace(".png", "-1080x1920.png"))
    canvas.convert("RGB").save(out, optimize=True)
    print("  ", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    print("Play Store screenshots")
    for s in SHOTS:
        build(*s)
