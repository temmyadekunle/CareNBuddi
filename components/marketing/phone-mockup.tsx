import {
  ActivityIcon,
  CalendarIcon,
  HeartPulseIcon,
  HomeIcon,
  PinIcon,
  SearchIcon,
  StarIcon,
  UserIcon,
} from "@/components/icons";

/**
 * Marketing mockups of the real HealthLink app.
 *
 * Every label below is copied from the shipped app (components/nav.tsx,
 * lib/i18n.ts, lib/content.ts) and every provider is a real seed record from
 * lib/content.ts, so nothing here contradicts the product. No clinical values
 * are invented — the real numbers come from the signed-in user.
 *
 * To use real device screenshots instead: drop PNGs into /public/screenshots/
 * and swap the <Screen> children for <img> tags of the same size.
 */

type ScreenName = "home" | "findCare" | "appointments" | "health";

const SCREEN_NAMES: Record<ScreenName, string> = {
  home: "Home",
  findCare: "Find Care",
  appointments: "Appointments",
  health: "Your health",
};

const NAV: { label: string; Icon: typeof HomeIcon }[] = [
  { label: "Home", Icon: HomeIcon },
  { label: "Find Care", Icon: SearchIcon },
  { label: "Health", Icon: HeartPulseIcon },
  { label: "Appointments", Icon: CalendarIcon },
  { label: "Profile", Icon: UserIcon },
];

