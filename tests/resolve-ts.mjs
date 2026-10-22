/**
 * Lets `node --test` load the app's TypeScript modules.
 *
 * The source imports siblings without a file extension ("../lib/provider-application"),
 * which is what the bundler expects. Plain Node cannot resolve that, so unit
 * tests failed with ERR_MODULE_NOT_FOUND before they ran a single assertion.
 *
 * It also maps the "@/..." path alias used across app components to the
 * repository root, so a test can import client modules (profile photo
 * hydration, cloud context, and friends) that transitively use the alias.
 *
 * This hook changes resolution only — it does not transform code, so it
 * stays in step with whatever TypeScript is actually on disk.
 */

const CANDIDATES = [".ts", ".tsx"];

/** Repository root as a directory URL: tests/resolve-ts.mjs -> <repo root>/ */
const REPO_ROOT = new URL("../", import.meta.url);

function aliasedCandidates(specifier) {
  const rel = specifier.slice(2); // "@/lib/storage" -> "lib/storage"
  if (/\.[cm]?[jt]sx?$/.test(rel)) {
    return [new URL(rel, REPO_ROOT)];
  }
  return CANDIDATES.map((ext) => new URL(`${rel}${ext}`, REPO_ROOT));
}

async function firstResolvable(candidates, context, nextResolve) {
  let lastError;
  for (const candidate of candidates) {
    try {
      return await nextResolve(candidate.href, context);
    } catch (retryError) {
      lastError = retryError;
    }
  }
  throw lastError;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const alreadyHasExtension = /\.[cm]?[jt]sx?$/.test(specifier);

    // "@/lib/storage" lives at <repo root>/lib/storage(.ts) — the alias is
    // defined in tsconfig paths and rewritten by the bundler; plain Node
    // needs it materialised here.
    if (specifier.startsWith("@/")) {
      return firstResolvable(aliasedCandidates(specifier), context, nextResolve);
    }

    if (!isRelative || alreadyHasExtension) throw error;

    let lastError = error;
    for (const ext of CANDIDATES) {
      try {
        return await nextResolve(`${specifier}${ext}`, context);
      } catch (retryError) {
        lastError = retryError;
      }
    }
    throw lastError;
  }
}
