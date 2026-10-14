/**
 * End-to-end check of the provider journey, driven through a real browser
 * against the real asset runtime (wrangler dev).
 *
 * This is the thing that unit tests cannot prove: that a person can actually
 * walk the path, that the registration form is reachable, that progress
 * survives a reload, and that re-visiting the registration page does not start
 * a second application.
 *
 * Run with:  node e2e/provider-journey.mjs http://127.0.0.1:8795
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:8795";
const results = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
const notFound = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 400) notFound.push(`${r.status()} ${r.url()}`);
});

const EMAIL = `e2e-provider-${Date.now()}@example.com`;

/* 1. A brand-new visitor can reach the provider registration form. */
await page.goto(`${BASE}/auth/choice`, { waitUntil: "networkidle" });
check("welcome screen loads", await page.getByText("Welcome to CareNBuddi").isVisible());

await page.getByText("Create account").first().click();
await page.waitForURL("**/auth/sign-up/role", { timeout: 15000 });
const roleText = await page.locator("body").innerText();
check("role selection loads", roleText.includes("Create your account"));
check("role selection offers patient", roleText.includes("Patient"));
check("role selection offers provider", roleText.includes("Healthcare provider"));

/* Both options must be real, keyboard-reachable controls. They were
   <div onClick>, which put the most important choice on the screen out of
   reach for anyone not using a mouse. */
const cardTags = await page.evaluate(() => {
  const link = (needle) =>
    [...document.querySelectorAll("main a, main button")].find((a) =>
      (a.innerText || "").includes(needle),
    );
  const patient = link("Track your health");
  const provider = link("Register your practice");
  return {
    patient: patient ? patient.tagName : null,
    provider: provider ? provider.tagName : null,
  };
});
check("patient option is a real control", cardTags.patient === "A", String(cardTags.patient));
check("provider option is a real control", cardTags.provider === "A", String(cardTags.provider));

await page.goto(`${BASE}/auth/sign-up/role`, { waitUntil: "networkidle" });
let keyboardReached = false;
for (let i = 0; i < 25; i += 1) {
  await page.keyboard.press("Tab");
  const txt = await page.evaluate(() => (document.activeElement?.innerText || "").trim());
  if (txt.includes("Register your practice")) { keyboardReached = true; break; }
}
check("provider option is reachable by keyboard", keyboardReached);

