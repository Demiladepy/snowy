# Intro and end title cards in the site's brand style (white dotted canvas, dart, red accent).
import math, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = pathlib.Path(__file__).parent / "build"
OUT.mkdir(exist_ok=True)
W, H = 1920, 792
INK, MUTED, RED, DOT = (25, 25, 25), (120, 119, 116), (229, 56, 59), (226, 225, 222)
F = "C:/Windows/Fonts/"


def font(name, size):
    return ImageFont.truetype(F + name, size)


def canvas():
    img = Image.new("RGB", (W, H), "white")
    glow = Image.new("RGB", (W, H), "white")
    gd = ImageDraw.Draw(glow)
    gd.ellipse((1150, -150, 2100, 650), fill=(255, 232, 231))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img = Image.blend(img, glow, 0.9)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 26):
        for y in range(0, H, 26):
            d.ellipse((x, y, x + 2, y + 2), fill=DOT)
    return img


def dart(img, cx, cy, scale):
    """Dart pointing down-left, like the logo: tip, steel barrel, red shaft, red flights."""
    layer = Image.new("RGBA", (int(64 * scale), int(64 * scale)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = scale
    P = lambda pts: [(x * s, y * s) for x, y in pts]
    d.polygon(P([(32, 61), (31.2, 46), (32.8, 46)]), fill=(154, 160, 166))
    d.rounded_rectangle((29.4 * s, 31 * s, 34.6 * s, 47 * s), radius=2.4 * s, fill=(190, 193, 197))
    for y in (34, 37, 40, 43):
        d.rectangle((29.4 * s, y * s, 34.6 * s, (y + 0.9) * s), fill=(111, 116, 122))
    d.rounded_rectangle((31 * s, 15 * s, 33 * s, 32 * s), radius=1 * s, fill=(216, 38, 44))
    d.polygon(P([(32, 3), (42, 13), (32, 21)]), fill=(255, 75, 71))
    d.polygon(P([(32, 3), (22, 13), (32, 21)]), fill=(200, 23, 29))
    layer = layer.rotate(-45, resample=Image.BICUBIC, expand=False)
    img.paste(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)), layer)


def board(img, cx, cy):
    d = ImageDraw.Draw(img)
    for r, label, hot in [(260, "v1", 0), (205, "2021-03-25", 0), (150, "2023-05-03", 0), (98, "2025-02-19", 1), (46, "2026", 0)]:
        if hot:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 241, 240))
            for a in range(0, 360, 6):  # dashed red ring
                a0, a1 = math.radians(a), math.radians(a + 3.5)
                d.line([(cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))], fill=RED, width=3)
        else:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(233, 233, 231), width=2)
        d.text((cx, cy - r + 22), label, font=font("consola.ttf", 17), fill=MUTED, anchor="mm")


def intro():
    img = canvas()
    board(img, 1450, 400)
    dart(img, 1560, 290, 4.2)
    d = ImageDraw.Draw(img)
    dart(img, 190, 165, 0.9)
    d.text((232, 165), "Pinned", font=font("segoeuib.ttf", 40), fill=INK, anchor="lm")
    d.text((160, 300), "Your apiVersion is a promise.", font=font("segoeuib.ttf", 76), fill=INK, anchor="ls")
    d.text((160, 395), "Pinned reads the ", font=font("segoeuib.ttf", 76), fill=INK, anchor="ls")
    w = d.textlength("Pinned reads the ", font=font("segoeuib.ttf", 76))
    d.text((160 + w, 395), "fine print.", font=font("segoeuib.ttf", 76), fill=RED, anchor="ls")
    d.text((160, 475), "A version-aware code reviewer for Sanity, built on Sanity Context.", font=font("segoeui.ttf", 32), fill=MUTED, anchor="ls")
    d.rounded_rectangle((160, 540, 760, 600), radius=30, outline=(233, 233, 231), width=2, fill="white")
    d.text((190, 570), "Sanity Challenge · Path One", font=font("segoeuib.ttf", 26), fill=INK, anchor="lm")
    img.save(OUT / "intro.png")


def outro():
    img = canvas()
    d = ImageDraw.Draw(img)
    dart(img, W / 2, 175, 2.2)
    d.text((W / 2, 340), "Some contradictions in the docs are just versions.", font=font("segoeuib.ttf", 62), fill=INK, anchor="mm")
    d.text((W / 2, 420), "Pinned keeps them apart.", font=font("segoeuib.ttf", 62), fill=RED, anchor="mm")
    d.rounded_rectangle((W / 2 - 330, 495, W / 2 + 330, 565), radius=35, fill=INK)
    d.text((W / 2, 530), "pinned-snowy.vercel.app", font=font("segoeuib.ttf", 32), fill="white", anchor="mm")
    d.text((W / 2, 625), "github.com/Demiladepy/snowy  ·  Sanity project mttzxmvf  ·  Built on Sanity Context", font=font("segoeui.ttf", 26), fill=MUTED, anchor="mm")
    img.save(OUT / "outro.png")


intro()
outro()
print("cards ok")
