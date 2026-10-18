import { chromium } from "playwright";

/**
 * Offline sign-in hardening - behavioural checks in a real browser.
 *
 * Covers the properties that cannot be proven by reading source: that a wrong
 * password creates no session, that a hand-written localStorage id does not
 * open a protected route, and that guest browsing still works.
 *
 * Run with: node e2e/auth-hardening.mjs http://127.0.0.1:8795
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8795";
const bail = setTimeout(() => { console.log("HARD TIMEOUT"); process.exit(2); }, 240000);

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) { pass += 1; console.log(`ok    ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
}

/** Reads the session exactly as the app stores it. */
const readSession = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("healthlink:session") ?? "null"));

async function fresh() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  return { ctx, page };
}

const browser = await chromium.launch();

/* ------------------------------------------------------------------
 * 1. Sign-in offers no credential form and never creates a session.
 * ------------------------------------------------------------------ */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  check("sign-in explains that secure sign-in is unavailable", /temporarily unavailable/i.test(body));
  check("the unavailable notice is announced", (await page.getByRole("status").count()) >= 1);

  const passwordFields = await page.locator('input[type="password"]').count();
  check("no password field is offered", passwordFields === 0, `(found ${passwordFields})`);

  // Submitting the form, if any, must not authenticate.
  await page.evaluate(() => {
    const form = document.querySelector("form");
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(800);
  const session = await readSession(page);
  check("submitting does not create a session", !session?.userId, `(session=${JSON.stringify(session)})`);

  const guestLink = await page.getByRole("link", { name: /continue as guest/i }).count();
  check("guest entry remains available", guestLink >= 1);
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 2. Email-only cannot authenticate: the old sign-in is unreachable.
 * ------------------------------------------------------------------ */
{
  const { ctx, page } = await fresh();
  // Pre-create a local account that a victim already "owns".
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "healthlink:users",
      JSON.stringify([
        { id: "u-victim", name: "Victim", email: "victim@qa.test", role: "consumer", lang: "en", createdAt: "" },
      ]),
    );
  });

  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);

  // No email input means no way to submit an email at all.
  const emailInputs = await page.locator('input[type="email"]').count();
  check("no email field is offered on sign-in", emailInputs === 0, `(found ${emailInputs})`);

  // Navigate to /auth/sign-up and try to claim the existing account.
  await page.goto(`${BASE}/auth/sign-up`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByLabel(/Full name/i).fill("Attacker");
  await page.getByLabel(/^Email/i).fill("victim@qa.test");
  await page.getByLabel(/^Password/i).fill("whatever-password-1");
  await page.getByLabel(/Confirm password/i).fill("whatever-password-1");
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i += 1) await boxes.nth(i).check();
  await page.getByRole("button", { name: /Create account/i }).last().click();
  await page.waitForTimeout(1500);

  const session = await readSession(page);
  check("sign-up cannot claim an existing account", session?.userId !== "u-victim", `(session=${JSON.stringify(session)})`);

  const page2 = await page.locator("body").innerText();
  check("the duplicate is refused with an explanation", /already uses that email|cannot confirm who you are/i.test(page2), `(got: ${page2.slice(0, 90)})`);

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 3. Protected routes do not trust a client-written session id.
 * ------------------------------------------------------------------ */
{
  const { ctx, page } = await fresh();
  // A session id that matches no account, written straight into storage.
  await ctx.addInitScript(() => {
    localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-fabricated", lang: "en" }));
    localStorage.setItem("healthlink:users", JSON.stringify([]));
  });

  for (const p of ["/profile", "/records", "/journal", "/appointments", "/reminders"]) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);
    const text = await page.locator("body").innerText();
    check(`a fabricated session cannot open ${p}`, text.includes("Sign in to continue"), `(got: ${text.slice(0, 70)})`);
  }

  for (const p of ["/admin", "/provider"]) {
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);
    const text = await page.locator("body").innerText();
    check(`a fabricated session cannot open ${p}`, text.includes("Sign in to continue"), `(got: ${text.slice(0, 70)})`);
  }

  // The registration page must stay reachable: gating it locks out applicants.
  await page.goto(`${BASE}/provider/register`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const reg = await page.locator("body").innerText();
  check("provider registration stays reachable", !reg.includes("Sign in to continue"));

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 4. Guest browsing still works and is not shown as signed in.
 * ------------------------------------------------------------------ */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const home = await page.locator("body").innerText();
  check("a guest can open the patient home", home.length > 40 && !home.includes("Sign in to continue"));
  check("a guest is offered the sign-in path, not shown as signed in", /sign ?in/i.test(home));

  await page.goto(`${BASE}/find-care`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  check("a guest can browse Find Care", (await page.locator("body").innerText()).length > 40);

  await ctx.close();
}

/* ------------------------------------------------------------------
 * 5. No demo-role switcher and no on-screen verification code.
 * ------------------------------------------------------------------ */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const text = await page.locator("body").innerText();
  check("the demo role switcher is gone", !/try a demo role/i.test(text));
  check("no verification code is displayed", !/demo mode shows the code/i.test(text));
  check("the account page explains sign-in is unavailable", /temporarily unavailable/i.test(text));
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 6. Guest preferences are preserved: nothing wiped storage.
 * ------------------------------------------------------------------ */
{
  const { ctx, page } = await fresh();
  await ctx.addInitScript(() => {
    localStorage.setItem("healthlink:theme", "dark");
    localStorage.setItem("healthlink:prefs-units", "imperial");
  });
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const kept = await page.evaluate(() => ({
    theme: localStorage.getItem("healthlink:theme"),
    units: localStorage.getItem("healthlink:prefs-units"),
  }));
  check("theme preference is preserved", kept.theme === "dark");
  check("unit preference is preserved", kept.units === "imperial");
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
clearTimeout(bail);
await browser.close();
process.exit(fail === 0 ? 0 : 1);