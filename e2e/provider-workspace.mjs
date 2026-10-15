import { chromium } from "playwright";

/**
 * Provider workspace access rules.
 *
 * Checks the three promises the workspace makes: an unverified applicant is
 * kept out, the screens never imply data that does not exist, and there is no
 * patient directory to browse.
 *
 * Run with: node e2e/provider-workspace.mjs http://127.0.0.1:8795
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:8795";
const bail = setTimeout(() => { console.log("HARD TIMEOUT"); process.exit(2); }, 240000);

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) { pass += 1; console.log(`ok    ${name}`); }
  else { fail += 1; console.log(`FAIL  ${name} ${extra}`); }
}

/** Waits out the server-rendered sign-in gate before reading the DOM. */
async function read(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page
    .waitForFunction(() => !document.body?.innerText?.includes("Sign in to continue"), null, { timeout: 20000 })
    .catch(() => {});
  // For a signed-in provider there is no gate, so the wait above resolves
  // against the server-rendered shell and reads it before React has rendered
  // anything. Give hydration a moment to settle before sampling.
  await page.waitForTimeout(1500);
  // innerText reflects CSS text-transform, so the dashboard tiles come back
  // uppercased. Compare case-insensitively rather than matching the styling.
  return (await page.locator("body").innerText()).toLowerCase();
}

/** Case-insensitive containment. */
function has(text, needle) {
  return text.toLowerCase().includes(needle.toLowerCase());
}
function hasNot(text, needle) {
  return !has(text, needle);
}

const browser = await chromium.launch();

/* ------------------------------------------------------------------
 * 1. A patient must not reach the provider workspace at all.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-up?role=consumer`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByLabel(/Full name/i).fill("Pia Consumer");
  await page.getByLabel(/^Email/i).fill(`pia-${Date.now()}@example.com`);
  await page.getByLabel(/^Password/i).fill("correct-horse-1");
  await page.getByLabel(/Confirm password/i).fill("correct-horse-1");
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i += 1) await boxes.nth(i).check();
  await page.getByRole("button", { name: /Create account/i }).last().click();
  await page.waitForURL("**/app", { timeout: 30000 });

  // /provider is intercepted by AppGuard itself, which shows its own staff
  // gate; the section pages are guarded by the provider shell. Either way the
  // patient must not reach the workspace.
  const dash = await read(page, "/provider");
  check(
    "a patient cannot open the provider workspace",
    !has(dash, "Needs your attention") && !has(dash, "Your patients"),
    `(got: ${dash.slice(0, 80)})`,
  );

  for (const p of ["/provider/patients", "/provider/practice", "/provider/rapid-response"]) {
    const t = await read(page, p);
    check(`a patient is kept out of ${p}`, has(t, "Provider access only"));
  }
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 2. An unverified applicant sees the locked state, not the workspace.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/sign-up/role`, { waitUntil: "networkidle", timeout: 30000 });
  await page.getByText("Register your practice and start accepting patients.").click();
  await page.waitForURL("**/provider/register", { timeout: 30000 });
  await page.getByLabel(/Full name/i).fill("Dr Ada Verification");
  await page.getByLabel(/^Email/i).fill(`ada-${Date.now()}@example.com`);
  await page.getByLabel(/^Password/i).fill("correct-horse-1");
  await page.getByLabel(/Confirm password/i).fill("correct-horse-1");
  await page.locator("select").first().selectOption("doctor");
  const checks = page.locator('input[type="checkbox"]');
  for (let i = 0; i < (await checks.count()); i += 1) await checks.nth(i).check();
  await page.getByRole("button", { name: /Create account and continue/i }).click();
  try {
    await page.waitForURL("**/provider/onboarding**", { timeout: 40000 });
  } catch {
    console.log("DEBUG url:", page.url());
    console.log("DEBUG body:", (await page.locator("body").innerText()).slice(0, 400));
    throw new Error("did not reach provider onboarding");
  }

  const dash = await read(page, "/provider");
  check(
    "an unverified applicant is locked out of the dashboard",
    has(dash, "not available yet") || has(dash, "under review"),
    `(got: ${dash.slice(0, 80)})`,
  );
  const care = await read(page, "/provider/patients");
  check("an unverified applicant cannot list patients", has(care, "not available yet"));
  await ctx.close();
}

/* ------------------------------------------------------------------
 * 3. A verified provider sees real data only: no invented patients,
 *    no directory, and honest "not built" wording elsewhere.
 * ------------------------------------------------------------------ */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Approved facility registration, so the account resolves to a real practice.
  // This is the same record the admin review flow writes. It is installed
  // before any app script runs: the storage layer caches its first read for
  // the life of the page, so writing after load would be ignored.
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "healthlink:users",
      JSON.stringify([
        {
          id: "u-e2e-prov",
          name: "Dr E2E Provider",
          email: "e2e-provider@example.com",
          role: "provider",
          lang: "en",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );
    localStorage.setItem(
      "healthlink:provider-requests",
      JSON.stringify([
        {
          id: "e2e-req",
          name: "Dr E2E Provider",
          email: "e2e-provider@example.com",
          facility: "E2E Clinic",
          category: "Clinic",
          state: "Lagos",
          lga: "Lagos Island",
          address: "1 Test Road",
          phone: "+234 800 000 0000",
          status: "approved",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );
    localStorage.setItem("healthlink:session", JSON.stringify({ userId: "u-e2e-prov", lang: "en" }));
    // No bookings: an empty practice must read as empty, not as populated.
    localStorage.setItem("healthlink:bookings", JSON.stringify([]));
    localStorage.removeItem("healthlink:practice-settings");
  });

  const dash = await read(page, "/provider");
  check("a verified provider reaches the dashboard", hasNot(dash, "Provider access only"));
  check("dashboard reports zero rather than inventing activity", has(dash, "new care requests"));
  check("no patient directory language", hasNot(dash, "patient directory") && hasNot(dash, "search patients") && hasNot(dash, "all patients"));
  check("no emergency dispatch claim on the dashboard", hasNot(dash, "dispatched") && hasNot(dash, "ambulance sent"));

  const care = await read(page, "/provider/patients");
  check("patient care is empty when there are no bookings", has(care, "No patients yet"));
  check("the empty state explains there is no directory", has(care, "no patient directory"));

  const practice = await read(page, "/provider/practice");
  check("practice says hours are not set", has(practice, "Hours not set"));
  check(
    "practice does not claim the provider is available",
    hasNot(practice, "you are available") && hasNot(practice, "currently available") && hasNot(practice, "accepting patients now"),
  );

  const rapid = await read(page, "/provider/rapid-response");
  check("rapid response is labelled awaiting integration", has(rapid, "Awaiting integration"));
  check(
    "rapid response makes no dispatch promise",
    has(rapid, "no responder has been alerted") && has(rapid, "not connected to an ambulance"),
  );

  const community = await read(page, "/provider/community");
  check("community is labelled not available", has(community, "Not available yet"));

  const profile = await read(page, "/provider/profile");
  check(
    "profile never exposes identity documents or NIN",
    !/NIN[:\s]\d|\d{11}/.test(profile) && hasNot(profile, "identity document.png"),
  );
  check("profile states private documents stay private", has(profile, "never shown here"));
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
clearTimeout(bail);
await browser.close();
process.exit(fail === 0 ? 0 : 1);