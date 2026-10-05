"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ListRow,
  Rating,
  Screen,
  SectionHeader,
} from "@/components/app-ui";
import {
  AlertIcon,
  BookIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  EmergencyIcon,
  FileTextIcon,
  HeartPulseIcon,
  PillIcon,
  PinIcon,
  SearchIcon,
  StethoscopeIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedBookings, seedJournal, seedProviders, seedReminders, seedTopics, seedUsers, todayIso, useSession, useStoredCollection } from "@/lib/storage";
import {
  PROVIDER_CATEGORY_LABELS,
  providerCostTier,
  topicSummary,
  topicTitle,
  type Provider,
} from "@/lib/content";
import {
  formatDay,
  nextAppointment,
  partitionAppointments,
  toAppointment,
} from "@/lib/appointments";
import { useLang } from "@/lib/i18n";

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "home_good_morning";
  if (hour < 17) return "home_good_afternoon";
  return "home_good_evening";
}

const QUICK_ACTIONS = [
  { href: "/find-care", key: "home_find_doctor", icon: SearchIcon, tone: "bg-brand-50 text-brand-700" },
  { href: "/appointments", key: "home_book", icon: CalendarIcon, tone: "bg-violet-50 text-violet-700" },
  { href: "/ask", key: "home_talk", icon: ChatIcon, tone: "bg-green-50 text-green-700" },
  { href: "/records", key: "home_records", icon: FileTextIcon, tone: "bg-sky-50 text-sky-700" },
  { href: "/reminders", key: "home_medicines", icon: PillIcon, tone: "bg-amber-50 text-amber-700" },
  { href: "/emergency", key: "home_emergency", icon: EmergencyIcon, tone: "bg-rose-50 text-rose-700" },
] as const;

