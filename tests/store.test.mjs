import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const DIR = new URL('../fastlane/metadata/android/', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const [a, b, c] = pkg.version.split('.').map(Number);
const CODE = a * 10000 + b * 100 + c;
const read = (p) => readFileSync(DIR + p, 'utf8').replace(/\n+$/, '');

test('the store listing is in every language the game speaks', () => {
  assert.deepEqual(readdirSync(DIR).sort(), ['en-US', 'es-419', 'es-ES', 'hi-IN', 'id', 'pt-BR']);
});

test("each listing fits Play's limits and has this version's notes", () => {
  for (const locale of readdirSync(DIR)) {
    const title = read(`${locale}/title.txt`);
    const short = read(`${locale}/short_description.txt`);
    const full = read(`${locale}/full_description.txt`);
    assert.ok(title.length > 0 && title.length <= 30, `${locale} title is ${title.length} long`);
    assert.ok(short.length > 0 && short.length <= 80, `${locale} short description is ${short.length} long`);
    assert.ok(full.length > 0 && full.length <= 4000, `${locale} full description is ${full.length} long`);
    assert.ok(title.startsWith('No Paddle'), `${locale} title keeps the name`);
    const notes = `${locale}/changelogs/${CODE}.txt`;
    assert.ok(existsSync(DIR + notes), `${notes} is there`);
    const n = read(notes).length;
    assert.ok(n > 0 && n <= 500, `${notes} is ${n} long`);
  }
});
