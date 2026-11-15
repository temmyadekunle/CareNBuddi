import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A confirmed provider can arrive with no local draft: the confirmation email
 * was opened on another device, Supabase reported an existing account (so the
 * pre-confirmation draft was skipped), or the draft write failed. The page
 * used to render "Loading…" forever because it required an application to
 * exist and nothing ever created one.
 */
const onboarding = readFileSync(
  new URL("../app/(app)/provider/onboarding/page.tsx", import.meta.url),
  "utf8",
);

test("a signed-in provider with no draft gets an explicit way forward", () => {
  assert.match(onboarding, /if \(!app\) \{/);
  assert.match(onboarding, /pr_no_draft/);
  assert.match(onboarding, /pr_start_application/);
  assert.match(onboarding, /onClick=\{\(\) => save\(\{\}\)\}/);
});

test("the missing-draft state is not confused with the hydration snapshot", () => {
  // The store is synchronous, but the static export hydrates with the seed
  // first. Only that brief window may show a loading line.
  assert.match(onboarding, /const hydrated = useHydrated\(\)/);
  assert.match(onboarding, /if \(!hydrated\) \{/);
  assert.match(onboarding, /if \(!app\) \{/);
});

test("starting the draft does not claim the application was submitted", () => {
  assert.doesNotMatch(onboarding, /status:\s*"submitted"/);
});
