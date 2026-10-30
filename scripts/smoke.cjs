// Browser smoke test of the bundled game: the prologue, menus, a voyage
// sailed by the autopilot at high speed, the results card, today's daily
// voyage, the Shipyard and Sail Locker, the medals and the accessibility
// settings. Fails on any page error.
//
//   node scripts/smoke.cjs [--shots <dir>] [--level <index>] [--size 915x412]

const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const shots = opt('shots', null);
const levelIndex = Number(opt('level', 0));
const [vw, vh] = opt('size', '915x412').split('x').map(Number);
const page = path.resolve(__dirname, '..', 'dist', 'index.html');

(async () => {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  tab.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const snap = async (name) => shots && tab.screenshot({ path: path.join(shots, `${name}.png`) });
  const step = (msg) => console.log(`- ${msg}`);

  await tab.goto(`file://${page}`);
  await tab.waitForFunction(() => window.__boatify && window.__boatify.state().frames > 20);

  step('a first launch opens on the prologue');
  await tab.waitForSelector('section[aria-label="Prologue"].open');
  if ((await tab.evaluate(() => window.__boatify.state().mode)) !== 'film') throw new Error('no prologue on a first launch');
  await tab.waitForTimeout(1200);
  await snap('00a-film-home');
  const caption = () => tab.evaluate(() => document.querySelector('.film-caption').textContent);
  if (!(await caption()).includes('Home')) throw new Error(`the prologue opens on "${await caption()}"`);
  for (const [t, name, says] of [
    [7.5, '00a-film-dawn', 'row home'],
    [17, '00b-film-squall', 'squall'],
    [20.5, '00c-film-oar-lost', 'took the oar'],
    [32, '00d-film-irons', 'flaps'],
    [39, '00e-film-reach', 'flies'],
    [44.5, '00f-film-chart', 'ten voyages'],
    [51, '00f-film-dangers', 'fog'],
  ]) {
    await tab.evaluate((s) => window.__boatify.filmSeek(s), t);
    await tab.waitForTimeout(500);
    const said = await caption();
    if (!said.includes(says)) throw new Error(`at ${t} s the prologue says "${said}"`);
    await snap(name);
  }
  const reel = await tab.evaluate(() => window.__boatify.state().film);
  if (reel.oar !== 'adrift' || !reel.route) throw new Error(`prologue ${JSON.stringify(reel)}`);
  await tab.evaluate(() => window.__boatify.filmSeek(54.5));
  await tab.locator('.film-card.in').waitFor();
  await tab.waitForTimeout(1300);
  await snap('00g-film-title');
  await tab.getByRole('button', { name: 'Take the helm' }).click();
  await tab.waitForSelector('section[aria-label="How to sail"].open');
  if (!(await tab.evaluate(() => window.__boatify.save.seenFilm))) throw new Error('prologue not marked as seen');
  step('back to the title; the prologue plays again from there and can be skipped');
  await tab.keyboard.press('Escape');
  await tab.waitForSelector('section[aria-label="Title"].open');
  await tab.getByRole('button', { name: 'Prologue' }).click();
  await tab.waitForSelector('section[aria-label="Prologue"].open');
  await tab.waitForTimeout(600);
  await tab.getByRole('button', { name: 'Skip' }).click();

  step('title screen with demo voyage');
  await tab.waitForSelector('section[aria-label="Title"].open');
  if ((await tab.evaluate(() => window.__boatify.state().mode)) !== 'title') throw new Error('skip did not land on the title');
  await tab.waitForTimeout(1500);
  const rumor = await tab.locator('.rumor').innerText();
  if (!/^harbor talk\s+\S.{15,}/i.test(rumor)) throw new Error(`harbor talk reads ${JSON.stringify(rumor)}`);
  step(`harbor talk: ${rumor.replace(/^harbor talk\s+/i, '')}`);
  await snap('01-title');

  await tab.getByRole('button', { name: 'Start voyage' }).click();
  await tab.waitForSelector('section[aria-label="How to sail"].open');
  step('how to sail');
  await snap('02-howto');
  for (let i = 0; i < 2; i++) await tab.getByRole('button', { name: 'Next' }).click();
  await snap('03-howto-tacking');
  await tab.getByRole('button', { name: 'Skip' }).click();

  await tab.waitForSelector('section[aria-label="Voyage briefing"].open');
  step('briefing');
  await snap('04-briefing');
  await tab.locator('section[aria-label="Voyage briefing"]').getByRole('button', { name: 'Set sail' }).click();
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  step('sailing by hand');
  // Hold the helm to starboard for a moment with a touch drag.
  const box = { x: 170, y: vh - 120 };
  await tab.mouse.move(box.x, box.y);
  await tab.mouse.down();
  await tab.mouse.move(box.x + 30, box.y, { steps: 4 });
  await tab.waitForTimeout(1200);
  await snap('05-sailing');
  await tab.mouse.up();

  step('pinch to zoom: fingers spread to come closer, close to pull back');
  const pinch = (from, to) =>
    tab.evaluate(
      ([from, to, w, h]) => {
        const c = document.getElementById('game');
        const send = (type, id, x) =>
          c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 21, clientX: x, clientY: h / 2, bubbles: true, cancelable: true }));
        send('pointerdown', 21, w / 2 - from);
        send('pointerdown', 22, w / 2 + from);
        let live = null;
        for (let k = 1; k <= 8; k++) {
          const d = from + ((to - from) * k) / 8;
          send('pointermove', 21, w / 2 - d);
          send('pointermove', 22, w / 2 + d);
          if (k === 5) live = window.__boatify.state().pinch;
        }
        send('pointerup', 21, w / 2 - to);
        send('pointerup', 22, w / 2 + to);
        return [live, window.__boatify.state().zoom, window.__boatify.state().pinch];
      },
      [from, to, vw, vh],
    );
  const spread = await pinch(40, 110);
  if (!(spread[0] > 1) || spread[1] !== 1.55 || spread[2] !== null) throw new Error(`pinch out ${JSON.stringify(spread)}`);
  await tab.waitForTimeout(700);
  await snap('05a-pinched-close');
  const closed = await pinch(110, 45);
  if (!(closed[0] < 1.55) || closed[1] !== 0.8 || closed[2] !== null) throw new Error(`pinch in ${JSON.stringify(closed)}`);
  step(`pinched to ${spread[1]}x, then back out to ${closed[1]}x`);
  await tab.evaluate(() => {
    window.__boatify.save.settings.zoom = 1;
  });

  step('in irons: dolphins show the way');
  await tab.evaluate(() => window.__boatify.inIrons());
  await tab.waitForFunction(() => window.__boatify.guidePod(), null, { timeout: 8000 });
  await tab.waitForFunction(() => /Follow the dolphins/.test(document.querySelector('#toasts').textContent), null, { timeout: 3000 });
  await tab.waitForTimeout(2200);
  await snap('05b-dolphin-guide');

  if (levelIndex !== 0) {
    await tab.evaluate((i) => window.__boatify.startLevel(i), levelIndex);
    await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  }
  step(`autopilot sails voyage ${levelIndex + 1}`);
  await tab.evaluate(() => {
    window.__boatify.setAutopilot(true);
    window.__boatify.setTimeScale(10);
  });
  await tab.waitForTimeout(1500);
  await snap('06-autopilot');
  await tab.waitForFunction(() => window.__boatify.state().mode === 'results', null, { timeout: 90000 });
  await tab.waitForTimeout(1600);
  const st = await tab.evaluate(() => window.__boatify.state());
  step(`finished in ${st.result.time.toFixed(1)} s with ${st.result.stars} stars, ${st.result.pearls}/${st.result.pearlsTotal} pearls`);
  await snap('07-results');
  const chips = await tab.locator('.medal-chip').allTextContents();
  if (!chips.includes('Cast Off')) throw new Error(`results card shows medals ${JSON.stringify(chips)}`);
  step(`new medals: ${chips.join(', ')}`);
  const paid = await tab.evaluate(() => [window.__boatify.save.wallet.coins, document.querySelector('.reward-sum') && document.querySelector('.reward-sum').textContent]);
  if (!(paid[0] > 0) || !paid[1] || !paid[1].includes(`+${paid[0]}`)) throw new Error(`voyage pay ${JSON.stringify(paid)}`);
  step(`paid ${paid[0]} coins`);

  await tab.getByRole('button', { name: 'Voyages' }).click();
  await tab.waitForSelector('section[aria-label="Voyages"].open');
  const fog = await tab.locator('.voyage.locked[data-i="7"] .teaser').innerText();
  if (!/fog/i.test(fog)) throw new Error(`Kraken Fog's card teases ${JSON.stringify(fog)}`);
  step(`locked voyages tease what's out there: "${fog}"`);
  await snap('08-voyages');

  step('daily voyage: locked card, then charted and sailed');
  await tab.locator('.voyage.daily.locked').waitFor();
  await tab.evaluate(() => window.__boatify.startLevel('daily'));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 15000 });
  const daily = await tab.evaluate(() => window.__boatify.state().level);
  if (!/^daily-\d{4}-\d\d-\d\d$/.test(daily)) throw new Error(`unexpected daily id ${daily}`);
  await tab.waitForTimeout(1000);
  await snap('09-daily');

  step('open sea: gates charted ahead, the run ends when the clock does');
  await tab.evaluate(() => window.__boatify.startLevel('sea'));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  await tab.waitForFunction(() => window.__boatify.state().sea.gates >= 1, null, { timeout: 30000 });
  await snap('09b-open-sea');
  await tab.evaluate(() => window.__boatify.setSeaClock(2));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'results', null, { timeout: 15000 });
  await tab.waitForTimeout(600);
  const run = await tab.evaluate(() => [window.__boatify.save.openSea, document.querySelector('section[aria-label="Run over"] h2').textContent]);
  if (run[0].runs !== 1 || run[0].gates < 1 || run[1] !== 'Out of time') throw new Error(`open sea run ${JSON.stringify(run)}`);
  step(`sailed ${run[0].best.toFixed(0)} units east through ${run[0].gates} gates`);
  await snap('09c-sea-results');

  step('regatta: three rivals, two marks in order, a finishing place');
  await tab.evaluate(() => window.__boatify.startLevel('regatta'));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  await tab.waitForFunction(() => window.__boatify.state().time > 14, null, { timeout: 15000 });
  await snap('09d-regatta');
  const fleet = await tab.evaluate(() => window.__boatify.state().race);
  if (fleet.rivals.length !== 3 || !(fleet.place >= 1)) throw new Error(`regatta fleet ${JSON.stringify(fleet)}`);
  await tab.waitForFunction(() => window.__boatify.state().mode === 'results', null, { timeout: 90000 });
  await tab.waitForTimeout(1600);
  const race = await tab.evaluate(() => [window.__boatify.save.regatta, window.__boatify.state().result, document.querySelector('section[aria-label="Race over"] h2').textContent]);
  if (race[0].races !== 1 || !race[1].race || race[1].standings.length !== 4) throw new Error(`regatta ${JSON.stringify(race)}`);
  step(`${race[2]} in ${race[1].time.toFixed(1)} s, ${race[1].bumps} bumps`);
  await snap('09e-race-results');

  step('open sea second wind: two black pearls buy thirty more seconds, once a run');
  await tab.evaluate(() => {
    window.__boatify.setAutopilot(false);
    window.__boatify.setTimeScale(1);
    window.__boatify.give({ blackPearls: 3 });
    window.__boatify.startLevel('sea');
  });
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  await tab.waitForTimeout(500);
  await tab.evaluate(() => window.__boatify.setSeaClock(0.5));
  await tab.waitForSelector('section[aria-label="Second wind"].open', { timeout: 15000 });
  await tab.waitForTimeout(300);
  await snap('09f-second-wind');
  await tab.getByRole('button', { name: /Sail on/ }).click();
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  const revived = await tab.evaluate(() => [window.__boatify.state().sea.clock, window.__boatify.save.wallet.blackPearls, window.__boatify.save.openSea.runs]);
  if (!(revived[0] > 25) || revived[1] !== 1 || revived[2] !== 1) throw new Error(`second wind ${JSON.stringify(revived)}`);
  await tab.evaluate(() => window.__boatify.setSeaClock(0.5));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'results', null, { timeout: 15000 });
  const runs = await tab.evaluate(() => window.__boatify.save.openSea.runs);
  if (runs !== 2) throw new Error(`open sea runs after a second wind: ${runs}`);
  step(`back on the water with ${revived[0].toFixed(0)} s, then the run ended for good`);

  step('shipyard: five boats, the sloop is sailing');
  await tab.evaluate(() => window.__boatify.showTitle());
  await tab.getByRole('button', { name: 'Shipyard' }).click();
  await tab.waitForSelector('section[aria-label="Shipyard"].open');
  const cards = await tab.locator('.boat-card').count();
  const picked = await tab.locator('.boat-card.picked h3').textContent();
  if (cards !== 5 || picked !== 'Driftwood Sloop') throw new Error(`shipyard shows ${cards} boats, picked ${picked}`);
  await tab.waitForTimeout(300);
  await snap('10-shipyard');

  step('sail locker: Cast Off unlocked the Harbor Stripe, the rest are locked');
  await tab.getByRole('button', { name: 'Sail Locker' }).click();
  await tab.waitForSelector('section[aria-label="Sail Locker"].open');
  const gear = await tab.locator('.gear').count();
  if (gear !== 43) throw new Error(`sail locker shows ${gear} items`);
  await tab.getByRole('button', { name: 'Jolly Roger, locked' }).click();
  await tab.waitForFunction(() => /secret medal unlocks the Jolly Roger sail\. “.+”/.test(document.querySelector('#toasts').textContent));
  await tab.getByRole('button', { name: 'Harbor Stripe' }).click();
  const fitted = await tab.evaluate(() => [window.__boatify.save.settings.sail, document.querySelector('.gear.picked[data-kind=sail]').dataset.id]);
  if (fitted.join() !== 'harbor,harbor') throw new Error(`fitted sail ${fitted}`);
  await tab.waitForTimeout(300);
  await snap('11-locker');

  step('sail locker: a sail bought with coins');
  await tab.evaluate(() => window.__boatify.give({ coins: 1000 }));
  const before = await tab.evaluate(() => window.__boatify.save.wallet.coins);
  await tab.getByRole('button', { name: 'Royal Purple, 400 coins' }).click();
  await tab.waitForSelector('.confirm.open');
  await tab.waitForTimeout(250);
  await snap('11b-confirm');
  await tab.locator('.confirm').getByRole('button', { name: /Buy/ }).click();
  const bought = await tab.evaluate(() => [window.__boatify.save.wallet.coins, window.__boatify.save.settings.sail, window.__boatify.save.wallet.owned]);
  if (bought[0] !== before - 400 || bought[1] !== 'royal' || !bought[2].includes('gear:royal')) throw new Error(`bought sail ${JSON.stringify(bought)}`);
  await tab.locator('section[aria-label="Sail Locker"]').getByRole('button', { name: 'Back' }).click();
  await tab.waitForSelector('section[aria-label="Shipyard"].open');

  step('shop: videos coming soon, a gust jar, a trade and a boat');
  await tab.locator('section[aria-label="Shipyard"]').getByRole('button', { name: 'Back' }).click();
  await tab.waitForSelector('section[aria-label="Title"].open');
  await tab.getByRole('button', { name: 'Shop' }).click();
  await tab.waitForSelector('section[aria-label="Shop"].open');
  const soon = await tab.locator('section[aria-label="Shop"] button[disabled]', { hasText: 'Coming soon' }).count();
  if (soon !== 1) throw new Error(`shop shows ${soon} coming-soon buttons`);
  await tab.locator('[data-buy=jar]').click();
  await tab.locator('[data-buy=trade]').click();
  await tab.locator('.confirm').getByRole('button', { name: /Trade/ }).click();
  await tab.evaluate(() => window.__boatify.give({ blackPearls: 5 }));
  await tab.getByRole('button', { name: 'Unlock the Reed Skiff for 5 black pearls' }).click();
  await tab.locator('.confirm').getByRole('button', { name: /Unlock/ }).click();
  await tab.waitForSelector('section[aria-label="Shop"].open');
  const shop = await tab.evaluate(() => ({ ...window.__boatify.save.wallet, boat: window.__boatify.save.settings.boat }));
  if (shop.jars !== 1 || shop.blackPearls !== 0 || !shop.owned.includes('boat:skiff') || shop.boat !== 'skiff') throw new Error(`shop ${JSON.stringify(shop)}`);
  step(`${shop.coins} coins left, a jar in the hold, the skiff unlocked`);
  await tab.waitForTimeout(300);
  await snap('11c-shop');
  await tab.evaluate(() => {
    window.__boatify.save.settings.boat = 'sloop';
  });

  step('medals: the first voyage is on the board');
  await tab.locator('section[aria-label="Shop"]').getByRole('button', { name: 'Back' }).click();
  await tab.waitForSelector('section[aria-label="Title"].open');
  await tab.waitForTimeout(300);
  await snap('11d-title-wallet');
  await tab.getByRole('button', { name: 'Medals' }).click();
  await tab.waitForSelector('section[aria-label="Medals"].open');
  const medals = await tab.locator('.medal').count();
  const earned = await tab.locator('.medal.earned').count();
  if (medals < 10 || earned < 1) throw new Error(`medals screen shows ${earned} of ${medals}`);
  const secrets = await tab.locator('.medal.sealed').count();
  const riddle = await tab.locator('.medal.sealed .riddle').first().innerText();
  if (secrets < 5 || !riddle.startsWith('“')) throw new Error(`${secrets} secret medals, the first riddle ${JSON.stringify(riddle)}`);
  step(`${secrets} secret medals, each with a riddle`);
  await tab.waitForTimeout(300);
  await snap('12-medals');

  step('settings: colour-blind colours, reduced motion and large text');
  await tab.getByRole('button', { name: 'Back' }).click();
  await tab.waitForSelector('section[aria-label="Title"].open');
  await tab.getByRole('button', { name: 'Settings' }).click();
  await tab.waitForSelector('section[aria-label="Settings"].open');
  await tab.getByRole('switch', { name: 'Colour-blind friendly' }).click();
  const motion = tab.getByRole('switch', { name: 'Reduce motion' });
  if ((await motion.getAttribute('aria-checked')) !== 'true') await motion.click();
  await tab.getByRole('group', { name: 'Text size' }).getByRole('button', { name: 'Largest' }).click();
  const look = await tab.evaluate(() => {
    const html = document.documentElement;
    const s = window.__boatify.save.settings;
    return { palette: html.dataset.palette, motion: html.dataset.motion, text: html.style.getPropertyValue('--text'), s };
  });
  if (look.palette !== 'colorblind' || look.motion !== 'reduced' || look.text !== '1.3' || look.s.reduceMotion !== true) {
    throw new Error(`settings did not stick: ${JSON.stringify(look)}`);
  }
  await tab.waitForTimeout(300);
  await snap('13-settings');

  step('orders: none before the daily voyage opens, then three jobs and a chest');
  await tab.evaluate(() => window.__boatify.showTitle());
  await tab.waitForSelector('section[aria-label="Title"].open');
  if (await tab.locator('section[aria-label="Title"].open [data-act=orders]').count()) throw new Error('orders before the daily voyage opens');
  await tab.evaluate(() => {
    const b = window.__boatify;
    for (const l of b.levels.slice(0, 3)) b.save.levels[l.id] ||= { best: 999, stars: 1, pearls: 0, pearlsTotal: 5, rescued: 0, castaways: 0, runs: 1 };
    b.showTitle();
  });
  await tab.locator('section[aria-label="Title"].open [data-act=orders]').click();
  await tab.waitForSelector('section[aria-label="Orders"].open');
  const board = await tab.evaluate(() => {
    const s = document.querySelector('section[aria-label="Orders"]');
    return [s.querySelectorAll('.order:not(.chest)').length, s.querySelectorAll('.order.chest').length, s.querySelectorAll('[data-swap]').length, window.__boatify.save.orders.seen];
  });
  if (board.join() !== '3,1,3,true') throw new Error(`orders board ${JSON.stringify(board)}`);
  await tab.waitForTimeout(300);
  await snap('13b-orders');
  // Today's three, set for the test, so the castaway voyage next finishes one.
  await tab.evaluate(() => Object.assign(window.__boatify.save.orders, { picks: ['voyages', 'gold', 'rescue'], progress: {}, done: [] }));

  step('castaway: heave to alongside, haul them aboard and bring them home');
  await tab.evaluate(() => window.__boatify.startLevel(1));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  await tab.evaluate(() => window.__boatify.setTimeScale(1));
  await tab.waitForTimeout(800);
  const castaway = await tab.evaluate(() => window.__boatify.heaveTo());
  await tab.waitForTimeout(600);
  await snap('14-hauling');
  await tab.waitForFunction(() => window.__boatify.state().aboard === 1, null, { timeout: 6000 });
  await tab.waitForTimeout(900);
  await snap('15-aboard');
  await tab.evaluate(() => {
    window.__boatify.setAutopilot(true);
    window.__boatify.setTimeScale(10);
  });
  await tab.waitForFunction(() => window.__boatify.state().mode === 'results', null, { timeout: 90000 });
  await tab.waitForTimeout(1600);
  await snap('16-rescued');
  const home = await tab.evaluate(() => [window.__boatify.state().result.rescued.map((c) => c.name), window.__boatify.save.crew.map((c) => c.name)]);
  const rescuedRow = await tab.locator('section[aria-label="Voyage complete"] .stat-rows').textContent();
  if (home.join('|') !== `${castaway}|${castaway}` || !rescuedRow.includes(castaway)) throw new Error(`rescue of ${castaway}: ${JSON.stringify(home)} / ${rescuedRow}`);
  step(`${castaway} is safe ashore and in the logbook`);
  const strip = await tab.locator('section[aria-label="Voyage complete"] .order-strip').textContent();
  const orders = await tab.evaluate(() => window.__boatify.save.orders);
  if (!strip.includes('Bring a castaway home') || !orders.done.includes('rescue') || orders.progress.voyages !== 1) throw new Error(`orders after the rescue: ${strip} / ${JSON.stringify(orders)}`);
  step('the rescue finished an order: "Bring a castaway home"');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('Smoke test passed.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
