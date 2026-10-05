// Reports translation keys that are used in the app but missing from a
// dictionary. Run with: node scripts/check-i18n.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "out" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const dictFiles = {
  en: join(root, "lib/i18n.ts"),
  yo: join(root, "lib/dict/yo.ts"),
  ha: join(root, "lib/dict/ha.ts"),
  ig: join(root, "lib/dict/ig.ts"),
};

function keysIn(file) {
  const src = readFileSync(file, "utf8");
  const keys = new Set();
  for (const m of src.matchAll(/(?:^|[\s{,])([a-z][a-z0-9_]{2,})\s*:/g)) keys.add(m[1]);
  return keys;
}

const dicts = Object.fromEntries(Object.entries(dictFiles).map(([lang, file]) => [lang, keysIn(file)]));
const en = dicts.en;

const used = new Map();
const dynamic = new Map();
for (const file of walk(join(root, "app")).concat(walk(join(root, "components")))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bt\(\s*"([a-z][a-z0-9_]*)"/g)) {
    if (!used.has(m[1])) used.set(m[1], relative(root, file));
  }
  // keys referenced through data tables: { labelKey: "n_home" }, { key: "x" }, ...
  for (const m of src.matchAll(/\b(?:labelKey|titleKey|subKey|bodyKey|descKey|ariaKey|eyebrowKey|ctaKey)\s*:\s*"([a-z][a-z0-9_]*)"/g)) {
    if (!dynamic.has(m[1])) dynamic.set(m[1], relative(root, file));
  }
  for (const m of src.matchAll(/\bt\(\s*"([a-z][a-z0-9_]*)"\s*[,)]/g)) {
    const key = m[1];
    if (!en.has(key) && !(key in used)) used.set(key, relative(root, file));
  }
}

const missingDynamic = [...dynamic.keys()].filter((k) => !en.has(k)).sort();
if (missingDynamic.length) {
  console.log(`\ndynamic keys missing from en (${missingDynamic.length}):`);
  for (const key of missingDynamic) console.log(`  ${key.padEnd(28)} ${dynamic.get(key)}`);
}

let bad = 0;
for (const lang of ["yo", "ha", "ig"]) {
  const missing = [...used.keys()].filter((k) => en.has(k) && !dicts[lang].has(k)).sort();
  if (missing.length === 0) {
    console.log(`${lang}: complete (${used.size} keys used)`);
    continue;
  }
  bad += missing.length;
  console.log(`${lang}: ${missing.length} missing`);
  for (const key of missing) console.log(`  ${key.padEnd(28)} ${used.get(key)}`);
}

const unknown = [...used.keys()].filter((k) => !en.has(k)).sort();
if (unknown.length) {
  console.log(`\nused but not defined in en (rely on inline fallback): ${unknown.length}`);
  for (const key of unknown) console.log(`  ${key.padEnd(28)} ${used.get(key)}`);
}

process.exit(0);