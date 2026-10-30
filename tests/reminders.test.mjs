import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REMINDERS, REMINDER_TIMES, remindersFor, reminderTimes } from '../web/src/data/reminders.js';
import { CAMPAIGN } from '../web/src/data/worlds.js';
import { DAILY_UNLOCK } from '../web/src/platform/save.js';

const SLOTS = REMINDER_TIMES.map((t) => t.at);
// A save with the first n campaign voyages sailed.
const sailed = (n) => ({ levels: Object.fromEntries(CAMPAIGN.slice(0, n).map((l) => [l.id, { best: 60 }])) });

test('reminders come at 9 am, 6 pm and 9 pm', () => {
  assert.deepEqual(REMINDER_TIMES.map((t) => [t.hour, t.minute]), [[9, 0], [18, 0], [21, 0]]);
  assert.deepEqual(SLOTS, ['morning', 'evening', 'night']);
  assert.equal(reminderTimes(), '9 am, 6 pm and 9 pm');
  assert.equal(reminderTimes([{ hour: 0, minute: 0 }, { hour: 12, minute: 30 }]), '12 am and 12:30 pm');
});

test('there are 150 or more lines, short enough for a notification and none twice', () => {
  assert.ok(REMINDERS.length >= 150, `only ${REMINDERS.length}`);
  const texts = new Set();
  for (const r of REMINDERS) {
    assert.ok(r.title && r.title.length <= 40, r.title);
    assert.ok(r.text && r.text.length <= 120, r.text);
    assert.ok(!r.at || SLOTS.includes(r.at), r.at);
    assert.ok(!r.needs || ['open', 'new'].includes(r.needs), r.needs);
    assert.ok(!texts.has(r.text), `twice: ${r.text}`);
    texts.add(r.text);
    // The only blank to fill is the next voyage.
    assert.deepEqual(r.text.match(/\{\w+\}/g) || [], r.text.includes('{next}') ? ['{next}'] : [], r.text);
  }
});

test('each time of day has plenty to draw from, for new and seasoned sailors', () => {
  for (const save of [sailed(0), sailed(DAILY_UNLOCK), sailed(CAMPAIGN.length)]) {
    const lines = remindersFor(save, CAMPAIGN);
    for (const at of SLOTS) {
      const fits = lines.filter((r) => !r.at || r.at === at);
      assert.ok(fits.length >= 80, `${at}: ${fits.length}`);
      assert.ok(lines.some((r) => r.at === at), at);
    }
  }
});

test("a new sailor isn't told about what isn't open yet, and the next voyage is named", () => {
  const fresh = remindersFor(sailed(0), CAMPAIGN);
  const open = remindersFor(sailed(DAILY_UNLOCK), CAMPAIGN);
  const needing = (kind) => REMINDERS.filter((r) => r.needs === kind).map((r) => r.title);
  for (const title of needing('open')) assert.ok(!fresh.some((r) => r.title === title), title);
  for (const title of needing('new')) assert.ok(!open.some((r) => r.title === title), title);
  assert.ok(fresh.some((r) => r.text.includes(CAMPAIGN[0].name)));
  assert.ok(open.some((r) => r.text.includes(CAMPAIGN[DAILY_UNLOCK].name)));
  for (const r of [...fresh, ...open]) {
    assert.ok(!r.text.includes('{'), r.text);
    assert.equal(typeof r.at, 'string');
  }
  // Once every voyage is sailed, the lines about the next one drop out.
  const done = remindersFor(sailed(CAMPAIGN.length), CAMPAIGN);
  assert.ok(done.length < open.length);
  assert.ok(done.every((r) => !r.text.includes('{') && !r.text.includes('null')));
});
