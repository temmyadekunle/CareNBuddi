"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Segmented,
  SectionHeader,
  useToast,
} from "@/components/app-ui";
import { ActivityIcon, ShieldIcon } from "@/components/icons";
import {
  communityErrorCopy,
  excerpt,
  formatCommunityTime,
  reportReason,
  statusTone,
} from "@/lib/community-core";
import {
  CommunityError,
  fetchModerationActions,
  fetchReportQueue,
  moderateContent,
  resolveReport,
  type ModerationQueueItem,
} from "@/lib/community";
import type {
  CommunityContentStatus,
  CommunityModerationAction,
  ModerationAction,
} from "@/lib/community-core";
import { useT } from "@/lib/i18n";

const ACTION_LABEL: Record<string, { key: string; fallback: string }> = {
  hide: { key: "cm_mod_hide", fallback: "Hidden" },
  restore: { key: "cm_mod_restore", fallback: "Restored" },
  remove: { key: "cm_mod_remove", fallback: "Removed" },
  resolve_report: { key: "cm_mod_resolved", fallback: "Report resolved" },
  dismiss_report: { key: "cm_mod_dismissed", fallback: "Report dismissed" },
};

/**
 * Administrator moderation queue.
 *
 * Every action goes through the SECURITY DEFINER RPCs in 0010, so the database
 * re-checks the administrator role and writes the audit row in the same
 * transaction. This component can only ever ask.
 */
export function CommunityModeration() {
  const t = useT();
  const { push } = useToast();

  const [filter, setFilter] = useState<"open" | "all">("open");
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [actions, setActions] = useState<CommunityModerationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [queue, audit] = await Promise.all([
        fetchReportQueue(filter),
        fetchModerationActions(25),
      ]);
      setItems(queue);
      setActions(audit);
      setErrorCode(null);
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
      setItems([]);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // The fetch starts after the effect body so React does not see a
    // synchronous state update during commit.
    queueMicrotask(() => void load());
  }, [load]);

  const moderate = async (item: ModerationQueueItem, action: ModerationAction) => {
    if (!item.target) return;
    setBusy(item.id);
    setErrorCode(null);
    try {
      await moderateContent({
        targetType: item.target_type,
        targetId: item.target_id,
        action,
      });
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id && entry.target
            ? {
                ...entry,
                target: {
                  ...entry.target,
                  status:
                    action === "hide" ? "hidden" : action === "remove" ? "removed" : "published",
                },
              }
            : entry,
        ),
      );
      push(t("cm_mod_done", "Moderation action recorded"), "success");
      const audit = await fetchModerationActions(25);
      setActions(audit);
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
    } finally {
      setBusy(null);
    }
  };

  const closeReport = async (item: ModerationQueueItem, resolution: "resolved" | "dismissed") => {
    setBusy(item.id);
    setErrorCode(null);
    try {
      await resolveReport({ reportId: item.id, resolution });
      setItems((prev) =>
        filter === "open" ? prev.filter((entry) => entry.id !== item.id) : prev.map((entry) =>
          entry.id === item.id ? { ...entry, status: resolution } : entry,
        ),
      );
      push(
        resolution === "resolved"
          ? t("cm_report_resolved_toast", "Report resolved")
          : t("cm_report_dismissed_toast", "Report dismissed"),
        "success",
      );
      const audit = await fetchModerationActions(25);
      setActions(audit);
    } catch (err) {
      setErrorCode(err instanceof CommunityError ? err.code : "community_error");
    } finally {
      setBusy(null);
    }
  };

  const errorCopy = errorCode ? communityErrorCopy(errorCode) : null;
  const errorMessage = errorCopy ? t(errorCopy.key, errorCopy.fallback) : "";
  const changeFilter = (value: "open" | "all") => {
    setLoading(true);
    setErrorCode(null);
    setFilter(value);
  };
  const retry = () => {
    setLoading(true);
    setErrorCode(null);
    void load();
  };

  return (
    <div className="space-y-3">
      <Segmented<"open" | "all">
        value={filter}
        onChange={changeFilter}
        options={[
          { value: "open", label: t("cm_mod_open", "Open reports") },
          { value: "all", label: t("cm_mod_all", "All reports") },
        ]}
      />

      {errorMessage ? (
        <Card>
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
          <Button tone="secondary" className="mt-3" onClick={retry}>
            {t("c_retry", "Try again")}
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {t("c_loading", "Loading…")}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldIcon className="h-6 w-6" />}
          title={t("cm_mod_none", "No reports to review")}
          body={t(
            "cm_mod_none_body",
            "Reports raised in either Community space appear here. There are no demo reports.",
          )}
        />
      ) : (
        items.map((item) => {
          const reason = reportReason(item.reason);
          const working = busy === item.id;
          return (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <ShieldIcon className="h-3.5 w-3.5" />
                    {item.target_type === "post"
                      ? t("cm_mod_post", "Reported post")
                      : t("cm_mod_comment", "Reported comment")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t(reason.key, reason.fallback)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {formatCommunityTime(item.created_at)}
                  </p>
                </div>
                <Badge tone={statusTone(item.status)}>
                  {t(`cm_report_${item.status}`, item.status)}
                </Badge>
              </div>

              {item.detail ? (
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                  {item.detail}
                </p>
              ) : null}

              {item.target ? (
                <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {item.target.author_name}
                    </p>
                    <Badge tone={statusTone(item.target.status as CommunityContentStatus)}>
                      {t(`cm_status_${item.target.status}`, item.target.status)}
                    </Badge>
                  </div>
                  {item.target.title ? (
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.target.title}
                    </p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {excerpt(item.target.body, 320)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {t("cm_mod_target_gone", "The reported content no longer exists.")}
                </p>
              )}

              {item.target ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.target.status !== "hidden" ? (
                    <Button
                      tone="secondary"
                      onClick={() => void moderate(item, "hide")}
                      disabled={working}
                    >
                      {t("cm_mod_hide", "Hide")}
                    </Button>
                  ) : (
                    <Button
                      tone="secondary"
                      onClick={() => void moderate(item, "restore")}
                      disabled={working}
                    >
                      {t("cm_mod_restore", "Restore")}
                    </Button>
                  )}
                  {item.target.status !== "removed" ? (
                    <Button tone="danger" onClick={() => void moderate(item, "remove")} disabled={working}>
                      {t("cm_mod_remove", "Remove")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {item.status === "open" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button full onClick={() => void closeReport(item, "resolved")} disabled={working}>
                    {t("cm_mod_resolve", "Resolve report")}
                  </Button>
                  <Button
                    full
                    tone="ghost"
                    onClick={() => void closeReport(item, "dismissed")}
                    disabled={working}
                  >
                    {t("cm_mod_dismiss", "Dismiss")}
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })
      )}

      <SectionHeader
        title={t("cm_mod_audit", "Moderation history")}
        subtitle={t("cm_mod_audit_sub", "Every decision is recorded and cannot be edited.")}
      />

      {actions.length === 0 ? (
        <Card className="flex items-start gap-2">
          <ActivityIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("cm_mod_audit_empty", "No moderation actions have been taken yet.")}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {actions.map((entry) => {
            const label = ACTION_LABEL[entry.action] ?? {
              key: "cm_mod_action",
              fallback: entry.action,
            };
            return (
              <Card key={entry.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t(label.key, label.fallback)} ·{" "}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        {entry.target_type}
                      </span>
                    </p>
                    {entry.note ? (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{entry.note}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatCommunityTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
