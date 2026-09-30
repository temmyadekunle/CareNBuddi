"use client";

import { useState } from "react";
import { KEYS, seedReports, uid, useStoredCollection } from "@/lib/storage";
import type { Report, ReportTarget } from "@/lib/types";
import { useT } from "@/lib/i18n";

export function ReportAction({
  targetType,
  targetId,
  title,
  reasonLabel = "Reason",
  className = "",
}: {
  targetType: ReportTarget;
  targetId: string;
  title?: string;
  reasonLabel?: string;
  className?: string;
}) {
  const t = useT();
  const [, setReports] = useStoredCollection(KEYS.reports, seedReports);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!reason.trim()) return;
    setReports((prev) => [
      ...prev,
      {
        id: uid(),
        targetType,
        targetId,
        reason: reason.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
      } satisfies Report,
    ]);
    setDone(true);
    setOpen(false);
  };

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setDone(false);
        }}
        className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500 hover:border-amber-300 hover:text-amber-700"
      >
        ⚠ {t("e_report")}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-xs font-semibold text-slate-900">{title ?? t("e_report")}</p>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonLabel}
            className="mt-2 h-16 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              {t("c_cancel")}
            </button>
            <button
              onClick={submit}
              className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
            >
              {t("c_send")}
            </button>
          </div>
        </div>
      )}
      {done && (
        <span className="ml-1 text-[11px] font-medium text-green-700">✓ {t("c_status")}</span>
      )}
    </span>
  );
}