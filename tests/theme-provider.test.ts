import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The theme provider must not react to the mutations it writes itself.
 *
 * ThemeProvider observed `documentElement` for attribute changes and then set
 * `data-theme` from inside the observer callback. `setAttribute` queues a
 * mutation record even when the value is unchanged, so each write woke the
 * observer again. That is an unbounded microtask loop: the browser stayed
 * pinned at 100% CPU, hydration never completed, and the profile screen - the
 * only screen with its own effect that mutates `documentElement` - froze on the
 * server-rendered sign-in gate. No error was thrown, which is why it looked
 * like a silent hang rather than a crash.
 *
 * The provider is a static module, so the guard is asserted against the source
 * rather than exercised in a DOM.
 */
const provider = readFileSync(
  new URL("../components/theme-provider.tsx", import.meta.url),
  "utf8",
);

test("the observer ignores the attribute it writes", () => {
  assert.match(
    provider,
    /records\.every\(\s*\(record\)\s*=>\s*record\.attributeName\s*===\s*"data-theme"\s*\)\s*\)\s*return/,
    "the self-mutation guard is missing, so the observer will re-trigger itself forever",
  );
});

test("the observer still reacts to other attribute changes", () => {
  // A blanket "never write" would stop the provider from doing its job; the
  // guard has to be narrow, and the write has to still be there.
  assert.match(provider, /new MutationObserver\(/);
  assert.match(provider, /setAttribute\("data-theme", effective\)/);
});