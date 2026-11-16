"""Cut the launch Reels from real gameplay: No Paddle is out on Google Play.

    node film_gameplay.cjs          # first: films out/clips/*.mp4 from the game
    python make_launch_reels.py     # out/launch-<name>.mp4 and a cover for each
    python make_launch_reels.py oar pirates      # just these
    python make_launch_reels.py --stills         # _stills-launch.png contact sheet

Five Reels, each a different hook in the first second over footage filmed
from the game itself (film_gameplay.cjs), cut on the music's beat, ending on
the game playing on a phone with "Out now on Google Play". 1080x1920, 30 fps,
H.264 + AAC at -14 LUFS. Drawing helpers and the brand come from
make_reels.py, the synthesised music and effects from make_audio.py.
Captions to paste are in captions.txt.
"""
import json
import math
import random
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

import make_audio as A
import make_reels as R
import timeline as TL

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
CLIPS = OUT / "clips"
W, H, FPS = R.W, R.H, R.FPS
INK = (6, 20, 29)


def cut(n):
    """The n-th beat of the music's grid, so cuts land on the beat."""
    return round(TL.MUSIC_T0 + n * TL.BEAT, 3)


# ---------------------------------------------------------------- the Reels
# segs: (clip, from second, to second of the Reel, push-in start, end)
#       a segment ends where the next begins; the last runs to `end`.
# words: (in, out, text, kind). kind "hook" is big at the top, "line" a
#       little smaller, "tag" a small label lower down. [Brackets] are brass.
# end:  when the end card starts; the Reel lasts END_LEN more.
END_LEN = 3.2

REELS = {
    "oar": dict(
        segs=[
            ("squall", 2.6, 0.0, 1.0, 1.10),
            ("squall", 6.0, cut(5), 1.04, 1.12),
            ("irons", 0.2, cut(9), 1.0, 1.06),
            ("irons", 5.0, cut(17), 1.02, 1.10),
        ],
        words=[
            (0.0, cut(5), "A squall just\ntook your [oar].", "hook"),
            (cut(5), cut(9), "No engine.\nNo paddle.\nOnly [the wind].", "hook"),
            (cut(9), cut(13), "Point her into the wind…", "line"),
            (cut(13) - 0.2, cut(17), "…and she stops [dead].", "line"),
            (cut(17), cut(25), "Stuck? Follow\nthe [dolphins].", "hook"),
        ],
        end=cut(25),
    ),
    "upwind": dict(
        segs=[
            ("tack", 0.0, 0.0, 1.0, 1.06),
            ("tack", 3.6, cut(7), 1.03, 1.10),
            ("tack", 12.6, cut(15), 1.05, 1.12),
            ("storm", 0.8, cut(19), 1.0, 1.08),
        ],
        words=[
            (0.0, cut(3), "You can't sail\nstraight into\nthe [wind].", "hook"),
            (cut(3), cut(7), "So how do you\nget home [upwind]?", "hook"),
            (cut(7), cut(15), "[Zig-zag] across it.\nSailors call it\ntacking.", "hook"),
            (cut(15), cut(19), "Every turn, the\nwind takes her\nthe [other side].", "line"),
            (cut(19), cut(24), "Now try it in\na [storm].", "hook"),
        ],
        end=cut(24),
    ),
    "pirates": dict(
        segs=[
            ("pirates", 2.4, 0.0, 1.0, 1.06),
            ("pirates", 4.6, cut(5), 1.02, 1.08),
            ("pirates", 7.4, cut(13), 1.04, 1.10),
            ("kraken", 1.2, cut(18), 1.0, 1.08),
        ],
        words=[
            (0.0, cut(5), "No engine.\nNo oar.\nAnd [pirates].", "hook"),
            (cut(5), cut(13), "Their brig can't\nsail into the wind.\nYou [can].", "hook"),
            (cut(13), cut(18), "Watch the\n[red rings].", "hook"),
            (cut(18), cut(23), "And that's not the\nworst thing [out here].", "line"),
        ],
        end=cut(23),
    ),
    "worlds": dict(
        segs=[
            ("alien", 0.6, 0.0, 1.0, 1.08),
            ("volcano", 1.4, cut(5), 1.0, 1.05),
            ("harbor", 1.4, cut(7), 1.0, 1.05),
            ("jungle", 1.4, cut(9), 1.0, 1.05),
            ("dino", 1.4, cut(11), 1.0, 1.05),
            ("sunken", 1.4, cut(13), 1.0, 1.05),
            ("ghost", 1.4, cut(15), 1.0, 1.05),
            ("aurora", 1.4, cut(17), 1.0, 1.05),
            ("toy", 1.4, cut(19), 1.0, 1.05),
            ("sky", 1.4, cut(21), 1.0, 1.05),
        ],
        words=[
            (0.0, cut(5), "This sailing game\ngets [weird].", "hook"),
            (cut(5), cut(23), "[110] voyages.\n[11] worlds.\n[0] paddles.", "hook"),
            (cut(5), cut(7), "Volcano Isles", "tag"),
            (cut(7), cut(9), "Harbor City", "tag"),
            (cut(9), cut(11), "Jungle Delta", "tag"),
            (cut(11), cut(13), "Dino Lagoon", "tag"),
            (cut(13), cut(15), "Sunken City", "tag"),
            (cut(15), cut(17), "Ghost Sea", "tag"),
            (cut(17), cut(19), "Aurora Ice", "tag"),
            (cut(19), cut(21), "Toy Bay", "tag"),
            (cut(21), cut(23), "Sky Sea", "tag"),
        ],
        end=cut(23),
    ),
    "kraken": dict(
        segs=[
            ("kraken", 0.0, 0.0, 1.0, 1.10),
            ("ice", 0.4, cut(9), 1.0, 1.06),
        ],
        words=[
            (0.0, cut(5), "Rule one: don't\nstop over the\n[bubbles].", "hook"),
            (cut(5), cut(9), "…too [late].", "hook"),
            (cut(9), cut(15), "Or just sail\nwith the [penguins].", "hook"),
        ],
        end=cut(15),
    ),
}


