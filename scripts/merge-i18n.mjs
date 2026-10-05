// Merges tmp/i18n-new-keys.json into the four dictionaries (en, yo, ha, ig),
// skipping keys that already exist. Run with: node scripts/merge-i18n.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const data = JSON.parse(readFileSync(join(root, "tmp/i18n-new-keys.json"), "utf8"));

const targets = {
  en: join(root, "lib/i18n.ts"),
  yo: join(root, "lib/dict/yo.ts"),
  ha: join(root, "lib/dict/ha.ts"),
  ig: join(root, "lib/dict/ig.ts"),
};

const escape = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

let inserted = 0;
let skipped = 0;

for (const [lang, file] of Object.entries(targets)) {
  let src = readFileSync(file, "utf8");
  const lines = [];
  for (const [key, values] of Object.entries(data)) {
    const value = values[lang];
    if (!value) {
      console.error(`missing ${lang} value for ${key}`);
      process.exitCode = 1;
      continue;
    }
    if (new RegExp(`(?:^|[\\s{,])${key}\\s*:`).test(src)) {
      skipped += 1;
      continue;
    }
    lines.push(`  ${key}: "${escape(value)}",`);
    inserted += 1;
  }
  if (!lines.length) continue;

  const crlf = src.indexOf("\r\n};");
  const lf = src.indexOf("\n};");
  const at = crlf !== -1 ? crlf : lf;
  if (at === -1) {
    console.error(`could not find dictionary terminator in ${file}`);
    process.exit(1);
  }
  const eol = crlf !== -1 ? "\r\n" : "\n";
  src = `${src.slice(0, at)}${eol}${lines.join(eol)}${src.slice(at)}`;
  writeFileSync(file, src, "utf8");
  console.log(`${lang}: inserted ${lines.length}`);
}

console.log(`done — ${inserted} inserted, ${skipped} already present`);
