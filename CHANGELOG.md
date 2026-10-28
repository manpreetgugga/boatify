# Changelog

## [0.5.0] - 2026-10-28

Into the ice.

- **Voyage 9: Drift Ice.** A snowy channel between two ice shelves. Slabs of drift ice slide back and forth across it with the tide, and a moving floe can ram you. Time your crossings, pass behind a floe, or ease the sail and wait for the gap.
- Each floe shows its path: a dotted track marks the line it swings along, and chevrons, a wake and foam on its leading edge show which way it's going right now. The minimap shows the floes moving too.
- Snow, icebergs and ice shelves: new ice terrain that dents a hull nearly as badly as rock.
- The autopilot (and the title screen demo) reads the drifting ice and waits for a gap instead of sailing into it.
- The arrow to the next buoy no longer sits on top of the arrow to B when both point the same way.
- A voyage you've already finished stays open, even if a new voyage is added before it.

## [0.4.0] - 2026-10-28

Pick your boat.

- **Shipyard.** Three new boats unlock with campaign stars, each handling the wind its own way:
  - **Reed Skiff** (6 ★): light and quick to turn and tack, but it tips over easily and takes more damage from rocks.
  - **Twin Proa** (12 ★): two hulls, so it almost never capsizes and flies on a reach, but it slides sideways upwind and turns slowly.
  - **Lantern Junk** (18 ★): a stout hull and a battened red sail. It points higher into the wind and shrugs off rocks, but it is no sprinter.
- Every boat looks the part: its own colors, twin hulls with a trampoline on the proa, bamboo battens on the junk's sail.
- Choose a boat from the title screen or straight from the briefing. The results card tells you when a new boat is waiting in the Shipyard.
- Ghosts remember which boat set the time and race you in it.
- Sailing dead downwind no longer gybes back and forth: the boom stays put until the wind is clearly on the other side.
- Back from a screen opened on top of the briefing returns to the briefing with the right history.

## [0.3.0] - 2026-10-28

A new sea every day.

- **Daily voyage.** Every day brings a freshly charted course, the same for every sailor that day: random islands, rock fields, wind, and two of currents, a whirlpool, dead calms, a squall or an archipelago. The autopilot test-sails each course before you see it, so it can always be finished, and its time sets the star targets. Opens after the first three voyages.
- **Daily streak.** Finish the daily voyage on consecutive days to build a streak, shown on the title screen, the briefing and the results card. Daily results don't change campaign stars.
- The course is charted a few milliseconds at a time in the background, so the menus never freeze, and it is cached for the rest of the day.
- Your ghost races you on the daily voyage too.
- The results card no longer shows two buttons that both go to Voyages after the last voyage.
- The lock on locked voyages sits in the card's corner instead of wrapping onto its own line.

## [0.2.0] - 2026-10-28

Race yourself.

- **Ghost racing.** Your fastest run of each voyage is recorded and replayed as a pale ghost boat. A chip under the timer shows whether you are ahead or behind it, and the results card compares the run with your best. Toggle it in Settings.
- Wind streaks are now long, gently curling wisps instead of short dashes that looked like rain.
- The wake keeps simulation time: it freezes on pause and its center line is lighter.
- Long voyage names shrink to fit the timer panel instead of running into the star target.
- The results card uses two columns on landscape phones, so every row fits without scrolling.
- The How to sail polar chart no longer clips its labels.

## [0.1.0] - 2026-10-28

First playable release.

- **Sail by the wind.** Your oar is gone: a lift-and-drag sail model with apparent wind, a no-go zone, leeway, heel and capsizing. Tack to go upwind, gybe downwind.
- **Eight voyages** from A to B: Lost Oar, Beam Reach Bay, Into the Wind, Coral Maze, Whirlpool Strait, Wind Shadow, Storm Front and Kraken Fog.
- **Hazards:** rocks and coral reefs, currents, whirlpools, calm patches, island wind shadows, squalls with rain and lightning, fog, night and a kraken.
- **Pickups:** pearls, gust jars (a burst of bottled wind), repair crates and messages in bottles for the Logbook.
- **Instruments:** heading-up wind dial with the no-go cone, speed and VMG to B, sail trim gauge, heel meter, minimap and pointers to B.
- **Controls:** touch helm wheel, gust button and an optional manual sheet slider; keyboard A/D, W/S, Space. Left-handed layout and steering sensitivity settings.
- **Stars and records:** gold and silver times per voyage, best times, pearls, unlocks and a Logbook.
- Synthesized sound and music, haptics, an illustrated How to sail guide, and an autopilot demo on the title screen.
- Android app: offline WebView shell, immersive landscape, back button support, vibration.