export function PhoneMockup({
  screen,
  label,
  className,
}: {
  screen: ScreenName;
  /** Caption shown under the phone. Pass an empty string to hide it. */
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className="relative mx-auto aspect-[9/19] w-full max-w-[260px] rounded-[2.1rem] bg-slate-900 p-2 shadow-[0_30px_60px_-28px_rgba(15,23,42,0.55)]"
        role="img"
        aria-label={`Screenshot of the HealthLink ${SCREEN_NAMES[screen]} screen`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[1.65rem] bg-[#f6f8fb]">
          <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[8px] font-medium text-slate-400">
            <span>9:41</span>
            <span className="h-1.5 w-8 rounded-full bg-slate-300" />
          </div>
          <div className="h-[calc(100%-1.4rem)] overflow-hidden">{renderScreen(screen)}</div>
        </div>
      </div>
      {label ? <p className="mt-3 text-center text-sm font-semibold text-slate-900">{label}</p> : null}
    </div>
  );
}

function renderScreen(screen: ScreenName) {
  if (screen === "home") return <HomeScreen />;
  if (screen === "findCare") return <FindCareScreen />;
  if (screen === "appointments") return <AppointmentsScreen />;
  return <HealthScreen />;
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-3 pt-2">
      <span className="text-[9px] font-semibold text-slate-900">HealthLink</span>
      <div aria-hidden className="flex items-center gap-1 text-brand-600">
        <ActivityIcon className="h-3 w-3" />
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="h-full">
      <StatusBar />
      <div className="px-3 pt-2">
        <p className="text-[8px] font-medium uppercase tracking-wide text-brand-700">
          Health overview
        </p>
        <p className="mt-0.5 text-[13px] font-semibold leading-tight text-slate-900">
          Good morning, how are you feeling today?
        </p>
      </div>

      <div className="mt-2.5 rounded-xl bg-brand-700 p-3 text-white">
        <p className="text-[8px] text-brand-100">Next appointment</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-tight">
          Mainland General Hospital
        </p>
        <div className="mt-1.5 flex items-center gap-1 text-[8px] text-brand-100">
          <CalendarIcon className="h-2.5 w-2.5" />
          <span>View</span>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 px-3">
        <Tile label="Reminders" value="2" />
        <Tile label="Medicines" value="1" />
      </div>

      <div className="mt-2.5 px-3">
        <p className="text-[9px] font-semibold text-slate-900">Quick actions</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {["Find care", "Appointments", "Records", "Reminders"].map((label) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-[8px] font-medium text-slate-700 shadow-sm"
            >
              <SearchIcon className="h-2.5 w-2.5 text-brand-600" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 px-3">
        <p className="text-[9px] font-semibold text-slate-900">Health services near you</p>
        <div className="mt-1.5 rounded-lg bg-white p-2 shadow-sm">
          <p className="text-[9px] font-medium text-slate-900">Ikeja Medical Centre</p>
          <p className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-500">
            <PinIcon className="h-2 w-2" />
            Ikeja &middot; Clinic
          </p>
        </div>
      </div>

      <TabBar active={0} />
    </div>
  );
}

function FindCareScreen() {
  return (
    <div className="h-full">
      <StatusBar />
      <div className="px-3 pt-1.5">
        <p className="text-[13px] font-semibold text-slate-900">Find Care</p>
        <p className="mt-0.5 text-[8px] leading-snug text-slate-500">
          Search hospitals, clinics, PHCs, laboratories, pharmacies and more.
        </p>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm">
          <SearchIcon className="h-2.5 w-2.5 text-slate-400" />
          <span className="text-[8px] text-slate-400">Search</span>
        </div>
      </div>

      <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto px-3">
        {["Hospitals", "Clinics", "PHCs", "Labs", "Pharmacies"].map((chip, i) => (
          <span
            key={chip}
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-medium ${
              i === 0 ? "bg-brand-700 text-white" : "bg-white text-slate-600 shadow-sm"
            }`}
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-2 space-y-1.5 px-3">
        {[
          { name: "Mainland General Hospital", meta: "Yaba · Hospital" },
          { name: "Apapa General Hospital", meta: "Apapa · Hospital" },
          { name: "Ajah Family Clinic", meta: "Eti-Osa · Clinic" },
        ].map((p) => (
          <div key={p.name} className="rounded-lg bg-white p-2 shadow-sm">
            <div className="flex items-start justify-between gap-1">
              <p className="text-[9px] font-medium leading-tight text-slate-900">{p.name}</p>
              <StarIcon className="h-2.5 w-2.5 shrink-0 text-amber-400" />
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-500">
              <PinIcon className="h-2 w-2" />
              {p.meta}
            </p>
          </div>
        ))}
      </div>

      <TabBar active={1} />
    </div>
  );
}

function AppointmentsScreen() {
  return (
    <div className="h-full">
      <StatusBar />
      <div className="px-3 pt-1.5">
        <p className="text-[13px] font-semibold text-slate-900">Appointments</p>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-brand-700 px-2.5 py-0.5 text-[8px] font-medium text-white">
            Upcoming
          </span>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[8px] font-medium text-slate-600 shadow-sm">
            Past
          </span>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5 px-3">
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <p className="text-[9px] font-medium text-slate-900">Mainland General Hospital</p>
          <p className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-500">
            <CalendarIcon className="h-2 w-2" />
            Upcoming appointment
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[7px] font-medium text-brand-800">
              View provider
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[7px] font-medium text-slate-600">
              Reschedule
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <p className="text-[9px] font-medium text-slate-900">Ikeja Medical Centre</p>
          <p className="mt-0.5 text-[8px] text-slate-500">Past</p>
        </div>
      </div>

      <TabBar active={3} />
    </div>
  );
}

function HealthScreen() {
  return (
    <div className="h-full">
      <StatusBar />
      <div className="px-3 pt-1.5">
        <p className="text-[8px] font-medium uppercase tracking-wide text-brand-700">
          Your health at a glance
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-slate-900">Your health</p>
      </div>

      <div className="mt-2 px-3">
        <p className="text-[9px] font-semibold text-slate-900">Vitals</p>
        <p className="text-[8px] text-slate-500">Your latest check-ins</p>
        <div className="mt-1.5 space-y-1.5">
          {["Blood pressure", "Weight", "Blood sugar"].map((label) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-white px-2.5 py-2 shadow-sm"
            >
              <span className="text-[9px] font-medium text-slate-700">{label}</span>
              <span className="text-[8px] text-brand-700">Log</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 px-3">
        <p className="text-[9px] font-semibold text-slate-900">Wellness</p>
        <p className="text-[8px] text-slate-500">Last 7 days</p>
        <div className="mt-1.5 flex h-12 items-end gap-1 rounded-lg bg-white px-2.5 py-2 shadow-sm">
          {[40, 65, 45, 80, 55, 70, 60].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className="flex-1 rounded-sm bg-brand-200"
            />
          ))}
        </div>
      </div>

      <TabBar active={2} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2.5 shadow-sm">
      <p className="text-[8px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TabBar({ active }: { active: number }) {
  return (
    <div className="absolute inset-x-0 bottom-0 border-t border-slate-200/80 bg-white/95 px-1.5 pb-2 pt-1.5 backdrop-blur">
      <ul className="flex items-center justify-between">
        {NAV.map(({ label, Icon }, i) => (
          <li
            key={label}
            className={`flex flex-col items-center gap-0.5 ${
              i === active ? "text-brand-700" : "text-slate-400"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[6.5px] font-medium">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
