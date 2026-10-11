"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  Switch,
  useToast,
} from "@/components/app-ui";
import {
  ActivityIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  FileTextIcon,
  HeartIcon,
  HeartPulseIcon,
  PillIcon,
  ShieldIcon,
  StethoscopeIcon,
  SyringeIcon,
  UserIcon,
} from "@/components/icons";
import {
  MeasurementTile,
  MiniBars,
  Ring,
  type ChartTone,
  type TrendTone,
} from "@/components/health-charts";
import { useT } from "@/lib/i18n";
import { shortDate } from "@/lib/format";
import {
  KEYS,
  seedJournal,
  seedRecords,
  seedReminders,
  seedUsers,
  useSession,
  useStoredCollection,
  useStoredValue,
} from "@/lib/storage";
import { seedFitnessProfile, seedWeighIns, seedWorkouts } from "@/lib/exercise";
import type { JournalEntry, Mood, RecordCategory, Vitals } from "@/lib/types";

type Translate = (key: string, fallback?: string) => string;

const DASH = "—";
const WEEK_TARGET_MIN = 150;
const CHECKINS = 7;

type BadgeTone = "brand" | "green" | "amber" | "rose" | "slate";

/* ------------------------------------------------------------------ helpers */

function at<T>(items: T[], index: number): T | undefined {
  return items[index];
}

/** Chronological (newest last) series of one vital, ignoring empty check-ins. */
function seriesOf(journal: JournalEntry[], field: keyof Vitals, limit = CHECKINS): number[] {
  const out: number[] = [];
  for (let i = journal.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const value = journal[i].vitals[field];
    if (typeof value === "number" && Number.isFinite(value)) out.unshift(value);
  }
  return out;
}

type Trend = { text: string; tone: TrendTone };

