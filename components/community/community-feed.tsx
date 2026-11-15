"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { ChatIcon, EditIcon, LockIcon, ShieldIcon, TrashIcon } from "@/components/icons";
import {
  communityErrorCopy,
  formatCommunityTime,
  hasMore,
  isEditable,
  isOwnContent,
  mergePostPage,
  statusTone,
  validatePostInput,
  type CommunityPost,
  type CommunitySpace,
} from "@/lib/community-core";
import {
  CommunityError,
  createPost,
  deletePost,
  fetchFeed,
  updatePost,
} from "@/lib/community";
import { useT } from "@/lib/i18n";
import { ReportDialog } from "./report-dialog";

function messageFor(t: ReturnType<typeof useT>, err: unknown): string {
  const code = err instanceof CommunityError ? err.code : "community_error";
  const copy = communityErrorCopy(code);
  return t(copy.key, copy.fallback);
}

export function CommunityFeed({
  space,
  canCompose,
  userId,
}: {
  space: CommunitySpace;
  canCompose: boolean;
  userId: string | null;
}) {
  const t = useT();
  const { push } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [page, setPage] = useState(0);
  const [lastPageLength, setLastPageLength] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<CommunityPost | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [deleting, setDeleting] = useState<CommunityPost | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      try {
        const rows = await fetchFeed({ space, page: nextPage });
        setLastPageLength(rows.length);
        setPosts((prev) => (replace ? rows : mergePostPage(prev, rows)));
        setPage(nextPage);
        setErrorCode(null);
      } catch (err) {
        setErrorCode(err instanceof CommunityError ? err.code : "community_error");
        if (replace) setPosts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [space],
  );

  useEffect(() => {
    // The fetch starts after the effect body so React does not see a
    // synchronous state update during commit.
    queueMicrotask(() => void load(0, true));
  }, [load]);

  const resetComposer = () => {
    setTitle("");
    setBody("");
    setFormError("");
    setComposerOpen(false);
  };

  const publish = async () => {
    const problem = validatePostInput(title, body);
    if (problem === "title_short") {
      setFormError(t("cm_post_title_short", "Add a title of at least 3 characters."));
      return;
    }
    if (problem === "title_long") {
      setFormError(t("cm_post_title_long", "Keep the title under 160 characters."));
      return;
    }
    if (problem === "body_empty") {
      setFormError(t("cm_post_body_empty", "Write something before posting."));
      return;
    }
    if (problem === "body_long") {
      setFormError(t("cm_post_body_long", "Keep the post under 8,000 characters."));
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const created = await createPost({ space, title, body });
      setPosts((prev) => [created, ...prev]);
      resetComposer();
      push(t("cm_posted", "Posted to Community"), "success");
    } catch (err) {
      setFormError(messageFor(t, err));
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (post: CommunityPost) => {
    setEditing(post);
    setEditTitle(post.title);
    setEditBody(post.body);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const problem = validatePostInput(editTitle, editBody);
    if (problem) {
      setFormError(t("cm_edit_invalid", "Check the title and body, then try again."));
      return;
    }
    setEditSaving(true);
    try {
      const updated = await updatePost({ id: editing.id, title: editTitle, body: editBody });
      setPosts((prev) => prev.map((post) => (post.id === updated.id ? updated : post)));
      setEditing(null);
      push(t("cm_updated", "Post updated"), "success");
    } catch (err) {
      setFormError(messageFor(t, err));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deletePost(deleting.id);
      setPosts((prev) => prev.filter((post) => post.id !== deleting.id));
      push(t("cm_deleted", "Post deleted"), "success");
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
    } finally {
      setDeleting(null);
    }
  };

  const errorCopy = errorCode ? communityErrorCopy(errorCode) : null;
  const errorMessage = errorCopy ? t(errorCopy.key, errorCopy.fallback) : "";
  const backendProblem =
    errorMessage && /backend|Sign in|permission/i.test(errorMessage) ? errorMessage : "";
  const retry = () => {
    setLoading(true);
    setErrorCode(null);
    void load(0, true);
  };
  const loadMore = () => {
    setLoadingMore(true);
    void load(page + 1, false);
  };

  return (
    <div className="space-y-4">
      {canCompose ? (
        <Card>
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <ChatIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-500 dark:text-slate-400">
                {t("cm_compose_prompt", "Start a discussion with the community…")}
              </span>
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {t("cm_new_post", "New post")}
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("cm_new_post", "New post")}
              </h2>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                placeholder={t("cm_post_title", "Post title")}
                aria-label={t("cm_post_title", "Post title")}
                className={inputClass}
              />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                placeholder={t("cm_post_body", "Share a question or experience…")}
                aria-label={t("cm_post_body", "Post body")}
                className={inputClass}
              />
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t(
                  "cm_privacy_note",
                  "Do not post another person's name, phone number, test results or other private health information.",
                )}
              </p>
              {formError ? (
                <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                  {formError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button onClick={publish} disabled={saving}>
                  {saving ? t("c_sending", "Sending…") : t("cm_publish", "Publish")}
                </Button>
                <Button tone="secondary" onClick={resetComposer} disabled={saving}>
                  {t("c_cancel", "Cancel")}
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="flex items-start gap-2">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("cm_read_only", "You can read this space, but only its members can post.")}
          </p>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <Card key={row}>
              <div className="h-4 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="mt-3 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
              <div className="mt-2 h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
            </Card>
          ))}
        </div>
      ) : backendProblem ? (
        <Card className="text-center">
          <EmptyState
            icon={<LockIcon className="h-6 w-6" />}
            title={t("cm_unavailable_title", "Community is unavailable")}
            body={backendProblem}
          />
        </Card>
      ) : errorMessage ? (
        <Card>
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
          <Button tone="secondary" className="mt-3" onClick={retry}>
            {t("c_retry", "Try again")}
          </Button>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="text-center">
          <EmptyState
            icon={<ChatIcon className="h-6 w-6" />}
            title={t("cm_empty_title", "No discussions yet")}
            body={t(
              "cm_empty_body",
              "This space is empty until a member posts. CareNBuddi does not seed sample discussions.",
            )}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const own = isOwnContent(post.author_id, userId);
            const editable = isEditable(post.status, own) && editing?.id !== post.id;
            return (
              <Card key={post.id}>
                <article>
                  <div className="flex items-start gap-3">
                    <Avatar name={post.author_name} size={38} />
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
                      <Badge tone={statusTone(post.status)}>
                        {t(`cm_status_${post.status}`, post.status)}
                      </Badge>
                    ) : null}
                  </div>

                  {editing?.id === post.id ? (
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
                        rows={5}
                        aria-label={t("cm_post_body", "Post body")}
                        className={inputClass}
                      />
                      {formError ? (
                        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                          {formError}
                        </p>
                      ) : null}
                      <div className="flex gap-2">
                        <Button onClick={saveEdit} disabled={editSaving}>
                          {editSaving ? t("c_saving", "Saving…") : t("c_save", "Save")}
                        </Button>
                        <Button tone="secondary" onClick={() => setEditing(null)} disabled={editSaving}>
                          {t("c_cancel", "Cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
                        {post.title}
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {post.body}
                      </p>
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <Link
                      href={`/community/post?id=${post.id}`}
                      className="font-semibold text-brand-700 dark:text-brand-300"
                    >
                      {t("cm_open_discussion", "Open discussion")}
                    </Link>
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => beginEdit(post)}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        {t("c_edit", "Edit")}
                      </button>
                    ) : null}
                    {own ? (
                      <button
                        type="button"
                        onClick={() => setDeleting(post)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        {t("c_delete", "Delete")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReporting(post.id)}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-amber-700"
                      >
                        <ShieldIcon className="h-3.5 w-3.5" />
                        {t("e_report", "Report")}
                      </button>
                    )}
                  </div>
                </article>
              </Card>
            );
          })}

          {hasMore(lastPageLength) ? (
            <Button
              tone="secondary"
              full
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? t("c_loading", "Loading…") : t("cm_load_more", "Load more")}
            </Button>
          ) : null}
        </div>
      )}

      {reporting ? (
        <ReportDialog
          key={reporting}
          targetType="post"
          targetId={reporting}
          onClose={() => setReporting(null)}
          onDone={() => push(t("cm_reported", "Report sent to moderators"), "success")}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={t("cm_delete_title", "Delete this post?")}
        body={t(
          "cm_delete_body",
          "The post and its comments will be removed permanently. This cannot be undone.",
        )}
        confirmLabel={t("cm_delete_confirm", "Delete post")}
        cancelLabel={t("c_cancel", "Cancel")}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
