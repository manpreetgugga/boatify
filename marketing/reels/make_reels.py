"""Render the No Paddle teaser Reel (1080x1920, 30 fps, H.264, no audio yet).

    python make_reels.py            # out/teaser.mp4 and out/teaser-cover.png
    python make_reels.py --stills   # _stills-teaser.png, a contact sheet of key frames

Adapted from the Scanaria Reels pipeline (teaser only). Pillow draws every frame
and pipes it to FFmpeg. Inputs come from the repo: the Play phone screenshots
(the game picture is cropped out of their caption frame), the Play icon, the
brand colours in android/.../colors.xml and the game's Barlow fonts.
Run make_audio.py afterwards to add the music and sound effects; re-rendering
here drops them again. Times live in timeline.py.
"""
import math
import random
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

import timeline as TL

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
IMAGES = ROOT / "fastlane" / "metadata" / "android" / "en-US" / "images"
SHOTS = IMAGES / "phoneScreenshots"
FONTS = ROOT / "web" / "fonts"
OUT = HERE / "out"

W, H, FPS = 1080, 1920, 30
SAFE_TOP, SAFE_BOT = 250, 1470      # Instagram UI covers above / below these

# Brand colours (android/app/src/main/res/values/colors.xml)
SEA_DEEP = (11, 42, 60)
SEA = (15, 76, 92)
FOAM = (232, 244, 242)
SIGNAL = (255, 107, 53)
BRASS = (217, 164, 65)

FONT_HEAD = str(FONTS / "barlow-condensed-800i.woff2")
FONT_COND = str(FONTS / "barlow-condensed-700.woff2")
FONT_BODY = str(FONTS / "barlow-400.woff2")
FONT_BODY_SB = str(FONTS / "barlow-600.woff2")

# scripts/store-art.cjs frames each 960x540 (@2x) game shot under a caption band:
# band = round(540*0.19) = 103, h = 415, w = 738, left = 111 -> x2 for the JPEG.
GAME_BOX = (222 + 4, 206 + 4, 222 + 1476 - 4, 206 + 830 - 4)

# landscape phone mockup
SCREEN_W, SCREEN_H = 956, 538
BEZEL = 22
PHONE_W, PHONE_H = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
PHONE_CY = 1020                     # phone centre in the Reel
EYEBROW_Y = 418
TITLE_Y = 560


# ---------------------------------------------------------------- helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(u):
    u = clamp(u)
    return 1 - (1 - u) ** 3


def ease_in_out(u):
    u = clamp(u)
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def ease_back(u, s=1.6):
    u = clamp(u)
    return 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2


def prog(t, start, dur):
    return clamp((t - start) / dur)


@lru_cache(None)
def font(path, size):
    return ImageFont.truetype(path, size)


@lru_cache(None)
def background():
    """The store art's sea: radial #0f4c5c -> #0b2a3c -> #06141d from the top."""
    small = Image.new("RGB", (54, 96))
    p = small.load()
    stops = [(0.0, SEA), (0.55, SEA_DEEP), (1.0, (6, 20, 29))]
    for y in range(96):
        for x in range(54):
            r = math.hypot((x / 54 - 0.5) * 1.1, y / 96 * 0.95)
            r = clamp(r / 1.0)
            for (a, ca), (b, cb) in zip(stops, stops[1:]):
                if r <= b:
                    f = (r - a) / (b - a)
                    p[x, y] = tuple(int(ca[i] + (cb[i] - ca[i]) * f) for i in range(3))
                    break
    return small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))


# wind streaks like the game's: short pale curves drifting downwind
_rng = random.Random(3)
STREAKS = [dict(x=_rng.uniform(-200, W), y=_rng.uniform(0, H), len=_rng.uniform(110, 210),
                life=_rng.uniform(2.2, 3.6), phase=_rng.uniform(0, 4), bend=_rng.uniform(-14, 14))
           for _ in range(22)]
WIND_DIR = math.radians(-14)        # blowing right and a little up


