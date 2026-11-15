import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMUNITY_PAGE_SIZE,
  canPostInSpace,
  canReadSpace,
  commentCountLabelKey,
  communityErrorCopy,
  excerpt,
  formatCommunityTime,
  hasMore,
  isEditable,
  isOwnContent,
  mergeCommentPage,
  mergePostPage,
  reportReason,
  statusTone,
  validateCommentInput,
  validatePostInput,
  type CommunityComment,
  type CommunityPost,
} from "./community-core";

const post = (over: Partial<CommunityPost> = {}): CommunityPost => ({
  id: "p1",
  space: "patients",
  author_id: "u1",
  author_name: "Patient A",
  title: "A title",
  body: "A body",
  status: "published",
  created_at: "2026-11-14T10:00:00.000Z",
  updated_at: "2026-11-14T10:00:00.000Z",
  edited_at: null,
  ...over,
});

const comment = (over: Partial<CommunityComment> = {}): CommunityComment => ({
  id: "c1",
  post_id: "p1",
  author_id: "u2",
  author_name: "Patient B",
  body: "A comment",
  status: "published",
  created_at: "2026-11-14T10:05:00.000Z",
  updated_at: "2026-11-14T10:05:00.000Z",
  ...over,
});

test("post validation mirrors the database bounds", () => {
  assert.equal(validatePostInput("ab", "body"), "title_short");
  assert.equal(validatePostInput("a".repeat(161), "body"), "title_long");
  assert.equal(validatePostInput("title", "   "), "body_empty");
  assert.equal(validatePostInput("title", "b".repeat(8_001)), "body_long");
  assert.equal(validatePostInput("  title  ", "  body  "), null);
  assert.equal(validatePostInput("abc", "b".repeat(8_000)), null);
});

test("comment validation mirrors the database bounds", () => {
  assert.equal(validateCommentInput("  "), "body_empty");
  assert.equal(validateCommentInput("c".repeat(4_001)), "body_long");
  assert.equal(validateCommentInput("is this safe?"), null);
});

test("patient space is consumers only; admin reads but never posts", () => {
  assert.equal(canReadSpace("patients", "consumer", false), true);
  assert.equal(canReadSpace("patients", "provider", true), false);
  assert.equal(canReadSpace("patients", "admin", false), true);
  assert.equal(canReadSpace("patients", undefined, false), false);

  assert.equal(canPostInSpace("patients", "consumer", false), true);
  assert.equal(canPostInSpace("patients", "admin", false), false);
  assert.equal(canPostInSpace("patients", "provider", true), false);
});

test("provider space needs a verified provider; pending providers are refused", () => {
  assert.equal(canReadSpace("providers", "provider", true), true);
  assert.equal(canReadSpace("providers", "provider", false), false);
  assert.equal(canReadSpace("providers", "consumer", false), false);
  assert.equal(canReadSpace("providers", "admin", false), true);

  assert.equal(canPostInSpace("providers", "provider", true), true);
  assert.equal(canPostInSpace("providers", "provider", false), false);
  assert.equal(canPostInSpace("providers", "admin", false), false);
  assert.equal(canPostInSpace("providers", "consumer", false), false);
});

test("only the author of a published item may edit it", () => {
  assert.equal(isEditable("published", true), true);
  assert.equal(isEditable("published", false), false);
  assert.equal(isEditable("hidden", true), false);
  assert.equal(isEditable("removed", true), false);
  assert.equal(isOwnContent("u1", "u1"), true);
  assert.equal(isOwnContent("u1", "u2"), false);
  assert.equal(isOwnContent("u1", null), false);
});

test("pages merge without duplicating rows that moved position", () => {
  const first = [post({ id: "a" }), post({ id: "b" })];
  const second = [post({ id: "b" }), post({ id: "c" })];
  assert.deepEqual(
    mergePostPage(first, second).map((p) => p.id),
    ["a", "b", "c"],
  );

  const comments = [comment({ id: "x" }), comment({ id: "y" })];
  assert.deepEqual(
    mergeCommentPage(comments, [comment({ id: "y" }), comment({ id: "z" })]).map((c) => c.id),
    ["x", "y", "z"],
  );
});

test("hasMore only reports another page for a full page", () => {
  assert.equal(hasMore(0), false);
  assert.equal(hasMore(COMMUNITY_PAGE_SIZE - 1), false);
  assert.equal(hasMore(COMMUNITY_PAGE_SIZE), true);
  assert.equal(hasMore(5, 5), true);
});

test("report reasons and status tones are stable", () => {
  assert.equal(reportReason("medical_misinformation").key, "cm_reason_misinfo");
  assert.equal(reportReason("other").fallback, "Something else");
  assert.equal(statusTone("published"), "green");
  assert.equal(statusTone("hidden"), "amber");
  assert.equal(statusTone("removed"), "rose");
  assert.equal(statusTone("open"), "amber");
  assert.equal(statusTone("resolved"), "green");
  assert.equal(statusTone("dismissed"), "slate");
});

test("comments are labelled for one and many", () => {
  assert.equal(commentCountLabelKey(1), "cm_one_comment");
  assert.equal(commentCountLabelKey(0), "cm_comments");
  assert.equal(commentCountLabelKey(7), "cm_comments");
});

test("excerpt collapses whitespace and caps length", () => {
  assert.equal(excerpt("  a   b\n c  "), "a b c");
  const long = excerpt("x".repeat(500), 10);
  assert.equal(long.length, 10);
  assert.ok(long.endsWith("…"));
});

test("every persistence failure has user-facing wording", () => {
  for (const code of [
    "cloud_required",
    "auth_required",
    "rate_limited",
    "forbidden",
    "not_found",
    "conflict",
    "community_error",
  ]) {
    const copy = communityErrorCopy(code);
    assert.ok(copy.key.startsWith("cm_err_"), code);
    assert.ok(copy.fallback.length > 0, code);
  }
  assert.equal(communityErrorCopy("cloud_required").key, "cm_err_cloud");
  assert.equal(communityErrorCopy("unknown").key, "cm_err_generic");
});

test("relative time labels do not invent a future age", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  assert.equal(formatCommunityTime("2026-11-14T12:00:00.000Z", now), "just now");
  assert.equal(formatCommunityTime("2026-11-14T11:38:00.000Z", now), "22m");
  assert.equal(formatCommunityTime("2026-11-14T09:00:00.000Z", now), "3h");
  assert.equal(formatCommunityTime("2026-11-10T12:00:00.000Z", now), "4d");
  assert.equal(formatCommunityTime("not-a-date", now), "");
  assert.equal(formatCommunityTime("2026-10-01T12:00:00.000Z", now), "2026-10-01");
});
