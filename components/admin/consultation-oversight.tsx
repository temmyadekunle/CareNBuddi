"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Segmented,
  SectionHeader,
} from "@/components/app-ui";
import { CameraIcon, ShieldIcon } from "@/components/icons";
import {
  formatConsultationWhen,
  type Consultation,
  type ConsultationEvent,
} from "@/lib/consultation-core";
import {
  EVENT_KEYS,
  ACTOR_KEYS,
  STATUS_FALLBACK,
  STATUS_KEY,
  STATUS_TONE,
  consultationErrorCopy,
} from "@/lib/consultation-ui";
import {
  ConsultationError,
  fetchConsultationEvents,
  listAllConsultations,
  type ConsultationErrorCode,
} from "@/lib/consultations";
import { useLang, useT } from "@/lib/i18n";

type Filter = "active" | "all";

const ACTIVE: Consultation["status"][] = ["requested", "accepted", "in_progress"];

/**
 * Read-only oversight of every consultation.
 *
 * The 0011 policies let an administrator select consultations and their
 * activity log, but the join endpoint requires the caller to be the assigned
 * patient or provider. This panel therefore shows status and history only; it
 * has no join button, by design.
 */
export function ConsultationOversight() {
  const t = useT();
  const lang = useLang();

  const [filter, setFilter] = useState<Filter>("active");
  const [rows, setRows] = useState<Consultation[]>([]);
  const [events, setEvents] = useState<Record<string, ConsultationEvent[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ConsultationErrorCode | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listAllConsultations();
      setRows(data);
      setErrorCode(null);
    } catch (err) {
      setErrorCode(err instanceof ConsultationError ? err.code : "consultation_error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const counts = useMemo(() => {
    const base = { requested: 0, accepted: 0, in_progress: 0, completed: 0, total: rows.length };
    for (const row of rows) {
      if (row.status === "requested") base.requested += 1;
      else if (row.status === "accepted") base.accepted += 1;
      else if (row.status === "in_progress") base.in_progress += 1;
      else if (row.status === "completed") base.completed += 1;
    }
    return base;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "active" ? rows.filter((row) => ACTIVE.includes(row.status)) : rows),
    [rows, filter],
  );

  const openEvents = async (row: Consultation) => {
    if (selected === row.id) {
      setSelected(null);
      return;
    }
    setSelected(row.id);
    if (events[row.id]) return;
    setBusy(row.id);
    setErrorCode(null);
    try {
      const log = await fetchConsultationEvents(row.id);
      setEvents((prev) => ({ ...prev, [row.id]: log }));
    } catch (err) {
      setErrorCode(err instanceof ConsultationError ? err.code : "consultation_error");
    } finally {
      setBusy(null);
    }
  };

  const errorCopy = errorCode ? consultationErrorCopy(errorCode) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: t("vc_requests", "Requests"), value: counts.requested },
          { label: t("vc_scheduled", "Scheduled"), value: counts.accepted },
          { label: t("vc_current", "In progress"), value: counts.in_progress },
          { label: t("vc_status_completed", "Completed"), value: counts.completed },
        ].map((item) => (
          <Card key={item.label} className="px-3 py-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="flex items-start gap-2">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {t(
            "vc_admin_no_join",
            "Administrators can see status and activity but cannot join the video room.",
          )}
        </p>
      </Card>

      <Segmented<Filter>
        value={filter}
        onChange={(value) => setFilter(value)}
        options={[
          { value: "active", label: t("vc_admin_active", "Active") },
          { value: "all", label: t("vc_admin_all", "All") },
        ]}
      />

      {errorCopy ? (
        <Card>
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {t(errorCopy.titleKey, errorCopy.title)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(errorCopy.bodyKey, errorCopy.body)}
          </p>
          <Button
            tone="secondary"
            className="mt-3"
            onClick={() => {
              setLoading(true);
              setErrorCode(null);
              void load();
            }}
          >
            {t("vc_retry", "Try again")}
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {t("vc_loading", "Loading…")}
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CameraIcon className="h-6 w-6" />}
          title={t("vc_admin_none", "No consultations")}
          body={t(
            "vc_admin_none_body",
            "Requests appear here once patients start using virtual care.",
          )}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((row) => {
            const expanded = selected === row.id;
            return (
              <Card key={row.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {row.patient_name} · {row.provider_name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatConsultationWhen(row.scheduled_for, lang)} · {row.duration_minutes} min
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[row.status]}>
                    {t(STATUS_KEY[row.status], STATUS_FALLBACK[row.status])}
                  </Badge>
                </div>

                {row.reason ? (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                    {row.reason}
                  </p>
                ) : null}

                {row.completion_note ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t("vc_notes", "Completion note")}: {row.completion_note}
                  </p>
                ) : null}

                <Button
                  tone="secondary"
                  full
                  className="mt-3"
                  onClick={() => void openEvents(row)}
                  disabled={busy === row.id}
                >
                  {expanded
                    ? t("vc_events_hide", "Hide activity")
                    : t("vc_events", "Activity")}
                </Button>

                {expanded ? (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    {(events[row.id] ?? []).length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("vc_events_empty", "No activity recorded.")}
                      </p>
                    ) : (
                      (events[row.id] ?? []).map((event) => {
                        const label = EVENT_KEYS[event.event] ?? {
                          key: "vc_event_unknown",
                          fallback: event.event,
                        };
                        const actor = ACTOR_KEYS[event.actor_role] ?? {
                          key: "vc_role_system",
                          fallback: event.actor_role,
                        };
                        return (
                          <div key={event.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {t(label.key, label.fallback)}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {t(actor.key, actor.fallback)}
                              </p>
                              {event.note ? (
                                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                  {event.note}
                                </p>
                              ) : null}
                            </div>
                            <p className="shrink-0 text-[11px] text-slate-400">
                              {formatConsultationWhen(event.created_at, lang)}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <SectionHeader
        title={t("vc_admin_audit", "Read-only audit")}
        subtitle={t(
          "vc_admin_audit_sub",
          "Activity is written by the database and cannot be edited from this panel.",
        )}
      />
    </div>
  );
}