export default function HomeScreen() {
  const t = useT();
  const lang = useLang();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [reminders] = useStoredCollection(KEYS.reminders, seedReminders);
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [topics] = useStoredCollection(KEYS.topics, seedTopics);
  const [journal] = useStoredCollection(KEYS.journal, seedJournal);

  const me = users.find((u) => u.id === session.userId);
  const firstName = me?.name?.split(" ")[0] ?? t("home_guest", "Guest");

  const appointments = useMemo(
    () =>
      partitionAppointments(
        bookings
          .filter((b) => !b.userId || b.userId === session.userId || me?.role !== "consumer")
          .map((b) => toAppointment(b, providers)),
      ),
    [bookings, providers, session.userId, me?.role],
  );
  const next = appointments.upcoming[0] ?? nextAppointment(bookings.map((b) => toAppointment(b, providers)));

  const activeReminders = reminders.filter((r) => r.enabled);
  const meds = activeReminders.filter((r) => r.type === "medication");
  const lastVitals = journal[0]?.vitals;
  const nearest = [...providers]
    .filter((p) => p.verified)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);
  const tips = topics.filter((tp) => tp.status === "published").slice(0, 8);

  return (
    <Screen>
      {/* greeting ------------------------------------------------------- */}
      <section className="flex items-center gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">{t(greetingKey(), "Good morning")},</p>
          <h2 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">
            {firstName}
          </h2>
        </div>
        {me ? (
          <Link href="/profile" className="tap shrink-0">
            <Avatar name={me.name} size={44} />
          </Link>
        ) : (
          <Link href="/auth/sign-in" className="shrink-0">
            <span className="tap inline-flex min-h-10 items-center rounded-full bg-brand-700 px-4 text-xs font-semibold text-white">
              {t("a_signin")}
            </span>
          </Link>
        )}
      </section>

      {/* health overview ------------------------------------------------ */}
      <SectionHeader title={t("home_overview", "Health overview")} />
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t("home_next_appt", "Next appointment")}
            </p>
            {next ? (
              <>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{next.providerName}</p>
                <p className="truncate text-xs text-slate-500">
                  {formatDay(next.date)} · {next.time} · {next.specialty}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-slate-500">
                {t("home_no_appt", "Nothing booked yet")}
              </p>
            )}
          </div>
          <Link href="/appointments" className="tap shrink-0">
            <span className="inline-flex min-h-9 items-center rounded-xl bg-brand-50 px-3 text-xs font-semibold text-brand-700">
              {t("home_view", "View")}
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <Metric
            value={String(activeReminders.length)}
            label={t("home_reminders", "Reminders")}
            tone="text-amber-600"
          />
          <Metric
            value={String(meds.length)}
            label={t("home_meds", "Medicines")}
            tone="text-brand-700"
          />
          <Metric
            value={lastVitals?.systolic ? `${lastVitals.systolic}/${lastVitals.diastolic ?? "—"}` : "—"}
            label={t("home_bp", "Blood pressure")}
            tone="text-green-700"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              meds.length > 0 ? "bg-amber-400" : "bg-green-500"
            }`}
          />
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600">
            {meds.length > 0
              ? meds.length === 1
                ? t("home_meds_due_1", "1 medication reminder active")
                : `${meds.length} ${t("home_meds_due_n", "medication reminders active")}`
              : t("home_no_meds", "No medication reminders")}
          </p>
          <Link href="/health" className="shrink-0 text-[11px] font-semibold text-brand-700">
            {t("home_details", "Details")}
          </Link>
        </div>
      </Card>

      {/* quick actions -------------------------------------------------- */}
      <SectionHeader title={t("home_quick", "Quick actions")} />
      <div className="grid grid-cols-3 gap-2.5">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href + action.key}
            href={action.href}
            className="tap flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-2 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${action.tone}`}>
              <action.icon className="h-5 w-5" />
            </span>
            <span className="text-center text-[11px] font-semibold leading-tight text-slate-700">
              {t(action.key)}
            </span>
          </Link>
        ))}
      </div>

      {/* upcoming appointment ------------------------------------------- */}
      <SectionHeader title={t("home_upcoming", "Upcoming appointment")} action={t("home_all", "All")} href="/appointments" />
      {next ? (
        <Link href="/appointments" className="tap block">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar
                name={next.providerName}
                role={next.kind === "Video call" ? "doctor" : "doctor"}
                size={46}
                seed={next.providerName.length}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{next.providerName}</p>
                <p className="truncate text-xs text-slate-500">{next.specialty}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {formatDay(next.date)}
                  </Badge>
                  <Badge tone="slate">
                    <ClockIcon className="mr-1 h-3 w-3" />
                    {next.time}
                  </Badge>
                  <Badge tone="green">{next.kind}</Badge>
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {t("home_no_appt_title", "No appointment booked")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("home_no_appt_d", "Find a provider and book in a few taps.")}
            </p>
          </div>
          <Link href="/find-care" className="shrink-0">
            <Button>{t("home_find_care", "Find care")}</Button>
          </Link>
        </Card>
      )}

      {/* providers near you --------------------------------------------- */}
      <SectionHeader
        title={t("home_nearby", "Health services near you")}
        action={t("home_see_all", "See all")}
        href="/find-care"
      />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {nearest.map((provider) => (
          <ProviderMiniCard key={provider.id} provider={provider} />
        ))}
      </div>

      {/* tips ------------------------------------------------------------ */}
      <SectionHeader
        title={t("home_tips", "Health tips")}
        action={t("home_see_all", "See all")}
        href="/explore"
      />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {tips.map((topic) => (
          <Link
            key={topic.id}
            href={`/explore?topic=${topic.id}`}
            className="tap w-56 shrink-0 snap-start rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <BookIcon className="h-4 w-4" />
            </span>
            <p className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">
              {topicTitle(topic, lang)}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
              {topicSummary(topic, lang)}
            </p>
          </Link>
        ))}
      </div>

      {/* emergency ------------------------------------------------------- */}
      <Card className="mt-6 border-rose-200 bg-rose-50/70">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900">{t("em_call", "Call an emergency number immediately")}</p>
            <p className="mt-0.5 text-xs text-rose-800">
              {t("home_emergency_d", "Do not wait for an app. Call first, then use HealthLink after.")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href="tel:112"
                className="tap inline-flex min-h-9 items-center rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white"
              >
                {t("home_call_112", "Call 112")}
              </a>
              <Link
                href="/emergency"
                className="tap inline-flex min-h-9 items-center rounded-xl border border-rose-300 bg-white px-3.5 text-xs font-semibold text-rose-700"
              >
                {t("em_title", "Get Help Now")}
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* shortcuts ------------------------------------------------------- */}
      <div className="mt-6 -mx-4 divide-y divide-slate-100 border-y border-slate-200/70 bg-white">
        <ListRow
          href="/passport"
          icon={<FileTextIcon className="h-5 w-5" />}
          title={t("pp_title", "Health Passport")}
          subtitle={t("home_passport_d", "Your emergency card and health summary")}
        />
        <ListRow
          href="/care-circle"
          icon={<HeartPulseIcon className="h-5 w-5" />}
          title={t("n_carecircle", "Care Circle")}
          subtitle={t("n_carecircle_d", "Look after family health")}
        />
        <ListRow
          href="/health/exercise"
          icon={<StethoscopeIcon className="h-5 w-5" />}
          title={t("hx_title", "Exercise & wellness")}
          subtitle={t("home_wellness_d", "Steps, weight and sleep")}
        />
        <ListRow
          href="/services"
          icon={<CalendarIcon className="h-5 w-5" />}
          title={t("s_title", "Health services")}
          subtitle={t("s_sub", "Screenings and outreach")}
        />
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t("ft_notdx")}
      </p>

      <p className="mt-4 text-center text-[11px] text-slate-300">
        {todayIso()}
      </p>
    </Screen>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <p className={`text-lg font-bold leading-tight ${tone}`}>{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function ProviderMiniCard({ provider }: { provider: Provider }) {
  const t = useT();
  const lang = useLang();
  const category = PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;
  return (
    <Link
      href={`/find-care/${provider.id}`}
      className="tap w-[9.5rem] shrink-0 snap-start rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center gap-2">
        <Avatar name={provider.name} role="doctor" size={32} seed={provider.name.length} />
        {provider.verified && (
          <span className="ml-auto rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
            ✓
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-snug text-slate-900">
        {provider.name}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">{category}</p>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        {provider.rating ? <Rating value={provider.rating} /> : <span />}
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
          <PinIcon className="h-3 w-3" />
          {provider.city}
        </span>
      </div>
      <p className="mt-1.5 truncate rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
        {providerCostTier(provider.category) === "low"
          ? t("f_cost_low", "₦ Lower cost")
          : providerCostTier(provider.category) === "high"
            ? t("f_cost_high", "₦₦₦ Private")
            : t("f_cost_mid", "₦₦ Typical")}
      </p>
    </Link>
  );
}