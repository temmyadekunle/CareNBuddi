/**
 * Community domain rules that do not touch the network.
 *
 * They mirror the database constraints in 0010_community.sql so the UI can
 * explain a refusal before a request is sent. The database remains the
 * authority: these helpers must never be the only check.
 */

export type CommunitySpace = "patients" | "providers";

export type CommunityContentStatus = "published" | "hidden" | "removed";

export interface CommunityPost {
  id: string;
  space: CommunitySpace;
  author_id: string;
  author_name: string;
  title: string;
  body: string;
  status: CommunityContentStatus;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  body: string;
  status: CommunityContentStatus;
  created_at: string;
  updated_at: string;
}

export type CommunityReportReason =
  | "spam"
  | "harassment"
  | "medical_misinformation"
  | "privacy"
  | "other";

export const COMMUNITY_REPORT_REASONS: readonly {
  id: CommunityReportReason;
  key: string;
  fallback: string;
}[] = [
  { id: "spam", key: "cm_reason_spam", fallback: "Spam or advertising" },
  { id: "harassment", key: "cm_reason_harassment", fallback: "Harassment or abuse" },
  {
    id: "medical_misinformation",
    key: "cm_reason_misinfo",
    fallback: "Dangerous medical misinformation",
  },
  { id: "privacy", key: "cm_reason_privacy", fallback: "Shares someone's private information" },
  { id: "other", key: "cm_reason_other", fallback: "Something else" },
] as const;

export type CommunityReportStatus = "open" | "resolved" | "dismissed";

export interface CommunityReport {
  id: string;
  reporter_id: string;
  target_type: "post" | "comment";
  target_id: string;
  target_author_id: string | null;
  reason: CommunityReportReason;
  detail: string;
  status: CommunityReportStatus;
  resolution_note: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type ModerationAction = "hide" | "restore" | "remove";

export interface CommunityModerationAction {
  id: string;
  moderator_id: string;
  target_type: "post" | "comment" | "report";
  target_id: string;
  action: ModerationAction | "resolve_report" | "dismiss_report";
  note: string;
  created_at: string;
}

export const COMMUNITY_PAGE_SIZE = 10;

export const POST_TITLE_MIN = 3;
export const POST_TITLE_MAX = 160;
export const POST_BODY_MAX = 8_000;
export const COMMENT_BODY_MAX = 4_000;
export const REPORT_DETAIL_MAX = 2_000;

export type PostInputError =
  | "title_short"
  | "title_long"
  | "body_empty"
  | "body_long"
  | null;

export function validatePostInput(title: string, body: string): PostInputError {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (cleanTitle.length < POST_TITLE_MIN) return "title_short";
  if (cleanTitle.length > POST_TITLE_MAX) return "title_long";
  if (!cleanBody) return "body_empty";
  if (cleanBody.length > POST_BODY_MAX) return "body_long";
  return null;
}

export type CommentInputError = "body_empty" | "body_long" | null;

export function validateCommentInput(body: string): CommentInputError {
  const clean = body.trim();
  if (!clean) return "body_empty";
  if (clean.length > COMMENT_BODY_MAX) return "body_long";
  return null;
}

/**
 * Read access. Administrators can read both spaces for moderation, but they
 * cannot post in either (see canPostInSpace).
 */
export function canReadSpace(
  space: CommunitySpace,
  role: string | undefined,
  verifiedProvider: boolean,
): boolean {
  if (role === "admin") return true;
  if (space === "patients") return role === "consumer";
  return role === "provider" && verifiedProvider;
}

/** Write access. Verified providers only in the provider space. */
export function canPostInSpace(
  space: CommunitySpace,
  role: string | undefined,
  verifiedProvider: boolean,
): boolean {
  if (spectatorRole(role)) return false;
  if (space === "patients") return role === "consumer";
  return role === "provider" && verifiedProvider;
}

function spectatorRole(role: string | undefined): boolean {
  return role === "admin" || !role;
}

/** The 0010 triggers force status back to published on insert. */
export function isEditable(status: CommunityContentStatus, isAuthor: boolean): boolean {
  return isAuthor && status === "published";
}

export function isOwnContent(authorId: string, userId: string | null | undefined): boolean {
  return Boolean(userId && authorId === userId);
}

/**
 * Merge a newly loaded page without duplicating rows. A post can move between
 * pages if something is deleted mid-session, so identity wins over position.
 */
export function mergePostPage(
  existing: CommunityPost[],
  page: CommunityPost[],
): CommunityPost[] {
  const seen = new Set(existing.map((post) => post.id));
  return [...existing, ...page.filter((post) => !seen.has(post.id))];
}

export function mergeCommentPage(
  existing: CommunityComment[],
  page: CommunityComment[],
): CommunityComment[] {
  const seen = new Set(existing.map((comment) => comment.id));
  return [...existing, ...page.filter((comment) => !seen.has(comment.id))];
}

/** True when a full page was returned, i.e. more rows may exist. */
export function hasMore(pageLength: number, pageSize = COMMUNITY_PAGE_SIZE): boolean {
  return pageLength >= pageSize;
}

export function reportReason(
  reason: CommunityReportReason,
): { key: string; fallback: string } {
  return (
    COMMUNITY_REPORT_REASONS.find((entry) => entry.id === reason) ?? {
      key: "cm_reason_other",
      fallback: "Something else",
    }
  );
}

export function statusTone(
  status: CommunityContentStatus | CommunityReportStatus,
): "green" | "amber" | "rose" | "slate" {
  switch (status) {
    case "published":
    case "resolved":
      return "green";
    case "hidden":
    case "open":
      return "amber";
    case "removed":
      return "rose";
    default:
      return "slate";
  }
}

export function excerpt(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function commentCountLabelKey(count: number): string {
  return count === 1 ? "cm_one_comment" : "cm_comments";
}

/** User-facing wording for a database/network refusal. */
export function communityErrorCopy(code: string): { key: string; fallback: string } {
  switch (code) {
    case "cloud_required":
      return {
        key: "cm_err_cloud",
        fallback: "Community needs the CareNBuddi backend. It is not available offline.",
      };
    case "auth_required":
      return { key: "cm_err_auth", fallback: "Sign in to take part in Community." };
    case "rate_limited":
      return {
        key: "cm_err_rate",
        fallback: "You are posting too quickly. Wait a few minutes and try again.",
      };
    case "forbidden":
      return {
        key: "cm_err_forbidden",
        fallback: "You do not have permission to do that in this space.",
      };
    case "not_found":
      return { key: "cm_err_missing", fallback: "That discussion is no longer available." };
    case "conflict":
      return { key: "cm_err_conflict", fallback: "You have already reported this content." };
    default:
      return {
        key: "cm_err_generic",
        fallback: "Community could not complete that request. Try again.",
      };
  }
}

/**
 * A stable relative-time label without pulling in a date library. The exact
 * locale formatting is left to Intl where available.
 */
export function formatCommunityTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(then).toISOString().slice(0, 10);
}
