import { existsSync, readdirSync, renameSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/**
 * Flattens Next.js RSC segment directories in the static export.
 *
 * Next writes per-route RSC payloads into a directory tree, and on Windows it
 * encodes route groups into the directory name: the `(app)` group becomes
 * `__next.!KGFwcCk`, because `!` + base64 is how the group is escaped. The
 * browser, however, asks for the flat path the router computes — it requests
 *
 *     /app/__next.app.__PAGE__.txt
 *
 * while the file is actually sitting at
 *
 *     /app/__next.!KGFwcCk/app/__PAGE__.txt
 *
 * so every `<Link>` prefetch 404s. Navigation still completes, because the
 * router falls back to a full document load, but it degrades a statically
 * exported app to hard navigations and fills the console with 404s.
 *
 * This runs after `next build` and moves each `__next.*` directory's contents
 * up into the parent as `<segmentName>.<path.with.dots>.txt`, which is the
 * shape the client asks for. See the equivalent fix in the Livanta repo.
 */

const root = join(process.cwd(), "out");

if (!existsSync(root)) {
  console.error("fix-rsc-segments: out/ not found, run next build first.");
  process.exit(1);
}

let fixed = 0;

function flattenSegmentDir(segmentDir, segmentName) {
  const files = [];
  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else files.push(full);
    }
  };
  collect(segmentDir);

  const parent = dirname(segmentDir);
  for (const file of files) {
    const rel = relative(segmentDir, file).split(sep).join(".");
    const dest = join(parent, `${segmentName}.${rel}`);
    if (existsSync(dest)) unlinkSync(dest);
    renameSync(file, dest);
    fixed += 1;
  }

  const removeEmpty = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) removeEmpty(join(dir, entry.name));
    }
    if (readdirSync(dir).length === 0) rmdirSync(dir);
  };
  removeEmpty(segmentDir);
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith("__next.")) {
      flattenSegmentDir(full, entry.name);
    } else {
      walk(full);
    }
  }
}

walk(root);

console.log(
  fixed > 0
    ? `fix-rsc-segments: flattened ${fixed} segment file(s).`
    : "fix-rsc-segments: nothing to fix.",
);