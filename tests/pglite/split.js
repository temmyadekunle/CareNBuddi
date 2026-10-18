const { PGlite, AUTH_STUB } = require("./migrate.js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const REPO = process.env.REPO ?? "C:/Users/USER/AppData/Local/Temp/opencode/carenbuddi-fix";

/** Splits a SQL file on ';' while respecting $$ ... $$ bodies and -- comments. */
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let inDollar = false;
  let inLine = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);
    if (inLine) {
      if (ch === "\n") inLine = false;
      buf += ch;
      continue;
    }
    if (!inDollar && two === "--") { inLine = true; buf += ch; continue; }
    if (two === "$$") { inDollar = !inDollar; buf += two; i += 1; continue; }
    if (ch === ";" && !inDollar) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

(async () => {
  const file = process.argv[2] ?? "0001_init.sql";
  const sql = readFileSync(join(REPO, "supabase", "migrations", file), "utf8");
  const stmts = splitStatements(sql);
  console.log(`${file}: ${stmts.length} statements`);

  const db = await PGlite.create();
  await db.exec(AUTH_STUB);

  let failed = 0;
  for (let i = 0; i < stmts.length; i += 1) {
    const s = stmts[i];
    try {
      await db.exec(s);
    } catch (e) {
      failed += 1;
      const head = s.replace(/\s+/g, " ").slice(0, 100);
      console.log(`\nFAILED at statement ${i + 1}/${stmts.length}:`);
      console.log("  " + head);
      console.log("  ERROR: " + e.message);
      console.log("  check_function_bodies = " + (await db.query("show check_function_bodies")).rows[0].check_function_bodies);
      break;
    }
  }
  if (!failed) console.log("ALL STATEMENTS APPLIED");
  await db.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });