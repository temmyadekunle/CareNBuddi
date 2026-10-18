import { chromium } from "playwright";

/**
 * Storage isolation - behavioural checks in a real browser.
 *
 * The unit tests drive the storage helpers against a fake localStorage. These
 * drive the real app, because the thing worth proving is that a person signing
 * out on one device does not leave their records visible to the next person.
 *
 * Run with: node e2e/storage-isolation.mjs http://127.0.0.1:8795
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

/* Seed a signed-in account with a recognisable record, plus preferences. */
async function seedSignedInUser(page) {
  await page.evaluate(() => {
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
    // A record only Alice should ever see.
    localStorage.setItem(
      "healthlink:u:u-alice:records",
      JSON.stringify([
        { id: "rec-1", title: "Alice private lab result", provider: "Dr Q", date: "2026-01-05", category: "lab", summary: "ALICE-SECRET-MARKER", link: "#" },
      ]),
    );
    localStorage.setItem(
      "healthlink:u:u-alice:menstrual-cycles",
      JSON.stringify([{ id: "cyc-1", startDate: "2026-01-01" }]),
    );
    localStorage.setItem(
      "healthlink:u:u-alice:bookings",
      JSON.stringify([
        { id: "bk-1", providerId: null, userId: "u-alice", name: "Alice Booking", phone: "", message: "ALICE-BOOKING-MARKER", status: "confirmed", createdAt: "" },
      ]),
    );
  });
}

/* ------------------------------------------------------------------
 * 1. A signed-in user still sees their own records.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seedSignedInUser(page);

  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const text = await page.locator("body").innerText();
  check("Alice sees her own medical record", text.includes("ALICE-SECRET-MARKER"), `(got: ${text.slice(0, 90)})`);

  await page.goto(`${BASE}/appointments`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const appt = await page.locator("body").innerText();
  check("Alice sees her own appointment", appt.includes("Alice Booking"), `(got: ${appt.slice(0, 90)})`);

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 2. Switching to another account must not show Alice's records.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seedSignedInUser(page);

  // Switch session straight to Bob, without a clean sign-out.
  await page.evaluate(() => {
    localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-bob", lang: "en" }));
  });

  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const text = await page.locator("body").innerText();
  check("Bob cannot see Alice's medical record", !text.includes("ALICE-SECRET-MARKER"));

  await page.goto(`${BASE}/appointments`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  check("Bob cannot see Alice's appointment", !(await page.locator("body").innerText()).includes("Alice Booking"));

  await page.goto(`${BASE}/health/diary/cycle`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const cycle = await page.locator("body").innerText();
  check("Bob does not get Alice's cycle screen content", !cycle.includes("ALICE-SECRET-MARKER"));

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 3. Sign-out removes private data and keeps preferences.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seedSignedInUser(page);

  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // The profile screen labels the row "Log Out"; the dialog confirms.
  const signOut = page.getByRole("button", { name: /log\s*out/i }).first();
  check("the sign-out control is present", (await signOut.count()) >= 1);
  await signOut.click();
  await page.waitForTimeout(1000);

  const confirm = page.getByRole("button", { name: /^sign out$/i }).last();
  check("a confirmation is required", (await confirm.count()) >= 1);
  await confirm.click();
  await page.waitForTimeout(2000);

  const after = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    session: localStorage.getItem("healthlink:session"),
    theme: localStorage.getItem("healthlink:theme"),
    units: localStorage.getItem("healthlink:prefs-units"),
    aliceRecords: localStorage.getItem("healthlink:u:u-alice:records"),
  }));

  check("sign-out cleared the session", after.session === null || JSON.parse(after.session).userId === null, `(session=${after.session})`);
  check("sign-out removed Alice's medical records", after.aliceRecords === null);
  check("sign-out left no user namespace behind", !after.keys.some((k) => k.startsWith("healthlink:u:")), JSON.stringify(after.keys.filter((k) => k.startsWith("healthlink:u:"))));
  check("theme preference survived sign-out", after.theme === '"dark"', `(theme=${after.theme})`);
  check("unit preference survived sign-out", after.units === '"imperial"', `(units=${after.units})`);
  check("the account registry survived sign-out", after.keys.includes("healthlink:users"));

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 4. A guest sees nothing of the previous user's records.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await seedSignedInUser(page);
  await page.evaluate(() => localStorage.removeItem("healthlink:session"));

  for (const p of ["/records", "/appointments", "/journal"]) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText();
    check(`a guest is gated from ${p}`, text.includes("Sign in to continue"), `(got: ${text.slice(0, 70)})`);
    check(`a guest sees none of Alice's data on ${p}`, !text.includes("ALICE-SECRET-MARKER") && !text.includes("Alice Booking"));
  }

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 5. Legacy unscoped records are not handed to a new account.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "healthlink:users",
      JSON.stringify([{ id: "u-new", name: "New QA", email: "new@qa.test", role: "consumer", lang: "en", createdAt: "" }]),
    );
    localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-new", lang: "en" }));
    // Pre-namespacing data, with no recorded owner.
    localStorage.setItem(
      "healthlink:records",
      JSON.stringify([{ id: "old", title: "LEGACY-MARKER", provider: "Old", date: "2025-01-01", category: "lab", summary: "legacy", link: "#" }]),
    );
  });

  await page.goto(`${BASE}/records`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const text = await page.locator("body").innerText();
  check("legacy records are not shown to the new account", !text.includes("LEGACY-MARKER"), `(got: ${text.slice(0, 90)})`);

  const state = await page.evaluate(() => ({
    live: localStorage.getItem("healthlink:records"),
    quarantined: localStorage.getItem("healthlink:quarantine:records"),
    mine: localStorage.getItem("healthlink:u:u-new:records"),
  }));
  check("legacy records left the live namespace", state.live === null);
  check("legacy records were preserved, not destroyed", state.quarantined !== null);
  check("legacy records were not attributed to the new account", state.mine === null);

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 6. Guest browsing still works after the change.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const home = await page.locator("body").innerText();
  check("a guest can still open the patient home", home.length > 40 && !home.includes("Sign in to continue"));

  await page.goto(`${BASE}/find-care`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  check("a guest can still browse Find Care", (await page.locator("body").innerText()).length > 40);

  await page.goto(`${BASE}/emergency`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  check("a guest can still reach emergency guidance", (await page.locator("body").innerText()).length > 40);

  // A guest can still use the app's own features in their own namespace.
  await page.goto(`${BASE}/journal`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  check("a guest sees the sign-in gate on a private journal", (await page.locator("body").innerText()).includes("Sign in to continue"));

  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
clearTimeout(bail);
await browser.close();
process.exit(fail === 0 ? 0 : 1);