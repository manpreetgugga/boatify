# Changelog

## [0.31.0] - 2026-10-30

A racing line for the regatta.

- **Follow the gold line.** Every regatta now shows a course you can really sail, from the start round mark 1 and mark 2 and into the harbor. Upwind you can't sail straight at the mark, so the line zig-zags up the beat, and the next place to tack is ringed and marked TACK.
- **The leg you're on stands out.** It's drawn bright, with its dashes running on toward the mark, from the point nearest your boat. The legs after it are faint, and stray off the line and a thin thread leads back to it.
- **On the minimap too,** so you can see the whole course at a glance.
- The line keeps clear of the islands and rocks. It's worked out from the prevailing wind, so when the wind shifts, sail by the wind and use the line as your guide.

## [0.30.0] - 2026-10-30

A reason to sail: the way home.

- **The prologue opens on home.** A small lighthouse isle at dawn: a cottage with smoke from the chimney, the lamp lit, and someone on the jetty with a lantern, waiting. Then it cuts to you far out at sea, rowing for it, before the squall takes your oar. The chart at the end marks home, ten voyages away, and the title card reads "Only the wind, and the way home."
- **Home Waters is the way home.** Its panel counts down the voyages left, with a dot for each one sailed, and the last voyage, Pirate Waters, now ends at home itself, past Skull Rock.
- **A homecoming.** Reach it and the results read "Home at last. The lamp was lit all along, and someone was waiting." Then the wider seas call, starting with Volcano Isles.
- The briefing now says "Reach home at B" for that voyage, and Lost Oar and Into the Wind say where they really go: the first harbor and the lighthouse.

## [0.29.0] - 2026-10-29

Quicker sailing.

- **Everything on the water runs 30% faster.** The boat, the wind, the gusts, the pirates and the Open Sea clock all keep their balance with each other, so every voyage plays the same, just quicker. Star times are kept on the game's own clock, so a voyage takes less real time.
- **A livelier speed dial.** Hit the best angle and the dial now reads 25 knots in a fresh breeze and 30 in a strong one, and the wind reading rises to match. Distances, Open Sea records and medals are unchanged.
- **A softer sea at speed.** The wind and the bow wave are now a low, smooth rush that rises and falls with the swell, instead of a loud hiss, and the whistle in the rigging is gone.
- The prologue film still plays at its own pace.

## [0.28.0] - 2026-10-29

The ads are on, in the Android app: Google AdMob, with the same gentle rules as before.

- **Videos that pay.** In the Shop, **Watch** a short video for a black pearl, three times a day. A failed Open Sea run can be saved with a video for a second wind, three times a day too. Close a video early and nothing is paid.
- **The ad between voyages** starts after Home Waters, every three voyages, only as you move on from the results (never on Retry) and never within four minutes of another ad.
- **Your choice first.** Where the law asks for it, Google's consent form comes up before any ad loads, and **Settings → Ad privacy** opens it again.
- The game still plays offline; only the ads need the internet. The privacy policy now names AdMob and what it collects.
- For builders: `AdsBridge.kt` in the Android app, Google's test ads unless the Play bundle is given the real AdMob ids, and Kotlin 2.3. [docs/MONETIZATION.md](docs/MONETIZATION.md) has the details.

## [0.27.0] - 2026-10-29

A reason to come back every day: the harbourmaster's orders.

- **Three orders a day.** Once the daily voyage opens, the new Orders board on the title screen has three small jobs from the harbourmaster, the same for everyone and new at midnight. One is easy, like setting sail three times or collecting fifteen pearls. One asks for good sailing: three stars twice, two voyages without a bump, or a best time beaten. One sends you somewhere: bring a castaway home, sail through eight Open Sea gates, finish a regatta in the top three, or ride with the dolphins.
- **Paid on the spot.** Each order pays 50 to 100 coins the moment it's done, and finishing all three opens the harbourmaster's chest, with a black pearl inside. The results card shows the orders a voyage finished and how far it took the rest.
- **One swap a day.** Don't fancy an order? Swap it for another of its kind, once a day.
- **Fixes.** On a phone held sideways, the results card puts the stars beside the heading and the pay on one line, so the orders and new medals fit, and new medals scroll into view when they pop up.

