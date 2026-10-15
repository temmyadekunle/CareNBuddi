"use client";

import { useState, useSyncExternalStore } from "react";

import {
  Badge,
  Button,
  Card,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { CheckIcon, PinIcon, TrashIcon } from "@/components/icons";
import { ProviderShell, useProviderContext } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_DURATIONS,
  WEEKDAYS,
  describeDay,
  hasAnyHours,
  isAcceptingRequests,
  isOpenOn,
  newLocation,
  practiceSnapshot,
  savePractice,
  serverPracticeSnapshot,
  subscribePractice,
  type PracticeSettings,
  type Weekday,
} from "@/lib/provider-practice";

/**
 * Practice.
 *
 * Everything here is something the provider states about themselves. The one
 * rule that shapes the screen: availability is opt-in. Until opening hours are
 * entered, the practice is shown as "hours not set" and never as open, because
 * telling a patient they can be seen is a claim about someone else's calendar.
 */

export default function ProviderPracticePage() {
  return (
    <ProviderShell>
      <Practice />
    </ProviderShell>
  );
}

function Practice() {
  const t = useT();
  const { push } = useToast();
  const ctx = useProviderContext();

  /* Practice settings live in device storage, which does not exist during the
     static render. useSyncExternalStore reports null on the server and the
     stored value on the client, so the loading state is honest rather than an
     empty form that briefly claims a provider has no services and no hours. */
  const stored = useSyncExternalStore(
    subscribePractice,
    () => practiceSnapshot(ctx.providerId),
    serverPracticeSnapshot,
  );

  /* Edits are local until saved. The draft records which practice it belongs to,
     so a draft is discarded the moment the account changes rather than needing
     an effect to clear it. */
  const [draft, setDraft] = useState<PracticeSettings | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const settings = draft && draftFor === ctx.providerId ? draft : stored;

  if (stored === null && !ctx.providerId) {
    return (
      <Screen>
        <SectionHeader title={t("pws_practice", "Practice")} />
        <Card className="mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(
              "pws_practice_none",
              "Practice settings appear once a facility is linked to this account.",
            )}
          </p>
        </Card>
      </Screen>
    );
  }

  if (!ctx.providerId || !settings) {
    return (
      <Screen>
        <SectionHeader title={t("pws_practice", "Practice")} />
        <Card className="mt-4">
          <p className="text-sm text-slate-500">{t("pws_loading", "Loading your practice…")}</p>
        </Card>
      </Screen>
    );
  }

  const persist = (next: PracticeSettings) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);
    setDraftFor(stamped.providerId);
    const ok = savePractice(stamped);
    push(
      ok ? t("pv_save", "Saved") : t("prv_save_failed", "Could not save on this device"),
      ok ? "success" : "error",
    );
  };

  const hoursSet = hasAnyHours(settings);

  const setWindow = (day: Weekday, index: number, patch: { from?: string; to?: string }) => {
    const current = settings.availability?.[day] ?? [];
    const next = current.map((w, i) => (i === index ? { ...w, ...patch } : w));
    setDraft({
      ...settings,
      availability: { ...(settings.availability ?? {}), [day]: next },
    });
  };

  const addWindow = (day: Weekday) => {
    const current = settings.availability?.[day] ?? [];
    setDraft({
      ...settings,
      availability: { ...(settings.availability ?? {}), [day]: [...current, { from: "09:00", to: "17:00" }] },
    });
  };

  const removeWindow = (day: Weekday, index: number) => {
    const current = settings.availability?.[day] ?? [];
    setDraft({
      ...settings,
      availability: {
        ...(settings.availability ?? {}),
        [day]: current.filter((_, i) => i !== index),
      },
    });
  };

  return (
    <Screen>
      <SectionHeader
        title={t("pws_practice", "Practice")}
        subtitle={t("pws_practice_sub", "What you offer, where, and when.")}
      />

      {/* The honest availability statement. */}
      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("pws_availability", "Service availability")}
          </h2>
          <Badge tone={hoursSet ? "green" : "slate"}>
            {hoursSet ? t("pws_hours_set", "Hours set") : t("pws_hours_unset", "Hours not set")}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {hoursSet
            ? t("pws_hours_set_d", "Patients can see the opening hours you have entered below.")
            : t(
                "pws_hours_unset_d",
                "You have not entered opening hours, so your practice is not listed as available.",
              )}
        </p>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("pws_accepting", "Accepting appointment requests")}
          </span>
          <input
            type="checkbox"
            checked={settings.acceptingNewPatients}
            onChange={(e) =>
              setDraft({ ...settings, acceptingNewPatients: e.target.checked })
            }
            className="h-5 w-5 rounded border-slate-300 text-brand-600"
          />
        </label>
        {!isAcceptingRequests(settings) ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            {t(
              "pws_not_accepting",
              "Booking is currently switched off, so requests are not being accepted.",
            )}
          </p>
        ) : null}
      </Card>

      {/* Opening hours. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_opening", "Opening hours")}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("pws_opening_d", "Only days you enter are shown as open. Everything else is closed.")}
        </p>
        <div className="mt-3 space-y-3">
          {WEEKDAYS.map(({ id, key, fallback }) => {
            const windows = settings.availability?.[id] ?? [];
            return (
              <div key={id} className="border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t(key, fallback)}
                  </span>
                  {isOpenOn(settings, id) ? (
                    <Badge tone="green">
                      <CheckIcon className="mr-1 h-3 w-3" />
                      {t("pws_open_day", "Open")}
                    </Badge>
                  ) : (
                    <Badge tone="slate">{describeDay(settings, id) ?? t("pws_closed", "Closed")}</Badge>
                  )}
                </div>
                {windows.map((w, i) => (
                  <div key={i} className="mt-2 flex items-center gap-2">
                    <input
                      type="time"
                      value={w.from}
                      onChange={(e) => setWindow(id, i, { from: e.target.value })}
                      className={inputClass}
                      aria-label={t("pws_from", "Opens")}
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      value={w.to}
                      onChange={(e) => setWindow(id, i, { to: e.target.value })}
                      className={inputClass}
                      aria-label={t("pws_to", "Closes")}
                    />
                    <Button
                      tone="ghost"
                      aria-label={t("pws_remove_window", "Remove")}
                      onClick={() => removeWindow(id, i)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button tone="secondary" className="mt-2" onClick={() => addWindow(id)}>
                  {t("pws_add_hours", "Add hours")}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Services. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_services", "Services offered")}
        </h2>
        <div className="mt-2">
          <Field label={t("pws_services_hint", "One per line")}>
            <textarea
              rows={3}
              value={settings.services.join("\n")}
              onChange={(e) =>
                setDraft({
                  ...settings,
                  services: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t(
            "pws_services_d",
            "Leave empty if you have not listed any. We do not copy services from elsewhere.",
          )}
        </p>
      </Card>

      {/* Appointment settings. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_appts", "Appointments")}
        </h2>
        <div className="mt-2">
          <Field label={t("pws_duration", "Default appointment length")}>
            <select
              value={settings.appointmentMinutes}
              onChange={(e) =>
                setDraft({ ...settings, appointmentMinutes: Number(e.target.value) })
              }
              className={inputClass}
            >
              {DEFAULT_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} {t("pws_minutes", "minutes")}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <Field label={t("pws_fee", "Consultation fee")}>
          <input
              type="number"
              min={0}
              value={settings.consultationFee ?? ""}
              placeholder={t("pws_fee_unset", "Not set")}
              onChange={(e) =>
                setDraft({
                  ...settings,
                  consultationFee: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {settings.consultationFee === null
            ? t("pws_fee_d", "No fee has been set. Blank does not mean free.")
            : t("pws_fee_set_d", "This fee is shown to patients booking with you.")}
        </p>
      </Card>

      {/* Locations. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_locations", "Service locations")}
        </h2>
        <div className="mt-2 space-y-3">
          {settings.locations.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("pws_locations_none", "No locations added.")}
            </p>
          ) : (
            settings.locations.map((loc, i) => (
              <div key={loc.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <PinIcon className="h-4 w-4 text-slate-400" />
                  <input
                    value={loc.label}
                    placeholder={t("pws_loc_label", "Label")}
                    onChange={(e) => {
                      const next = [...settings.locations];
                      next[i] = { ...loc, label: e.target.value };
                      setDraft({ ...settings, locations: next });
                    }}
                    className={inputClass}
                  />
                  <Button
                    tone="ghost"
                    aria-label={t("pws_remove_location", "Remove")}
                    onClick={() =>
                      setDraft({
                        ...settings,
                        locations: settings.locations.filter((l) => l.id !== loc.id),
                      })
                    }
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
                <input
                  value={loc.address}
                  placeholder={t("pws_loc_address", "Address")}
                  onChange={(e) => {
                    const next = [...settings.locations];
                    next[i] = { ...loc, address: e.target.value };
                    setDraft({ ...settings, locations: next });
                  }}
                  className={`${inputClass} mt-2`}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={loc.city}
                    placeholder={t("pws_loc_city", "City")}
                    onChange={(e) => {
                      const next = [...settings.locations];
                      next[i] = { ...loc, city: e.target.value };
                      setDraft({ ...settings, locations: next });
                    }}
                    className={inputClass}
                  />
                  <input
                    value={loc.state}
                    placeholder={t("pws_loc_state", "State")}
                    onChange={(e) => {
                      const next = [...settings.locations];
                      next[i] = { ...loc, state: e.target.value };
                      setDraft({ ...settings, locations: next });
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <Button
          tone="secondary"
          className="mt-3"
          onClick={() =>
            setDraft({ ...settings, locations: [...settings.locations, newLocation()] })
          }
        >
          {t("pws_add_location", "Add location")}
        </Button>
      </Card>

      <Button full className="mt-5" onClick={() => persist(settings)}>
        {t("pv_save", "Save changes")}
      </Button>
      <p className="mt-2 text-xs text-slate-400">
        {settings.updatedAt
          ? t("pws_last_saved", "Last saved") + " " + new Date(settings.updatedAt).toLocaleString()
          : t("pws_not_saved", "Not saved yet")}
      </p>
      <div className="h-24" aria-hidden="true" />
    </Screen>
  );
}