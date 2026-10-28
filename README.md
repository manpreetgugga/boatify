# Boatify

A squall snapped your oar. Now only the wind can carry you from **A** to **B**.

Boatify is a sailing game for Android (and any modern browser). Read the wind,
pick your angle, tack upwind, ride the gusts and get to the harbor without
capsizing, sinking on a reef or getting dragged into a whirlpool.

## Download

Every version is published as a pre-release on the
[Releases page](https://github.com/manpreetgugga/boatify/releases) with a signed
APK. Download `boatify-vX.Y.Z.apk` on your phone, open it and allow installing
from that source. Android 8.0 or newer.

## How to play

| | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag the helm wheel (left thumb) | A / D or ← / → |
| Gust jar | Tap the gust button | Space |
| Sheet in / out (manual trim) | Slider on the right | W / S or ↑ / ↓ |
| Pause | Pause button or back | P or Esc |
| Restart, mute, toggle trim | | R, M, T |

- **The no-go zone.** You can't sail straight into the wind. The red wedge on the wind dial shows where the sail stops working.
- **Beam reach is fastest.** Wind from the side gives the most speed; dead downwind is slower than you'd think.
- **Zig-zag upwind.** Sail about 45° off the wind, then tack through it. Keep speed up or you'll stall "in irons".
- **Watch the heel.** Gusts lean the boat over. Past the red mark you capsize. Ease out or bear away.
- **Read the water.** Dark ruffled patches are gusts, pale glassy water is a lull or an island's wind shadow. Streaks show how the air flows.
- **Daily voyage.** After the first three voyages, a new course is charted every day: the same one for everyone that day. Sail it on consecutive days to build a streak.
- **Race your ghost.** Once you've finished a voyage, a pale ghost boat replays your fastest run, and a chip under the timer says how far ahead or behind you are. Turn it off in Settings.

### Voyages

1. **Lost Oar**: a gentle downwind run home.
2. **Beam Reach Bay**: the fastest point of sail, between islands.
3. **Into the Wind**: home is dead upwind. Learn to tack.
4. **Coral Maze**: find the gaps in the reef walls.
5. **Whirlpool Strait**: currents and a whirlpool in a narrow channel.
6. **Wind Shadow**: tall islands steal your wind.
7. **Storm Front**: squalls, rain and lightning.
8. **Kraken Fog**: night, fog and something in the water.

Finish under the gold time for three stars. Collect pearls, gust jars, repair
crates and messages in bottles along the way.

## Development

Requires Node 18+. No dependencies to install.

```sh
npm start           # play the dev build at http://localhost:5173
npm test            # physics, wind, levels and daily courses (the autopilot sails them), save and bundle tests
npm run build       # dist/index.html: the whole game in one file
npm run smoke       # browser playtest with Playwright (needs Playwright installed)
```

The game is plain JavaScript modules in `web/src`:

- `physics/`: sail aerodynamics and the boat model
- `world/`: game simulation, wind field, water, collisions, voyages, autopilot
- `render/`: canvas renderer (ocean, islands, boat, effects, lighting, HUD)
- `input/`, `audio/`, `ui/`, `platform/`: controls, WebAudio sound, menus, saves and the Android bridge
- `data/levels.js`: the voyages; `data/daily.js`: the daily course generator

### Android

`android/` is a small Kotlin WebView shell. Gradle runs `scripts/build.mjs` to
bundle the game into the APK's assets, so the app works offline.

```sh
cd android
./gradlew assembleRelease   # needs the Android SDK (or let CI build it)
```

CI (`.github/workflows/build.yml`) runs the tests, builds the APK and creates a
pre-release for each new version in `package.json`. See
`android/keystore/README.md` for signing.

## Credits

Barlow and Barlow Condensed fonts by Jeremy Tribby, SIL Open Font License
(`web/fonts/OFL.txt`). Everything else, including the sound, is generated in code.
