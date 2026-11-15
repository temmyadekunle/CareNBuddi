"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import {
  AlertIcon,
  ChatIcon,
  ChevronLeftIcon,
  EditIcon,
  LockIcon,
  ShieldIcon,
  TrashIcon,
} from "@/components/icons";
import { ReportDialog } from "@/components/community/report-dialog";
import {
  COMMENT_BODY_MAX,
  communityErrorCopy,
  formatCommunityTime,
  isEditable,
  isOwnContent,
  mergeCommentPage,
  statusTone,
  validateCommentInput,
  validatePostInput,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/community-core";
import {
  CommunityError,
  addComment,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPost,
  updatePost,
} from "@/lib/community";
import { useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { useServerApplication } from "@/lib/server-provider-applications";

function messageFor(t: ReturnType<typeof useT>, err: unknown): string {
  const code = err instanceof CommunityError ? err.code : "community_error";
  const copy = communityErrorCopy(code);
  return t(copy.key, copy.fallback);
}

/**
 * A single discussion, addressed by ?id= so the static export does not need
 * dynamic routes. The database decides visibility: a hidden post is returned
 * to its author and to administrators, and to nobody else.
 */
export default function CommunityPostPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <div className="mt-2 h-40 w-full animate-pulse rounded-2xl bg-slate-200/70" />
        </Screen>
      }
    >
      <PostDetail />
    </Suspense>
  );
}

