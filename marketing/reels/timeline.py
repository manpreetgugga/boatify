"""One timeline for the No Paddle teaser, shared by make_reels.py and make_audio.py
so the picture and the sound can't drift apart.

The music runs at 133.33 BPM: a beat is 0.45 s and a bar 1.8 s, exactly one
feature screen. MUSIC_T0 shifts the bar grid so the carousel's cuts and the end
card land on downbeats.
"""
DUR = 14.7            # seconds
COVER_T = 13.2        # end card, settled

INTRO_END = 2.0       # logo intro 0 .. 2.0
HOOK = ["Only", "the", "wind."]
HOOK_START = 2.2      # first word, on a beat
HOOK_STEP = 0.45      # one word per beat
HOOK_END = 4.0

CAROUSEL_START = 4.0  # 4 screens x 1.8 s
SEG = 1.8
SCREENS = 4
CAROUSEL_EXIT = 10.95  # phone drops away
END_START = 11.2      # end card 11.2 .. 14.7

BPM = 400 / 3         # 133.33
BEAT = 60 / BPM       # 0.45
BAR = 4 * BEAT        # 1.8
MUSIC_T0 = 0.4        # a bar starts here, so 4.0 and 11.2 are downbeats
DRUMS_FROM = CAROUSEL_START
DRUMS_TO = END_START
