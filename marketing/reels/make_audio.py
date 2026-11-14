"""Original music bed + sound effects for the No Paddle teaser, muxed into out/teaser.mp4.

    python make_audio.py

Adapted from the Scanaria Reels pipeline (teaser only). Everything is
synthesised here: no samples, no licensed music, no downloaded sounds.
Event times come from timeline.py, the same table make_reels.py draws from.

Mix: music and effects are built on separate tracks; the music ducks about
6 dB under each effect (an envelope follower on the effects track), repeated
whooshes vary in pitch and level, and the result is normalised to -14 LUFS
integrated, -1.5 dBTP, with ffmpeg's loudnorm in two passes.
"""
import json
import math
import random
import re
import struct
import subprocess
import wave
from pathlib import Path

import timeline as TL

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SR = 44100
BEAT = TL.BEAT

# i - VI - III - VII in D minor (Dm Bb F C), one bar each: a sea-going lift
CHORDS = [
    [50, 53, 57, 62],
    [46, 53, 58, 62],
    [48, 53, 57, 60],
    [48, 52, 55, 60],
]
ROOTS = [38, 34, 41, 36]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def bar_of(t):
    return math.floor((t - TL.MUSIC_T0) / TL.BAR) % 4


class Track:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = [0.0] * self.n

    def add(self, start, samples, gain=1.0):
        i0 = int(start * SR)
        b = self.buf
        for k, s in enumerate(samples):
            i = i0 + k
            if 0 <= i < self.n:
                b[i] += s * gain


def db(x):
    return 10 ** (x / 20)


# ---------------------------------------------------------------- instruments
def pluck(freq, dur=0.42):
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-t * 9) * min(1.0, t * 400)
        ph = 2 * math.pi * freq * t
        out.append(env * (math.sin(ph) + 0.35 * math.sin(2 * ph) + 0.12 * math.sin(3 * ph)))
    return out


def bass(freq, dur):
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1.0, t * 200) * math.exp(-t * 2.2) * min(1.0, (dur - t) * 40)
        x = math.sin(2 * math.pi * freq * t)
        out.append(env * math.tanh(1.8 * x))
    return out


def kick():
    n = int(0.32 * SR)
    out, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 48 + 110 * math.exp(-t * 35)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 11))
    return out


def hat(rng):
    n = int(0.06 * SR)
    out, prev = [], 0.0
    for i in range(n):
        x = rng.uniform(-1, 1)
        hp = x - prev  # crude high-pass
        prev = x
        out.append(hp * math.exp(-i / SR * 70))
    return out


def pad(track, start, end, level):
    """Soft detuned-saw chords through a one-pole low-pass, bar by bar."""
    i0, i1 = int(start * SR), min(track.n, int(end * SR))
    y = 0.0
    a = 1 - math.exp(-2 * math.pi * 900 / SR)
    b = track.buf
    for i in range(i0, i1):
        t = i / SR
        s = 0.0
        for m in CHORDS[bar_of(t)]:
            f = hz(m)
            s += ((t * f) % 1.0) * 2 - 1
            s += ((t * f * 1.004) % 1.0) * 2 - 1
        y += a * (s / 8 - y)
        fade = min(1.0, (t - start) / 1.2, max(0.0, (end - t) / 1.5))
        b[i] += y * level * fade


def sea(track, level, rng):
    """Surf: low-passed noise that swells and falls like waves on a hull."""
    y1 = y2 = 0.0
    a = 1 - math.exp(-2 * math.pi * 520 / SR)
    b = track.buf
    dur = track.n / SR
    for i in range(track.n):
        t = i / SR
        x = rng.uniform(-1, 1)
        y1 += a * (x - y1)
        y2 += a * (y1 - y2)
        swell = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(2 * math.pi * t / 3.6 - 1.2)) ** 2
        fade = min(1.0, t / 0.5, max(0.0, (dur - t) / 1.2))
        b[i] += y2 * 3.0 * swell * fade * level


def music(track, dur, drums_from, drums_to, rng):
    pad(track, 0.0, dur, 0.22)
    pls = {}
    k = 0
    while True:  # 8th-note arpeggio on the bar grid
        t = TL.MUSIC_T0 + k * BEAT / 2
        if t > dur - 1.2:
            break
        notes = CHORDS[bar_of(t)]
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        m = notes[pat[k % 8]] + 12
        if m not in pls:
            pls[m] = pluck(hz(m))
        g = 0.10 if (k % 2 == 0) else 0.07
        track.add(t, pls[m], g)
        k += 1
    k = 0
    while True:
        t = TL.MUSIC_T0 + k * BEAT
        if t >= drums_to:
            break
        if t >= drums_from - 1e-6:
            track.add(t, bass(hz(ROOTS[bar_of(t)]), BEAT * 0.9), 0.20)
            if k % 2 == 0:
                track.add(t, kick(), 0.55)
            track.add(t + BEAT / 2, hat(rng), 0.10)
        k += 1


