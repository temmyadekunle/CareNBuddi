"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Chip,
  Field,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { CalendarIcon, ClockIcon } from "@/components/icons";
import {
  CONSULTATION_TYPES,
  SLOTS,
  formatShortDate,
  nextAvailableSlots,
} from "@/lib/appointments";
import {
  COST_TIER_LABELS,
  PROVIDER_CATEGORY_LABELS,
  providerCostTier,
  type Provider,
} from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedUsers,
  todayIso,
  uid,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import type { Booking, ConsultationType } from "@/lib/types";

const VISIT_TYPE_LABEL: Record<ConsultationType, [string, string]> = {
  "Clinic visit": ["fc_type_clinic", "Clinic visit"],
  "Video call": ["fc_type_video", "Video call"],
  "Phone consult": ["fc_type_phone", "Phone consult"],
  "Home visit": ["fc_type_home", "Home visit"],
  Screening: ["fc_type_screen", "Screening"],
};

export function BookSheet({
  provider,
  open,
  onClose,
  onBooked,
}: {
  provider: Provider | null;
  open: boolean;
  onClose: () => void;
  onBooked?: (booking: Booking) => void;
}) {
  const t = useT();
  const lang = useLang();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const me = users.find((user) => user.id === session.userId);

  const dates = useMemo(
    () =>
      Array.from(new Set(nextAvailableSlots(40).map((slot) => slot.slice(0, 10)))).slice(
        0,
        5,
      ),
    [],
  );

  const [kind, setKind] = useState<ConsultationType>(CONSULTATION_TYPES[0]);
  const [date, setDate] = useState(dates[0] ?? "");
  const [time, setTime] = useState<string>(SLOTS[0]);
  const [notes, setNotes] = useState("");
  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [touched, setTouched] = useState({ name: false, phone: false });

  const nameError =
    touched.name && !name.trim() ? t("fc_name_req", "Enter your full name") : null;
  const phoneError =
    touched.phone && !phone.trim() ? t("fc_phone_req", "Enter a phone number") : null;
  const valid = Boolean(name.trim() && phone.trim() && date && time);

  const reset = () => {
    setKind(CONSULTATION_TYPES[0]);
    setDate(dates[0] ?? "");
    setTime(SLOTS[0]);
    setNotes("");
    setTouched({ name: false, phone: false });
  };

  const confirm = () => {
    if (!provider || !valid) return;
    const categoryLabel =
      PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;
    const booking: Booking = {
      id: uid(),
      providerId: provider.id,
      userId: session.userId,
      name: name.trim(),
      phone: phone.trim(),
      message: notes.trim(),
      date,
      status: "confirmed",
      createdAt: todayIso(),
      time,
      kind,
      specialty: provider.services[0] ?? categoryLabel,
    };
    setBookings((prev) => [...prev, booking]);
    push(t("booking_done", "Appointment booked"), "success");
    reset();
    onClose();
    onBooked?.(booking);
  };

  const categoryLabel = provider
    ? (PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category)
    : "";
  const tier = provider ? providerCostTier(provider.category) : "mid";

  return (
    <BottomSheet
      open={open && provider !== null}
      onClose={onClose}
      title={t("fc_book_title", "Book an appointment")}
      footer={
        <Button full disabled={!valid} onClick={confirm}>
          <CalendarIcon className="h-4 w-4" />
          {t("fc_confirm_booking", "Confirm booking")}
        </Button>
      }
    >
      {provider && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
            <Avatar
              name={provider.name}
              role="doctor"
              size={40}
              seed={provider.name.length}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {provider.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {provider.services[0] ?? categoryLabel}
              </p>
            </div>
            <Badge tone="slate">{COST_TIER_LABELS[tier]}</Badge>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600">
              {t("fc_visit_type", "Visit type")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONSULTATION_TYPES.map((type) => {
                const [key, fallback] = VISIT_TYPE_LABEL[type];
                return (
                  <Chip
                  key={type}
                  className="min-h-11!"
                  active={type === kind}
                  onClick={() => setKind(type)}
                >
                    {t(key, fallback)}
                  </Chip>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600">
              {t("fc_pick_date", "Choose a date")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {dates.map((value) => {
                const label = formatShortDate(value);
                return (
                  <Chip
                    key={value}
                    className="min-h-11!"
                    active={value === date}
                    onClick={() => setDate(value)}
                  >
                    <span className="text-[10px] uppercase opacity-70">
                      {label.weekday}
                    </span>
                    <span className="font-bold">
                      {label.day} {label.month}
                    </span>
                  </Chip>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600">
              {t("fc_pick_time", "Choose a time")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SLOTS.map((slot) => (
                <Chip
                  key={slot}
                  className="min-h-11!"
                  active={slot === time}
                  onClick={() => setTime(slot)}
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  {slot}
                </Chip>
              ))}
            </div>
          </div>

          <Field label={t("a_name", "Full name")} error={nameError}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              className={inputClass}
              autoComplete="name"
            />
          </Field>

          <Field label={t("a_phone", "Phone number")} error={phoneError}>
            <input
              value={phone}
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              className={inputClass}
              autoComplete="tel"
            />
          </Field>

          <Field label={t("fc_notes", "Notes (optional)")}>
            <textarea
              value={notes}
              rows={2}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t(
                "fc_notes_ph",
                "Anything the provider should know before your visit…",
              )}
              className={`${inputClass} resize-none`}
            />
          </Field>

          <p className="text-[11px] leading-relaxed text-slate-400">
            {t(
              "fc_book_note",
              "You can reschedule or cancel from your Appointments tab.",
            )}
          </p>
        </div>
      )}
    </BottomSheet>
  );
}