"use client";

import { useState } from "react";

import { BottomSheet, Button, inputClass } from "@/components/app-ui";
import { COMMUNITY_REPORT_REASONS, REPORT_DETAIL_MAX, communityErrorCopy } from "@/lib/community-core";
import { reportContent, CommunityError } from "@/lib/community";
import { useT } from "@/lib/i18n";

export function ReportDialog({
  targetType,
  targetId,
  onClose,
  onDone,
}: {
  targetType: "post" | "comment";
  targetId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState(COMMUNITY_REPORT_REASONS[0].id);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await reportContent({ targetType, targetId, reason, detail });
      onDone();
      onClose();
    } catch (err) {
      const code = err instanceof CommunityError ? err.code : "community_error";
      const copy = communityErrorCopy(code);
      setError(t(copy.key, copy.fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t("cm_report_title", "Report content")}
      footer={
        <Button full onClick={submit} disabled={busy}>
          {busy ? t("c_sending", "Sending…") : t("cm_report_send", "Send report")}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t(
            "cm_report_note",
            "Reports go to the CareNBuddi moderation team. The author is not told who reported them.",
          )}
        </p>

        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("cm_report_reason", "Why are you reporting this?")}
          </p>
          <div className="mt-2 space-y-2">
            {COMMUNITY_REPORT_REASONS.map((entry) => (
              <label
                key={entry.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
              >
                <input
                  type="radio"
                  name="community-report-reason"
                  checked={reason === entry.id}
                  onChange={() => setReason(entry.id)}
                  className="h-4 w-4"
                />
                <span>{t(entry.key, entry.fallback)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="community-report-detail" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("cm_report_detail", "Anything else we should know? (optional)")}
          </label>
          <textarea
            id="community-report-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value.slice(0, REPORT_DETAIL_MAX))}
            rows={3}
            className={`${inputClass} mt-1`}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
