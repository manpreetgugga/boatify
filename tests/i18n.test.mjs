import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, TABLES, detectLang, setLang, currentLang, t, ordinal, nameOf, blurbOf } from '../web/src/i18n/index.js';
import { allKeys, holes } from './i18n-keys.mjs';
import { reminderTimes, remindersFor } from '../web/src/data/reminders.js';
import { dailyVoyage, dateKey } from '../web/src/data/daily.js';
import { loadSave, DEFAULT_SETTINGS } from '../web/src/platform/save.js';
import { CAMPAIGN } from '../web/src/data/worlds.js';

const KEYS = allKeys();
const tags = (s) => (s.match(/<\/?[a-z]+/g) || []).join('');

test('the game speaks the first of the phone languages it knows', () => {
  assert.deepEqual(LANGS.map((l) => l.id), ['en', 'hi', 'es', 'pt', 'id']);
  assert.equal(detectLang(['hi-IN', 'en-GB']), 'hi');
  assert.equal(detectLang(['fr-FR', 'es-MX']), 'es');
  assert.equal(detectLang(['pt_BR']), 'pt');
  assert.equal(detectLang(['in-ID']), 'id', 'old Android calls Indonesian "in"');
  assert.equal(detectLang(['fr', 'de']), 'en');
  assert.equal(detectLang([]), 'en');
  assert.equal(DEFAULT_SETTINGS.lang, 'auto');
});

test('t() looks text up in the chosen language and fills in its names', () => {
  try {
    assert.equal(setLang('es'), 'es');
    assert.equal(currentLang(), 'es');
    assert.equal(t('Voyage {n}', { n: 4 }), TABLES.es['Voyage {n}'].replace('{n}', '4'));
    assert.equal(t('Text nobody wrote down'), 'Text nobody wrote down', 'what a table lacks stays in English');
    assert.equal(ordinal(2), '2.º');
    setLang('id');
    assert.equal(ordinal(3), 'ke-3');
    assert.equal(setLang('xx'), 'en', 'an unknown language is English');
    assert.equal(ordinal(2), '2nd');
    assert.equal(ordinal(11), '11th');
    assert.equal(t('Voyage {n}', { n: 4 }), 'Voyage 4');
  } finally {
    setLang('en');
  }
});

test('every language has every piece of text the game shows', () => {
  assert.ok(KEYS.size > 1500, `${KEYS.size} pieces of text found`);
  for (const lang of LANGS.slice(1)) {
    const table = TABLES[lang.id];
    const missing = [...KEYS.keys()].filter((k) => typeof table[k] !== 'string' || !table[k].trim());
    assert.deepEqual(missing.slice(0, 8), [], `${lang.id} lacks ${missing.length}, from ${missing.slice(0, 3).map((k) => KEYS.get(k))}`);
    const stale = Object.keys(table).filter((k) => !KEYS.has(k));
    assert.deepEqual(stale.slice(0, 8), [], `${lang.id} has ${stale.length} the game no longer shows`);
    for (const [k, v] of Object.entries(table)) {
      assert.equal(holes(v), holes(k), `${lang.id}: "${v}" fills in what "${k}" does`);
      assert.equal(tags(v), tags(k), `${lang.id}: "${v}" keeps the markup of "${k}"`);
    }
  }
});

test('reminders and the daily voyage read in the game language', () => {
  const save = loadSave();
  try {
    assert.equal(reminderTimes(), '9 am, 6 pm and 9 pm');
    setLang('pt');
    const list = remindersFor(save, CAMPAIGN);
    assert.ok(list.length > 20);
    for (const r of list) {
      assert.ok(!r.text.includes('{next}') && !r.title.includes('{'), r.text);
      assert.ok(Object.values(TABLES.pt).includes(r.title), `"${r.title}" is in Portuguese`);
    }
    assert.ok(list.some((r) => r.text.includes(t(CAMPAIGN[0].name))), 'the next voyage is named in Portuguese');
    assert.ok(/\d/.test(reminderTimes()));
    for (const lang of ['hi', 'es', 'pt', 'id']) {
      setLang(lang);
      const def = dailyVoyage(dateKey(new Date(2026, 3, 9)));
      assert.notEqual(nameOf(def), def.name, `${lang}: the daily voyage's name`);
      assert.notEqual(blurbOf(def), def.blurb, `${lang}: its blurb`);
    }
  } finally {
    setLang('en');
  }
});
