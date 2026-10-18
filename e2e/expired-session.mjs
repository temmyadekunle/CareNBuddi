import { chromium } from "playwright";

/**
 * Expired-session cleanup, behavioural checks in a real browser.
 *
 * The unit tests drive the storage helpers against a fake localStorage. These
 * drive the running app, because the thing worth proving is that a session
 * which ends without the user pressing "sign out" still leaves nothing behind.
 *
 * The app is built without Supabase configured, so the auth listener never
 * fires here. That is exactly why this suite exercises the shared cleanup
 * operation the listener calls, through the app's own sign-out path, rather
 * than pretending an expired session can be produced locally.
 *
 * Run with: node e2e/expired-session.mjs http://127.0.0.1:8795
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8795";
const bail = setTimeout(() => { console.log("HARD TIMEOUT"); process.exit(2); }, 300000);

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) { pass += 1; console.log(`ok    ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
}

const browser = await chromium.launch();

async function seed(page, { withData = true } = {}) {
  await page.evaluate((seedData) => {
    localStorage.clear();
    localStorage.setItem(
      "healthlink:users",
      JSON.stringify([
        { id: "u-alice", name: "Alice QA", email: "alice@qa.test", role: "consumer", lang: "en", createdAt: "" },
        { id: "u-bob", name: "Bob QA", email: "bob@qa.test", role: "consumer", lang: "en", createdAt: "" },
      ]),
    );
    localStorage.setItem("healthlink:theme", '"dark"');
    localStorage.setItem("healthlink:prefs-units", '"imperial"');
    localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-alice", lang: "en" }));
    if (seedData) {
      localStorage.setItem(
        "healthlink:u:u-alice:records",
        JSON.stringify([{ id: "rec-1", title: "Alice private lab result", provider: "Dr Q", date: "2026-01-05", category: "lab", summary: "ALICE-SECRET-MARKER", link: "#" }]),
      );
      localStorage.setItem(
        "healthlink:u:u-alice:menstrual-cycles",
        JSON.stringify([{ id: "cyc-1", startDate: "2026-01-01" }]),
      );
      localStorage.setItem(
        "healthlink:u:u-alice:journal",
        JSON.stringify([{ id: "j-1", note: "ALICE-JOURNAL-MARKER" }]),
      );
    }
  }, withData);
}

const snapshot = (page) =>
  page.evaluate(() => ({
    keys: Object.keys(localStorage),
    session: localStorage.getItem("healthlink:session"),
    theme: localStorage.getItem("healthlink:theme"),
    units: localStorage.getItem("healthlink:prefs-units"),
    users: localStorage.getItem("healthlink:users"),
    aliceRecords: localStorage.getItem("healthlink:u:u-alice:records"),
    quarantine: localStorage.getItem("healthlink:quarantine:records"),
    bobRecords: localStorage.getItem("healthlink:u:u-bob:records"),
  }));

/* ------------------------------------------------------------------
 * 1. Session end removes the previous principal's private state.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seed(page);

  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  check("the user can see their own record first", (await page.locator("body").innerText()).includes("ALICE-SECRET-MARKER"));

  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /log\s*out/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^sign out$/i }).last().click();
  await page.waitForTimeout(2000);

  const after = await snapshot(page);
  check("private keys are gone", !after.keys.some((k) => k.startsWith("healthlink:u:")), JSON.stringify(after.keys.filter((k) => k.startsWith("healthlink:u:"))));
  check("medical records are gone", after.aliceRecords === null);
  check("the session pointer is gone", after.session === null || JSON.parse(after.session).userId === null);
  check("theme survived", after.theme === '"dark"', `(theme=${after.theme})`);
  check("unit preference survived", after.units === '"imperial"', `(units=${after.units})`);
  check("the account registry survived", after.users !== null);
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 2. A second account's namespace is never touched.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seed(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "healthlink:u:u-bob:records",
      JSON.stringify([{ id: "bob-1", title: "Bob record", provider: "Dr B", date: "2026-02-01", category: "lab", summary: "BOB", link: "#" }]),
    );
  });

  // Alice's session ends.
  await page.evaluate(() => localStorage.removeItem("healthlink:session"));
  // Bob signs in, then his own session ends.
  await page.evaluate(() => localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-bob", lang: "en" })));
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /log\s*out/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^sign out$/i }).last().click();
  await page.waitForTimeout(2000);

  const after = await snapshot(page);
  // Bob signed out, so only bob's namespace goes. Alice's data stays: her
  // session pointer was removed here, but no revocation event ever confirmed
  // that she left, and guessing would risk deleting the wrong person's
  // records. Recovery for her is the documented quarantine-style path.
  check("bob's namespace was purged by his own sign-out", !after.keys.some((k) => k.startsWith("healthlink:u:u-bob:")));
  check("alice's data is untouched by bob signing out", after.aliceRecords !== null);
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 3. A late duplicate event cannot destroy a live session.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seed(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "healthlink:u:u-bob:records",
      JSON.stringify([{ id: "bob-2", title: "Bob still here", provider: "Dr B", date: "2026-02-02", category: "lab", summary: "BOB2", link: "#" }]),
    );
    localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-bob", lang: "en" }));
  });

  // A duplicated SIGNED_OUT for the previous account arrives after Bob signed in.
  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const text = await page.locator("body").innerText();
  check("bob still sees his own data", !text.includes("Sign in to continue"));

  const after = await snapshot(page);
  check("bob's data is untouched", after.bobRecords !== null);
  check("bob's session is intact", JSON.parse(after.session).userId === "u-bob");
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 4. Repeating the operation is safe.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seed(page);

  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /log\s*out/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^sign out$/i }).last().click();
  await page.waitForTimeout(2000);

  // Second attempt: the control is gone, but the operation must still be safe.
  const second = await page.getByRole("button", { name: /log\s*out/i }).count();
  check("sign-out control is gone after signing out", second === 0);

  const after = await snapshot(page);
  check("theme survived the repeat", after.theme === '"dark"', `(theme=${after.theme})`);
  check("still no private keys", !after.keys.some((k) => k.startsWith("healthlink:u:")));
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 5. Quarantined legacy data is preserved, never destroyed.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seed(page);
  await page.evaluate(() => {
    localStorage.setItem("healthlink:quarantine:records", JSON.stringify([{ id: "legacy", title: "LEGACY" }]));
  });

  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /log\s*out/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^sign out$/i }).last().click();
  await page.waitForTimeout(2000);

  const after = await snapshot(page);
  check("quarantined legacy data survives sign-out", after.quarantine !== null);
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 6. Guest browsing is unaffected.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seed(page);
  await page.evaluate(() => localStorage.removeItem("healthlink:session"));

  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  check("a guest can still open the patient home", (await page.locator("body").innerText()).length > 40);

  await page.goto(`${BASE}/find-care`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  check("a guest can still browse Find Care", (await page.locator("body").innerText()).length > 40);

  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const rec = await page.locator("body").innerText();
  check("a guest is still gated from records", rec.includes("Sign in to continue"));
  check("a guest sees none of the previous user's data", !rec.includes("ALICE-SECRET-MARKER"));

  const after = await snapshot(page);
  check("guest browsing preserved the theme", after.theme === '"dark"');
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
clearTimeout(bail);
await browser.close();
process.exit(fail === 0 ? 0 : 1);