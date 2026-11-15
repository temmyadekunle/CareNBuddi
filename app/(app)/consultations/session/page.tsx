"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
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
  AlertIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  LockIcon,
  ShieldIcon,
} from "@/components/icons";
import {
  canCancel,
  canComplete,
  canStart,
  formatConsultationWhen,
  joinState,
  joinWindow,
  type Consultation,
  type ConsultationEvent,
  type ConsultationJoinTicket,
} from "@/lib/consultation-core";
import {
  ACTOR_KEYS,
  EVENT_KEYS,
  STATUS_FALLBACK,
  STATUS_KEY,
  STATUS_TONE,
  consultationErrorCopy,
} from "@/lib/consultation-ui";
import {
  ConsultationError,
  cancelConsultation,
  completeConsultation,
  currentConsultationUserId,
  fetchConsultation,
  fetchConsultationEvents,
  joinConsultation,
  respondConsultation,
  startConsultation,
  type ConsultationErrorCode,
} from "@/lib/consultations";
import { useLang, useT } from "@/lib/i18n";

type LoadPhase = "loading" | "ready" | "not_found" | "error" | "auth" | "offline";

export default function ConsultationSessionPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonCards rows={2} />
        </Screen>
      }
    >
      <Session />
    </Suspense>
  );
}

