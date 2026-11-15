"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  SkeletonCards,
  useToast,
} from "@/components/app-ui";
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  StethoscopeIcon,
} from "@/components/icons";
import { RequestConsultationSheet } from "@/components/consultations/request-sheet";
import {
  canCancel,
  canJoin,
  formatConsultationWhen,
  groupConsultations,
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
  cancelConsultation,
  currentConsultationUserId,
  expireMyConsultations,
  listConsultationsForPatient,
  type ConsultationErrorCode,
} from "@/lib/consultations";
import { useLang, useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";

type LoadPhase = "loading" | "ready" | "error" | "auth" | "offline";

export default function ConsultationsPage() {
  const t = useT();
  const router = useRouter();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((user) => user.id === session.userId);

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [rows, setRows] = useState<Consultation[]>([]);
  const [errorCode, setErrorCode] = useState<ConsultationErrorCode | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Consultation | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const userId = await currentConsultationUserId();
      await expireMyConsultations().catch(() => 0);
      setRows(await listConsultationsForPatient(userId));
      setErrorCode(null);
      setPhase("ready");
    } catch (error) {
      const code = error instanceof ConsultationError ? error.code : "consultation_error";
      setErrorCode(code);
      setPhase(code === "cloud_required" ? "offline" : code === "auth_required" ? "auth" : "error");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const groups = useMemo(() => groupConsultations(rows, now), [rows, now]);

  const doCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelConsultation(cancelTarget.id, "");
      push(t("vc_cancel_ok", "Consultation cancelled"), "success");
      setCancelTarget(null);
      await load();
    } catch (error) {
      const copy = consultationErrorCopy(
        error instanceof ConsultationError ? error.code : "consultation_error",
      );
      push(t(copy.titleKey, copy.title), "error");
    }
  };

  if (me?.role === "provider") {
    return (
      <Screen>
        <SectionHeader
          title={t("vc_title", "Virtual care")}
          subtitle={t("vc_patient_space", "Request a private video consultation.")}
        />
        <Card className="mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(
              "vc_provider_redirect",
              "Provider accounts manage assigned consultations in the provider workspace.",
            )}
          </p>
          <Link href="/provider/consultations" className="mt-3 inline-block">
            <Button>
              <StethoscopeIcon className="mr-1.5 h-4 w-4" />
              {t("vc_open_provider", "Open provider consultations")}
            </Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  if (me?.role === "admin") {
    return (
      <Screen>
        <SectionHeader
          title={t("vc_title", "Virtual care")}
          subtitle={t("vc_patient_space", "Request a private video consultation.")}
        />
        <Card className="mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(
              "vc_admin_patient_note",
              "Administrators oversee consultations from the admin console and cannot request or join a session.",
            )}
          </p>
          <Link href="/admin" className="mt-3 inline-block">
            <Button>{t("vc_open_admin", "Open admin console")}</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("vc_title", "Virtual care")}
        subtitle={t("vc_sub", "Request a private video consultation with a verified provider.")}
      />

      <Card className="mt-4 flex items-start gap-2 border-brand-100 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30">
        <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
            {t("vc_secure", "Private room")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brand-900/80 dark:text-brand-100/80">
            {t(
              "vc_secure_body",
              "The room link and token are created only for the assigned patient and provider, and expire after the session. Sessions are not recorded by default.",
            )}
          </p>
        </div>
      </Card>

      <Card className="mt-3 flex items-start gap-2 border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/85">
          {t(
            "vc_emergency",
            "This is not an emergency service. For chest pain, severe bleeding, trouble breathing or another emergency, seek urgent care now.",
          )}
        </p>
      </Card>

      <div className="mt-4">
        <Button full onClick={() => setRequestOpen(true)}>
          <CameraIcon className="h-4 w-4" />
          {t("vc_request", "Request consultation")}
        </Button>
      </div>

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
            title={t("vc_empty", "No consultations yet")}
            body={t("vc_empty_body", "Request a consultation to get started.")}
          />
        </div>
      )}

      {phase === "ready" && groups.current.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_current", "In progress")} />
          <div className="space-y-3">
            {groups.current.map((item) => (
              <PatientRow
                key={item.id}
                item={item}
                now={now}
                onCancel={setCancelTarget}
              />
            ))}
          </div>
        </section>
      )}

      {phase === "ready" && groups.upcoming.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_upcoming", "Upcoming")} />
          <div className="space-y-3">
            {groups.upcoming.map((item) => (
              <PatientRow
                key={item.id}
                item={item}
                now={now}
                onCancel={setCancelTarget}
              />
            ))}
          </div>
        </section>
      )}

      {phase === "ready" && groups.history.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_history", "History")} />
          <div className="space-y-3">
            {groups.history.map((item) => (
              <PatientRow
                key={item.id}
                item={item}
                now={now}
                onCancel={setCancelTarget}
              />
            ))}
          </div>
        </section>
      )}

      <RequestConsultationSheet
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSent={(id) => router.push(`/consultations/session?id=${id}`)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t("vc_cancel_confirm", "Cancel this consultation?")}
        body={t("vc_cancel_body", "The other participant will see it as cancelled.")}
        confirmLabel={t("vc_cancel", "Cancel consultation")}
        cancelLabel={t("vc_keep", "Keep it")}
        onConfirm={() => void doCancel()}
        onCancel={() => setCancelTarget(null)}
      />
    </Screen>
  );
}

function PatientRow({
  item,
  now,
  onCancel,
}: {
  item: Consultation;
  now: Date;
  onCancel: (item: Consultation) => void;
}) {
  const t = useT();
  const lang = useLang();
  const joinable = canJoin(item, now);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.provider_name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatConsultationWhen(item.scheduled_for, lang)} · {item.duration_minutes} min
          </p>
        </div>
        <Badge tone={STATUS_TONE[item.status]}>{t(STATUS_KEY[item.status], STATUS_FALLBACK[item.status])}</Badge>
      </div>

      {item.reason && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{item.reason}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/consultations/session?id=${item.id}`} className="inline-block min-h-11">
          <Button tone="secondary" className="min-h-11">
            {t("vc_view", "View details")}
          </Button>
        </Link>
        {joinable && (
          <Link href={`/consultations/session?id=${item.id}`} className="inline-block min-h-11">
            <Button className="min-h-11">
              <CameraIcon className="h-4 w-4" />
              {t("vc_join", "Join video room")}
            </Button>
          </Link>
        )}
        {canCancel(item.status) && (
          <Button tone="danger" className="min-h-11" onClick={() => onCancel(item)}>
            {t("vc_cancel", "Cancel")}
          </Button>
        )}
      </div>
      {joinable && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckIcon className="h-3.5 w-3.5" />
          {t("vc_join_ready", "The room is open now.")}
        </p>
      )}
    </Card>
  );
}