/* Choosing Patient must actually preselect Patient. */
await page.goto(`${BASE}/auth/sign-up?role=consumer`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const selectedRole = await page.evaluate(() => {
  const pressed = [...document.querySelectorAll("main button")].find(
    (b) => b.getAttribute("aria-pressed") === "true",
  );
  return pressed ? pressed.innerText.trim() : null;
});
check("?role=consumer preselects Patient", selectedRole === "Patient", String(selectedRole));

await page.goto(`${BASE}/auth/sign-up/role`, { waitUntil: "networkidle" });
await page.getByText("Register your practice and start accepting patients.").click();
await page.waitForURL("**/provider/register", { timeout: 15000 });

/* 2. No sign-in gate, and the form is actually there. */
const bodyText = await page.locator("body").innerText();
check("registration form is not gated", !bodyText.includes("Sign in to continue"));
check("form asks for a name", bodyText.includes("Full name"));
check("form asks for a password", bodyText.includes("Password"));
check("form asks for a category", bodyText.includes("Professional category"));
check("consent is required", bodyText.includes("Terms of Service"));

const categoryOptions = await page.locator("select option").allInnerTexts();
check("11 professional categories offered", categoryOptions.length >= 12, `${categoryOptions.length - 1} categories + placeholder`);

/* 3. Validation blocks an incomplete submission. */
await page.getByRole("button", { name: /Create account and continue/i }).click();
await page.waitForTimeout(400);
const afterInvalid = await page.locator("body").innerText();
check("incomplete form is rejected", afterInvalid.includes("Enter your full professional name."));

/* 4. Complete it and create the account. */
await page.getByLabel(/Full name/i).fill("Dr Ada Nwosu");
await page.getByLabel(/^Email/i).fill(EMAIL);
await page.getByLabel(/^Password/i).fill("correct-horse-1");
await page.getByLabel(/Confirm password/i).fill("correct-horse-1");
await page.locator("select").first().selectOption("doctor");

const boxes = page.locator('input[type="checkbox"]');
const boxCount = await boxes.count();
check("consent checkboxes present", boxCount >= 2, `${boxCount} checkbox(es) incl. trainee toggle`);
for (let i = 0; i < boxCount; i += 1) await boxes.nth(i).check();

await page.getByRole("button", { name: /Create account and continue/i }).click();

try {
  await page.waitForURL("**/provider/onboarding**", { timeout: 20000 });
} catch {
  const dump = await page.locator("body").innerText();
  console.log("\n--- page after submit ---");
  console.log("URL:", page.url());
  console.log(dump.slice(0, 900));
  console.log("-------------------------\n");
}
check("registration lands on onboarding, not sign-in", page.url().includes("/provider/onboarding"));

/* 5. Onboarding explains what happens next, on whichever step you land. */
const obText = await page.locator("body").innerText();
if (!obText.includes("Our review team checks your application")) {
  console.log("\n--- onboarding body text ---");
  console.log(obText.slice(0, 1200));
  console.log("----------------------------\n");
}
check("onboarding is titled for professionals", obText.includes("Welcome to CareNBuddi Professional"));
check("onboarding says what happens next", obText.includes("Our review team checks your application"));
check("onboarding shows a progress indicator", obText.includes("Profile") && obText.includes("Identity"));
check("lands on the first outstanding step, not the end", obText.includes("Speciality or area of practice"));

/* 6. Consent captured at registration is remembered: the Start step is done. */
await page.getByRole("button", { name: /^Start/ }).click();
await page.waitForTimeout(400);
const welcomeText = await page.locator("body").innerText();
check("welcome step reachable from the stepper", welcomeText.includes("Before you apply we need your consent"));

const consentBoxes = page.locator('input[type="checkbox"]');
const consentCount = await consentBoxes.count();
check("welcome step has consent boxes", consentCount === 2, `${consentCount}`);
const alreadyChecked = await consentBoxes.nth(0).isChecked();
check("consent from registration is remembered", alreadyChecked);

/* Toggle it off and back on, then reload to prove progress is persisted. */
await consentBoxes.nth(0).uncheck();
await consentBoxes.nth(0).check();
await page.waitForTimeout(500);
await page.reload({ waitUntil: "networkidle" });
const afterReload = await page.locator("body").innerText();
check("onboarding survives a reload", afterReload.includes("Welcome to CareNBuddi Professional"));
check("orientation survives a reload", afterReload.includes("Our review team checks your application"));

// A reload returns to the first outstanding step, which is where the applicant
// left off — not step one. That is the resume behaviour we want.
await page.getByRole("button", { name: /^Start/ }).click();
await page.waitForTimeout(400);
const consentAfterReload = await page.locator('input[type="checkbox"]').first().isChecked();
check("progress persisted across reload", consentAfterReload === true);

/* 6b. Fill the profile and confirm it persists too. */
await page.getByRole("button", { name: /^Profile/ }).click();
await page.waitForTimeout(300);
await page.getByLabel(/Speciality or area of practice/i).fill("Community paediatrics");
// On this step the first select is the professional category; state is the next.
await page.locator("select").nth(1).selectOption("Lagos");
await page.getByLabel(/^City/i).fill("Ikeja");
await page.getByRole("button", { name: /^Continue/ }).click();
await page.waitForTimeout(600);
const storedAfterProfile = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("healthlink:provider-applications") ?? "[]"),
);
check("profile field persisted", storedAfterProfile[0]?.speciality === "Community paediatrics", storedAfterProfile[0]?.speciality);
check("state selection persisted", storedAfterProfile[0]?.state === "Lagos", storedAfterProfile[0]?.state);
check("moving on advances the step", (await page.locator("body").innerText()).includes("Identity verification"));

/* 7. Re-visiting the registration page must not start a second application. */
await page.goto(`${BASE}/provider/register`, { waitUntil: "networkidle" });
const revisit = await page.locator("body").innerText();
check("revisit does not show a fresh form", revisit.includes("You already have an application"));
check("revisit offers to resume", revisit.includes("Continue my application"));

/* 8. Exactly one application exists for the account. */
const stored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("healthlink:provider-applications") ?? "[]"),
);
check("exactly one application exists", stored.length === 1, `${stored.length} application(s)`);
check("it belongs to the new account", stored[0]?.email === EMAIL);

/* 9. A brand-new visitor, same journey, still gets the form. */
const fresh = await context.browser().newContext();
const freshPage = await fresh.newPage();
await freshPage.goto(`${BASE}/provider/register`, { waitUntil: "networkidle" });
const freshText = await freshPage.locator("body").innerText();
check("a different visitor still sees the form", freshText.includes("Create your provider account"));
check("a different visitor is not gated", !freshText.includes("Sign in to continue"));
await fresh.close();

/* 10. Patient routes are untouched. */
for (const [label, url] of [
  ["patient home", "/app"],
  ["find care", "/find-care"],
  ["health", "/health"],
  ["appointments", "/appointments"],
  ["profile", "/profile"],
  ["support", "/support"],
]) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  check(`${label} still loads`, !page.url().includes("_not-found"));
}

check(
  "no failed requests during the journey",
  notFound.length === 0,
  [...new Set(notFound)].slice(0, 4).join(" | "),
);
check("no console errors during the journey", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);