function Session() {
  const t = useT();
  const lang = useLang();
  const { push } = useToast();
  const params = useSearchParams();
  const id = params.get("id") ?? "";

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [errorCode, setErrorCode] = useState<ConsultationErrorCode | null>(null);
  const [item, setItem] = useState<Consultation | null>(null);
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const [ticket, setTicket] = useState<ConsultationJoinTicket | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<ConsultationErrorCode | null>(null);
  const [left, setLeft] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!id) {
        setPhase("not_found");
        return;
      }
      if (!silent) setPhase("loading");
      try {
        const userId = await currentConsultationUserId();
        const row = await fetchConsultation(id);
        if (!row) {
          setItem(null);
          setEvents([]);
          setPhase("not_found");
          return;
        }
        setMeId(userId);
        setItem(row);
        setEvents(await fetchConsultationEvents(id));
        setErrorCode(null);
        setPhase("ready");
      } catch (error) {
        const code = error instanceof ConsultationError ? error.code : "consultation_error";
        setErrorCode(code);
        setPhase(code === "cloud_required" ? "offline" : code === "auth_required" ? "auth" : "error");
      }
    },
    [id],
  );

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const poll = window.setInterval(() => void load(true), 30_000);
    const tick = window.setInterval(() => setNow(new Date()), 15_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [id, load]);

  const isPatient = Boolean(item && meId && item.patient_id === meId);
  const isProvider = Boolean(item && meId && item.provider_id === meId);
  const participant = isPatient || isProvider;
  const backHref = isProvider ? "/provider/consultations" : "/consultations";

  const runAction = async (action: () => Promise<void>, success: string): Promise<boolean> => {
    setActionBusy(true);
    try {
      await action();
      push(success, "success");
      await load(true);
      return true;
    } catch (error) {
      const copy = consultationErrorCopy(
        error instanceof ConsultationError ? error.code : "consultation_error",
      );
      push(t(copy.titleKey, copy.title), "error");
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const openRoom = async () => {
    if (!item) return;
    setJoining(true);
    setJoinError(null);
    try {
      setTicket(await joinConsultation(item.id));
      setLeft(false);
    } catch (error) {
      setJoinError(error instanceof ConsultationError ? error.code : "video_error");
    } finally {
      setJoining(false);
    }
  };

  const leaveRoom = () => {
    setTicket(null);
    setLeft(true);
  };

  if (phase === "loading") {
    return (
      <Screen>
        <SkeletonCards rows={2} />
      </Screen>
    );
  }

  if (phase === "not_found") {
    return (
      <Screen>
        <SectionHeader title={t("vc_detail", "Consultation")} />
        <EmptyState
          icon={<CameraIcon className="h-6 w-6" />}
          title={t("vc_not_found", "Consultation not found")}
          body={t(
            "vc_not_found_body",
            "This consultation does not exist or is not available to this account.",
          )}
          action={
            <Link href="/consultations" className="mt-2 inline-block min-h-11">
              <Button className="min-h-11">{t("vc_back", "Back to virtual care")}</Button>
            </Link>
          }
        />
      </Screen>
    );
  }

  if (phase === "auth" || phase === "offline" || phase === "error" || !item) {
    const code = errorCode ?? (phase === "offline" ? "cloud_required" : phase === "auth" ? "auth_required" : "consultation_error");
    const copy = consultationErrorCopy(code);
    return (
      <Screen>
        <SectionHeader title={t("vc_detail", "Consultation")} />
        <ErrorState
          title={t(copy.titleKey, copy.title)}
          body={t(copy.bodyKey, copy.body)}
          onRetry={() => void load()}
          retryLabel={t("vc_retry", "Try again")}
        />
        {phase === "auth" && (
          <div className="mt-3 text-center">
            <Link href="/auth/sign-in">
              <Button>{t("vc_signin", "Sign in")}</Button>
            </Link>
          </div>
        )}
      </Screen>
    );
  }

  const state = joinState(item, now);
  const joinTimes = joinWindow(item.scheduled_for, item.duration_minutes);
  const otherName = isProvider ? item.patient_name : item.provider_name;

  return (
    <Screen>
      <Link href={backHref} className="mp-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        {t("vc_back", "Back to virtual care")}
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {otherName}
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatConsultationWhen(item.scheduled_for, lang)} · {item.duration_minutes} min
          </p>
        </div>
        <Badge tone={STATUS_TONE[item.status]}>{t(STATUS_KEY[item.status], STATUS_FALLBACK[item.status])}</Badge>
      </div>

      {!participant && (
        <Card className="mt-4 flex items-start gap-2 border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t(
              "vc_admin_oversight_note",
              "You are viewing this consultation as an administrator. Administrators cannot join the video room.",
            )}
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{t("vc_when", "When")}</dt>
            <dd className="text-right font-medium text-slate-800 dark:text-slate-200">
              {formatConsultationWhen(item.scheduled_for, lang)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{t("vc_duration", "Duration")}</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">{item.duration_minutes} min</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">
              {isProvider ? t("vc_patient", "Patient") : t("vc_provider", "Provider")}
            </dt>
            <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{otherName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{t("vc_consent_label", "Consent")}</dt>
            <dd className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
              {t("vc_consent_given", "Patient consent recorded")}
            </dd>
          </div>
        </dl>
        {item.reason && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t("vc_reason_label", "Reason")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">{item.reason}</p>
          </div>
        )}
        {item.status === "declined" && item.decline_reason && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {t("vc_declined_reason", "Provider note")}: {item.decline_reason}
          </p>
        )}
        {item.status === "completed" && item.completion_note && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            {t("vc_notes", "Completion note")}: {item.completion_note}
          </p>
        )}
      </Card>

      {ticket && (
        <Card className="mt-4 p-0">
          <div className="flex items-center justify-between gap-2 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <LockIcon className="h-4 w-4 text-emerald-600" />
              {t("vc_room_open", "Secure room")}
            </p>
            <Button tone="danger" className="min-h-9 px-3" onClick={leaveRoom}>
              {t("vc_leave", "Leave room")}
            </Button>
          </div>
          <iframe
            title={t("vc_room_open", "Secure room")}
            src={`${ticket.url}?t=${encodeURIComponent(ticket.token)}`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="h-[58vh] w-full bg-black"
          />
          <p className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
            {t(
              "vc_room_hint",
              "If the video does not connect, leave and rejoin. The room token expires automatically after this session.",
            )}
          </p>
        </Card>
      )}

      {!ticket && joinError && (
        <Card className="mt-4 border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30">
          <div className="flex items-start gap-2">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                {t(consultationErrorCopy(joinError).titleKey, consultationErrorCopy(joinError).title)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-800 dark:text-rose-200">
                {t(consultationErrorCopy(joinError).bodyKey, consultationErrorCopy(joinError).body)}
              </p>
              <Button tone="secondary" className="mt-2" onClick={() => void openRoom()} disabled={joining}>
                {t("vc_retry", "Try again")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!ticket && participant && state === "open" && (
        <div className="mt-4">
          <Button full onClick={() => void openRoom()} disabled={joining}>
            <CameraIcon className="h-4 w-4" />
            {joining
              ? t("vc_joining", "Connecting…")
              : left
                ? t("vc_rejoin", "Rejoin room")
                : t("vc_join", "Join video room")}
          </Button>
          {left && (
            <p className="mt-2 text-center text-xs text-slate-500">
              {t("vc_left", "You left the room. You can rejoin while the session window is open.")}
            </p>
          )}
        </div>
      )}

      {!ticket && participant && state === "waiting" && (item.status === "accepted" || item.status === "in_progress") && (
        <Card className="mt-4 flex items-start gap-2 border-brand-100 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30">
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
          <div>
            <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
              {t("vc_waiting_title", "Waiting room")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-brand-900/80 dark:text-brand-100/80">
              {t("vc_waiting_body", "The room opens 15 minutes before the appointment.")}{" "}
              {formatConsultationWhen(joinTimes.opensAt.toISOString(), lang)}
            </p>
          </div>
        </Card>
      )}

      {!ticket && participant && state === "ended" && (
        <Card className="mt-4 flex items-start gap-2 border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t("vc_ended", "This session window has ended.")}
          </p>
        </Card>
      )}

      {participant && item.status === "requested" && isProvider && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={actionBusy}
            onClick={() =>
              void runAction(() => respondConsultation({ id: item.id, accept: true }), t("vc_accept_ok", "Request accepted"))
            }
          >
            {t("vc_accept", "Accept")}
          </Button>
          <Button tone="danger" disabled={actionBusy} onClick={() => setDeclineOpen(true)}>
            {t("vc_decline", "Decline")}
          </Button>
        </div>
      )}

      {participant && item.status === "accepted" && isProvider && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canStart(item, now) && (
            <Button
              disabled={actionBusy}
              onClick={() =>
                void runAction(() => startConsultation(item.id), t("vc_start_ok", "Session started"))
              }
            >
              {t("vc_start", "Start session")}
            </Button>
          )}
        </div>
      )}

      {participant && item.status === "in_progress" && isProvider && canComplete(item.status) && (
        <div className="mt-4">
          <Button full disabled={actionBusy} onClick={() => setCompleteOpen(true)}>
            {t("vc_complete", "Complete consultation")}
          </Button>
        </div>
      )}

      {participant && canCancel(item.status) && (
        <div className="mt-3">
          <Button tone="danger" full disabled={actionBusy} onClick={() => setCancelOpen(true)}>
            {t("vc_cancel", "Cancel consultation")}
          </Button>
        </div>
      )}

      <Card className="mt-4 flex items-start gap-2">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t(
            "vc_privacy_note",
            "Only the assigned patient and verified provider can open this room. The session is not recorded by default and no medical record is shared with anyone else.",
          )}
        </p>
      </Card>

      {events.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={t("vc_events", "Activity")} />
          <Card>
            <ol className="space-y-2">
              {events.map((event) => {
                const label = EVENT_KEYS[event.event] ?? { key: event.event, fallback: event.event };
                const actor = ACTOR_KEYS[event.actor_role] ?? { key: event.actor_role, fallback: event.actor_role };
                return (
                  <li key={event.id} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-slate-700 dark:text-slate-200">
                      {t(label.key, label.fallback)}
                      <span className="ml-1 text-slate-400">· {t(actor.key, actor.fallback)}</span>
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {formatConsultationWhen(event.created_at, lang)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </section>
      )}

      <BottomSheet
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
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
          <Button
            full
            tone="danger"
            disabled={actionBusy}
            onClick={() =>
              void runAction(
                () => respondConsultation({ id: item.id, accept: false, reason: declineReason }),
                t("vc_decline_ok", "Request declined"),
              ).then((ok) => {
                if (ok) setDeclineOpen(false);
              })
            }
          >
            {t("vc_decline", "Decline")}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title={t("vc_complete", "Complete consultation")}
      >
        <div className="space-y-3">
          <Field
            label={t("vc_complete_note", "Completion note (optional)")}
            hint={t("vc_complete_hint", "This note is visible to the patient and authorised administrators.")}
          >
            <textarea
              value={completionNote}
              onChange={(event) => setCompletionNote(event.target.value)}
              rows={4}
              maxLength={2000}
              className={inputClass}
              placeholder={t("vc_complete_placeholder", "Summary and next steps.")}
            />
          </Field>
          <Button
            full
            disabled={actionBusy}
            onClick={() =>
              void runAction(
                () => completeConsultation(item.id, completionNote),
                t("vc_complete_ok", "Consultation completed"),
              ).then((ok) => {
                if (ok) setCompleteOpen(false);
              })
            }
          >
            {t("vc_complete", "Complete consultation")}
          </Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={cancelOpen}
        title={t("vc_cancel_confirm", "Cancel this consultation?")}
        body={t("vc_cancel_body", "The other participant will see it as cancelled.")}
        confirmLabel={t("vc_cancel", "Cancel consultation")}
        cancelLabel={t("vc_keep", "Keep it")}
        onConfirm={() =>
          void runAction(
            () => cancelConsultation(item.id, ""),
            t("vc_cancel_ok", "Consultation cancelled"),
          ).then((ok) => {
            if (ok) setCancelOpen(false);
          })
        }
        onCancel={() => setCancelOpen(false)}
      />
    </Screen>
  );
}
