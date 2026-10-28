// Bundles the game into one self-contained HTML page: ES modules become
// function scopes in dependency order, the stylesheet and fonts are inlined.
//
//   node scripts/build.mjs                 -> dist/index.html + dist/artifact.html
//   node scripts/build.mjs --out <dir>     -> <dir>/index.html (used by the Android build)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const IMPORT_RE = /^import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
const EXPORT_DECL_RE = /^export\s+(async\s+function\*?|function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

export function bundleModules(entry) {
  const order = [];
  const seen = new Map(); // id -> 'visiting' | 'done'
  const sources = new Map();

  function visit(file, from) {
    const id = posix.normalize(relative(WEB, file).split('\\').join('/'));
    const state = seen.get(id);
    if (state === 'done') return id;
    if (state === 'visiting') throw new Error(`Circular import: ${from} -> ${id}`);
    seen.set(id, 'visiting');
    const src = readFileSync(file, 'utf8');
    if (/^\s*import\s+[^{\s]/m.test(src) || /^\s*export\s+(default|\*|\{)/m.test(src)) {
      throw new Error(`${id}: only named imports and declaration exports are supported`);
    }
    const deps = [];
    for (const m of src.matchAll(IMPORT_RE)) deps.push(m[2]);
    for (const d of deps) visit(resolve(dirname(file), d), id);
    sources.set(id, { file, src });
    seen.set(id, 'done');
    order.push(id);
    return id;
  }

  visit(entry, '(entry)');

  const parts = [];
  for (const id of order) {
    const { file, src } = sources.get(id);
    const exportsList = [];
    let code = src.replace(IMPORT_RE, (_, names, spec) => {
      const depId = posix.normalize(relative(WEB, resolve(dirname(file), spec)).split('\\').join('/'));
      const binding = names
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => {
          const [orig, alias] = n.split(/\s+as\s+/);
          return alias ? `${orig}: ${alias}` : orig;
        })
        .join(', ');
      return `const { ${binding} } = __m[${JSON.stringify(depId)}];`;
    });
    code = code.replace(EXPORT_DECL_RE, (_, kind, name) => {
      exportsList.push(name);
      return `${kind} ${name}`;
    });
    if (/^export\s/m.test(code)) throw new Error(`${id}: unsupported export form`);
    parts.push(`// ---- ${id}\n__m[${JSON.stringify(id)}] = (() => {\n${code}\nreturn { ${exportsList.join(', ')} };\n})();`);
  }
  return `(() => {\n'use strict';\nconst __m = Object.create(null);\nglobalThis.BOATIFY_VERSION = ${JSON.stringify(pkg.version)};\n${parts.join('\n')}\n})();`;
}

export function inlineCss() {
  const css = readFileSync(join(WEB, 'styles.css'), 'utf8');
  return css.replace(/url\('([^']+\.woff2)'\)/g, (_, path) => {
    const data = readFileSync(join(WEB, path)).toString('base64');
    return `url('data:font/woff2;base64,${data}')`;
  });
}

// Keep a literal "</script" or "</style" in the code from closing the tag early.
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script');
const safeStyle = (css) => css.replace(/<\/style/gi, '<\\/style');

export function buildPages() {
  const html = readFileSync(join(WEB, 'index.html'), 'utf8');
  const js = safeScript(bundleModules(join(WEB, 'src', 'main.js')));
  const css = safeStyle(inlineCss());
  const linkRe = /<link rel="stylesheet" href="styles\.css" \/>/;
  const scriptRe = /<script type="module" src="src\/main\.js"><\/script>/;
  if (!linkRe.test(html) || !scriptRe.test(html)) throw new Error('index.html is missing the stylesheet or script tag');

  const full = html.replace(linkRe, () => `<style>\n${css}\n</style>`).replace(scriptRe, () => `<script>\n${js}\n</script>`);

  // The artifact page is a fragment: the host supplies the document shell.
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(scriptRe, '').trim();
  const artifact = [
    '<title>No Paddle Sailing Game</title>',
    '<meta name="description" content="Your oar is lost. Sail by the wind from A to B." />',
    '<meta name="claude:viewport-fit-sides" content="cover" />',
    `<style>\n${css}\n</style>`,
    body,
    `<script>\n${js}\n</script>`,
  ].join('\n');
  return { full, artifact };
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const { full, artifact } = buildPages();
  if (outIdx !== -1) {
    const out = resolve(args[outIdx + 1]);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'index.html'), full);
    console.log(`Wrote ${relative(process.cwd(), join(out, 'index.html'))} (${(full.length / 1024).toFixed(0)} KB)`);
    return;
  }
  const dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'index.html'), full);
  writeFileSync(join(dist, 'artifact.html'), artifact);
  console.log(`Wrote dist/index.html (${(full.length / 1024).toFixed(0)} KB) and dist/artifact.html`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
