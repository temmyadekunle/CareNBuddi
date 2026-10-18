import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildStoragePath, userIdFromStoragePath, validateFile } from "../lib/storage/upload";

/**
 * Storage upload helpers.
 *
 * The path scheme provider-applications/{userId}/{applicationId}/{docType}/{fileName}
 * is what the Storage policies in 0006 key ownership on: the second path
 * segment must be the authenticated user's ID. A crafted or weird file name
 * must never change the leading segments, and a path from another namespace
 * must never yield a usable user ID.
 */

const USER = "a1b2c3d4-1111-4222-8333-444455556666";
const APP = "00000000-0000-4000-8000-00000000aa01";

const mkFile = (over: Partial<File> = {}): File =>
  ({ type: "image/png", size: 1024, name: "health-card.png", ...over } as unknown as File);

describe("validateFile", () => {
  it("accepts the four whitelisted mime types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      assert.equal(validateFile(mkFile({ type })).ok, true, type);
    }
  });

  it("rejects other mime types, including text and archives", () => {
    for (const type of ["text/plain", "application/zip", "image/svg+xml", ""]) {
      const v = validateFile(mkFile({ type }));
      assert.equal(v.ok, false, type);
      assert.match(v.error ?? "", /JPG, PNG, WEBP or PDF/i);
    }
  });

  it("rejects files over 8 MB", () => {
    const v = validateFile(mkFile({ size: 8 * 1024 * 1024 + 1 }));
    assert.equal(v.ok, false);
    assert.match(v.error ?? "", /too large/i);
  });

  it("accepts a file exactly at the 8 MB limit", () => {
    assert.equal(validateFile(mkFile({ size: 8 * 1024 * 1024 })).ok, true);
  });
});

describe("buildStoragePath", () => {
  it("places the authenticated user id in path segment [2]", () => {
    assert.equal(
      buildStoragePath(USER, APP, "identity", "scan.png"),
      `provider-applications/${USER}/${APP}/identity/scan.png`,
    );
  });

  it("never lets a file name traverse directories", () => {
    const p = buildStoragePath(USER, APP, "credentials", "../../someone-else/evil.png");
    assert.equal(p.startsWith(`provider-applications/${USER}/${APP}/credentials/`), true);
    assert.equal(p.includes(".."), false);
  });

  it("strips windows-style traversal until only the base name is left", () => {
    const p = buildStoragePath(USER, APP, "credentials", "C:\\Users\\evil\\secret.pdf");
    assert.equal(p, `provider-applications/${USER}/${APP}/credentials/secret.pdf`);
  });

  it("limits the file name to a safe character set", () => {
    const p = buildStoragePath(USER, APP, "identity", "naïve name (final).png");
    assert.equal(/[^a-zA-Z0-9._\/-]/.test(p), false, p);
    // Every character outside [a-zA-Z0-9._-] — spaces, parentheses, and the
    // accented i — becomes an underscore, one-for-one.
    assert.equal(p, `provider-applications/${USER}/${APP}/identity/na_ve_name__final_.png`);
  });

  it("prefers portability over stripping a leading extension-only name", () => {
    // ".env" stays ".env": disguise attempts are harmless, because the
    // segments below the file name come from the caller's authenticated id
    // and are re-verified by the storage policy, not by the file name.
    const p = buildStoragePath(USER, APP, "identity", ".env");
    assert.equal(p, `provider-applications/${USER}/${APP}/identity/.env`);
  });

  it("uses the doc type verbatim as the folder", () => {
    assert.equal(
      buildStoragePath(USER, APP, "credentials", "x.pdf").split("/")[3],
      "credentials",
    );
  });
});

describe("userIdFromStoragePath", () => {
  it("extracts segment [2] for an application-scoped path", () => {
    assert.equal(userIdFromStoragePath(`provider-applications/${USER}/${APP}/identity/x.png`), USER);
  });

  it("returns null for anything outside the namespace", () => {
    for (const p of [
      "",
      "avatars/whatever.png",
      `provider-applications/${USER}`, // too short: over-bucket root paths
      "provider-applications",
    ]) {
      assert.equal(userIdFromStoragePath(p), null, p);
    }
  });

  it("keeps the owner id unseen when the path has trailing segments", () => {
      assert.equal(
      userIdFromStoragePath(`provider-applications/${USER}/${APP}/credentials/a/b/c.pdf`),
      USER,
    );
  });
});
