/**
 * Lets `node --test` load the app's TypeScript modules.
 *
 * The source imports siblings without a file extension ("../lib/provider-application"),
 * which is what the bundler expects. Plain Node cannot resolve that, so unit
 * tests failed with ERR_MODULE_NOT_FOUND before they ran a single assertion.
 *
 * This hook retries a failed relative resolve with a `.ts` / `.tsx` extension.
 * It changes resolution only — it does not transform code, so it stays in step
 * with whatever TypeScript is actually on disk.
 */

const CANDIDATES = [".ts", ".tsx"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const alreadyHasExtension = /\.[cm]?[jt]sx?$/.test(specifier);
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