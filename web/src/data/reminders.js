// Reminders the phone shows at 9 am, 6 pm and 9 pm. The Android shell
// schedules them and draws one at random each time from the ones that fit
// the hour (platform/native.js hands it this list on every launch).
//
// at: only at that time of day; without it, any time.
// needs: 'open' once the daily voyage, orders, Open Sea and regatta are open
// (the first three voyages sailed), 'new' only before then.
// {next} is the next voyage to sail; a line with it is left out once every
// voyage is sailed.

import { isDailyUnlocked } from '../platform/save.js';

export const REMINDER_TIMES = [
  { hour: 9, minute: 0, at: 'morning' },
  { hour: 18, minute: 0, at: 'evening' },
  { hour: 21, minute: 0, at: 'night' },
];

export const REMINDERS = [
  // Any time of day.
  { title: 'The wind is up', text: 'A fresh breeze is blowing, and your boat is waiting at the quay.' },
  { title: 'Fair winds, skipper', text: 'The tide has turned. Time to cast off?' },
  { title: 'Where to next?', text: '{next} is charted and waiting for you.' },
  { title: 'Next on the chart', text: '{next}. The wind is right for it.' },
  { title: 'Your voyage home', text: '{next} is the next leg. Every voyage brings you closer.' },
  { title: 'Someone is adrift', text: 'A castaway was seen waving from a raft. Can you bring them home?' },
  { title: 'Pearls on the water', text: 'Pearls are glinting in the swell. Go and scoop them up.' },
  { title: 'Black pearls', text: 'They lie where the danger is: by whirlpools, krakens and pirates. Feeling brave?' },
  { title: 'The dolphins are back', text: 'A pod is riding the bow waves. Sail with them for a while.' },
  { title: 'Read the water', text: 'Dark ruffled water means wind, glassy water means none. Go and find a gust.' },
  { title: 'No paddle, no problem', text: 'Only the wind, and the way home.' },
  { title: 'Beat your ghost', text: 'The pale ghost of your best run is still out there. Can you leave it behind?' },
  { title: 'Three stars?', text: 'One more go might be the one that wins gold.' },
  { title: 'Gold is close', text: 'Shave a few seconds off a voyage and the third star is yours.' },
  { title: 'The shipwright is busy', text: 'New boats are on the slipway. Win stars to sail them.' },
  { title: 'A new sail?', text: 'The Sail Locker has sails and paints to buy with your coins.' },
  { title: 'The kraken stirs', text: 'Something big is moving under the water. Keep clear of its ring.' },
  { title: 'Pirates sighted', text: 'A black flag behind the rocks. Stay out of cannon range.' },
  { title: 'Mind the whirlpool', text: 'Ride its edge and it slings you on. Get too close and it pulls you in.' },
  { title: 'Sail by the wind', text: "Can't sail straight at the mark? Tack, and zig-zag up the wind." },
  { title: 'Tip from the harbor', text: 'Ease the sail before the gust, not after it.' },
  { title: 'Tip from the harbor', text: 'Nobody ever sailed straight into the wind. Nobody.' },
  { title: 'Tip from the harbor', text: 'Slow boats steer badly. Keep some speed on and the rudder bites.' },
  { title: 'Tip from the harbor', text: 'Heeling too far? Ease the sail out or turn away from the wind.' },
  { title: 'Tip from the harbor', text: 'To pick up a castaway, slow right down and come alongside.' },
  { title: 'Gust jars', text: 'Keep a jar of bottled wind for the moment the breeze dies.' },
  { title: 'A message in a bottle', text: 'Something is bobbing in the waves. Who sent it?' },
  { title: 'Your boat is tugging', text: 'It has been pulling at its mooring line all day. Take it out?' },
  { title: 'The lighthouse is lit', text: "Follow its beam. There's a harbor at the end of it." },
  { title: 'Gulls overhead', text: 'An old sailor swears the gulls know where the gusts are. He won\'t say how.' },
  { title: 'Land ho!', text: 'New islands are on the chart. Go and see what lives there.' },
  { title: 'Secret medals', text: 'Some medals are secret. The harbor folk drop hints about them.' },
  { title: 'A new medal?', text: "You're closer to the next medal than you think." },
  { title: 'Wind shift!', text: 'The wind has swung round. Courses that were hard yesterday might not be today.' },
  { title: 'A clean run', text: 'Can you bring a voyage home without a single bump?' },
  { title: 'Over she goes', text: 'Even the best skippers capsize now and then. Try again?' },
  { title: 'Ten worlds', text: 'Ten worlds lie past Home Waters. How far have you sailed?' },
  { title: 'Volcano Isles', text: 'Black rock, warm water and ash that falls like snow. Keep clear of anything glowing.' },
  { title: 'Harbor City', text: 'Quays stacked with containers, and dock workers who wave as you sail past.' },
  { title: 'Planet Zeta', text: 'A violet sea and glowing crystal isles. Eyes on stalks follow you about.' },
  { title: 'Jungle Delta', text: 'A brown river runs out to sea between the jungle isles. Listen for the macaws.' },
  { title: 'Dino Lagoon', text: 'Long necks above the ferns, and eggs in the nests. Sail softly.' },
  { title: 'Sunken City', text: 'You sail over the streets of a drowned city. Mind the columns.' },
  { title: 'Ghost Sea', text: 'Grey water and green lanterns. Something is watching from the mist.' },
  { title: 'Aurora Ice', text: 'Green and violet lights ripple across the sky, and penguins ride the floes.' },
  { title: 'Toy Bay', text: 'Islands of giant toy bricks, and sandcastles on the beaches.' },
  { title: 'Sky Sea', text: 'The water is up in the clouds, with sheep on the floating isles.' },
  { title: 'Home is waiting', text: 'The lamp is lit, and someone is watching for your sail.' },
  { title: 'Lost?', text: 'When you lose your way, the dolphins will show you which way to turn.' },
  { title: 'Hold on to your hat', text: 'Gusty weather out there. Ease the sail when the dark water hits.' },
  { title: 'Steady westerly', text: 'A steady wind on the beam. Perfect for a fast reach.' },
  { title: 'Wind behind you', text: 'Running downwind is easy. Gybing is not. Take it gently.' },
  { title: 'Upwind is a puzzle', text: 'Can you reach the mark in fewer tacks than last time?' },
  { title: 'Penguins!', text: 'They ride the ice floes in Aurora Ice. Try not to bump them off.' },
  { title: 'Your logbook', text: 'The notes from the bottles you find go in your logbook. Add a page today.' },
  { title: 'Stars add up', text: 'Every star you win brings a new boat closer.' },
  { title: 'Coins for every voyage', text: 'Every voyage pays, and more for each new star. Spend them in the Shop.' },
  { title: 'The Grand Galleon', text: 'Three masts of square sail, as big as the pirate brig. Win stars to sail her.' },
  { title: 'The Twin Proa', text: 'Two hulls and almost impossible to capsize. It flies on a reach.' },
  { title: 'The Lantern Junk', text: 'A teak hull under a battened red sail. It points higher into the wind.' },
  { title: 'The Reed Skiff', text: 'Light, twitchy and quick through a tack. Can you keep it upright?' },
  { title: 'Rescue mission', text: 'Every castaway you bring home joins your crew. Who is still out there?' },
  { title: 'The current is running', text: 'A current across your path can push you off course, or carry you home.' },
  { title: 'A narrow channel', text: 'Two islands nearly meet. Can you thread the gap without a scrape?' },
  { title: 'Calm patch ahead', text: 'Glassy water, no wind. Sail round it, or bring a gust jar.' },
  { title: 'Treasure in the deep', text: 'The black pearls are waiting, right where the danger is.' },
  { title: 'Look sharp', text: 'Rocks off the point. Give them a wide berth and keep your paint.' },
  { title: 'A good day to sail', text: 'The wind is fair and the sea is kind. What are you waiting for?' },
  { title: 'Free black pearl', text: 'In the Shop, a short video gets you a black pearl, three times a day.' },
  { title: 'Show off your sail', text: 'A new sail colour from the Sail Locker. Let the fleet see it.' },
  { title: 'Personal best', text: 'Your best time on a voyage is only a gust away from beaten.' },
  { title: 'The fleet is out', text: 'Every boat in the harbor is out on the water. Yours too?' },
  { title: 'Sea legs', text: 'A few minutes on the water, and the wind does the rest.' },
  { title: 'The squall has passed', text: 'Blue sky and a good breeze. Time to get going.' },
  { title: 'Find the gap', text: 'A wall of rock right across the sea, and only one way through.' },
  { title: 'Bring them home', text: 'A castaway is clinging to a raft somewhere out there. Go and look.' },
  { title: 'Fast on a reach', text: 'Wind on the side of the boat is the fastest point of sail. Find it.' },
  { title: 'Tacking duel', text: 'Every tack costs speed. Make each one count.' },
  { title: 'Trim to win', text: 'Feeling expert? Trim the sail by hand in Settings for every last knot.' },
  { title: 'The harbor is quiet', text: 'Everyone else is out sailing. Join them.' },
  { title: 'Ahoy!', text: 'Your crew is aboard and the sail is ready. Just say the word.' },

  // Before the first three voyages are sailed.
  { title: 'The voyage home', text: 'Your way home has only just begun. Let the westerly carry you on.', needs: 'new' },
  { title: 'Three voyages in', text: 'Sail the first three voyages and the daily voyage, the Open Sea and the regatta open.', needs: 'new' },
  { title: 'Learn the ropes', text: 'Tacking, gybing, trimming. A few voyages and you will sail like an old hand.', needs: 'new' },
  { title: 'The squall took your oar', text: 'But the wind is still blowing. Sail on.', needs: 'new' },
  { title: 'A regatta is coming', text: 'Three rival boats are waiting for a fourth. Sail three voyages to join them.', needs: 'new' },
  { title: 'The first harbor', text: 'The first harbors are close. Bring a few voyages home and the sea opens up.', needs: 'new' },

  // Once the daily voyage and the rest are open.
  { title: "Today's voyage", text: "A new course was charted at sunrise. Sail it before it's gone.", needs: 'open' },
  { title: 'Fresh orders', text: "Three new orders are on the harbourmaster's board. Coins on the spot.", needs: 'open' },
  { title: 'Keep your streak', text: "Sail today's daily voyage and keep your run of days going.", needs: 'open' },
  { title: 'The Open Sea', text: 'How far east can you sail? Nobody has found the end yet.', needs: 'open' },
  { title: 'Gates on the horizon', text: 'On the Open Sea the clock is ticking, and every gate buys more time.', needs: 'open' },
  { title: 'Regatta today', text: 'Petrel, Marlin and Squall are on the start line. Race them?', needs: 'open' },
  { title: 'Follow the gold line', text: 'The regatta course is marked. Tack where it turns and beat the fleet.', needs: 'open' },
  { title: 'Climb the fleets', text: 'Win regattas to move up from the Club fleet to the Open and the Championship.', needs: 'open' },
  { title: 'Podium finish?', text: "A top-three regatta finish could fill one of today's orders.", needs: 'open' },
  { title: "The harbourmaster's chest", text: 'Fill all three of today\'s orders and the chest opens, with a black pearl inside.', needs: 'open' },
  { title: 'Swap an order', text: "Don't fancy one of today's orders? You can swap it once a day.", needs: 'open' },
  { title: 'Second wind', text: 'Out of time on the Open Sea? Two black pearls buy 30 more seconds and a patched hull.', needs: 'open' },
  { title: 'Clean air', text: "In a regatta, a rival's wind shadow slows you down. Find clean air.", needs: 'open' },
  { title: 'Round the marks', text: 'Mark 1, mark 2, then into the harbor. The regatta fleet is waiting.', needs: 'open' },
  { title: 'A new sea every day', text: "Today's daily voyage is like no other. Tomorrow it's gone.", needs: 'open' },
  { title: 'Orders waiting', text: 'Set sail, scoop pearls, bring someone home. Today\'s orders pay on the spot.', needs: 'open' },
  { title: 'Further east', text: 'Your best on the Open Sea is a mark on the chart. Sail past it.', needs: 'open' },

  // Mornings, at 9.
  { title: 'Good morning, skipper', text: 'The sun is up and so is the wind. Coffee, then cast off?', at: 'morning' },
  { title: 'Dawn on the water', text: 'The sea is flat and gold. The best time for a quiet voyage.', at: 'morning' },
  { title: 'Morning tide', text: 'The tide is running out. Ride it to the first mark.', at: 'morning' },
  { title: 'Rise and sail', text: 'A fresh breeze this morning. Make the most of it.', at: 'morning' },
  { title: 'Breakfast with dolphins', text: 'A pod is playing off the harbor wall this morning.', at: 'morning' },
  { title: 'Weather report', text: 'Light airs at dawn, freshening by noon. A good day for sailing.', at: 'morning' },
  { title: 'Early start', text: 'The gulls are up and the castaways are waving. Are you?', at: 'morning' },
  { title: 'Morning mist', text: "The mist is lifting off the water. Time to see what's out there.", at: 'morning' },
  { title: 'One before the day begins', text: 'A quick voyage with your breakfast?', at: 'morning' },
  { title: 'The lamp is out', text: 'Dawn is here and the lighthouse can rest. Your turn to sail.', at: 'morning' },
  { title: 'Fresh start', text: "Yesterday's capsizes are forgotten. It's a new day on the water.", at: 'morning' },
  { title: 'Morning breeze', text: 'Light and steady: perfect for chasing three stars.', at: 'morning' },
  { title: 'The harbor wakes', text: 'Nets out, sails up. Join the morning fleet.', at: 'morning' },
  { title: 'Coffee and a course', text: '{next} is waiting. Plan your tacks over breakfast.', at: 'morning' },
  { title: 'Morning, captain', text: 'Your boat is bailed out and the sail is dry. Ready when you are.', at: 'morning' },
  { title: 'Sunrise, new sea', text: 'Today\'s voyage was charted at sunrise. Be one of the first to sail it.', at: 'morning', needs: 'open' },
  { title: 'Morning orders', text: 'The harbourmaster has pinned three new orders to the board.', at: 'morning', needs: 'open' },
  { title: 'Start the streak', text: 'Begin the day with the daily voyage and keep your streak alive.', at: 'morning', needs: 'open' },

  // Evenings, at 6.
  { title: 'Evening breeze', text: 'The sea breeze fills in late in the day. Go and use it.', at: 'evening' },
  { title: 'Done for the day?', text: 'Unwind with a sail. Just you, the wind and the water.', at: 'evening' },
  { title: 'Golden hour', text: 'The sun is low and the sea is glowing. A beautiful time for a voyage.', at: 'evening' },
  { title: 'Sundowner sail', text: 'One short voyage before dinner?', at: 'evening' },
  { title: 'Home from work?', text: 'So is the fishing fleet. Your turn on the water.', at: 'evening' },
  { title: "Wind's freshening", text: 'Big gusts this evening. Hold on to the sheet!', at: 'evening' },
  { title: 'Evening tide', text: 'The tide is coming in. A good time to sail for the harbor.', at: 'evening' },
  { title: 'Dusk is coming', text: "Sail now and you'll see the lighthouse light up.", at: 'evening' },
  { title: 'A quick one?', text: 'A little time on the water clears the head.', at: 'evening' },
  { title: 'Before dark', text: 'A castaway is still adrift. Bring them home before night falls.', at: 'evening' },
  { title: 'Evening gossip', text: 'The harbor folk say a secret medal is waiting to be found.', at: 'evening' },
  { title: 'Sunset sail', text: 'Fit the sunset sail from the Sail Locker, then show it off at dusk.', at: 'evening' },
  { title: 'Evening, skipper', text: "The day's work is done. The sea is still here.", at: 'evening' },
  { title: 'The kraken naps at dusk', text: 'Or so they say. Fancy finding out?', at: 'evening' },
  { title: 'Evening pearls', text: 'Pearls glow brightest in the low sun. Go and gather some.', at: 'evening' },
  { title: 'Evening race', text: 'The regatta fleet is racing tonight, and there is room for one more boat.', at: 'evening', needs: 'open' },
  { title: 'Orders still open', text: "Today's orders are still on the board. Coins on the spot when you fill them.", at: 'evening', needs: 'open' },
  { title: 'Before dinner', text: 'The Open Sea is calling. How far east can you get?', at: 'evening', needs: 'open' },

  // Nights, at 9.
  { title: 'One more voyage?', text: 'Just one before bed. The sea is calm tonight.', at: 'night' },
  { title: 'Lantern light', text: 'The lighthouse is lit. Sail by its beam tonight.', at: 'night' },
  { title: 'Night sailing', text: 'Stars overhead, and little lights wandering over the water.', at: 'night' },
  { title: 'Green lanterns', text: 'In the Ghost Sea the lanterns burn green tonight. Dare you?', at: 'night' },
  { title: 'Bedtime story', text: "Once upon a time, a squall took a sailor's oar. Find out how it ends.", at: 'night' },
  { title: 'Northern lights', text: 'In Aurora Ice the sky is putting on a show tonight.', at: 'night' },
  { title: 'Quiet harbor', text: "Everyone's moored for the night. The sea is all yours.", at: 'night' },
  { title: "Can't sleep?", text: 'A gentle sail on a calm sea might help.', at: 'night' },
  { title: 'Nightcap voyage', text: 'A short, calm voyage to end the day.', at: 'night' },
  { title: 'Someone is waiting', text: 'The lamp at home is lit. Sail a little closer tonight.', at: 'night' },
  { title: 'Moonlit pearls', text: 'Pearls shine under the moon. Easy to spot tonight.', at: 'night' },
  { title: 'Night watch', text: 'Keep a lookout: the pirates like the dark.', at: 'night' },
  { title: 'Rest the crew', text: 'Sail one more, then rest. Tomorrow brings a new wind.', at: 'night' },
  { title: 'Goodnight, skipper', text: 'One voyage, then goodnight. Your boat is ready.', at: 'night' },
  { title: 'Your ghost never sleeps', text: 'The ghost of your best run is still out there. Beat it before bed.', at: 'night' },
  { title: 'Last call', text: "Today's daily voyage is gone at midnight. There's still time to sail it.", at: 'night', needs: 'open' },
  { title: 'Midnight orders', text: "The harbourmaster's board clears at midnight. Any orders left?", at: 'night', needs: 'open' },
  { title: "Don't break the streak", text: 'A daily voyage before midnight keeps your run of days going.', at: 'night', needs: 'open' },
];

// "9 am, 6 pm and 9 pm".
export function reminderTimes(times = REMINDER_TIMES) {
  const words = times.map(({ hour, minute }) => {
    const h = hour % 12 || 12;
    return `${h}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'am' : 'pm'}`;
  });
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words.join('');
}

// The first voyage not yet sailed, or null once they all are.
function nextVoyage(save, campaign) {
  const next = campaign.find((l) => !save.levels[l.id] || save.levels[l.id].best === null);
  return next ? next.name : null;
}

// The reminders that fit this player now, ready for the phone.
export function remindersFor(save, campaign) {
  const open = isDailyUnlocked(save, campaign);
  const next = nextVoyage(save, campaign);
  return REMINDERS.filter((r) => (r.needs === 'open' ? open : r.needs === 'new' ? !open : true))
    .filter((r) => next || !r.text.includes('{next}'))
    .map((r) => ({ title: r.title, text: r.text.replace('{next}', next), at: r.at || '' }));
}
