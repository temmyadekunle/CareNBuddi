const { PGlite } = require("@electric-sql/pglite");

(async () => {
  const db = await PGlite.create();
  const v = await db.query("select version()");
  console.log("VERSION:", v.rows[0].version);

  const su = await db.query(
    "select rolbypassrls, rolsuper from pg_roles where rolname = 'postgres'",
  );
  console.log("postgres role flags:", JSON.stringify(su.rows));

  const jwt = await db.query(
    "select current_setting('request.jwt.claims', true) as c",
  );
  console.log("request.jwt.claims readable:", JSON.stringify(jwt.rows));

  // The features the migration depends on.
  for (const sql of [
    "create role anon nologin",
    "create role authenticated nologin",
    "create role service_role nologin bypassrls",
    "create table public.probe(id int primary key, role text)",
    "alter table public.probe enable row level security",
    "create policy p on public.probe for select using (auth_ok())",
  ]) {
    try {
      if (sql.includes("auth_ok()")) {
        await db.exec("create schema if not exists auth");
        await db.exec(
          "create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid $$",
        );
      }
      await db.exec(sql);
      console.log("OK  :", sql.slice(0, 64));
    } catch (e) {
      console.log("FAIL:", sql.slice(0, 64), "->", e.message);
    }
  }

  await db.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});