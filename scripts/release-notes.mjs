// Prints the CHANGELOG section for a version, plus install notes, for a GitHub release.
import { readFileSync } from 'node:fs';

const version = process.argv[2];
const log = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const start = log.search(new RegExp(`^## \\[?${version.replace(/\./g, '\\.')}\\]?`, 'm'));
let section = 'See CHANGELOG.md.';
if (start !== -1) {
  const rest = log.slice(start);
  const next = rest.slice(3).search(/^## /m);
  section = (next === -1 ? rest : rest.slice(0, next + 3)).split('\n').slice(1).join('\n').trim();
}
console.log(`${section}

---

**Install on Android:** download \`boatify-v${version}.apk\` below on your phone, open it and allow installing from this source. Android 8.0 or newer. Releases are signed with the same development key, so a new version installs over the old one and keeps your progress.`);