function trendOf(
  values: number[],
  higherIsBetter: boolean,
  t: Translate,
): Trend | null {
  const latest = at(values, values.length - 1);
  const before = at(values, values.length - 2);
  if (latest === undefined || before === undefined || before === 0) return null;
  const delta = ((latest - before) / Math.abs(before)) * 100;
  if (Math.abs(delta) < 0.5) return { text: t("hd_steady", "Steady"), tone: "flat" };
  const rising = delta > 0;
  return {
    text: `${rising ? "\u2191" : "\u2193"} ${Math.round(Math.abs(delta))}%`,
    tone: rising === higherIsBetter ? "good" : "bad",
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? DASH : value.toLocaleString();
}

/* ------------------------------------------------------------------ taxonomy */

const MOOD_LABEL: Record<Mood, [string, string]> = {
  great: ["hd_mood_great", "Great"],
  good: ["hd_mood_good", "Good"],
  okay: ["hd_mood_okay", "Okay"],
  low: ["hd_mood_low", "Low"],
  poor: ["hd_mood_poor", "Poor"],
};

const MOOD_TONE: Record<Mood, BadgeTone> = {
  great: "green",
  good: "brand",
  okay: "amber",
  low: "amber",
  poor: "rose",
};

const CATEGORY_LABEL: Record<RecordCategory, [string, string]> = {
  visit: ["hd_cat_visit", "Visit"],
  lab: ["hd_cat_lab", "Lab result"],
  imaging: ["hd_cat_imaging", "Imaging"],
  prescription: ["hd_cat_script", "Prescription"],
  vaccination: ["hd_cat_vax", "Vaccination"],
};

const CATEGORY_TONE: Record<RecordCategory, BadgeTone> = {
  visit: "brand",
  lab: "amber",
  imaging: "slate",
  prescription: "green",
  vaccination: "green",
};

type IconComponent = (props: { className?: string }) => React.ReactNode;

type MetricSpec = {
  field: keyof Vitals;
  pairField?: keyof Vitals;
  label: [string, string];
  unit: [string, string];
  digits: number;
  tone: ChartTone;
  href: string;
  higherIsBetter: boolean;
  icon: IconComponent;
};

const METRICS: MetricSpec[] = [
  {
    field: "systolic",
    pairField: "diastolic",
    label: ["hd_bp", "Blood pressure"],
    unit: ["hd_unit_bp", "mmHg"],
    digits: 0,
    tone: "rose",
    href: "/journal",
    higherIsBetter: false,
    icon: HeartPulseIcon,
  },
  {
    field: "weightKg",
    label: ["hd_weight", "Weight"],
    unit: ["hd_unit_kg", "kg"],
    digits: 1,
    tone: "brand",
    href: "/health/exercise",
    higherIsBetter: false,
    icon: ActivityIcon,
  },
  {
    field: "heartRate",
    label: ["hd_hr", "Heart rate"],
    unit: ["hd_unit_bpm", "bpm"],
    digits: 0,
    tone: "coral",
    href: "/journal",
    higherIsBetter: false,
    icon: HeartIcon,
  },
  {
    field: "sleepHours",
    label: ["hd_sleep", "Sleep"],
    unit: ["hd_unit_hrs", "hours"],
    digits: 1,
    tone: "green",
    href: "/journal",
    higherIsBetter: true,
    icon: ClockIcon,
  },
];

const SUPPORT_LINKS: {
  href: string;
  icon: IconComponent;
  title: [string, string];
  subtitle: [string, string];
  tone: "brand" | "green" | "coral" | "slate" | "rose";
}[] = [
  {
    href: "/care-circle",
    icon: UserIcon,
    title: ["hd_care_circle", "Care Circle"],
    subtitle: ["hd_care_circle_d", "Keep family health in one place"],
    tone: "coral",
  },
  {
    href: "/ask",
    icon: ChatIcon,
    title: ["hd_ask", "Talk to a health professional"],
    subtitle: ["hd_ask_d", "Ask a question and get a clear answer"],
    tone: "green",
  },
  {
    href: "/services",
    icon: StethoscopeIcon,
    title: ["hd_services", "Health services"],
    subtitle: ["hd_services_d", "Screenings, outreach and mobile clinics"],
    tone: "brand",
  },
  {
    href: "/health-days",
    icon: CalendarIcon,
    title: ["hd_health_days", "Health days near you"],
    subtitle: ["hd_health_days_d", "Free check-ups and wellness walks"],
    tone: "slate",
  },
];

/* --------------------------------------------------------------------- page */

export default function HealthDashboardPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [journal] = useStoredCollection(KEYS.journal, seedJournal);
  const [records] = useStoredCollection(KEYS.records, seedRecords);
  const [reminders, setReminders] = useStoredCollection(KEYS.reminders, seedReminders);
  const [workouts] = useStoredCollection(KEYS.workouts, seedWorkouts);
  const [weighIns] = useStoredCollection(KEYS.weighIns, seedWeighIns);
  const [profile] = useStoredValue(KEYS.fitnessProfile, seedFitnessProfile);

  const me = users.find((u) => u.id === session.userId);
  const firstName = me?.name?.split(" ")[0] ?? "";

  const entries = useMemo(
    () => [...journal].sort((a, b) => a.date.localeCompare(b.date)),
    [journal],
  );

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records],
  );
  const recentRecords = sortedRecords.filter((r) => r.category !== "vaccination").slice(0, 2);
  const vaccinations = sortedRecords.filter((r) => r.category === "vaccination");

  const meds = useMemo(
    () =>
      reminders
        .filter((r) => r.type === "medication")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [reminders],
  );
  const activeMeds = meds.filter((r) => r.enabled);
  const nextMed = activeMeds[0] ?? meds[0];

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const weekMinutes = useMemo(
    () =>
      workouts
        .filter((w) => w.date >= weekStart)
        .reduce((sum, w) => sum + (w.durationMin || 0), 0),
    [workouts, weekStart],
  );

  const sortedWeighIns = useMemo(
    () => [...weighIns].sort((a, b) => a.date.localeCompare(b.date)),
    [weighIns],
  );
  const weightSeries = seriesOf(entries, "weightKg");
  const currentWeight = at(sortedWeighIns, sortedWeighIns.length - 1)?.weightKg ??
    at(weightSeries, weightSeries.length - 1);
  const goalSpan = profile.startWeightKg - profile.goalWeightKg;
  const goalProgress =
    currentWeight === undefined || goalSpan <= 0
      ? 0
      : (profile.startWeightKg - currentWeight) / goalSpan;

  const stepsSeries = seriesOf(entries, "steps");
  const latestSteps = at(stepsSeries, stepsSeries.length - 1);

  const timeline = entries.slice(-3).reverse();

  const toggleReminder = (id: string, enabled: boolean) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    push(
      enabled
        ? t("hd_reminder_on", "Reminder turned on")
        : t("hd_reminder_off", "Reminder turned off"),
    );
  };

  return (
    <Screen>
      {/* header ---------------------------------------------------------- */}
      <section className="flex items-center gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-xs font-medium text-slate-500">
              {t("hd_eyebrow", "Your health at a glance")}
            </p>
            {firstName && (
              <span className="shrink-0">
                <Badge tone="brand">{firstName}</Badge>
              </span>
            )}
          </div>
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">
            {t("hd_title", "Your health")}
          </h1>
        </div>
        {me ? (
          <Link href="/profile" className="tap shrink-0">
            <Avatar name={me.name} size={44} seed={me.name.length} />
          </Link>
        ) : (
          <Link href="/auth/sign-in" className="shrink-0">
            <Button>{t("a_signin", "Sign in")}</Button>
          </Link>
        )}
      </section>

      {!me && (
        <Card className="mt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <UserIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {t("hd_guest_title", "Sign in to keep your health chart")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {t(
                  "hd_guest_body",
                  "Sign in and your journal, records and reminders follow you on every device.",
                )}
              </p>
              <Link href="/auth/sign-in" className="mt-3 inline-block">
                <Button full>{t("hd_guest_cta", "Sign in or create an account")}</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* vitals ---------------------------------------------------------- */}
      <SectionHeader
        title={t("hd_vitals", "Vitals")}
        subtitle={t("hd_vitals_sub", "Your latest check-ins")}
        action={t("hd_log", "Log")}
        href="/journal"
      />
      <div className="grid grid-cols-2 gap-2.5">
        {METRICS.map((spec) => {
          const values = seriesOf(entries, spec.field);
          const pairs = spec.pairField ? seriesOf(entries, spec.pairField) : [];
          const latest = at(values, values.length - 1);
          const pair = at(pairs, pairs.length - 1);
          const display =
            latest === undefined
              ? DASH
              : spec.pairField && pair !== undefined
                ? `${latest.toFixed(spec.digits)}/${pair.toFixed(spec.digits)}`
                : latest.toFixed(spec.digits);
          const trend = trendOf(values, spec.higherIsBetter, t);

          return (
            <MeasurementTile
              key={spec.field}
              href={spec.href}
              tone={spec.tone}
              icon={<spec.icon className="h-3.5 w-3.5" />}
              label={t(spec.label[0], spec.label[1])}
              value={display}
              unit={latest === undefined ? undefined : t(spec.unit[0], spec.unit[1])}
              trend={trend?.text}
              trendTone={trend?.tone}
              spark={values}
            />
          );
        })}
      </div>

      {/* wellness -------------------------------------------------------- */}
      <SectionHeader
        title={t("hd_wellness", "Wellness")}
        subtitle={t("hd_wellness_sub", "Last 7 days")}
        action={t("hd_open", "Open")}
        href="/health/exercise"
      />
      <Card>
        <div className="flex items-start gap-2">
          <Ring
            value={weekMinutes}
            max={WEEK_TARGET_MIN}
            tone="brand"
            label={t("hd_activity", "Weekly activity")}
            caption={`${weekMinutes} / ${WEEK_TARGET_MIN} ${t("hd_min", "min")}`}
          />
          <span className="h-16 w-px shrink-0 bg-slate-100" />
          <Ring
            value={goalProgress}
            max={1}
            tone="green"
            label={t("hd_weight_goal", "Weight goal")}
            caption={
              currentWeight === undefined
                ? t("hd_no_weighin", "No weigh-in yet")
                : `${currentWeight.toFixed(1)} \u2192 ${profile.goalWeightKg.toFixed(1)} ${t("hd_unit_kg", "kg")}`
            }
          />
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-slate-700">
              {t("hd_steps", "Steps")}
            </p>
            <p className="shrink-0 text-[11px] text-slate-500">
              {t("hd_daily_avg", "Daily avg")} {formatNumber(mean(stepsSeries))}
            </p>
          </div>
          <div className="mt-1.5">
            <MiniBars values={stepsSeries} tone="coral" />
          </div>
          <p className="mt-1.5 truncate text-[11px] text-slate-500">
            {t("hd_steps_sub", "Latest")} {formatNumber(latestSteps)}
          </p>
        </div>
      </Card>

      <Link href="/health/diary" className="tap mt-2.5 block">
        <Card className="flex items-center gap-3 hover:border-brand-300">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-700">
            <CalendarIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {t("mh_title", "My Health Diary")}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {t("mh_sub", "Track your cycle, mood, symptoms and wellbeing in one place.")}
            </p>
          </div>
        </Card>
      </Link>

      {/* medications ------------------------------------------------------ */}
      <SectionHeader
        title={t("hd_meds", "Medications")}
        action={t("hd_all", "All")}
        href="/reminders"
      />
      {nextMed ? (
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <PillIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {nextMed.enabled
                  ? t("hd_next_dose", "Next dose")
                  : t("hd_paused", "Paused")}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                {`${nextMed.time} \u00b7 ${nextMed.title}`}
              </p>
            </div>
            <Switch
              checked={nextMed.enabled}
              onChange={(value) => toggleReminder(nextMed.id, value)}
              label={t("hd_toggle_med", "Toggle medication reminder")}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                activeMeds.length > 0 ? "bg-amber-400" : "bg-slate-300"
              }`}
            />
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600">
              {`${activeMeds.length} ${t("hd_active", "active")}`}
            </p>
            <Link
              href="/reminders"
              className="shrink-0 text-[11px] font-semibold text-brand-700"
            >
              {t("hd_manage", "Manage")}
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <PillIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {t("hd_no_meds", "No medication reminders")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("hd_no_meds_d", "Add one so you never miss a dose")}
            </p>
          </div>
          <Link href="/reminders" className="shrink-0">
            <Button tone="secondary">{t("hd_add", "Add")}</Button>
          </Link>
        </Card>
      )}

      {/* test results & records ------------------------------------------- */}
      <SectionHeader
        title={t("hd_records", "Test results & records")}
        action={t("hd_view_all", "View all")}
        href="/records"
      />
      {recentRecords.length > 0 ? (
        <Card padded={false} className="overflow-hidden divide-y divide-slate-100">
          {recentRecords.map((record) => {
            const label = CATEGORY_LABEL[record.category];
            return (
              <ListRow
                key={record.id}
                href="/records"
                icon={<FileTextIcon className="h-5 w-5" />}
                tone="brand"
                title={record.title}
                subtitle={`${record.provider} \u00b7 ${shortDate(record.date)}`}
                meta={
                  <Badge tone={CATEGORY_TONE[record.category]}>
                    {t(label[0], label[1])}
                  </Badge>
                }
              />
            );
          })}
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-slate-900">
            {t("hd_no_records", "No records yet")}
          </p>
          <Link href="/records" className="shrink-0">
            <Button tone="secondary">{t("hd_add_record", "Add a record")}</Button>
          </Link>
        </Card>
      )}

      <Link href="/passport" className="tap mt-2.5 block">
        <Card className="flex items-center gap-3 hover:border-brand-300">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {t("hd_passport", "Health passport")}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {t("hd_passport_d", "Your emergency card and health summary")}
            </p>
          </div>
        </Card>
      </Link>

      {/* vaccinations ----------------------------------------------------- */}
      <SectionHeader
        title={t("hd_vaccines", "Vaccinations")}
        action={t("hd_view_all", "View all")}
        href="/records"
      />
      {vaccinations.length > 0 ? (
        <Card padded={false} className="overflow-hidden divide-y divide-slate-100">
          {vaccinations.map((record) => (
            <ListRow
              key={record.id}
              href="/records"
              icon={<SyringeIcon className="h-5 w-5" />}
              tone="green"
              title={record.title}
              subtitle={record.provider}
              meta={
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {shortDate(record.date)}
                </span>
              }
            />
          ))}
        </Card>
      ) : (
        <EmptyState
          icon={<SyringeIcon className="h-6 w-6" />}
          title={t("hd_no_vaccines", "No vaccinations recorded")}
          body={t(
            "hd_no_vaccines_d",
            "Add a vaccination to keep your immunisation history in one place.",
          )}
          action={
            <Link href="/records" className="mt-1 inline-block">
              <Button tone="secondary">{t("hd_add_record", "Add a record")}</Button>
            </Link>
          }
        />
      )}

      {/* health journey --------------------------------------------------- */}
      <SectionHeader
        title={t("hd_journey", "Health journey")}
        subtitle={t("hd_journey_sub", "Your recent check-ins")}
        action={t("hd_view_all", "View all")}
        href="/health/journey"
      />
      {timeline.length > 0 ? (
        <Card>
          <ol className="space-y-3.5">
            {timeline.map((entry, index) => (
              <li key={entry.id} className="flex gap-3">
                <span className="flex w-3 shrink-0 flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  {index < timeline.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-slate-200" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {shortDate(entry.date)}
                    </p>
                    <Badge tone={MOOD_TONE[entry.mood]}>
                      {t(MOOD_LABEL[entry.mood][0], MOOD_LABEL[entry.mood][1])}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
                    {entry.symptoms.length > 0
                      ? entry.symptoms.join(", ")
                      : t("hd_no_symptoms", "No symptoms logged")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-slate-900">
            {t("hd_no_journal", "No check-ins yet")}
          </p>
          <Link href="/journal" className="shrink-0">
            <Button tone="secondary">{t("hd_log", "Log")}</Button>
          </Link>
        </Card>
      )}

      <Link href="/health/chronic" className="tap mt-2.5 block">
        <Card className="flex items-center gap-3 hover:border-brand-300">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <HeartPulseIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {t("hd_chronic", "Chronic conditions")}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {t("hd_chronic_d", "Blood pressure, diabetes and asthma care plans")}
            </p>
          </div>
        </Card>
      </Link>

      {/* care team & support ---------------------------------------------- */}
      <SectionHeader
        title={t("hd_support", "Care team & support")}
        action={t("hd_all", "All")}
        href="/care-circle"
      />
      <Card padded={false} className="overflow-hidden divide-y divide-slate-100">
        {SUPPORT_LINKS.map((link) => (
          <ListRow
            key={link.href}
            href={link.href}
            tone={link.tone}
            icon={<link.icon className="h-5 w-5" />}
            title={t(link.title[0], link.title[1])}
            subtitle={t(link.subtitle[0], link.subtitle[1])}
          />
        ))}
      </Card>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t(
          "ft_notdx",
          "CareNBuddi offers general health information. It is not a diagnosis and does not replace a healthcare professional.",
        )}
      </p>
    </Screen>
  );
}