function PostDetail() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const postId = params.get("id") ?? "";
  const { push } = useToast();

  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const { application } = useServerApplication(session.userId);
  const me = users.find((user) => user.id === session.userId);
  const verifiedProvider = me?.role === "provider" && application?.status === "verified";

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingComment, setDeletingComment] = useState<CommunityComment | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const loaded = await fetchPost(postId);
      if (!loaded) {
        setNotFound(true);
        setPost(null);
      } else {
        setPost(loaded);
        setComments(await fetchComments(loaded.id));
      }
      setErrorCode(null);
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    // The fetch starts after the effect body so React does not see a
    // synchronous state update during commit.
    queueMicrotask(() => void load());
  }, [load]);

  const ownPost = isOwnContent(post?.author_id ?? "", session.userId);
  const missing = !postId || notFound;
  const errorCopy = errorCode ? communityErrorCopy(errorCode) : null;
  const errorMessage = errorCopy ? t(errorCopy.key, errorCopy.fallback) : "";
  const retry = () => {
    setLoading(true);
    setErrorCode(null);
    void load();
  };
  const canCompose =
    post?.space === "patients"
      ? me?.role === "consumer"
      : me?.role === "provider" && verifiedProvider;
  const backHref = post?.space === "providers" ? "/provider/community" : "/community";

  const submitComment = async () => {
    if (!post) return;
    const problem = validateCommentInput(commentBody);
    if (problem === "body_empty") {
      setCommentError(t("cm_comment_empty", "Write a comment before sending."));
      return;
    }
    if (problem === "body_long") {
      setCommentError(t("cm_comment_long", "Keep the comment under 4,000 characters."));
      return;
    }
    setCommentSaving(true);
    setCommentError("");
    try {
      const created = await addComment({ postId: post.id, body: commentBody });
      setComments((prev) => mergeCommentPage(prev, [created]));
      setCommentBody("");
    } catch (err) {
      setCommentError(messageFor(t, err));
    } finally {
      setCommentSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!post) return;
    const problem = validatePostInput(editTitle, editBody);
    if (problem) {
      setEditError(t("cm_edit_invalid", "Check the title and body, then try again."));
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await updatePost({ id: post.id, title: editTitle, body: editBody });
      setPost(updated);
      setEditing(false);
      push(t("cm_updated", "Post updated"), "success");
    } catch (err) {
      setEditError(messageFor(t, err));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDeletePost = async () => {
    if (!post) return;
    try {
      await deletePost(post.id);
      push(t("cm_deleted", "Post deleted"), "success");
      router.push(backHref);
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
      setDeletingPost(false);
    }
  };

  const confirmDeleteComment = async () => {
    if (!deletingComment) return;
    try {
      await deleteComment(deletingComment.id);
      setComments((prev) => prev.filter((comment) => comment.id !== deletingComment.id));
      push(t("cm_comment_deleted", "Comment deleted"), "success");
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
    } finally {
      setDeletingComment(null);
    }
  };

  if (missing) {
    return (
      <Screen>
        <Link
          href="/community"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t("c_back", "Back")}
        </Link>
        <div className="mt-4">
          <EmptyState
            icon={<LockIcon className="h-6 w-6" />}
            title={t("cm_post_unavailable", "Discussion unavailable")}
            body={t(
              "cm_post_unavailable_body",
              "It may have been removed, hidden by a moderator, or belong to a space you cannot read.",
            )}
            action={
              <Link href="/community" className="mt-2 inline-block">
                <Button tone="secondary">{t("cm_back_patients", "Patient Community")}</Button>
              </Link>
            }
          />
        </div>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <div className="space-y-3" aria-hidden="true">
          <div className="h-6 w-24 rounded bg-slate-100 dark:bg-slate-800" />
          <Card>
            <div className="h-4 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-3 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
          </Card>
        </div>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <div className="mt-4">
          <ErrorState
            title={t("cm_post_error", "Could not load this discussion")}
            body={errorMessage}
            onRetry={retry}
            retryLabel={t("c_retry", "Try again")}
          />
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {post.space === "providers"
          ? t("cm_provider_space", "Provider Community")
          : t("cm_patient_space", "Patient Community")}
      </Link>

      <SectionHeader
        title={post.title}
        subtitle={`${post.author_name} · ${formatCommunityTime(post.created_at)}${
          post.edited_at ? ` · ${t("cm_edited", "edited")}` : ""
        }`}
      />

      <Card>
        <div className="flex items-start gap-3">
          <Avatar name={post.author_name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {post.author_name}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatCommunityTime(post.created_at)}
              {post.edited_at ? ` · ${t("cm_edited", "edited")}` : ""}
            </p>
          </div>
          {post.status !== "published" ? (
            <Badge tone={statusTone(post.status)}>{t(`cm_status_${post.status}`, post.status)}</Badge>
          ) : null}
        </div>

        {post.status !== "published" ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t(
              "cm_post_moderated",
              "A moderator has restricted this post. Only you and moderators can see it now.",
            )}
          </p>
        ) : null}

        {editing ? (
          <div className="mt-3 space-y-2">
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              maxLength={160}
              aria-label={t("cm_post_title", "Post title")}
              className={inputClass}
            />
            <textarea
              value={editBody}
              onChange={(event) => setEditBody(event.target.value)}
              rows={6}
              aria-label={t("cm_post_body", "Post body")}
              className={inputClass}
            />
            {editError ? (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                {editError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={editSaving}>
                {editSaving ? t("c_saving", "Saving…") : t("c_save", "Save")}
              </Button>
              <Button tone="secondary" onClick={() => setEditing(false)} disabled={editSaving}>
                {t("c_cancel", "Cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {post.body}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          {ownPost && isEditable(post.status, true) && !editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setEditTitle(post.title);
                setEditBody(post.body);
                setEditError("");
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <EditIcon className="h-3.5 w-3.5" />
              {t("c_edit", "Edit")}
            </button>
          ) : null}
          {ownPost ? (
            <button
              type="button"
              onClick={() => setDeletingPost(true)}
              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {t("c_delete", "Delete")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setReportTarget({ type: "post", id: post.id })}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-amber-700"
            >
              <ShieldIcon className="h-3.5 w-3.5" />
              {t("e_report", "Report")}
            </button>
          )}
        </div>
      </Card>

      {errorMessage ? (
        <Card className="mt-3">
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        </Card>
      ) : null}

      <div className="mt-5">
        <SectionHeader
          title={t("cm_comments", "Comments")}
          subtitle={`${comments.length}`}
        />
      </div>

      {canCompose ? (
        <Card>
          <label htmlFor="community-comment" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("cm_add_comment", "Add a comment")}
          </label>
          <textarea
            id="community-comment"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value.slice(0, COMMENT_BODY_MAX))}
            rows={3}
            placeholder={t("cm_comment_placeholder", "Write a respectful reply…")}
            className={`${inputClass} mt-1`}
          />
          {commentError ? (
            <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
              {commentError}
            </p>
          ) : null}
          <Button className="mt-2" onClick={submitComment} disabled={commentSaving}>
            {commentSaving ? t("c_sending", "Sending…") : t("cm_comment_send", "Send comment")}
          </Button>
        </Card>
      ) : me?.role === "admin" ? (
        <Card className="flex items-start gap-2">
          <ChatIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "cm_admin_view",
              "You are viewing this space as an administrator. Moderation actions are in the admin console.",
            )}
          </p>
        </Card>
      ) : (
        <Card className="flex items-start gap-2">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("cm_read_only", "You can read this space, but only its members can post.")}
          </p>
        </Card>
      )}

      <div className="mt-3 space-y-2.5">
        {comments.length === 0 ? (
          <Card className="text-center">
            <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
              {t("cm_no_comments", "No comments yet.")}
            </p>
          </Card>
        ) : (
          comments.map((comment) => {
            const own = isOwnContent(comment.author_id, session.userId);
            return (
              <Card key={comment.id}>
                <div className="flex items-start gap-3">
                  <Avatar name={comment.author_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {comment.author_name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatCommunityTime(comment.created_at)}
                    </p>
                  </div>
                  {comment.status !== "published" ? (
                    <Badge tone={statusTone(comment.status)}>
                      {t(`cm_status_${comment.status}`, comment.status)}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {comment.body}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {own ? (
                    <button
                      type="button"
                      onClick={() => setDeletingComment(comment)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      {t("c_delete", "Delete")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReportTarget({ type: "comment", id: comment.id })}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-amber-700"
                    >
                      <ShieldIcon className="h-3.5 w-3.5" />
                      {t("e_report", "Report")}
                    </button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {reportTarget ? (
        <ReportDialog
          key={`${reportTarget.type}:${reportTarget.id}`}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
          onDone={() => push(t("cm_reported", "Report sent to moderators"), "success")}
        />
      ) : null}

      <ConfirmDialog
        open={deletingPost}
        title={t("cm_delete_title", "Delete this post?")}
        body={t(
          "cm_delete_body",
          "The post and its comments will be removed permanently. This cannot be undone.",
        )}
        confirmLabel={t("cm_delete_confirm", "Delete post")}
        cancelLabel={t("c_cancel", "Cancel")}
        onConfirm={() => void confirmDeletePost()}
        onCancel={() => setDeletingPost(false)}
      />

      <ConfirmDialog
        open={deletingComment !== null}
        title={t("cm_delete_comment_title", "Delete this comment?")}
        body={t("cm_delete_comment_body", "This cannot be undone.")}
        confirmLabel={t("c_delete", "Delete")}
        cancelLabel={t("c_cancel", "Cancel")}
        onConfirm={() => void confirmDeleteComment()}
        onCancel={() => setDeletingComment(null)}
      />
    </Screen>
  );
}