## [0.26.0] - 2026-10-29

Ads only: nothing in the game will ever be sold for money.

- **No purchases.** The black pearl packs and the No ads purchase are gone from the Shop. Black pearls come from the sea, and later from a video, a few a day.
- **Ads, when they come,** are the video for a black pearl, the video for an Open Sea second wind, and the short ad between voyages, with the same gentle rules as before. All of it stays switched off until the ads SDK is in the Android app.
- The bridge to the app is now `BoatifyAds`, for ads alone; [docs/MONETIZATION.md](docs/MONETIZATION.md) has the details.

## [0.25.0] - 2026-10-29

Ready for ads between voyages, done gently, and a way to turn them off. Like the rest of the store, it's all switched off until the ads and billing SDKs are in the Android app, so nothing changes for players yet.

- **An ad between voyages.** Once switched on, a short ad plays after every three voyages, as you move on from the results. It never interrupts sailing and never holds up a Retry. Home Waters is free of them, so the first comes three voyages into the Volcano Isles, and there's never one within four minutes of another ad, a video for black pearls included. If no ad is loaded, the game just carries on.
- **No ads.** A one-time purchase in the Shop ends the ads between voyages for good, and comes back after a reinstall. Buying any black pearls ends them too. Videos for black pearls stay, since they only play when you ask for one.
- **Fixes.** On a phone held sideways, the Shop's Boats group no longer shows an empty heading once every boat is yours.
- [docs/MONETIZATION.md](docs/MONETIZATION.md) covers the `no_ads` product, the interstitial and the `breakReady()` bridge flag.

## [0.24.0] - 2026-10-29

The last three worlds and thirty more voyages: the frozen north, a bay full of toys and a sea up in the clouds. That makes a hundred voyages beyond Home Waters.

- **Aurora Ice.** Green and violet northern lights ripple across the sky, brightest at night. Glaciers rise out of the sea with crevasses, meltwater pools and seals on their edges, and polar bears prowl the big ones. On the tundra there's an igloo, a stone inukshuk and reindeer grazing among the berries. Chunks of ice float in the water, icebergs drift on the tide, and a black fin circles until the orca breaches.
- **Toy Bay.** A bathtub-blue bay where the islands are giant toy bricks with studs on top, and sandcastles stand with moats, towers and pennants. Beach balls and loose bricks bob in the water, soap bubbles float by, and giant rubber ducks drift on the tide. A jack-in-the-box plays its tune while the crank turns, then the lid flies open and out springs the clown.
- **Sky Sea.** The water is up in the clouds. Cloud banks with rainbows, floating isles with cottages, sheep and a waterfall pouring off the edge, hot-air balloons and little cloud puffs. Airships cruise up and down the sky with their lamps lit at night, clouds drift overhead with their shadows below, and thunderclouds darken, flicker and then strike with lightning all round.
- **New castaways.** Olga, Skipper Sven and Dr. Frost in Aurora Ice; Captain Quack, Teddy and Pip in Toy Bay; Amelia, Professor Nimbus and Skye on the Sky Sea.
- **Three new medals.** Polar Star, Toy Admiral and Cloud Captain are for finishing every voyage in a world. They unlock the Aurora sail, the Rubber Duck hull paint and the Nimbus sail.
- Penguins now ride icebergs and stand on glaciers.

## [0.23.0] - 2026-10-29

Four more worlds and forty more voyages: a jungle river, a lagoon from the age of dinosaurs, a drowned city and a haunted sea.

