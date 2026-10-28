# No Paddle

A squall snapped your oar. Now only the wind can carry you from **A** to **B**.

No Paddle (first released as Boatify) is a sailing game for Android (and any modern browser). Read the wind,
pick your angle, tack upwind, ride the gusts and get to the harbor without
capsizing, sinking on a reef or getting dragged into a whirlpool.

## Download

Every version is published as a pre-release on the
[Releases page](https://github.com/manpreetgugga/boatify/releases) with a signed
APK. Download `no-paddle-vX.Y.Z.apk` on your phone, open it and allow installing
from that source. Android 8.0 or newer.

## How to play

| | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag the helm wheel (left thumb) | A / D or ← / → |
| Gust jar | Tap the gust button | Space |
| Sheet in / out (manual trim) | Slider on the right | W / S or ↑ / ↓ |
| Pause | Pause button or back | P or Esc |
| Restart, mute, toggle trim | | R, M, T |

- **The no-go zone.** You can't sail straight into the wind. The shaded wedge on the wind dial shows where the sail stops working.
- **Beam reach is fastest.** Wind from the side gives the most speed; dead downwind is slower than you'd think.
- **Zig-zag upwind.** Sail about 45° off the wind, then tack through it. Keep speed up or you'll stall "in irons".
- **Watch the heel.** Gusts lean the boat over. Past the danger mark you capsize. Ease out or bear away.
- **Read the water.** Dark ruffled patches are gusts, pale glassy water is a lull or an island's wind shadow. Streaks show how the air flows.
- **Daily voyage.** After the first three voyages, a new course is charted every day: the same one for everyone that day. Sail it on consecutive days to build a streak.
- **Open Sea.** An endless run east with no harbor at the end. Sail through buoy gates to put time back on the clock (pearls add a little more) while the wind shifts and islands, reefs, currents and whirlpools come thicker the further you go. How far can you get before the clock runs out?
- **Regatta.** Race three rival boats round two marks and into the harbor. Round the marks in order, keep out of the dirty air in a rival's lee, and don't bump into the fleet. Win and the next race steps up from the Club fleet to the Open and then the Championship.
- **Castaways.** On every voyage after the first, someone is clinging to wreckage, waving. Turn into the wind to stop, drift alongside until the ring fills, and they climb aboard. Their weight on the rail means a little less heel and a touch less speed. Bring them home to the harbor and they're rescued, and they're written into your logbook.
- **Shipyard.** Earn stars to unlock the Reed Skiff, Twin Proa and Lantern Junk. Each boat trades speed, upwind ability, stability, agility and toughness differently.
- **Medals.** Twenty-five goals beyond the stars: thread a coral reef without a dent, dodge the kraken, ride with dolphins, escape the pirates without a scratch, cross the ice untouched, find every bottle, sail a week of daily voyages, win a regatta, bring every castaway home. The Medals screen shows how close you are to each one.
- **Sail Locker.** Every medal unlocks a sail design or a hull paint: the Jolly Roger, a rainbow sail, Admiral's Blue, a gilded hull and more. Looks only: they never change how a boat sails.
- **Race your ghost.** Once you've finished a voyage, a pale ghost boat replays your fastest run, and a chip under the timer says how far ahead or behind you are. Turn it off in Settings.
- **Pirates.** On Pirate Waters a square-rigged brig hunts you. It's fast downwind but can't sail close to the wind, so reach across the wind, get upwind, or thread a reef gap too narrow for it. Dodge the cannonballs: a red ring marks where each will land.
- **Sea life.** Dolphins ride your bow wave and push you along if you sail fast enough. Whales spout, dive and breach, sending out a swell that rocks your boat. Flying fish skim past and gulls land on the stern when you stop.
- **Play your way.** Settings has colour-blind friendly colours (blue and orange instead of green and red), a reduce-motion mode (no screen shake or lightning flashes; it follows your phone's setting until you choose), three text sizes, left-handed controls and steering sensitivity.

### Voyages

1. **Lost Oar**: a gentle downwind run home.
2. **Beam Reach Bay**: the fastest point of sail, between islands.
3. **Into the Wind**: home is dead upwind. Learn to tack.
4. **Coral Maze**: find the gaps in the reef walls.
5. **Whirlpool Strait**: currents and a whirlpool in a narrow channel.
6. **Wind Shadow**: tall islands steal your wind.
7. **Storm Front**: squalls, rain and lightning.
8. **Kraken Fog**: night, fog and something in the water.
9. **Drift Ice**: snow, icebergs and floes that drift across the channel.
10. **Pirate Waters**: outsail a pirate brig, or lose it in the reef.

Finish under the gold time for three stars. Collect pearls, gust jars, repair
crates and messages in bottles along the way.

## Development

Requires Node 18+. No dependencies to install.

```sh
npm start           # play the dev build at http://localhost:5173
npm test            # physics, wind, boats, floes, pirates, levels and daily courses (the autopilot sails them), the Open Sea, regattas, castaways, medals, the Sail Locker, accessibility, save and bundle tests
npm run build       # dist/index.html: the whole game in one file
npm run smoke       # browser playtest with Playwright (needs Playwright installed)
```

The game is plain JavaScript modules in `web/src`:

- `physics/`: sail aerodynamics, the boat model and the Shipyard's boat types
- `world/`: game simulation, wind field, water, drifting ice, collisions, voyages, autopilot
- `render/`: canvas renderer (ocean, islands, boat, effects, lighting, HUD)
- `input/`, `audio/`, `ui/`, `platform/`: controls, WebAudio sound, menus, saves and the Android bridge
- `data/levels.js`: the voyages; `data/daily.js`: the daily course generator; `world/opensea.js`: the endless Open Sea; `world/regatta.js`: the regatta course and its fleet; `world/castaways.js`: castaways and hauling them aboard; `data/medals.js`: the medals; `data/locker.js`: the Sail Locker's sails and hull paints

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
