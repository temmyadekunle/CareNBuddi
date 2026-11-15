"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Screen,
  SectionHeader,
  SkeletonCards,
  inputClass,
  useToast,
} from "@/components/app-ui";
import {
  CameraIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";
import { ProviderShell } from "@/components/provider-shell";
import {
  canStart,
  formatConsultationWhen,
  type Consultation,
} from "@/lib/consultation-core";
import {
  STATUS_FALLBACK,
  STATUS_KEY,
  STATUS_TONE,
  consultationErrorCopy,
} from "@/lib/consultation-ui";
import {
  ConsultationError,
  currentConsultationUserId,
  expireMyConsultations,
  listConsultationsForProvider,
  respondConsultation,
  startConsultation,
  type ConsultationErrorCode,
} from "@/lib/consultations";
import { useLang, useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { useServerApplication } from "@/lib/server-provider-applications";

type LoadPhase = "loading" | "ready" | "error" | "auth" | "offline";

export default function ProviderConsultationsPage() {
  return (
    <ProviderShell>
      <ProviderConsultations />
    </ProviderShell>
  );
}

function ProviderConsultations() {
  const t = useT();
  const lang = useLang();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const { application, phase: applicationPhase } = useServerApplication(session.userId);
  const me = users.find((user) => user.id === session.userId);

  const verified = me?.role === "provider" && application?.status === "verified";
  const statusUnknown = applicationPhase === "offline" || applicationPhase === "error";

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [rows, setRows] = useState<Consultation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ConsultationErrorCode | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [actionBusy, setActionBusy] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Consultation | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const load = useCallback(async () => {
    try {
      const id = await currentConsultationUserId();
      setUserId(id);
      await expireMyConsultations().catch(() => 0);
      setRows(await listConsultationsForProvider(id));
      setErrorCode(null);
      setPhase("ready");
    } catch (error) {
      const code = error instanceof ConsultationError ? error.code : "consultation_error";
      setErrorCode(code);
      setPhase(code === "cloud_required" ? "offline" : code === "auth_required" ? "auth" : "error");
    }
  }, []);

  useEffect(() => {
    if (!verified) return;
    queueMicrotask(() => void load());
  }, [verified, load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const groups = useMemo(() => {
    const sortByTime = (a: Consultation, b: Consultation) =>
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime();
    return {
      requests: rows.filter((row) => row.status === "requested").sort(sortByTime),
      scheduled: rows.filter((row) => row.status === "accepted").sort(sortByTime),
      current: rows.filter((row) => row.status === "in_progress").sort(sortByTime),
      history: rows
        .filter((row) => !["requested", "accepted", "in_progress"].includes(row.status))
        .sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()),
    };
  }, [rows]);

  const accept = async (row: Consultation) => {
    setActionBusy(true);
    try {
      await respondConsultation({ id: row.id, accept: true });
      push(t("vc_accept_ok", "Request accepted"), "success");
      await load();
    } catch (error) {
      const copy = consultationErrorCopy(
        error instanceof ConsultationError ? error.code : "consultation_error",
      );
      push(t(copy.titleKey, copy.title), "error");
    } finally {
      setActionBusy(false);
    }
  };

  const decline = async () => {
    if (!declineTarget) return;
    setActionBusy(true);
    try {
      await respondConsultation({
        id: declineTarget.id,
        accept: false,
        reason: declineReason,
      });
      push(t("vc_decline_ok", "Request declined"), "success");
      setDeclineTarget(null);
      setDeclineReason("");
      await load();
    } catch (error) {
      const copy = consultationErrorCopy(
        error instanceof ConsultationError ? error.code : "consultation_error",
      );
      push(t(copy.titleKey, copy.title), "error");
    } finally {
      setActionBusy(false);
    }
  };

  const start = async (row: Consultation) => {
    setActionBusy(true);
    try {
      await startConsultation(row.id);
      push(t("vc_start_ok", "Session started"), "success");
      await load();
    } catch (error) {
      const copy = consultationErrorCopy(
        error instanceof ConsultationError ? error.code : "consultation_error",
      );
      push(t(copy.titleKey, copy.title), "error");
    } finally {
      setActionBusy(false);
    }
  };

  if (statusUnknown) {
    return (
      <Screen>
        <SectionHeader
          title={t("vc_consultations", "Consultations")}
          subtitle={t("vc_provider_sub", "Manage your assigned video consultations.")}
        />
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t("cm_verify_unknown", "Verification status unavailable")}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {t(
                  "vc_verify_unknown_body",
                  "CareNBuddi cloud could not confirm your verification, so consultation management is unavailable. Try again when the backend is reachable.",
                )}
              </p>
            </div>
          </div>
        </Card>
      </Screen>
    );
  }

  if (!verified) {
    return (
      <Screen>
        <SectionHeader
          title={t("vc_consultations", "Consultations")}
          subtitle={t("vc_provider_sub", "Manage your assigned video consultations.")}
        />
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t("vc_provider_only", "Verified providers only")}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {t(
                  "vc_provider_only_body",
                  "Consultation requests open after your provider application is verified. Until then no patient can book you and you cannot join a session.",
                )}
              </p>
              <Link href="/provider/status" className="mt-3 inline-block">
                <Button tone="secondary">{t("vc_view_application", "View application status")}</Button>
              </Link>
            </div>
          </div>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("vc_consultations", "Consultations")}
        subtitle={t("vc_provider_sub", "Manage your assigned video consultations.")}
      />

      <Card className="mt-4 flex items-start gap-2 border-brand-100 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30">
        <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
        <p className="text-xs leading-relaxed text-brand-900/80 dark:text-brand-100/80">
          {t(
            "vc_provider_privacy",
            "Only the assigned patient and you can open the video room. Do not record the session or copy patient details outside the consultation record.",
          )}
        </p>
      </Card>

      {phase === "loading" && (
        <div className="mt-4">
          <SkeletonCards rows={2} />
        </div>
      )}

      {phase === "offline" && (
        <div className="mt-4">
          <ErrorState
            title={t("vc_cloud_required", "Sign-in required")}
            body={t(
              "vc_cloud_required_body",
              "Virtual care needs the CareNBuddi backend and a signed-in account.",
            )}
            onRetry={() => void load()}
            retryLabel={t("vc_retry", "Try again")}
          />
        </div>
      )}

      {phase === "auth" && (
        <div className="mt-4">
          <EmptyState
            icon={<LockIcon className="h-6 w-6" />}
            title={t("vc_signin_required", "Sign in again")}
            body={t("vc_signin_required_body", "Your secure session has expired. Sign in and try again.")}
            action={
              <Link href="/auth/sign-in" className="mt-2 inline-block min-h-11">
                <Button className="min-h-11">{t("vc_signin", "Sign in")}</Button>
              </Link>
            }
          />
        </div>
      )}

      {phase === "error" && errorCode && (
        <div className="mt-4">
          <ErrorState
            title={t(consultationErrorCopy(errorCode).titleKey, consultationErrorCopy(errorCode).title)}
            body={t(consultationErrorCopy(errorCode).bodyKey, consultationErrorCopy(errorCode).body)}
            onRetry={() => void load()}
            retryLabel={t("vc_retry", "Try again")}
          />
        </div>
      )}

      {phase === "ready" && rows.length === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={<CameraIcon className="h-6 w-6" />}
            title={t("vc_no_requests", "No consultation requests")}
            body={t("vc_no_requests_body", "New video consultation requests from patients will appear here.")}
          />
        </div>
      )}

      {phase === "ready" && groups.requests.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_requests", "Requests")} />
          <div className="space-y-3">
            {groups.requests.map((row) => (
              <ProviderRow key={row.id} row={row} lang={lang}>
                <Button
                  disabled={actionBusy}
                  onClick={() => void accept(row)}
                  className="min-h-11"
                >
                  <CheckIcon className="h-4 w-4" />
                  {t("vc_accept", "Accept")}
                </Button>
                <Button
                  tone="danger"
                  className="min-h-11"
                  disabled={actionBusy}
                  onClick={() => setDeclineTarget(row)}
                >
                  {t("vc_decline", "Decline")}
                </Button>
              </ProviderRow>
            ))}
          </div>
        </section>
      )}

      {phase === "ready" && groups.current.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_current", "In progress")} />
          <div className="space-y-3">
            {groups.current.map((row) => (
              <ProviderRow key={row.id} row={row} lang={lang}>
                <Link href={`/consultations/session?id=${row.id}`} className="inline-block min-h-11">
                  <Button className="min-h-11">
                    <CameraIcon className="h-4 w-4" />
                    {t("vc_open_room", "Open room")}
                  </Button>
                </Link>
              </ProviderRow>
            ))}
          </div>
        </section>
      )}

      {phase === "ready" && groups.scheduled.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_scheduled", "Scheduled")} />
          <div className="space-y-3">
            {groups.scheduled.map((row) => (
              <ProviderRow key={row.id} row={row} lang={lang}>
                {canStart(row, now) && (
                  <Button
                    tone="secondary"
                    className="min-h-11"
                    disabled={actionBusy}
                    onClick={() => void start(row)}
                  >
                    {t("vc_start", "Start session")}
                  </Button>
                )}
                <Link href={`/consultations/session?id=${row.id}`} className="inline-block min-h-11">
                  <Button className="min-h-11">
                    <CameraIcon className="h-4 w-4" />
                    {t("vc_open_room", "Open room")}
                  </Button>
                </Link>
              </ProviderRow>
            ))}
          </div>
        </section>
      )}

      {phase === "ready" && groups.history.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_history", "History")} />
          <div className="space-y-3">
            {groups.history.map((row) => (
              <ProviderRow key={row.id} row={row} lang={lang}>
                <Link href={`/consultations/session?id=${row.id}`} className="inline-block min-h-11">
                  <Button tone="secondary" className="min-h-11">
                    {t("vc_view", "View details")}
                  </Button>
                </Link>
              </ProviderRow>
            ))}
          </div>
        </section>
      )}

      {userId && (
        <p className="mt-4 text-center text-[11px] text-slate-400">
          {t(
            "vc_provider_footer",
            "Patient contact details remain in the patient record. This list shows only the information shared for the consultation.",
          )}
        </p>
      )}

      <BottomSheet
        open={Boolean(declineTarget)}
        onClose={() => {
          setDeclineTarget(null);
          setDeclineReason("");
        }}
        title={t("vc_decline_title", "Decline request")}
      >
        <div className="space-y-3">
          <Field label={t("vc_decline_reason", "Reason (optional)")}>
            <textarea
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              rows={3}
              maxLength={500}
              className={inputClass}
              placeholder={t("vc_decline_placeholder", "For example: this needs an in-person examination")}
            />
          </Field>
          <Button full tone="danger" disabled={actionBusy} onClick={() => void decline()}>
            {t("vc_decline", "Decline")}
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

function ProviderRow({
  row,
  lang,
  children,
}: {
  row: Consultation;
  lang: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
            {row.patient_name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatConsultationWhen(row.scheduled_for, lang)} · {row.duration_minutes} min
          </p>
        </div>
        <Badge tone={STATUS_TONE[row.status]}>
          {t(STATUS_KEY[row.status], STATUS_FALLBACK[row.status])}
        </Badge>
      </div>
      {row.reason && (
        <p className="mt-2 line-clamp-3 text-xs text-slate-600 dark:text-slate-300">{row.reason}</p>
      )}
      {row.status === "completed" && row.completion_note && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          {t("vc_notes", "Completion note")}: {row.completion_note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </Card>
  );
}
