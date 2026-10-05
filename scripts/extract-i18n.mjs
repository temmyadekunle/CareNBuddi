// Extracts key -> English fallback pairs for keys that are used with an inline
// fallback but are not yet defined in the English dictionary.
// Usage: node scripts/extract-i18n.mjs > tmp/i18n-new.json
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", "out", ".git", "tmp"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const en = new Set();
for (const m of readFileSync(join(root, "lib/i18n.ts"), "utf8").matchAll(/(?:^|[\s{,])([a-z][a-z0-9_]{2,})\s*:/g)) {
  en.add(m[1]);
}

const found = {};
const noFallback = new Set();
for (const file of [...walk(join(root, "app")), ...walk(join(root, "components"))]) {
  const src = readFileSync(file, "utf8");
  // t("key", "English text") including keys built from a helper
  for (const m of src.matchAll(/\bt\(\s*"([a-z][a-z0-9_]*)"\s*,\s*"((?:[^"\\]|\\.)*)"/g)) {
    const [, key, value] = m;
    if (en.has(key)) continue;
    if (!(key in found)) found[key] = value.replace(/\\"/g, '"');
  }
  for (const m of src.matchAll(/\bt\(\s*"([a-z][a-z0-9_]*)"\s*[,)]/g)) {
    const key = m[1];
    if (!en.has(key) && !(key in found)) noFallback.add(key);
  }
}

writeFileSync(join(root, "tmp/i18n-new.json"), JSON.stringify(found, null, 2));
console.error(`wrote ${Object.keys(found).length} keys to tmp/i18n-new.json`);
if (noFallback.size) {
  console.error(`\n// keys with no literal fallback (${noFallback.size}): ${[...noFallback].sort().join(", ")}`);
}