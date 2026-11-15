import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The static export delivers form markup before React attaches handlers. A tap
 * in that window submits the form natively and puts every field, password
 * included, in the URL as a GET query string.
 */
const authForm = readFileSync(new URL("../components/auth-form.tsx", import.meta.url), "utf8");
const hydration = readFileSync(new URL("../lib/hydration.ts", import.meta.url), "utf8");

test("the hydration snapshot is false before, true after, hydration", () => {
  assert.match(hydration, /useSyncExternalStore\(\s*subscribeToHydration,\s*\(\) => true,\s*\(\) => false,?\s*\)/);
});

test("the auth submit button is disabled until the form has hydrated", () => {
  assert.match(authForm, /import \{ useHydrated \} from "@\/lib\/hydration"/);
  assert.match(authForm, /const hydrated = useHydrated\(\)/);
  assert.match(authForm, /disabled=\{!hydrated \|\| pending\}/);
});

test("every AuthSubmit consumer inherits the pre-hydration guard", () => {
  // The guard lives in the shared component, so sign-in, sign-up, password
  // reset and provider registration all get it without page-specific code.
  for (const page of [
    "../app/auth/sign-in/page.tsx",
    "../app/auth/sign-up/page.tsx",
    "../app/auth/forgot-password/page.tsx",
    "../app/(app)/provider/register/page.tsx",
  ]) {
    const src = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.match(src, /AuthSubmit/, `${page} does not use AuthSubmit`);
  }
});