# ---------------------------------------------------------------- text
@lru_cache(None)
def words_img(text, kind):
    """Centred lines with a dark outline, [bracketed] words in brass."""
    size = {"hook": 120, "line": 96, "tag": 50}[kind]
    path = R.FONT_COND if kind == "tag" else R.FONT_HEAD
    f = R.font(path, size)
    stroke = max(4, size // 13)
    lines = text.split("\n")
    lh = int(size * 1.02)
    parts = [[(p, i % 2 == 1) for i, p in enumerate(re.split(r"[\[\]]", line)) if p] for line in lines]
    widths = [sum(f.getlength(p) for p, _ in line) for line in parts]
    img = Image.new("RGBA", (int(max(widths)) + 4 * stroke + 40, lh * len(lines) + size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(parts):
        x = (img.width - widths[i]) / 2
        y = int(size * 0.3) + i * lh + lh // 2
        for p, hi in line:
            colour = R.BRASS if hi else R.FOAM
            d.text((x, y), p, font=f, fill=colour + (255,), anchor="lm", stroke_width=stroke, stroke_fill=INK + (235,))
            x += f.getlength(p)
    img = img.crop(img.getbbox())
    # a soft shadow under it, for busy water
    pad = 30
    out = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sh.paste(INK + (150,), (pad, pad + 8), img)
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))
    out.alpha_composite(img, (pad, pad))
    return out


def draw_words(canvas, t, reel):
    for t0, t1, text, kind in reel["words"]:
        if not (t0 - 0.01 <= t < t1):
            continue
        img = words_img(text, kind)
        # the opening words are already there on the first frame: they're the hook
        u = 1.0 if t0 <= 0 else R.prog(t, t0, 0.32)
        fade = 1 - R.prog(t, t1 - 0.12, 0.12)
        if kind == "tag":
            y = 1290
            R.put(canvas, img, W / 2, y + (1 - R.ease_out(u)) * 24, alpha=R.ease_out(u) * fade)
            continue
        # top band, under Instagram's own row of icons
        y = R.SAFE_TOP + 40 + img.height / 2
        wob = math.sin(u * math.pi * 2) * (1 - u) * 0.10
        R.put(canvas, img, W / 2, y + (1 - R.ease_out(u)) * 40, alpha=R.ease_out(R.prog(u, 0, 0.5)) * fade,
              scale=0.86 + 0.14 * R.ease_back(u), sx=1 - wob, sy=1 + wob)


@lru_cache(None)
def scrim():
    """Darker water behind the words at the top, clear in the middle."""
    g = Image.new("L", (1, H))
    for y in range(H):
        top = max(0.0, 1 - y / 900) ** 1.6 * 175
        bot = max(0.0, (y - 1250) / 670) ** 1.8 * 120
        g.putpixel((0, y), int(top + bot))
    layer = Image.new("RGBA", (W, H), INK + (0,))
    layer.putalpha(g.resize((W, H)))
    return layer


@lru_cache(None)
def out_now_tag():
    """Small and steady at the foot of the picture: what this is and where."""
    size, track = 40, 0.08
    f = R.font(R.FONT_COND, size)
    parts = [("NO PADDLE  ·  ", R.FOAM), ("OUT NOW ON GOOGLE PLAY", R.SIGNAL)]
    adv = lambda ch: f.getlength(ch) + track * size
    tw = sum(adv(ch) for text, _ in parts for ch in text)
    w, h = int(tw) + 64, 76
    ss = 3
    img = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], h * ss // 2, fill=INK + (200,),
                                          outline=R.FOAM + (60,), width=2 * ss)
    img = img.resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    x = 32
    for text, colour in parts:
        for ch in text:
            d.text((x, h // 2 + 1), ch, font=f, fill=colour + (255,), anchor="lm")
            x += adv(ch)
    return img


# ---------------------------------------------------------------- footage
class Footage:
    """Frames of one clip from a second on, read through ffmpeg; holds the
    last frame if the clip runs out."""

    def __init__(self, name, start, size=(W, H)):
        self.size = size
        self.proc = subprocess.Popen(
            ["ffmpeg", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(CLIPS / f"{name}.mp4"),
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.last = None

    def next(self):
        n = self.size[0] * self.size[1] * 3
        buf = self.proc.stdout.read(n)
        if len(buf) == n:
            self.last = Image.frombytes("RGB", self.size, buf)
        return self.last

    def close(self):
        self.proc.stdout.close()
        self.proc.kill()
        self.proc.wait()


def push(img, z, focus=(0.5, 0.55)):
    """Push in by z around a point, back to full size."""
    if z <= 1.001:
        return img
    cw, ch = W / z, H / z
    x0 = R.clamp(focus[0] * W - cw / 2, 0, W - cw)
    y0 = R.clamp(focus[1] * H - ch / 2, 0, H - ch)
    return img.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))


def screen_frame(frame):
    scr = frame.resize((R.SCREEN_W, R.SCREEN_H), Image.BICUBIC).convert("RGBA")
    scr.putalpha(R.screen_mask())
    ph = R.phone_body().copy()
    ph.alpha_composite(scr, (R.BEZEL, R.BEZEL))
    return ph


def end_card(canvas, lt, phone_frame):
    """The game on a phone, out now, and where to get it."""
    R.name_block(canvas, lt, 400, 0.05)
    u = R.ease_out(R.prog(lt, 0.1, 0.55))
    R.paste_phone(canvas, screen_frame(phone_frame), dy=-145 + (1 - u) * 1100,
                  tilt=math.sin(2 * math.pi * lt / 2.4) * 0.6)
    cta = "OUT NOW ON GOOGLE PLAY"
    if lt > 1.4:
        pulse = ((lt - 1.4) / TL.BAR) % 1.0
        R.put(canvas, R.pulse_ring(cta, pulse), W / 2, 1300, alpha=0.5 * (1 - pulse) ** 1.5)
    u3 = R.prog(lt, 0.55, 0.5)
    R.put(canvas, R.pill(cta), W / 2, 1300, alpha=R.clamp(u3 * 2), scale=0.6 + 0.4 * R.ease_back(u3))
    u4 = R.ease_out(R.prog(lt, 0.9, 0.5))
    R.put(canvas, R.text_img("Free  ·  Link in bio", R.FONT_BODY_SB, 46, R.FOAM + (230,)), W / 2,
          1420 + (1 - u4) * 30, alpha=u4)


# ---------------------------------------------------------------- render
def timeline(reel):
    segs = reel["segs"]
    out = []
    for i, (clip, src, start, z0, z1) in enumerate(segs):
        stop = segs[i + 1][2] if i + 1 < len(segs) else reel["end"]
        out.append(dict(clip=clip, src=src, start=start, stop=stop, z0=z0, z1=z1))
    return out


def frames(reel):
    """Every frame of a Reel, in order, as RGB images."""
    segs = timeline(reel)
    dur = reel["end"] + END_LEN
    n = int(round(dur * FPS))
    k, feed = -1, None
    phone = Footage("hud", 0.0, (1280, 720))
    last_game = None
    for i in range(n):
        t = i / FPS
        if t < reel["end"]:
            while k + 1 < len(segs) and t >= segs[k + 1]["start"] - 1e-6:
                k += 1
                if feed:
                    feed.close()
                feed = Footage(segs[k]["clip"], segs[k]["src"])
            s = segs[k]
            u = (t - s["start"]) / max(0.001, s["stop"] - s["start"])
            since = t - s["start"]
            # a little punch on each cut
            punch = 0.035 * math.exp(-since * 14) if k > 0 else 0.0
            frame = push(feed.next(), s["z0"] + (s["z1"] - s["z0"]) * R.ease_in_out(u) + punch)
            c = frame.convert("RGBA")
            c.alpha_composite(scrim())
            if k > 0 and since < 0.12:
                flash = Image.new("RGBA", (W, H), R.FOAM + (int(70 * (1 - since / 0.12)),))
                c.alpha_composite(flash)
            draw_words(c, t, reel)
            if t > 1.6:
                R.put(c, out_now_tag(), W / 2, 1400, alpha=0.95 * R.ease_out(R.prog(t, 1.6, 0.4)) *
                      (1 - R.prog(t, reel["end"] - 0.2, 0.2)))
            last_game = frame
            yield c.convert("RGB")
        else:
            if feed:
                feed.close()
                feed = None
            lt = t - reel["end"]
            c = R.base(t)
            # the last of the voyage fades out behind the card
            if lt < 0.35 and last_game is not None:
                g = last_game.convert("RGBA")
                g.putalpha(int(255 * (1 - lt / 0.35)))
                c.alpha_composite(g)
            end_card(c, lt, phone.next())
            yield c.convert("RGB")
    phone.close()


def render(name):
    reel = REELS[name]
    OUT.mkdir(exist_ok=True)
    path = OUT / f"launch-{name}.mp4"
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", str(path)], stdin=subprocess.PIPE)
    # the cover is the hook: the words and the game a second in
    cover_at = int(1.2 * FPS)
    for i, fr in enumerate(frames(reel)):
        proc.stdin.write(fr.tobytes())
        if i == cover_at:
            fr.save(OUT / f"launch-{name}-cover.jpg", quality=92)
    proc.stdin.close()
    proc.wait()
    add_audio(name, reel, path)
    print("wrote", path)


# ---------------------------------------------------------------- sound
def soundtrack(reel, rng):
    dur = reel["end"] + END_LEN
    mus = A.Track(dur)
    fx = A.Track(dur)
    first_cut = reel["segs"][1][2] if len(reel["segs"]) > 1 else cut(3)
    A.music(mus, dur, first_cut, reel["end"], rng)
    A.sea(mus, 0.05, rng)
    for i, (_, _, start, _, _) in enumerate(reel["segs"]):
        if i:
            A.gust(fx, rng, start - 0.08, 0.4, 0.26)
    for j, (t0, _, _, kind) in enumerate(reel["words"]):
        if kind == "tag":
            continue
        fx.add(t0 + 0.02, A.pop(600 + (j % 4) * 110, 1150 + (j % 4) * 140), 0.24)
    e = reel["end"]
    A.gust(fx, rng, e + 0.05, 0.55, 0.3)
    fx.add(e + 0.6, A.pop(500, 900, 0.12), 0.30)
    fx.add(e + 0.95, A.bell(880.0), 0.11)
    fx.add(e + 1.22, A.bell(880.0), 0.08)
    return A.duck(mus, fx)


def add_audio(name, reel, video):
    rng = random.Random(hash(name) & 0xFFFF)
    wav = OUT / f"_{name}.wav"
    A.write_wav(wav, soundtrack(reel, rng))
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", f"loudnorm={A.LOUD}:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
    af = (f"loudnorm={A.LOUD}:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
          f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
          f":offset={m['target_offset']}:linear=true")
    tmp = OUT / f"_{name}-av.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(wav), "-map", "0:v:0",
                    "-map", "1:a:0", "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", str(tmp)], check=True)
    tmp.replace(video)
    wav.unlink()


def stills():
    """A contact sheet: four moments of each Reel."""
    rows = []
    for name, reel in REELS.items():
        dur = reel["end"] + END_LEN
        want = [0.6, reel["end"] * 0.45, reel["end"] - 0.5, dur - 0.5]
        idx = {int(t * FPS) for t in want}
        shots = []
        for i, fr in enumerate(frames(reel)):
            if i in idx:
                shots.append(fr.resize((270, 480)))
            if len(shots) == len(idx):
                break
        rows.append(shots)
    sheet = Image.new("RGB", (270 * 4, 480 * len(rows)), (0, 0, 0))
    for r, shots in enumerate(rows):
        for c, s in enumerate(shots):
            sheet.paste(s, (c * 270, r * 480))
    sheet.save(HERE / "_stills-launch.png")
    print("wrote", HERE / "_stills-launch.png")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--stills" in sys.argv:
        stills()
    else:
        for name in args or REELS:
            render(name)
