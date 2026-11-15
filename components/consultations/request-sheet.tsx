"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BottomSheet,
  Button,
  Card,
  Field,
  Segmented,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { AlertIcon, CheckIcon, SearchIcon } from "@/components/icons";
import {
  CONSULTATION_DURATIONS,
  formatSlotTime,
  groupSlots,
  validateRequest,
  type ConsultationDuration,
  type VerifiedProvider,
} from "@/lib/consultation-core";
import { consultationErrorCopy } from "@/lib/consultation-ui";
import {
  ConsultationError,
  listOpenSlots,
  listVerifiedProviders,
  requestConsultation,
  type ConsultationErrorCode,
} from "@/lib/consultations";
import { useLang, useT } from "@/lib/i18n";

type LoadPhase = "loading" | "ready" | "error";

export function RequestConsultationSheet({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const { push } = useToast();

  const [providers, setProviders] = useState<VerifiedProvider[]>([]);
  const [providerPhase, setProviderPhase] = useState<LoadPhase>("loading");
  const [providerError, setProviderError] = useState<ConsultationErrorCode | null>(null);
  const [query, setQuery] = useState("");

  const [providerId, setProviderId] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotPhase, setSlotPhase] = useState<LoadPhase>("loading");
  const [slotError, setSlotError] = useState<ConsultationErrorCode | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");

  const [duration, setDuration] = useState<ConsultationDuration>(30);
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProviders = useCallback(async () => {
    setProviderPhase("loading");
    try {
      setProviders(await listVerifiedProviders());
      setProviderError(null);
      setProviderPhase("ready");
    } catch (error) {
      setProviderError(error instanceof ConsultationError ? error.code : "consultation_error");
      setProviderPhase("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => void loadProviders());
  }, [open, loadProviders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return providers;
    return providers.filter((p) =>
      [p.full_name, p.speciality, p.facility, p.city, p.state]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [providers, query]);

  const chooseProvider = async (id: string) => {
    setProviderId(id);
    setSelectedSlot("");
    setSlots([]);
    setSlotPhase("loading");
    setFormError(null);
    try {
      setSlots(await listOpenSlots(id));
      setSlotError(null);
      setSlotPhase("ready");
    } catch (error) {
      setSlotError(error instanceof ConsultationError ? error.code : "consultation_error");
      setSlotPhase("error");
    }
  };

  const reset = () => {
    setQuery("");
    setProviderId("");
    setSlots([]);
    setSlotPhase("loading");
    setSlotError(null);
    setSelectedSlot("");
    setDuration(30);
    setReason("");
    setConsent(false);
    setFormError(null);
  };

  const submit = async () => {
    const problem = validateRequest({
      providerId,
      scheduledFor: selectedSlot,
      durationMinutes: duration,
      reason,
      consent,
    });
    if (problem) {
      setFormError(
        problem === "provider"
          ? { title: t("vc_err_provider", "Choose a provider"), body: t("vc_err_provider_body", "Select one verified provider first.") }
          : problem === "slot"
            ? { title: t("vc_err_slot", "Choose an open time"), body: t("vc_err_slot_body", "Pick one of the available times shown.") }
            : problem === "duration"
              ? { title: t("vc_err_duration", "Choose a duration"), body: t("vc_err_duration_body", "Sessions are 15, 30 or 45 minutes.") }
              : problem === "reason"
                ? { title: t("vc_err_reason", "Describe what you need"), body: t("vc_err_reason_body", "Write at least 3 characters, without full medical records.") }
                : { title: t("vc_err_consent", "Consent is required"), body: t("vc_err_consent_body", "Tick the consent box to request a video consultation.") },
      );
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const id = await requestConsultation({
        providerId,
        scheduledFor: selectedSlot,
        durationMinutes: duration,
        reason,
        consent,
      });
      push(t("vc_sent", "Request sent"), "success");
      reset();
      onSent(id);
      onClose();
    } catch (error) {
      if (error instanceof ConsultationError) {
        const copy = consultationErrorCopy(error.code);
        setFormError({ title: t(copy.titleKey, copy.title), body: t(copy.bodyKey, copy.body) });
      } else {
        const copy = consultationErrorCopy("consultation_error");
        setFormError({ title: t(copy.titleKey, copy.title), body: t(copy.bodyKey, copy.body) });
      }
    } finally {
      setBusy(false);
    }
  };

  const slotDays = useMemo(() => groupSlots(slots, lang), [slots, lang]);

  return (
    <BottomSheet open={open} onClose={onClose} title={t("vc_request", "Request consultation")}>
      <div className="space-y-4">
        <Card className="flex items-start gap-2 border-brand-100 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
          <p className="text-xs leading-relaxed text-brand-900/85 dark:text-brand-100/85">
            {t(
              "vc_emergency",
              "This is not an emergency service. For chest pain, severe bleeding, trouble breathing or another emergency, seek urgent care now.",
            )}
          </p>
        </Card>

        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("vc_choose_provider", "Choose a provider")}
          </p>
          <div className="relative mt-1.5">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("vc_search_placeholder", "Search by name, speciality or facility")}
              className={`${inputClass} pl-9`}
              aria-label={t("vc_search_placeholder", "Search verified providers")}
            />
          </div>
        </div>

        {providerPhase === "loading" && (
          <p className="text-xs text-slate-500">{t("vc_loading_providers", "Loading verified providers…")}</p>
        )}
        {providerPhase === "error" && providerError && (
          <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
              {t(consultationErrorCopy(providerError).titleKey, consultationErrorCopy(providerError).title)}
            </p>
            <Button tone="secondary" className="mt-2" onClick={() => void loadProviders()}>
              {t("vc_retry", "Try again")}
            </Button>
          </div>
        )}
        {providerPhase === "ready" && filtered.length === 0 && (
          <p className="text-xs text-slate-500">
            {t("vc_no_providers_body", "Verified providers appear here after their application is approved.")}
          </p>
        )}
        <div className="space-y-2">
          {filtered.map((provider) => {
            const selected = providerId === provider.user_id;
            return (
              <button
                key={provider.user_id}
                type="button"
                aria-pressed={selected}
                onClick={() => void chooseProvider(provider.user_id)}
                className={`tap flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                  selected
                    ? "border-brand-400 bg-brand-50/70 dark:border-brand-700 dark:bg-brand-950/30"
                    : "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-700/40"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                  {provider.full_name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {provider.full_name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-300">
                    {[provider.speciality || provider.category, provider.facility, provider.city]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {selected && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                      <CheckIcon className="h-3.5 w-3.5" />
                      {t("vc_selected", "Selected")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {providerId && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("vc_choose_time", "Choose a time")}
            </p>
            {slotPhase === "loading" && (
              <p className="mt-1.5 text-xs text-slate-500">{t("vc_loading_slots", "Loading open times…")}</p>
            )}
            {slotPhase === "error" && slotError && (
              <div className="mt-1.5 rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                  {t(consultationErrorCopy(slotError).titleKey, consultationErrorCopy(slotError).title)}
                </p>
                <Button tone="secondary" className="mt-2" onClick={() => void chooseProvider(providerId)}>
                  {t("vc_retry", "Try again")}
                </Button>
              </div>
            )}
            {slotPhase === "ready" && slotDays.length === 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                {t("vc_no_slots_body", "No open times in the next week. Try another provider or check again later.")}
              </p>
            )}
            <div className="mt-2 space-y-3">
              {slotDays.map((day) => (
                <div key={day.key}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {day.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {day.slots.map((slot) => {
                      const selected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSelectedSlot(slot)}
                          className={`tap min-h-9 rounded-full px-3 text-xs font-semibold ${
                            selected
                              ? "bg-brand-700 text-white"
                              : "border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {formatSlotTime(slot, lang)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {t(
                "vc_slot_note",
                "Times show slots with no conflicting booking. The provider still accepts or declines your request.",
              )}
            </p>
          </div>
        )}

        <Field label={t("vc_duration", "Duration")}>
          <Segmented
            options={CONSULTATION_DURATIONS.map((minutes) => ({
              value: String(minutes) as `${number}`,
              label: `${minutes} min`,
            }))}
            value={String(duration) as `${number}`}
            onChange={(value) => setDuration(Number(value) as ConsultationDuration)}
          />
        </Field>

        <Field
          label={t("vc_reason", "What would you like to discuss?")}
          hint={t("vc_reason_hint", "A short description helps the provider prepare. Do not paste full medical records.")}
        >
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t("vc_reason_placeholder", "For example: recurring headaches for one week")}
            className={inputClass}
          />
        </Field>

        <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-600">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
          />
          <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t(
              "vc_consent",
              "I consent to a private video consultation with this provider. I understand this is not an emergency service and that the session is not recorded.",
            )}
          </span>
        </label>

        {formError && (
          <Card className="border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">{formError.title}</p>
            <p className="mt-1 text-xs text-rose-800 dark:text-rose-200">{formError.body}</p>
          </Card>
        )}

        <Button full onClick={() => void submit()} disabled={busy}>
          {busy ? t("vc_sending", "Sending…") : t("vc_submit", "Send request")}
        </Button>
        <p className="pb-2 text-center text-[11px] text-slate-400">
          {t("vc_secure_body", "The room link and token are created only for the assigned patient and provider, and expire after the session.")}
        </p>
      </div>
    </BottomSheet>
  );
}
