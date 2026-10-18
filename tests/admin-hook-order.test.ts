import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * Regression test for the hook-ordering scenario reported by the pre-release
 * audit.
 *
 * The bug: AdminProviderApplicationsPage returned the unauthorised gate
 * before the dashboard hooks ran, so a render where the session resolved
 * after mount flipped the hook count on the same component instance
 * ("Rendered more hooks than during the previous render").
 *
 * The fix splits the page into:
 *   - the default-export wrapper, whose conditional return sits AFTER every
 *     hook it calls, and
 *   - AdminDashboard, which renders only once authorised and therefore owns
 *     the dashboard hooks unconditionally-for-its-lifetime.
 *
 * This file enforces the invariant that makes that bug impossible in this
 * module: in the wrapper's own function body, NO hook call may appear after
 * its first statement-level `return`. Rather than trusting a regex, the scan
 * tracks brace scopes and flags function/arrow bodies, skips strings,
 * template literals and comments, so a `return` inside a useMemo/Callback
 * body is not mistaken for the component's own return.
 *
 * It is a structural tripwire pinned to this one file. If the file gains a
 * legitimately different shape, the test should be updated alongside it, not
 * silenced.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "app", "(app)", "admin", "provider-applications", "page.tsx");

/** Which scope a `{` opens. Function and arrow bodies get their own so nested returns/hook calls don't leak to component level. */
type Scope = "fn" | "block";

interface ScanResult {
  /** `useXxx(` call sites at component-body level (not inside nested functions). */
  hookCalls: { name: string; index: number }[];
  /** Byte offsets of component-level `return` statements, ascending. */
  returns: number[];
}

/**
 * Scans `source` starting at the component's opening brace.
 */
function scanComponentBody(source: string, openBrace: number): ScanResult {
  const scopes: Scope[] = [];
  const hookCalls: { name: string; index: number }[] = [];
  const returns: number[] = [];
  let pendingFn = false;
  let i = openBrace;
  let depth = 0;

  advance: while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    const meaningful = !/\s/.test(c);

    if (meaningful) {
      if (c === "/" && d === "/") {
        i = source.indexOf("\n", i) === -1 ? source.length : source.indexOf("\n", i);
        continue advance;
      }
      if (c === "/" && d === "*") {
        const to = source.indexOf("*/", i + 2);
        i = to === -1 ? source.length : to + 2;
        continue advance;
      }

      if (c === '"' || c === "'" || c === "`") {
        let j = i + 1;
        for (; j < source.length; j++) {
          if (source[j] === "\\") { j++; continue; }
          if (source[j] === c) { j++; break; }
        }
        i = j;
        continue advance;
      }

      if (c === "=" && d === ">") {
        pendingFn = true;
        i += 2;
        continue advance;
      }
      if (c === "f" && source.startsWith("function", i)) {
        pendingFn = true;
        i += 8;
        continue advance;
      }

      if (c === "{") {
        scopes.push(pendingFn ? "fn" : "block");
        pendingFn = false;
        depth++;
        i++;
        continue advance;
      }
      if (c === "}") {
        scopes.pop();
        depth--;
        if (depth <= 0) break advance;
        i++;
        continue advance;
      }

      const isWordStart = /[A-Za-z_$]/.test(c);
      if (isWordStart) {
        let j = i;
        while (j < source.length && /[A-Za-z0-9_$]/.test(source[j])) j++;
        const word = source.slice(i, j);
        if (word === "return" && !scopes.includes("fn")) {
          returns.push(i);
        } else if (/^use[A-Z][A-Za-z0-9]*$/.test(word) && !scopes.includes("fn")) {
          // Hooks may be invoked with an explicit generic list, e.g.
          // useStoredCollection<ProviderApplication>(...); skip brackets.
          let k = j;
          if (source[k] === "<") {
            let angle = 0;
            for (; k < source.length; k++) {
              if (source[k] === "<") angle++;
              if (source[k] === ">") {
                angle--;
                if (angle === 0) { k++; break; }
              }
            }
          }
          if (source[k] === "(") hookCalls.push({ name: word, index: i });
        }
        i = j;
        pendingFn = false;
        continue advance;
      }

      if (c === ")") pendingFn = false;
    }

    i++;
  }

  return { hookCalls, returns };
}

function openBraceOf(signatureStart: number, source: string): number {
  let i = source.indexOf("(", signatureStart);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === "(") depth++;
    if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.indexOf("{", i);
    }
  }
  return -1;
}

test("AdminProviderApplicationsPage: no hook call sits after the first statement-level return", () => {
  const source = readFileSync(PAGE, "utf8");

  // The structure the fix relies on.
  assert.match(source, /export default function AdminProviderApplicationsPage/);
  assert.match(source, /function AdminDashboard\(\{/);

  const sig = source.indexOf("export default function AdminProviderApplicationsPage");
  assert.notEqual(sig, -1, "wrapper is the default export");
  const brace = openBraceOf(sig, source);
  assert.notEqual(brace, -1, "wrapper has a function body");

  const { hookCalls, returns } = scanComponentBody(source, brace);

  // Sanity so the invariant cannot pass on a vacuously empty scan.
  const names = new Set(hookCalls.map((h) => h.name));
  assert.ok(hookCalls.length >= 3, `expected the wrapper's own hooks, got: ${[...names].join(", ")}`);
  assert.ok(names.has("useT"), "wrapper calls useT");
  assert.ok(names.has("useSession"), "wrapper calls useSession");
  assert.ok(names.has("useStoredCollection"), "wrapper calls useStoredCollection");
  assert.ok(names.has("useState") === false, "wrapper owns no dashboard state");
  assert.ok(returns.length >= 2, "wrapper has a gate return and a dashboard render");

  const firstReturn = returns[0];
  for (const h of hookCalls) {
    assert.ok(
      h.index < firstReturn,
      `hook ${h.name} runs after the first return in the wrapper (hook at +${h.index - brace}, return at +${firstReturn - brace})`,
    );
  }
});

test("AdminDashboard asserts its own hooks and receives the resolved identity", () => {
  const source = readFileSync(PAGE, "utf8");
  const sig = source.indexOf("function AdminDashboard({");
  assert.notEqual(sig, -1);

  const brace = openBraceOf(sig, source);
  assert.notEqual(brace, -1, "dashboard body exists");

  const { hookCalls, returns } = scanComponentBody(source, brace);
  const names = new Set(hookCalls.map((h) => h.name));

  // The dashboard hooks that used to run conditionally now live here. Data
  // comes from the server hook (no localStorage collection in this
  // component by design; see useServerApplications).
  assert.ok(names.has("useServerApplications"), "dashboard owns the server applications hook");
  assert.ok(names.has("useState"), "dashboard owns its interactive state");
  assert.ok(names.has("useCallback"), "dashboard owns the review/download callbacks");
  assert.ok(names.has("useMemo"), "dashboard owns its derived views");
  assert.ok(names.has("useStoredCollection") === false, "review data is server-only");

  // No hook may follow the dashboard's own first statement-level return
  // either: this keeps the invariant true for the component regardless of
  // how it is mounted.
  if (returns.length > 0) {
    for (const h of hookCalls) {
      assert.ok(h.index < returns[0], `hook ${h.name} runs after a return in AdminDashboard`);
    }
  }

  // The wrapper renders the dashboard only after the role check passed.
  const wrapper = source.slice(
    source.indexOf("export default function AdminProviderApplicationsPage"),
    sig,
  );
  assert.match(wrapper, /me\?\.role !== "admin"/);
  assert.match(wrapper, /<AdminDashboard\s+me=\{me\}/);
});