def wind_layer(t):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = math.cos(WIND_DIR), math.sin(WIND_DIR)
    for s in STREAKS:
        k = (t + s["phase"]) / s["life"]
        cycle, u = int(k), k - int(k)
        a = math.sin(math.pi * u) ** 1.5 * 62
        if a < 2:
            continue
        # each life starts somewhere new along a fixed lane, then drifts
        x0 = (s["x"] + cycle * 337) % (W + 300) - 150 + u * 150 * cx
        y0 = (s["y"] + cycle * 211) % H + u * 150 * cy
        pts = []
        for i in range(9):
            f = i / 8
            along = f * s["len"]
            off = math.sin(f * math.pi) * s["bend"]
            pts.append((x0 + along * cx - off * cy, y0 + along * cy + off * cx))
        d.line(pts, fill=FOAM + (int(a),), width=3, joint="curve")
    return layer.filter(ImageFilter.GaussianBlur(1.1))


def base(t):
    c = background().copy().convert("RGBA")
    c.alpha_composite(wind_layer(t))
    return c


@lru_cache(None)
def text_img(text, path, size, color, spacing=1.04, tracking=0.0):
    """Centred multi-line text as RGBA, cropped to its box. tracking is in em."""
    f = font(path, size)
    lines = text.split("\n")
    lh = int(size * spacing)

    def width(line):
        if not tracking:
            return f.getlength(line)
        return sum(f.getlength(ch) for ch in line) + tracking * size * (len(line) - 1)

    widths = [int(width(l)) for l in lines]
    img = Image.new("RGBA", (max(widths) + 80, lh * len(lines) + size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        y = int(size * 0.3) + i * lh + lh // 2
        if not tracking:
            d.text((img.width // 2, y), l, font=f, fill=color, anchor="mm")
        else:
            x = (img.width - widths[i]) / 2
            for ch in l:
                d.text((x, y), ch, font=f, fill=color, anchor="lm")
                x += f.getlength(ch) + tracking * size
    return img.crop(img.getbbox())


def put(canvas, img, cx, cy, alpha=1.0, scale=1.0, sx=1.0, sy=1.0):
    """Paste RGBA img centred at (cx, cy) with an extra opacity and scale (sx/sy squash)."""
    fx, fy = scale * sx, scale * sy
    if alpha <= 0.003 or fx <= 0.01 or fy <= 0.01:
        return
    if abs(fx - 1) > 1e-3 or abs(fy - 1) > 1e-3:
        img = img.resize((max(1, int(img.width * fx)), max(1, int(img.height * fy))), Image.BILINEAR)
    if alpha < 0.997:
        a = img.getchannel("A").point(lambda v: int(v * alpha))
        img = img.copy()
        img.putalpha(a)
    canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def rounded_mask(size, r, ss=3):
    w, h = size
    m = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], r * ss, fill=255)
    return m.resize(size, Image.LANCZOS)


# ---------------------------------------------------------------- phone
@lru_cache(None)
def game_shot(name):
    return Image.open(SHOTS / f"{name}.jpg").convert("RGB").crop(GAME_BOX)


@lru_cache(None)
def phone_body():
    ss = 3
    body = Image.new("RGBA", (PHONE_W * ss, PHONE_H * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle([0, 0, PHONE_W * ss - 1, PHONE_H * ss - 1], 64 * ss, fill=(8, 16, 22, 255),
                        outline=(70, 96, 108, 255), width=3 * ss)
    # camera dot in the left bezel (landscape)
    cx, cy = 11 * ss, PHONE_H * ss // 2
    d.ellipse([cx - 5 * ss, cy - 5 * ss, cx + 5 * ss, cy + 5 * ss], fill=(26, 38, 46, 255))
    return body.resize((PHONE_W, PHONE_H), Image.LANCZOS)


@lru_cache(None)
def screen_mask():
    return rounded_mask((SCREEN_W, SCREEN_H), 42)


@lru_cache(None)
def phone_shadow():
    pad = 70
    s = Image.new("RGBA", (PHONE_W + pad * 2, PHONE_H + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle([pad, pad + 26, pad + PHONE_W, pad + PHONE_H + 26], 64,
                                        fill=(2, 10, 16, 150))
    return s.filter(ImageFilter.GaussianBlur(26))


def phone(name, zoom=1.0, focus=(0.5, 0.5)):
    """The game shot in a landscape phone, pushed in by `zoom` around `focus`."""
    shot = game_shot(name)
    sw, sh = shot.size
    cw, ch = sw / zoom, sh / zoom
    fx = clamp(focus[0] * sw, cw / 2, sw - cw / 2)
    fy = clamp(focus[1] * sh, ch / 2, sh - ch / 2)
    box = (fx - cw / 2, fy - ch / 2, fx + cw / 2, fy + ch / 2)
    scr = shot.resize((SCREEN_W, SCREEN_H), Image.BICUBIC, box=box).convert("RGBA")
    scr.putalpha(screen_mask())
    ph = phone_body().copy()
    ph.alpha_composite(scr, (BEZEL, BEZEL))
    return ph


def paste_phone(canvas, ph, dx=0.0, dy=0.0, tilt=0.0):
    cx, cy = W / 2 + dx, PHONE_CY + dy
    if cx - PHONE_W > W or cx + PHONE_W < 0 or cy - PHONE_H > H:
        return
    sh = phone_shadow()
    canvas.alpha_composite(sh, (int(cx - sh.width / 2), int(cy - sh.height / 2)))
    if abs(tilt) > 0.01:
        ph = ph.rotate(tilt, Image.BICUBIC, expand=True)
    canvas.alpha_composite(ph, (int(cx - ph.width / 2), int(cy - ph.height / 2)))


# ---------------------------------------------------------------- brand bits
@lru_cache(None)
def icon(size):
    ic = Image.open(IMAGES / "icon.png").convert("RGBA").resize((size, size), Image.LANCZOS)
    r = int(size * 0.23)
    ic.putalpha(rounded_mask((size, size), r))
    rim = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle([1, 1, size - 2, size - 2], r, outline=FOAM + (90,), width=3)
    ic.alpha_composite(rim)
    pad = 60
    out = Image.new("RGBA", (size + pad * 2, size + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 18, pad + size, pad + size + 18], r, fill=(2, 10, 16, 150))
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
    out.alpha_composite(ic, (pad, pad))
    return out


@lru_cache(None)
def pill(text, fg=SEA_DEEP, bg=SIGNAL, size=60):
    f = font(FONT_COND, size)
    tw = int(f.getlength(text))
    w, h = tw + 120, int(size * 1.9)
    ss = 3
    img = Image.new("RGBA", (w * ss, h * ss), SIGNAL + (0,))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], 16 * ss, fill=bg + (255,))
    img = img.resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(img).text((w // 2, h // 2 + 1), text, font=f, fill=fg, anchor="mm")
    return img


def headline(canvas, eyebrow, title, alpha, dx=0.0, dy=0.0):
    e = text_img(eyebrow.upper(), FONT_COND, 40, BRASS, tracking=0.16)
    put(canvas, e, W / 2 + dx * 0.8, EYEBROW_Y + dy, alpha)
    t = text_img(title, FONT_HEAD, 112, FOAM, spacing=0.98)
    put(canvas, t, W / 2 + dx, TITLE_Y + dy, alpha)


def name_block(canvas, lt, y, delay):
    u = ease_out(prog(lt, delay, 0.5))
    put(canvas, text_img("No Paddle", FONT_HEAD, 168, FOAM), W / 2, y + (1 - u) * 50, alpha=u)
    u2 = ease_out(prog(lt, delay + 0.3, 0.5))
    put(canvas, text_img("SAIL BY THE WIND", FONT_COND, 46, BRASS, tracking=0.18), W / 2, y + 128 + (1 - u2) * 40,
        alpha=u2)


# ---------------------------------------------------------------- scene parts
def logo_intro(canvas, t, t_out):
    """Icon pops in with an overshoot, the name rises under it; all fades by t_out."""
    fade = 1 - prog(t, t_out - 0.35, 0.35)
    if fade <= 0:
        return
    s = 0.5 + 0.5 * ease_back(prog(t, 0.05, 0.6))
    put(canvas, icon(300), W / 2, 700, alpha=prog(t, 0.05, 0.25) * fade, scale=s)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    name_block(layer, t, 1010, 0.5)
    if fade < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * fade)))
    canvas.alpha_composite(layer)


def word_stack(canvas, t, words, start, step, end, size=210):
    """Words pop in one per beat, stacked and centred, with a squash on landing."""
    fade = 1 - prog(t, end - 0.3, 0.3)
    lh = int(size * 1.0)
    y0 = (SAFE_TOP + SAFE_BOT) / 2 - lh * (len(words) - 1) / 2
    for i, wd in enumerate(words):
        u = prog(t, start + i * step, 0.38)
        if u <= 0:
            continue
        img = text_img(wd, FONT_HEAD, size, FOAM if i < len(words) - 1 else BRASS)
        wob = math.sin(u * math.pi * 2) * (1 - u) * 0.16    # stretch, then squash, then rest
        put(canvas, img, W / 2, y0 + i * lh + (1 - ease_out(u)) * 50, alpha=ease_out(prog(u, 0, 0.5)) * fade,
            scale=0.8 + 0.2 * ease_back(u), sx=1 - wob, sy=1 + wob)


FEATURES = [
    # shot, eyebrow, title, push-in focus (fraction of the game picture)
    ("3-dolphins", "Learn as you sail", "Stuck? Follow\nthe dolphins", (0.5, 0.48)),
    ("6-storm", "Storm Front", "Ride the gusts\nthrough lightning", (0.49, 0.5)),
    ("4-pirates", "Pirate Waters", "Outsail the\npirate brig", (0.48, 0.46)),
    ("8-voyages", "Daily voyage · Regattas · Open Sea", "110 voyages\nin 11 worlds", (0.5, 0.42)),
]


def carousel(canvas, t, items, start, seg, enter=0.65, trans=0.5, exit_at=None):
    """Phones slide sideways between features; headline cross-fades with them.
    Each phone pushes in slowly on its action and rides a gentle swell."""
    lt = t - start
    if lt < 0:
        return
    k = int(lt // seg)
    within = lt - k * seg
    if k >= len(items):
        p = len(items) - 1
    elif k == 0:
        p = 0.0
    else:
        p = k - 1 + ease_in_out(within / trans)
    enter_dy = (1 - ease_out(lt / enter)) * 1300
    exit_dy = 0
    if exit_at is not None and t > exit_at:
        exit_dy = ease_in_out(prog(t, exit_at, 0.55)) * 1400
    head_fade = 1 - prog(t, exit_at - 0.05, 0.3) if exit_at is not None else 1
    bob = math.sin(2 * math.pi * lt / 2.4)
    for i, (shot, eyebrow, title, focus) in enumerate(items):
        d = i - p
        if abs(d) >= 1:
            continue
        # push-in over this screen's time on stage (and a little either side)
        u = clamp((lt - i * seg + 0.3) / (seg + 0.6))
        ph = phone(shot, zoom=1.04 + 0.18 * ease_in_out(u), focus=focus)
        paste_phone(canvas, ph, dx=d * 1150, dy=enter_dy + exit_dy + bob * 7, tilt=bob * 0.7)
        a = clamp(1 - abs(d) * 2.2) * ease_out(lt / 0.5) * head_fade
        headline(canvas, eyebrow, title, a, dx=d * 260)


def end_card(canvas, t, start, cta):
    lt = t - start
    if lt < 0:
        return
    s = 0.5 + 0.5 * ease_back(prog(lt, 0.0, 0.6))
    put(canvas, icon(260), W / 2, 590, alpha=prog(lt, 0, 0.25), scale=s)
    name_block(canvas, lt, 860, 0.25)
    # gentle pulse ring behind the button after it lands, to hold the eye
    if lt > 1.6:
        pulse = ((lt - 1.6) / TL.BAR) % 1.0
        ring = pulse_ring(cta, pulse)
        put(canvas, ring, W / 2, 1150, alpha=0.5 * (1 - pulse) ** 1.5)
    u3 = prog(lt, 0.8, 0.5)
    put(canvas, pill(cta), W / 2, 1150, alpha=clamp(u3 * 2), scale=0.6 + 0.4 * ease_back(u3))
    u4 = ease_out(prog(lt, 1.15, 0.5))
    put(canvas, text_img("by Kpstn Studios", FONT_BODY, 40, FOAM + (190,)), W / 2, 1300 + (1 - u4) * 30, alpha=u4)


def pulse_ring(cta, u):
    """An outline of the button's shape, grown by u (0..1) of a bar."""
    p = pill(cta)
    grow = int(4 + 40 * ease_out(u))
    w, h = p.width + 2 * grow, p.height + 2 * grow
    ss = 3
    img = Image.new("RGBA", (w * ss, h * ss), FOAM + (0,))
    ImageDraw.Draw(img).rounded_rectangle([2 * ss, 2 * ss, (w - 2) * ss, (h - 2) * ss], (16 + grow) * ss,
                                          outline=FOAM + (255,), width=4 * ss)
    return img.resize((w, h), Image.LANCZOS)


# ---------------------------------------------------------------- the reel
def reel_teaser(t):
    c = base(t)
    if t < TL.INTRO_END:
        logo_intro(c, t, TL.INTRO_END)
    if TL.INTRO_END - 0.1 <= t < TL.HOOK_END:
        word_stack(c, t, TL.HOOK, TL.HOOK_START, TL.HOOK_STEP, TL.HOOK_END)
    if TL.CAROUSEL_START - 0.05 <= t < TL.END_START + 0.6:
        carousel(c, t, FEATURES, TL.CAROUSEL_START, TL.SEG, exit_at=TL.CAROUSEL_EXIT)
    end_card(c, t, TL.END_START, "Coming soon on Google Play")
    return c.convert("RGB")


def render():
    OUT.mkdir(exist_ok=True)
    path = OUT / "teaser.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-movflags", "+faststart", str(path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = round(TL.DUR * FPS)
    for i in range(n):
        proc.stdin.write(reel_teaser(i / FPS).tobytes())
        if i % 60 == 0:
            print(f"teaser: {i}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    reel_teaser(TL.COVER_T).save(OUT / "teaser-cover.png")
    print("wrote", path)


def stills(times):
    """Contact sheet; red lines mark Instagram's covered top and bottom."""
    thumbs = []
    for t in times:
        fr = reel_teaser(t)
        d = ImageDraw.Draw(fr)
        for y in (SAFE_TOP, SAFE_BOT):
            d.rectangle([0, y - 3, W, y + 3], fill=(255, 40, 40))
        d.text((20, 20), f"{t:.2f}s", font=font(FONT_COND, 64), fill=(255, 255, 0))
        thumbs.append(fr.resize((360, 640), Image.LANCZOS))
    cols = 5
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (370 * cols - 10, 650 * rows - 10), (0, 0, 0))
    for i, th in enumerate(thumbs):
        sheet.paste(th, ((i % cols) * 370, (i // cols) * 650))
    sheet.save(HERE / "_stills-teaser.png")
    print("wrote", HERE / "_stills-teaser.png")


if __name__ == "__main__":
    if "--stills" in sys.argv[1:]:
        stills([0.5, 1.5, 2.45, 3.5, 4.3, 5.2, 7.0, 8.8, 10.6, 11.1, 11.7, 12.3, 13.2, 14.0, 14.6])
    else:
        render()