- **Jungle Delta.** A brown river runs out to sea between jungle isles thick with canopy, flowers and macaws. Mangroves stand on their roots in the water, lily pads float in the shallows, and drowned trees lie just under the surface. Hippos wallow on the tide, and some of the logs have eyes: a crocodile waits in its pool and snaps its jaws when the ring turns red. The monsoon brings rain, and on Firefly Night the air is full of blinking lights.
- **Dino Lagoon.** Fern isles with eggs in their nests and long-necked sauropods wading through the ferns, and red cliffs where pterosaurs wheel overhead. Giant ribs and bones stick out of the water, sea turtles drift on the current, and a plesiosaur rises out of the deep with its long neck and snapping jaws.
- **Sunken City.** You sail over the streets of a drowned city. Broken columns stand up to the surface, stone heads stare up from the shallows, and the round tops of towers with copper domes show above the water. Galleys row up and down the lanes, with rowers at the oars and eyes painted on the bow. In the city gate, a giant eel waits in its doorway and lunges.
- **Ghost Sea.** Grey water and green lanterns. Islands of graves and dead trees, with bats and drifting mist, and the wrecks of the ships that ran into them. Broken masts stick out of the water, ghost ships with no crew glide through the mist, and wisps gather on the water before a wraith bursts out.
- **New castaways.** Tomas, Amara and Professor Lim in the Jungle Delta; Rex, Dr. Petra Stone and Ugg in Dino Lagoon; Marina, Old Theo and Nerissa in the Sunken City; Wilhelmina, Captain Bones and Lantern Lou on the Ghost Sea.
- **Four new medals.** River Pilot, Fossil Hunter, Atlantean and Spirit Sailor are for finishing every voyage in a world. They unlock the Canopy sail, the Fossil hull paint, the Mosaic sail and the Phantom hull paint.
- **Fireflies and wisps.** Some waters now have little blinking lights that wander over the sea, brighter at night.
- **Fixes.** Penguins only ride ice floes now, not hippos, jellies or rafts.

## [0.22.0] - 2026-10-29

Three new worlds with thirty new voyages, black pearls, and pinch to zoom.

- **Worlds.** After Pirate Waters the campaign carries on into three new worlds of ten voyages each. Finishing the last voyage of a world opens the first voyage of the next. The Voyages screen has a tab for each world showing your stars there, and the briefing lists that world's hazards by name.
- **Volcano Isles.** Black rock, warm water and falling ash. Volcano cones smoke, with lava running down their sides, and some isles are black basalt. Vents steam, then boil, then blow: when the water starts to boil, get out of the ring. Pumice rafts drift on the tide, and a lava flow walls off the sea with a single gap. Mount Ember is the last voyage.
- **Harbor City.** Quays stacked with coloured containers, with bollards and dock workers who wave as you sail past. Gantry cranes swing containers out over the water and drop them inside a ring. City ferries carry passengers on deck, trail smoke from their funnels and cross your course on the tide. There are also breakwaters, a river current, fog, the docks at night and a smugglers' brig.
- **Planet Zeta.** A violet sea with glowing crystal isles. On the fungus islands, eyes on stalks follow you as you sail past and sometimes blink. Giant pink jellies drift on the tide. There are gravity wells, patches of air too thin to fill a sail, and beasts that rise from below with glowing eyes and a mouth full of teeth. The Mother Beast sleeps under the last voyage.
- **New castaways.** Pyra, Basil and Cole in the Volcano Isles; Dot, Marco and Ines in Harbor City; Zib, Captain Nova and Blorp on Planet Zeta.
- **Three new medals.** Fire Walker, Harbor Master and Star Sailor are for finishing every voyage in a world. They unlock the Lava Flow sail, the Harbor Pilot hull paint and the Nebula sail.
- **Black pearls.** Diamonds are now black pearls: rare dark pearls in an oyster shell, still found near whirlpools, krakens and pirates. Any diamonds you had are now black pearls. The Shop lists a handful, a pouch and a chest of black pearls; buying them is still switched off.
- **Pinch to zoom.** While sailing, spread two fingers to zoom in and pinch them together to zoom out. When you let go, the view snaps to the nearest zoom step and remembers it. Steering with one thumb while trimming with the other doesn't zoom.
- **Fixes.** Tips no longer cover the zoom button, and when two pointers point the same way they no longer sit on top of each other.
- Harbor talk only mentions voyages in worlds you have reached.