# ---------------------------------------------------------------- sound effects
def whoosh(rng, dur=0.42, pitch=1.0):
    """Wind gust: band-passed noise with the filter sweeping up."""
    n = int(dur * SR)
    out, lp, lp2 = [], 0.0, 0.0
    for i in range(n):
        u = i / n
        env = math.sin(math.pi * u) ** 2
        cut = (400 + 3500 * u) * pitch
        a = 1 - math.exp(-2 * math.pi * cut / SR)
        x = rng.uniform(-1, 1)
        lp += a * (x - lp)
        lp2 += a * (lp - lp2)
        out.append((lp - lp2) * env * 2.2)
    return out


def gust(tr, rng, t, dur=0.42, gain=0.30):
    """A whoosh with a little pitch and level variation, so repeats don't sound stamped."""
    tr.add(t, whoosh(rng, dur, rng.uniform(0.85, 1.15)), gain * db(rng.uniform(-1.5, 1.5)))


def pop(f0=700, f1=1300, dur=0.09):
    n = int(dur * SR)
    out, ph = [], 0.0
    for i in range(n):
        u = i / n
        ph += 2 * math.pi * (f0 + (f1 - f0) * u) / SR
        out.append(math.sin(ph) * (1 - u) ** 2 * min(1.0, i / 60))
    return out


def bell(f=880.0, dur=1.6):
    """Ship's-bell strike: inharmonic partials, the high ones dying first."""
    n = int(dur * SR)
    parts = [(1.0, 1.0, 3.2), (2.0, 0.5, 4.5), (2.76, 0.35, 6.0), (5.4, 0.15, 9.0)]
    out = []
    for i in range(n):
        t = i / SR
        s = sum(g * math.exp(-t * d) * math.sin(2 * math.pi * f * r * t) for r, g, d in parts)
        out.append(s * min(1.0, i / 40))
    return out


# ---------------------------------------------------------------- the reel
def teaser(rng):
    dur = TL.DUR
    mus = Track(dur)
    fx = Track(dur)
    music(mus, dur, TL.DRUMS_FROM, TL.DRUMS_TO, rng)
    sea(mus, 0.05, rng)
    # logo: icon pops, the name rises on a soft gust
    fx.add(0.08, pop(450, 900, 0.14), 0.32)
    gust(fx, rng, 0.45, 0.6, 0.14)
    # hook: one rising pop per word, on the beat
    for i in range(len(TL.HOOK)):
        fx.add(TL.HOOK_START + i * TL.HOOK_STEP, pop(650 + i * 120, 1200 + i * 150), 0.26)
    # carousel: phone rises, slides on each downbeat, drops away
    gust(fx, rng, TL.CAROUSEL_START, 0.55, 0.35)
    for k in range(1, TL.SCREENS):
        gust(fx, rng, TL.CAROUSEL_START + k * TL.SEG - 0.04)
    gust(fx, rng, TL.CAROUSEL_EXIT, 0.5)
    # end card: icon pop, then two bell strikes as the button lands
    fx.add(TL.END_START + 0.05, pop(500, 900, 0.12), 0.30)
    fx.add(TL.END_START + 0.85, bell(880.0), 0.11)
    fx.add(TL.END_START + 1.12, bell(880.0), 0.08)
    return duck(mus, fx)


def duck(mus, fx, depth_db=-6.0, thresh=0.25):
    """Sidechain-style: an envelope follower on the effects dips the music."""
    att = 1 - math.exp(-1 / (0.005 * SR))
    rel = 1 - math.exp(-1 / (0.30 * SR))
    env = 0.0
    out = [0.0] * mus.n
    for i in range(mus.n):
        x = abs(fx.buf[i])
        env += (att if x > env else rel) * (x - env)
        g = db(depth_db * min(1.0, env / thresh))
        out[i] = mus.buf[i] * g + fx.buf[i]
    return out


def write_wav(path, buf):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for s in buf:
            v = int(max(-1.0, min(1.0, math.tanh(s * 1.2))) * 30000)
            frames += struct.pack("<hh", v, v)
        w.writeframes(bytes(frames))


LOUD = "I=-14:TP=-1.5:LRA=11"


def build():
    rng = random.Random(7)
    buf = teaser(rng)
    wav = OUT / "_teaser.wav"
    write_wav(wav, buf)
    # pass 1: measure
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", f"loudnorm={LOUD}:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
    # pass 2: normalise with the measured values, linear so the dynamics stay
    af = (f"loudnorm={LOUD}:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
          f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
          f":offset={m['target_offset']}:linear=true")
    video = OUT / "teaser.mp4"
    tmp = OUT / "_teaser-av.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(wav),
                    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                    "-af", af, "-ar", "48000",
                    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(tmp)],
                   check=True)
    tmp.replace(video)
    wav.unlink()
    print("measured", m["input_i"], "LUFS ->", "audio added:", video)


if __name__ == "__main__":
    build()
