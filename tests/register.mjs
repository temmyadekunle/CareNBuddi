/**
 * Entry point for `npm test`. Registers the TypeScript resolve hook, then hands
 * over to Node's test runner.
 *
 *   npm test  ->  node --import ./tests/register.mjs --test
 *
 * Node strips the types itself, so nothing here needs a compiler.
 */

import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);