## [0.21.0] - 2026-10-29

Coins for sailing, rare diamonds, and a Shop.

- **Coins.** Every voyage now pays: coins for finishing, for each star (more for a star you hadn't won before), for pearls and rescued castaways, for the first time you finish a voyage, for each medal, and for the daily voyage and your streak. The Open Sea pays for distance and for each buoy gate, and a regatta pays for your place. The results screen lists what you earned, and your purse shows on the title screen, the Shop and the Sail Locker.
- **Diamonds.** They're rare, and they lie where the danger is. Every voyage with a whirlpool, a kraken or a pirate brig hides one diamond near it: just outside a whirlpool's eye, over the kraken's lair, or off the pirates' cove. Pick it up and finish the voyage to keep it, once per voyage. The briefing says whether a voyage has one and whether you've brought it home, and the voyage list marks the ones you have. On the Open Sea a whirlpool sometimes guards one too.
- **The Shop.** A new button on the title screen. Buy gust jars, trade a diamond for 150 coins, unlock boats early with diamonds, and find the new sails and paints. Buying diamonds and watching a video for one aren't switched on yet, and say "Coming soon".
- **Second wind.** When an Open Sea run ends, spend two diamonds for 30 more seconds and a patched hull, and sail on from where you were. Once per run.
- **Gust jars from the hold.** Jars you buy go in the hold, and up to three come aboard each voyage. You only lose the ones you use.
- **Sails and paints for coins.** A Royal Purple sail, a sunset sail and a diamond-dust sail, and Ocean, Cherry and Ebony hull paints, in the Sail Locker.
- **Boats for diamonds.** Locked boats in the Shipyard can be unlocked with diamonds instead of waiting for the stars: the Reed Skiff for 5, the Twin Proa for 10, the Lantern Junk for 15 and the Grand Galleon for 25.
- **Ready for the store.** The game can speak to Google Play Billing and a rewarded-video SDK once the Android app adds them. Nothing is sold and there are no ads in this version. docs/MONETIZATION.md describes how to switch them on.
- **Big purchases ask first.** Anything that costs diamonds, and every sail or paint, shows its price and asks you to confirm. A gust jar is a single tap.

## [0.20.0] - 2026-10-29

A ship as big as the pirates', and a closer look.

- **The Grand Galleon.** A fifth boat in the Shipyard, unlocked at 24 stars. She's as long as the pirate brig, with three masts of square sail, a quarterdeck with a ship's wheel, gun ports along both sides, stern lanterns and a long bowsprit. She's heavy: slow to get going, slow to turn and slow to stop, so she carries her way through lulls and calms. She's the toughest boat in the yard, so rocks and cannonballs hurt her far less, and she's nearly impossible to tip over. She doesn't point as high as the small boats. Her yards swing round to the wind as you trim, and the sails fill and flap like the others.
- **Zoom.** A magnifier button at the top of the screen, next to the timer, steps the view through Far, Normal, Close and Closer, with dots showing which one you're on. The same setting is in Settings under "View". On a keyboard, + and - zoom in and out, and so does the mouse wheel.
- **Sails on the right side.** Every boat drew its sail on the side the wind comes from. Sails now swing away from the wind, the way real ones do, and the skipper hikes out on the correct side.
- **Shipyard** shows the bigger boat scaled down to fit its card.

## [0.19.0] - 2026-10-29

A skipper on deck, and islands full of life.

- **Your skipper.** A sailor in a yellow jacket and red hat now sails with you. He sits at the tiller while you steer, with his hand on it as it swings. Leave the helm alone for a few seconds and he wanders up the deck, round the mast: to the bow to shade his eyes and look out, to the mast to haul on a halyard, or to lean on the rail. When you're going slowly he fishes over the stern, and now and then he lands one and holds it up. Steer and he runs back to the tiller. Heel her over and he sits out on the high side, and when you tack he ducks under the boom and crosses over. He cheers every pearl and every castaway you pick up, cheers at the bow when you reach the harbor, and if she capsizes he's in the water beside her until she's back up. The rival boats in a regatta and the boat in the Shipyard have a helmsman too.
- **Green islands.** The sandy islands now have patches of light and dark grass, tufts, meadows of white, yellow, pink and violet wild flowers, bushes (some in flower) and broadleaf trees. Their beaches have shells, pebbles, starfish, driftwood and marram grass where the sand meets the green. The rocky islands have moss, lichen, scrub and cushions of pink sea thrift.
- **Island animals.** Crabs scuttle sideways along the shore, busier when you sail close. Goats graze inland in little herds, with kids skipping after their mothers, and lift their heads to watch you go by. Parrots (scarlet, green and blue) perch in the palms and fly between them, and take off when you come close. Gulls stand about on the rocks.
- **Turtles and seals.** Sea turtles doze on the beaches and seals bask in groups on the rocks. Sail close and fast and they slip into the sea and swim about (the turtles dive and come up for air), staying out while you're near and hauling themselves out again once you've gone. The first time you see them a tip says so.

## [0.18.0] - 2026-10-29

Steer with your thumb, a clearer screen, and penguins.

- **Steer with your thumb.** The helm wheel is gone. Put your thumb down anywhere on the left and a ring appears right under it, with a dot that follows your thumb. Slide right to turn right and left to turn left, and let go to sail straight. Where your thumb lands doesn't turn the boat, only how far you slide. Until you first steer, a pulsing ring shows where to touch.
- **A clearer instrument panel.** The bottom panel is smaller and shows just what you need: a compass that turns with your boat, with the wind arrow and the no-go wedge on it, then the wind, your speed and your heading in big numbers. The little boat in the middle of the compass turns amber and then red as you heel towards a capsize. The trim bar, heel meter, Beaufort scale and VMG are gone.
- **Penguins on the ice.** Huddles of penguins stand at the water's edge on every ice shelf and berg, and a few ride the big drifting floes. They turn to watch you sail by. Sail close and fast and they belly-slide into the sea, porpoise about and hop back out. Gulls circle over some huddles and stand among others, facing into the wind.

## [0.17.0] - 2026-10-29

Ready for Google Play.

- **Android 16.** The app now targets Android 16 (API 36), which Google Play requires for new apps. It's marked as a game, so tablets and foldables keep it in landscape.
- **A bundle for the store.** Each release can carry the Play bundle (`.aab`) next to the APK, signed with your Play upload key once it's added to the repository's secrets. The APK keeps the same key as before, so it still installs over older versions and keeps your progress.
- **Store listing.** The title, short and full description, release notes, the 512 px icon, the feature graphic and eight screenshots each for phones and 7-inch and 10-inch tablets, all drawn from the game itself (`npm run store-art`).
- **Privacy policy.** `PRIVACY.md`: the game collects nothing, makes no network connections and keeps your progress on your phone.
- **Publishing guide.** `docs/PLAY_STORE.md` goes step by step through signing up for Play Console, making the upload key, the closed test and every form Play asks you to fill in.

## [0.16.0] - 2026-10-28

Follow the dolphins.

- **Dolphin hints.** If you're stuck head to wind with the sail flapping, or sailing well off away from B, three dolphins now surface off your bow on the side you should turn to. Then they swim off the way to go, leaping, with a dashed line of foam curving from your bow to them. "This way!" pops up over them. The first time on each voyage a message says what to do.
- **Where the way comes from.** It's the same chart the autopilot sails by, so the dolphins tack you upwind and lead you round islands and reefs, not straight at B.
- **Follow them or not.** Follow them up to speed and they stay to ride your bow wave. Ignore them and they swim off, and won't come back for twenty seconds.
- **When they stay away.** They don't come when you've stopped head to wind on purpose next to a castaway. They don't come when you've turned off course to fetch one, or to run from a pirate brig.
- **Settings** has a new "Dolphin hints" switch. They're off while the autopilot sails.
- **The prologue** shows the hint at work. Stuck in irons, the dolphins come up and swim off across the wind. She follows them onto the reach, "Follow the dolphins across it, and she flies.", and they ride her bow.
- **Title screen fits on a phone.** On a landscape phone, a two-line piece of harbor talk pushed the top and bottom of the title screen off the edges. It's tighter on short screens now, and with large text it scrolls rather than cutting anything off.
- The README has screenshots.

## [0.15.0] - 2026-10-28

Curiosity: what's out there?

- **Voyage teasers.** Each voyage you haven't sailed yet has a line on its card hinting at what's out there, instead of "Not sailed yet" or "Finish the last voyage". Kraken Fog's says "Fishermen won't say what lives in this fog." and Pirate Waters' says "A black flag was seen behind Skull Rock." Tapping a locked voyage names the voyage you have to finish first.
- **Secret medals.** Thirteen medals are now secrets until you reach the waters they're won in. Until then the Medals screen shows "???" and a riddle, such as "Something with too many arms waits in the fog. Don't shake hands." The header counts how many are still secret. Earning one early breaks its seal too. In the Sail Locker, gear behind a secret medal says "A secret medal", and tapping it gives the riddle.
- **Harbor talk.** The title screen passes on one rumor each time you see it, always about something you haven't found yet: a voyage not yet sailed, a secret medal, a boat the shipwright is building and how many stars it costs, or a castaway still waving from a plank. Once you've found everything there is to find, it repeats old sailors' sayings instead.
- A livelier tagline on the title screen.

## [0.14.0] - 2026-10-28

The prologue: a short film before the first voyage.

- **The prologue.** The first launch now opens on a film, letterboxed with captions, before any menu. It's dawn, and a sloop is rowing out of harbor in a flat calm. A squall comes in with rain and thunder, a sea knocks the oar out of its oarlock, and it splashes down astern. The rest of the film shows what the wind does: point her into it and the sail flaps and she stops, with the no-go wedge drawn over the water. Turn her across it and she flies, with the fastest angles marked in green and dolphins coming to ride the bow wave. Then the chart lays a dotted course from her to B, past the reefs, the whirlpools, the squalls and a fog marked "?", and the title card hands you the helm.
- **Take the helm** goes straight to How to sail and then your first voyage. **Skip** (or Back) goes to the title screen. Either way the film won't play again on its own. Players who already have voyages in their logbook go straight to the title screen as before.
- **Prologue** on the title screen plays the film again. It's highlighted until you've seen it.
- The film runs on the real boat, wind and weather, with the camera and helm scripted. It has new sounds: the oar's creak and stroke, the knock when it's lost and the splash when it lands.

## [0.13.0] - 2026-10-28

Castaways: no one left behind.

- **Castaways.** Every voyage after the first now has a sailor adrift on a broken plank: Old Tomas in Beam Reach Bay, Little Pip in the Coral Maze, Captain Okafor in the Storm Front, and more. The daily voyage has one too. Ripples pulse around them, an SOS pointer shows where they are when they're close, and a white dot blinks on the minimap.
- **Hauling them aboard.** You have to stop alongside, and you have no oar. Turn up into the wind to slow down and drift into the ring around them. A green arc fills as you haul them in. Come in too fast and the ring turns yellow with SLOW DOWN, and they shout that they can't grab the line.
- Once aboard they sit in the cockpit, or on the net of the Twin Proa, and say thank you. A chip under the hull bar shows how many are aboard. Their weight on the rail heels the boat less but makes it a touch slower.
- Bring them into the harbor and they're rescued. The results card names who you brought home. The briefing and pause screens show who is still adrift. The Logbook keeps a page of every sailor you've rescued and what they said.
- New medals: **Lifeline** (rescue three castaways) unlocks the Lifebuoy sail, and **No One Left Behind** (bring every voyage's castaway home) unlocks Rescue Orange hull paint. That makes twenty-five.

## [0.12.0] - 2026-10-28

Regatta: race the fleet.

- **Regatta.** A new race mode, unlocked with the daily voyage. Race three rival boats round two marks and into the harbor: Petrel in a red-sailed sloop, Marlin in a yellow-sailed skiff and Squall in a blue junk. Every regatta is a fresh course with its own wind.
- Round the marks in order. Mark 2 doesn't count until you've rounded mark 1, and the harbor doesn't count until you've rounded both.
- **Dirty air.** Every sail leaves a wind shadow downwind of it, drawn as a faint dark fan on the water. Sail into one and you lose up to a quarter of your wind. A DIRTY AIR chip warns you while you're in it.
- Boats that touch push apart and lose speed. The rivals steer clear of a boat under their bow, but it's up to you to steer round them.
- The HUD shows your place in the fleet, which mark is next and the race clock. Each rival's name floats over its boat in its sail color and shows on the minimap. You get a call-out when you gain or lose a place, and a note when a rival finishes.
- Win a race and the fleet steps up from Club to Open, then Championship. The briefing shows your fleet, the rivals and your record. The results card shows the finishing order with everyone's time.
- New medal: **Line Honours** (win a regatta). It unlocks the Regatta Stripes sail. That makes twenty-three.
- Fixed: when the hull gave out, the message said "+15 s" but no time was ever added. The message no longer mentions a penalty.

## [0.11.0] - 2026-10-28

The Open Sea, and a sail you can see.

- **Open Sea.** A new endless mode, unlocked with the daily voyage. There's no B: sail east for as long as the clock lasts. Each buoy gate you sail between puts the next leg's time back on the clock, and each pearl adds two seconds. Miss a gate and you lose its time. The run ends when the clock runs out or the hull gives out, and your score is how far east you got.
- The sea is charted as you go, so every run is different. It starts gentle, and the further out you sail the more islands, reefs, calms, currents and whirlpools you meet. Dolphins and whales turn up too. Every minute or so the wind shifts, and it never settles dead on the nose for long. Gates give back less time the further you go, so every run ends sooner or later.
- On the HUD a countdown replaces the voyage timer. It turns red and ticks over the last ten seconds. A GATE pointer shows the way, and the minimap scrolls along with you.
- The Voyages screen has an Open Sea card with your furthest run, and its briefing shows your records. The results card shows your distance, gates, pearls and time at sea, and marks a new best.
- New medal: **Far Horizon** (sail 1.5 km in one Open Sea run). It unlocks the Compass Rose sail. That makes twenty-two.
- **A sail you can see.** From straight above, the sail was only a thin sliver. Now it leans out over the water as a full triangle with a shadow underneath. It swings as you trim and fills out more when it's pulling hard, so you can see what the wind is doing to your boat.
- The demo boat behind the title screen picks better courses. It had been overestimating its speed with the wind on the beam.

## [0.10.0] - 2026-10-28

The Sail Locker, and a bigger boat.

- **Bigger boat.** Your boat is drawn about a quarter larger on screen, so it's easier to follow on a phone. The camera sits a little closer too. Its hull for bumping into things is the same size, so every voyage sails exactly as before.
- **Sail Locker.** Every medal now unlocks a new look: eleven sail designs and ten hull paints. Fly the Jolly Roger after escaping the pirates, a rainbow sail for collecting every pearl, or gild your hull by finishing a voyage in every boat. Open it from the Shipyard. The designs change only how your boat looks, never how it sails, and they fit every boat.
- Sails hang on the locker wall so you can see the whole design; hull paints show on your boat. Locked ones show which medal earns them.
- The results card tells you when a new medal puts something in the locker, and each medal on the Medals screen names its reward. The Shipyard button lights up when there's something new to try on.
- The gull now lands on the stern of the bigger boat, not in the cockpit.

## [0.9.0] - 2026-10-28

Pirates, and a new name.

- **Boatify is now called No Paddle.** New name on the title screen, the phone's home screen and the release downloads. It's the same app underneath, so the update installs over the old one and keeps your progress.
- **New voyage: Pirate Waters.** A pirate brig lurks behind Skull Rock. Sail too close and it gives chase. Its square sails make it fast downwind, but it can't point within seventy degrees of the wind and it's slow on a beam reach. Keep the wind on your beam to outrun it, get upwind of it, or slip through the narrow gap in the reef, where its deep hull can't follow.
- **Cannon fire.** In range, the brig fires broadsides from its side and a bow gun straight ahead. A red ring on the water marks where each cannonball will land, so you can dodge. A hit dents the hull, and so does getting rammed.
- While a pirate is chasing you, the camera pulls back to show it, a red arrow points to it when it's off screen, and it shows as a red dot on the minimap. A dashed ring shows how far its guns reach.
- New medal: **Clean Getaway** (escape a pirate chase without taking a hit). That makes twenty-one.
- New sounds for the alarm bell, cannon fire, splashes and hits.

## [0.8.0] - 2026-10-28

Sea life.

- **Dolphins.** Pods roam several voyages. Sail past one at five knots or more and the dolphins swim up to ride your bow wave, giving the boat a steady push for about fourteen seconds. Slow down and they lose interest. A chip under the timer shows how much longer they'll stay.
- **Whales.** On Whirlpool Strait, Wind Shadow and Drift Ice a humpback cruises, spouts, dives, then breaches. A ring of rising bubbles warns you a few seconds before it comes up. The splash sends out a swell that shoves and rocks any boat it rolls under, and a whale landing on top of you dents the hull.
- **Flying fish** skim away from your bow when you're going fast, and a **gull** lands on the stern when you sit still for a while. Gulls also circle the harbour at B.
- Two new medals: **Bow Rider** (ten seconds with dolphins in one voyage) and **Whale Watcher** (see a breach up close without being hit). That makes twenty.
- A short tip the first time you meet dolphins or a whale, shown ahead of any queued tips.
- New sounds for dolphin clicks and whistles, whale spouts and breaches, and passing swells, with a buzz on phones.

## [0.7.0] - 2026-10-28

Play your way.

- **Colour-blind friendly colours.** A new setting swaps the game's green, yellow and red for blue, yellow and orange, which stay apart for every kind of colour vision. It covers the sail and heel meters, the hull bar, the in-irons warning on the wind dial, the kraken's ring and the warning toasts.
- **Reduce motion.** No screen shake, no lightning flashes, and lighter rain and snow. It follows your phone's own reduce-motion setting until you pick one yourself.
- **Text size.** Normal, Large or Largest for menus, tips, briefings and messages in bottles.
- Settings are grouped into Sound and feel, Sailing, Seeing and reading, and Progress.
- Help text no longer leans on colour names ("the red wedge"), so it reads right in either palette.

## [0.6.0] - 2026-10-28

Medals.

- **Eighteen medals** to earn beyond the stars. Some come from a single voyage: thread a coral reef without a dent, earn three stars and leave every gust jar shut, ride out the squalls without capsizing, slip past the kraken, cross the drift ice untouched, or beat your best time by five seconds. Others build up over time: finish every voyage, collect every pearl, find every bottle, unlock and sail every boat, keep a seven-day daily streak, sail 25 km.
- A new **Medals** screen on the title shows each medal, the day you earned it, and a progress bar for the ones still to come. A dot on the button means there's a new one to see.
- New medals pop up on the results card with their own fanfare.
- Players with progress from earlier versions get the medals they've already earned when the game starts.
- Tips now wait their turn instead of stacking up, so they no longer cover the arrow to B. The kraken's strike warning shows in red and never waits.

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
