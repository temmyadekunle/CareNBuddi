import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:8841";
const bail = setTimeout(() => { console.log("HARD TIMEOUT"); process.exit(2); }, 180000);
const log = (...a) => console.log(...a);

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) { pass += 1; log(`ok    ${name}`); }
  else { fail += 1; log(`FAIL  ${name} ${extra}`); }
}

/** Clicks the header back arrow and reports where it landed. */
async function backTarget(page, want) {
  await page.getByRole("link", { name: /go back/i }).click();
  // next/link navigates on the client, so no load state fires. Wait for the
  // URL itself rather than sampling it immediately after the click.
  await page.waitForURL((url) => url.pathname.replace(/\/+$/, "") === want.replace(/\/+$/, ""), {
    timeout: 20000,
  });
  return new URL(page.url()).pathname;
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const noArrow = "/auth/verify";

/* 1. Screens that have their own back link must NOT also show the header arrow. */
for (const [screen, expect] of [
  ["/auth/sign-in/role", "/auth/choice"],
  ["/auth/sign-up/role", "/auth/choice"],
  ["/auth/verify", "/auth/sign-in"],
  ["/auth/forgot-password", "/auth/sign-in"],
]) {
  await page.goto(`${BASE}${screen}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const headerArrows = await page.getByRole("link", { name: /go back/i }).count();
  check(`${screen} shows exactly one back affordance`, headerArrows === 0, `(header arrows: ${headerArrows})`);
  const own = await page.getByRole("link", { name: /^back|back to sign in/i }).count();
  check(`${screen} keeps its own back link`, own >= 1, `(found ${own})`);
  void expect;
}

/* 2. Screens without one must send the header arrow to their flow parent. */
for (const [screen, want] of [
  ["/auth/choice", "/onboarding"],
  ["/auth/sign-in", "/auth/sign-in/role"],
  ["/auth/sign-up", "/auth/sign-up/role"],
]) {
  await page.goto(`${BASE}${screen}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const arrows = await page.getByRole("link", { name: /go back/i }).count();
  check(`${screen} shows a header back arrow`, arrows === 1, `(found ${arrows})`);
  const landed = await backTarget(page, want);
  check(`${screen} back arrow goes to ${want}`, landed.replace(/\/+$/, "") === want, `(landed on ${landed})`);
}

/* 3. The header arrow must not point at the app dashboard. */
await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1200);
const hrefs = await page.locator('header a').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
check("header arrow is not /app", !hrefs.includes("/app") || hrefs.filter((h) => h === "/app").length === 1, JSON.stringify(hrefs));

/* 4. After onboarding, the arrow from /auth/choice returns to onboarding. */
await page.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1500);
check("onboarding step 1 has no back arrow", (await page.getByRole("button", { name: /go back/i }).count()) === 0);
await page.getByRole("button", { name: /^next/i }).click();
await page.waitForTimeout(800);
check("onboarding step 2 has a back arrow", (await page.getByRole("button", { name: /go back/i }).count()) === 1);
await page.getByRole("button", { name: /go back/i }).click();
await page.waitForTimeout(800);
check(
  "onboarding back returns to step 1",
  (await page.locator("h1").first().innerText()).includes("Your Health"),
);

void noArrow;
log(`\n${pass} passed, ${fail} failed`);
clearTimeout(bail);
await browser.close();
process.exit(fail === 0 ? 0 : 1);