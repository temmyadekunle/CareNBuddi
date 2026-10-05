// Coherence audit for the app screens: which pages skip the mobile shell
// primitives, still hardcode English, or risk horizontal overflow.
// Usage: node scripts/audit-pages.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", "out", ".git", "tmp"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(join(root, "app"));
const rows = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(root, file).replace(/\\/g, "/");
  if (rel.startsWith("app/(site)")) continue;

  const screen = /<Screen[\s>]/.test(src);
  const usesT = /useT\(/.test(src);
  // JSX text nodes with real words: >Some English words here<
  const textNodes = [...src.matchAll(/>\s*([A-Za-z][^<>{}\n]{6,})\s*</g)]
    .map((m) => m[1].trim())
    .filter((t) => /[a-z]{3}/i.test(t) && !/^[a-z-]+$/.test(t));
  const literals = [...src.matchAll(/(?:title|label|subtitle|body|hint|placeholder|name)=\{?"([A-Z][^"{\n]{5,})"/g)].map(
    (m) => m[1],
  );
  const wide = [...src.matchAll(/className="[^"]*(w-screen|min-w-\[|grid-cols-[4-9]|overflow-x-auto)[^"]*"/g)].length;
  const tables = /<table|<thead|<tr\b/.test(src);

  rows.push({
    rel,
    screen,
    usesT,
    hardcoded: textNodes.length + literals.length,
    wide,
    tables,
    lines: src.split("\n").length,
  });
}

rows.sort((a, b) => b.hardcoded - a.hardcoded || b.lines - a.lines);
console.log("route".padEnd(44), "Screen useT hard wide tbl lines");
for (const r of rows) {
  console.log(
    r.rel.replace(/^app\/\(app\)\//, "").replace(/\/page\.tsx$/, "").padEnd(44),
    String(r.screen).padEnd(6),
    String(r.usesT).padEnd(4),
    String(r.hardcoded).padEnd(5),
    String(r.wide).padEnd(4),
    String(r.tables).padEnd(3),
    r.lines,
  );
}