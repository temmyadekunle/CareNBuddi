"use client";

/**
 * Community persistence.
 *
 * Supabase is the only authority. There is deliberately no localStorage
 * fallback: an offline device must not render a thread that does not exist or
 * accept a post the server never stored.
 */

import { getSupabase, isCloudEnabled } from "./supabase/client";
import {
  COMMUNITY_PAGE_SIZE,
  type CommunityComment,
  type CommunityModerationAction,
  type CommunityPost,
  type CommunityReport,
  type CommunityReportStatus,
  type CommunitySpace,
  type ModerationAction,
} from "./community-core";

export type CommunityErrorCode =
  | "cloud_required"
  | "auth_required"
  | "rate_limited"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "community_error";

export class CommunityError extends Error {
  code: CommunityErrorCode;

  constructor(code: CommunityErrorCode, message?: string) {
    super(message ?? code);
    this.name = "CommunityError";
    this.code = code;
  }
}

function client() {
  if (!isCloudEnabled) throw new CommunityError("cloud_required");
  const supabase = getSupabase();
  if (!supabase) throw new CommunityError("cloud_required");
  return supabase;
}

function fail(error: { message?: string } | null, fallback: CommunityErrorCode = "community_error"): never {
  const message = error?.message ?? "";
  if (/rate_limited/i.test(message)) throw new CommunityError("rate_limited", message);
  if (/not allowed|moderator only|not permitted|status is moderator-controlled|immutable/i.test(message)) {
    throw new CommunityError("forbidden", message);
  }
  if (/not found/i.test(message)) throw new CommunityError("not_found", message);
  if (/duplicate key|already exists|already closed/i.test(message)) {
    throw new CommunityError("conflict", message);
  }
  throw new CommunityError(fallback, message || fallback);
}

export async function currentCommunityUserId(): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new CommunityError("auth_required");
  return data.user.id;
}

export async function fetchFeed(args: {
  space: CommunitySpace;
  page?: number;
  pageSize?: number;
}): Promise<CommunityPost[]> {
  const supabase = client();
  const page = Math.max(0, args.page ?? 0);
  const size = args.pageSize ?? COMMUNITY_PAGE_SIZE;
  const from = page * size;
  const to = from + size - 1;

  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("space", args.space)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) fail(error);
  return (data ?? []) as CommunityPost[];
}

export async function fetchPost(postId: string): Promise<CommunityPost | null> {
  const supabase = client();
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) fail(error);
  return (data ?? null) as CommunityPost | null;
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as CommunityComment[];
}

export async function createPost(args: {
  space: CommunitySpace;
  title: string;
  body: string;
}): Promise<CommunityPost> {
  const supabase = client();
  const userId = await currentCommunityUserId();
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      space: args.space,
      author_id: userId,
      title: args.title.trim(),
      body: args.body.trim(),
    })
    .select("*")
    .single();
  if (error) fail(error);
  return data as CommunityPost;
}

export async function updatePost(args: {
  id: string;
  title: string;
  body: string;
}): Promise<CommunityPost> {
  const supabase = client();
  const { data, error } = await supabase
    .from("community_posts")
    .update({ title: args.title.trim(), body: args.body.trim() })
    .eq("id", args.id)
    .select("*")
    .single();
  if (error) fail(error);
  return data as CommunityPost;
}

export async function deletePost(id: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) fail(error);
}

export async function addComment(args: {
  postId: string;
  body: string;
}): Promise<CommunityComment> {
  const supabase = client();
  const userId = await currentCommunityUserId();
  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: args.postId,
      author_id: userId,
      body: args.body.trim(),
    })
    .select("*")
    .single();
  if (error) fail(error);
  return data as CommunityComment;
}

export async function deleteComment(id: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.from("community_comments").delete().eq("id", id);
  if (error) fail(error);
}

export async function reportContent(args: {
  targetType: "post" | "comment";
  targetId: string;
  reason: CommunityReport["reason"];
  detail?: string;
}): Promise<void> {
  const supabase = client();
  const userId = await currentCommunityUserId();
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: userId,
    target_type: args.targetType,
    target_id: args.targetId,
    reason: args.reason,
    detail: (args.detail ?? "").trim(),
  });
  if (error) fail(error);
}

/* ------------------------------------------------------------ moderation */

export interface ModerationTarget {
  kind: "post" | "comment";
  id: string;
  author_name: string;
  title: string | null;
  body: string;
  status: string;
}

export interface ModerationQueueItem extends CommunityReport {
  target: ModerationTarget | null;
}

export async function fetchReportQueue(
  status: CommunityReportStatus | "all" = "open",
): Promise<ModerationQueueItem[]> {
  const supabase = client();
  let query = supabase
    .from("community_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) fail(error);
  const reports = (data ?? []) as CommunityReport[];

  const postIds = reports.filter((r) => r.target_type === "post").map((r) => r.target_id);
  const commentIds = reports.filter((r) => r.target_type === "comment").map((r) => r.target_id);

  const [posts, comments] = await Promise.all([
    postIds.length
      ? supabase
          .from("community_posts")
          .select("id,author_name,title,body,status")
          .in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase
          .from("community_comments")
          .select("id,author_name,body,status")
          .in("id", commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (posts.error) fail(posts.error);
  if (comments.error) fail(comments.error);

  const postMap = new Map(
    ((posts.data ?? []) as { id: string; author_name: string; title: string; body: string; status: string }[]).map(
      (row) => [row.id, row],
    ),
  );
  const commentMap = new Map(
    ((comments.data ?? []) as { id: string; author_name: string; body: string; status: string }[]).map(
      (row) => [row.id, row],
    ),
  );

  return reports.map((report) => {
    if (report.target_type === "post") {
      const row = postMap.get(report.target_id);
      return {
        ...report,
        target: row
          ? {
              kind: "post" as const,
              id: row.id,
              author_name: row.author_name,
              title: row.title,
              body: row.body,
              status: row.status,
            }
          : null,
      };
    }
    const row = commentMap.get(report.target_id);
    return {
      ...report,
      target: row
        ? {
            kind: "comment" as const,
            id: row.id,
            author_name: row.author_name,
            title: null,
            body: row.body,
            status: row.status,
          }
        : null,
    };
  });
}

export async function fetchModerationActions(limit = 100): Promise<CommunityModerationAction[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from("community_moderation_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error);
  return (data ?? []) as CommunityModerationAction[];
}

export async function moderateContent(args: {
  targetType: "post" | "comment";
  targetId: string;
  action: ModerationAction;
  note?: string;
}): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("moderate_community_content", {
    p_target_type: args.targetType,
    p_target_id: args.targetId,
    p_action: args.action,
    p_note: args.note ?? "",
  });
  if (error) fail(error, "forbidden");
}

export async function resolveReport(args: {
  reportId: string;
  resolution: "resolved" | "dismissed";
  note?: string;
  contentAction?: ModerationAction | null;
}): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("resolve_community_report", {
    p_report_id: args.reportId,
    p_resolution: args.resolution,
    p_note: args.note ?? "",
    p_content_action: args.contentAction ?? null,
  });
  if (error) fail(error, "forbidden");
}
