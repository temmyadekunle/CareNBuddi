"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  ListRow,
  Screen,
  inputClass,
  useToast,
} from "@/components/app-ui";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ClockIcon,
  EmergencyIcon,
  MessageIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
  StethoscopeIcon,
} from "@/components/icons";
import { BookSheet } from "@/components/book-sheet";
import { ReportAction } from "@/components/report-button";
import { formatDay } from "@/lib/appointments";
import {
  PROVIDER_CATEGORY_LABELS,
  directionsUrl,
  whatsappUrl,
} from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedProviders,
  uid,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import type { Booking } from "@/lib/types";

export default function ProviderProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const { push } = useToast();
  const [session] = useSession();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const provider = providers.find((entry) => entry.id === id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [sent, setSent] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  const canSend = Boolean(name.trim() && phone.trim());
  const nameError =
    touched.name && !name.trim() ? t("fc_name_req", "Enter your full name") : null;
  const phoneError =
    touched.phone && !phone.trim() ? t("fc_phone_req", "Enter a phone number") : null;

  if (!provider) {
    return (
      <Screen>
        <EmptyState
          icon={<StethoscopeIcon className="h-6 w-6" />}
          title={t("fc_missing_title", "Facility not found")}
          body={t(
            "fc_missing_d",
            "This facility is no longer listed. Browse the facilities we have nearby.",
          )}
          action={
            <Button
              tone="secondary"
              className="mt-2"
              onClick={() => router.push("/find-care")}
            >
              {t("f_title", "Find Care")}
            </Button>
          }
        />
      </Screen>
    );
  }

  const submit = () => {
    if (!canSend) return;
    const booking: Booking = {
      id: uid(),
      providerId: provider.id,
      userId: session.userId,
      name: name.trim(),
      phone: phone.trim(),
      message: message.trim(),
      date: date || undefined,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [...prev, booking]);
    push(t("fc_request_sent", "Visit request sent"));
    setSent(true);
  };

  const catLabel =
    PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;

  return (
    <Screen>
      <Link
        href="/find-care"
        className="tap -mx-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-sm font-semibold text-slate-600"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {t("f_title", "Find Care")}
      </Link>

      <Card className="mt-1">
        <div className="flex items-start gap-3">
          <Avatar
            name={provider.name}
            role="doctor"
            size={56}
            seed={provider.name.length}
          />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-[17px] font-bold leading-tight tracking-tight text-slate-900">
              {provider.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="slate">{catLabel}</Badge>
              {provider.verified && (
                <Badge tone="brand">
                  <ShieldIcon className="mr-1 h-3 w-3" />
                  {t("f_verified", "Verified")}
                </Badge>
              )}
              {provider.rating !== undefined && (
                <Badge tone="amber">★ {provider.rating.toFixed(1)}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 break-words">
              {provider.address} · {provider.lga} · {provider.state}
            </span>
          </p>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 break-words">{provider.hours}</span>
          </p>
        </div>

        <div className="mt-2.5 flex justify-end border-t border-slate-100 pt-2.5">
          <ReportAction
            targetType="provider"
            targetId={provider.id}
            title={t("fc_report_title", "Report this facility")}
            reasonLabel={t("fc_report_reason", "What is wrong with this listing?")}
          />
        </div>
      </Card>

      <Button full className="mt-3" onClick={() => setBookingOpen(true)}>
        <CalendarIcon className="h-4 w-4" />
        {t("fc_book_appointment", "Book an appointment")}
      </Button>

      <Card padded={false} className="mt-3 overflow-hidden">
        <div className="divide-y divide-slate-100">
          <ListRow
            onClick={() => {
              window.location.href = `tel:${provider.phone}`;
            }}
            icon={<PhoneIcon className="h-5 w-5" />}
            tone="brand"
            title={t("f_call", "Call")}
            subtitle={provider.phone}
            chevron={false}
          />
          <ListRow
            href={whatsappUrl(provider)}
            icon={<MessageIcon className="h-5 w-5" />}
            tone="green"
            title={t("f_whatsapp", "WhatsApp")}
            subtitle={t("fc_whatsapp_d", "Ask a question on WhatsApp")}
            chevron={false}
          />
          <ListRow
            href={directionsUrl(provider)}
            icon={<PinIcon className="h-5 w-5" />}
            tone="slate"
            title={t("f_dir", "Directions")}
            subtitle={provider.address}
            chevron={false}
          />
        </div>
      </Card>

      {provider.emergency && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-medium leading-relaxed text-rose-800">
          <EmergencyIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
              {t("f_emergency", "24-hour emergency care is available at this facility.")}
            </span>
        </div>
      )}

      <Card className="mt-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          {t("f_desc", "About this facility")}
        </h2>
        <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-600">
          {provider.description}
        </p>
        <h3 className="mt-4 text-xs font-semibold text-slate-600">
          {t("f_services", "Services")}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {provider.services.map((service) => (
            <span
              key={service}
              className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
            >
              {service}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mt-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          {t("f_request", "Request a visit")}
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {t(
            "fc_request_d",
            "Send a request and the facility will contact you to arrange the visit.",
          )}
        </p>

        {sent ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900">
              ✓ {t("f_book_sent", "Visit request sent")}
            </p>
            <p className="mt-1 break-words text-xs text-green-800">
              {provider.name} · {phone} ·{" "}
              {date ? formatDay(date) : t("fc_no_date", "No preferred date")}
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
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

            <Field label={t("f_form_msg", "What do you need?")}>
              <textarea
                value={message}
                rows={2}
                onChange={(event) => setMessage(event.target.value)}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <Field label={t("f_form_date", "Preferred date")}>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Button full disabled={!canSend} onClick={submit}>
              <StethoscopeIcon className="h-4 w-4" />
              {t("c_send", "Send request")}
            </Button>
          </div>
        )}
      </Card>

      <BookSheet
        provider={provider}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />
    </Screen>
  );
}