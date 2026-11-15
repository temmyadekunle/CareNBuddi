import Link from "next/link";
import { AppDownload } from "@/components/app-download";
import { ConnectedArt, FindCareArt, ManageArt } from "@/components/brand-art";
import {
  ActivityIcon,
  BellIcon,
  BookIcon,
  CalendarIcon,
  CameraIcon,
  ChartIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  GridIcon,
  HeartIcon,
  HeartPulseIcon,
  LanguageIcon,
  PhoneIcon,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { AcademySection } from "@/components/marketing/academy";
import { CommunitySection } from "@/components/marketing/community";
import { Faq } from "@/components/marketing/faq";
import { MarketingImage } from "@/components/marketing/marketing-image";
import { PhoneMockup } from "@/components/marketing/phone-mockup";
import { Reveal } from "@/components/marketing/reveal";
import { CtaLink, Section } from "@/components/marketing/section";
import { WhatsAhead } from "@/components/marketing/whats-ahead";
import { BIGGER_VISION } from "@/lib/landing-features";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

/**
 * One hover treatment and one reveal rule for every card on the page, so the
 * whole site moves the same way.
 */
const CARD = "transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md";

const ABOUT_AUDIENCE = [
  {
    Icon: UserIcon,
    title: "Patients",
    body: "Organise health information, ask questions and find care.",
  },
  {
    Icon: HeartIcon,
    title: "Families and caregivers",
    body: "Keep the people you look after close, with their key details nearby.",
  },
  {
    Icon: StethoscopeIcon,
    title: "Healthcare professionals",
    body: "Apply, complete verification and prepare for patient connections.",
  },
  {
    Icon: GridIcon,
    title: "Facilities",
    body: "Facility profiles and tools are part of the longer-term build.",
  },
];

const STEPS = [
  {
    Art: ConnectedArt,
    title: "Create your profile",
    body: "Set up your CareNBuddi profile and personalise your healthcare experience.",
  },
  {
    Art: FindCareArt,
    title: "Find the right care",
    body: "Discover healthcare providers and services that match your needs.",
  },
  {
    Art: ManageArt,
    title: "Manage your care",
    body: "Keep health information organised, request visits and follow what is next.",
  },
];

const FEATURES = [
  {
    Icon: SearchIcon,
    title: "Find Healthcare",
    body: "Find healthcare providers and services in one place, with locations and contact details.",
  },
  {
    Icon: CalendarIcon,
    title: "Visit Requests",
    body: "Send a visit request from a provider's page and keep the details together.",
  },
  {
    Icon: FileTextIcon,
    title: "Health Records",
    body: "Keep important health information organised and accessible whenever you need it.",
  },
  {
    Icon: BellIcon,
    title: "Health Reminders",
    body: "Stay on top of important health activities, medicines and appointments.",
  },
  {
    Icon: HeartPulseIcon,
    title: "Health Companion",
    body: "Ask a health question and get guided next steps, with emergency signals caught first.",
  },
  {
    Icon: ChartIcon,
    title: "Personal Health Dashboard",
    body: "Get a simple overview of your healthcare activities and health journey.",
  },
];

const PATIENT_POINTS = [
  "Find hospitals, clinics, PHCs, labs and pharmacies across seven states",
  "Keep records, notes and daily check-ins organised in one place",
  "Carry a Health Passport with your blood group, allergies, medicines, emergency contacts and a scannable summary",
  "Keep family and trusted contacts close in your Care Circle",
  "Set reminders for medicines and health activities",
  "Send visit requests from a provider's page and keep the details together",
];

const PROVIDER_AVAILABLE = [
  "Register as a healthcare professional",
  "Upload your credentials to private storage",
  "Check the status of your application after signing in",
];

const PROVIDER_NEXT = [
  "Verified directory profiles so patients can find you",
  "Provider\u2013facility connections",
  "Provider-side confirmation and appointment management",
  "Telemedicine and virtual consultation tools",
  "Complete facility profiles and service details",
];

const FEATURE_PHOTOS = [
  {
    image: "vitalsCheck",
    title: "Check-ins you can rely on",
    body: "Log blood pressure, weight, heart rate and daily activity, then watch how they change over time.",
  },
  {
    image: "vaccination",
    title: "Vaccines kept on record",
    body: "Keep a dated record of the vaccinations you have received alongside your other health records.",
  },
  {
    image: "medication",
    title: "Prescriptions in one place",
    body: "Keep prescriptions and medicines together with the rest of your health information.",
  },
] as const;

const PRINCIPLES = [
  {
    title: "Simple by design",
    body: "Clear screens and plain language, so the next step is obvious without training.",
    Icon: ActivityIcon,
  },
  {
    title: "Accessible to more people",
    body: "Available in English, Yoruba, Hausa and Igbo, with guidance written for everyday life.",
    Icon: LanguageIcon,
  },
  {
    title: "Built for ordinary phones",
    body: "Designed for the Android and iOS devices people already own, not only the newest ones.",
    Icon: PhoneIcon,
  },
  {
    title: "Useful on a weak connection",
    body: "Opens offline after the first load, so unreliable internet is not a dead end.",
    Icon: RefreshIcon,
  },
];

const PRODUCT_FACTS = [
  { label: "Languages", value: "English, Yoruba, Hausa & Igbo" },
  { label: "Care directory", value: "Hospitals, clinics, PHCs, labs & pharmacies" },
  { label: "Works on", value: "Any modern phone, offline after first load" },
];

const VISION_FLOW = [
  { label: "Patient", Icon: UserIcon, logo: false },
  { label: "CareNBuddi", Icon: HeartPulseIcon, logo: true },
  { label: "Healthcare Provider", Icon: StethoscopeIcon, logo: false },
] as const;

type StoreLogo = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

type AppAvailability = {
  name: string;
  status: string;
  available: boolean;
  detail: string;
  logo?: StoreLogo;
};

const APP_AVAILABILITY: AppAvailability[] = [
  {
    name: "CareNBuddi Web App",
    status: "Available now",
    available: true,
    detail: "Open it in any modern browser. No store download is needed to get started.",
  },
  {
    name: "Android",
    status: "Available now",
    available: true,
    detail: "In Chrome, open the browser menu and choose \u201cInstall app\u201d or \u201cAdd to Home screen\u201d.",
  },
  {
    name: "iPhone & iPad",
    status: "Available now",
    available: true,
    detail: "In Safari, tap the Share button and choose \u201cAdd to Home Screen\u201d.",
  },
  {
    name: "Google Play",
    status: "Coming soon",
    available: false,
    detail: "There is no Google Play listing yet.",
    logo: { src: "/brand/google-badge.png", width: 563, height: 167, alt: "Google Play logo" },
  },
  {
    name: "Apple App Store",
    status: "Coming soon",
    available: false,
    detail: "There is no App Store listing yet.",
    logo: { src: "/brand/apple-badge.svg", width: 120, height: 40, alt: "App Store logo" },
  },
];

const TEAM_ROLES = [
  { title: "CTO", Icon: SettingsIcon },
  { title: "Board Advisor", Icon: ShieldIcon },
  { title: "Admin", Icon: UserIcon },
];

export default function LandingPage() {
  return (
    <main id="top">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white px-4 pb-28 pt-12 sm:px-6 sm:pb-32 sm:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-100/50 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-800">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              Your Health, Your Buddi.
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Your Health, Your Buddi.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Find the care you need, keep your health information organised, and manage your
              health journey &mdash; all in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/onboarding">Get Started</CtaLink>
              <CtaLink href="#features" variant="secondary">
                Explore CareNBuddi
              </CtaLink>
            </div>
            <p className="mt-4">
              <a
                href="#whats-ahead"
                className="text-sm font-semibold text-brand-800 underline decoration-brand-300 underline-offset-4 hover:text-brand-900"
              >
                Discover what&apos;s ahead
              </a>
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              {PRODUCT_FACTS.map((fact) => (
                <li key={fact.label} className="flex items-center gap-2">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  <span>
                    <span className="font-semibold text-slate-900">{fact.label}:</span>{" "}
                    {fact.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <MarketingImage
              image={MARKETING_IMAGES.lagosConsultation}
              sizes="(max-width: 1024px) 92vw, 560px"
              className="w-full rounded-3xl object-cover shadow-xl"
              priority
            />
            <div className="absolute -bottom-14 left-0 w-[44%] max-w-[168px] sm:-bottom-16 sm:left-6">
              <PhoneMockup screen="home" label="" />
            </div>
            <div className="absolute -right-2 -top-10 hidden w-32 sm:block lg:-right-6 lg:w-40">
              <ConnectedArt className="w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- why */}
      <Section
        id="why"
        eyebrow="Why CareNBuddi"
        title="Healthcare shouldn't feel complicated."
        lede="For many people, getting care means long travel, crowded waiting rooms, unanswered phone calls and health details scattered across paper, messages and memory. Those gaps are rarely about a lack of care — they are about coordination."
      >
        <div className="mt-6 max-w-3xl space-y-4 text-[15px] leading-relaxed text-slate-700">
          <p>
            CareNBuddi was built to make that coordination simpler: one place to find care, keep
            health information together and know what to do next, on an ordinary phone and in the
            language people speak at home.
          </p>
          <p>
            We design for the conditions care actually happens in — interrupted connections,
            limited time and devices that are shared between family members.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((item, i) => (
            <Reveal key={item.title} delay={i * 70}>
              <div
                className={`h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <item.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- about */}
      <Section
        id="about"
        eyebrow="About CareNBuddi"
        title="Healthcare is evolving, and so are we."
        tone="tint"
        lede="CareNBuddi is building a more connected healthcare experience — bringing patients, families, healthcare professionals and facilities closer together."
      >
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <Reveal className="h-full">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <p className="text-[15px] leading-relaxed text-slate-700">
                  Healthcare in Nigeria involves many people &mdash; patients, families,
                  professionals and facilities &mdash; often working from different information.
                  CareNBuddi is being built as one place where those pieces connect.
                </p>
                <p className="text-[15px] leading-relaxed text-slate-700">
                  Some of it is available today. More is being carefully developed. And the bigger
                  vision is only just beginning.
                </p>
              </div>
              <div className="mt-6">
                <CtaLink href="#whats-ahead" variant="secondary">
                  Discover What&apos;s Ahead
                </CtaLink>
              </div>
            </div>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {ABOUT_AUDIENCE.map((item, i) => (
              <Reveal key={item.title} delay={i * 60} className="h-full">
                <div
                  className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${CARD}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <item.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------- how it works */}
      <Section
        id="how-it-works"
        eyebrow="How it works"
        title="Three steps to a clearer healthcare journey."
        lede="CareNBuddi is built around the way people actually access care in Nigeria."
        tone="tint"
      >
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} as="li" delay={i * 90} className="h-full">
              <div
                className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}
              >
                <span className="text-sm font-bold tracking-widest text-brand-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <step.Art className="mt-3 w-full" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* --------------------------------------------------- app showcase */}
      <Section
        id="app"
        eyebrow="The CareNBuddi app"
        title="Everything you need, right at your fingertips."
        lede="A closer look at four screens from the app as it works today."
      >
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { screen: "home", label: "Home" },
              { screen: "findCare", label: "Find Care" },
              { screen: "appointments", label: "Visit requests" },
              { screen: "health", label: "Your health" },
            ] as const
          ).map((item, i) => (
            <Reveal key={item.label} delay={i * 80}>
              <PhoneMockup screen={item.screen} label={item.label} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={60}>
          <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Where to get CareNBuddi</h3>
                <p className="mt-1 text-sm text-slate-600">
                  CareNBuddi is a web app. It runs in your browser and can be added to your home
                  screen like a normal app.
                </p>
              </div>
              <CtaLink href="/onboarding">Get Started</CtaLink>
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {APP_AVAILABILITY.map((item) => (
                <li
                  key={item.name}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className={item.logo ? "flex items-start gap-3" : undefined}>
                    {item.logo ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.logo.src}
                          alt={item.logo.alt}
                          width={item.logo.width}
                          height={item.logo.height}
                          className="h-8 w-auto shrink-0 rounded"
                        />
                      </>
                    ) : null}
                    <div className={item.logo ? "min-w-0 flex-1" : undefined}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                        <span
                          className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.available
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <AppDownload />
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ------------------------------------------------------ features */}
      <Section
        id="features"
        eyebrow="Key features"
        title="Essential tools for your healthcare journey."
        lede="The tools people use most, all available in the app today — plus what we are preparing next."
      >
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 60}>
              <article
                className={`group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white">
                  <feature.Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={360}>
          <article
            className={`mt-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm ${CARD}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                <CameraIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Telemedicine &amp; Virtual Consultations
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Consult healthcare professionals remotely, hold virtual follow-up appointments
                  and reach professionals in different locations &mdash; reducing unnecessary
                  travel and improving access to care. Video consultations are not available in
                  the app yet.
                </p>
              </div>
            </div>
          </article>
        </Reveal>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_PHOTOS.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <figure
                className={`h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${CARD}`}
              >
                <MarketingImage
                  image={MARKETING_IMAGES[item.image]}
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px"
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="p-5">
                  <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Section>

      <WhatsAhead />

      {/* -------------------------------------------------- for patients */}
      <Section
        id="for-patients"
        eyebrow="For patients"
        title="Healthcare that works around you."
        lede="Finding care should not mean juggling phone numbers, paper notes and memory. CareNBuddi puts the important parts in one calm, simple place."
      >
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <ul className="space-y-3.5">
              {PATIENT_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-slate-700">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden>
                      <path
                        d="m5 10.5 3.2 3.2L15 7"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-[15px] leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CtaLink href="/onboarding">Start Your Health Journey</CtaLink>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Telemedicine and virtual consultations are coming soon.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <MarketingImage
              image={MARKETING_IMAGES.communityHealthCheck}
              sizes="(max-width: 1024px) 92vw, 560px"
              className="w-full rounded-3xl object-cover shadow-lg"
            />
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------- for providers */}
      <Section
        id="for-providers"
        eyebrow="For healthcare providers"
        title="Better connections between providers and patients."
        lede="Doctors, nurses and other healthcare professionals can apply to join, send credentials for review and follow their verification status. Facility profiles are coming next."
        tone="tint"
      >
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <MarketingImage
              image={MARKETING_IMAGES.providerWithTablet}
              sizes="(max-width: 1024px) 92vw, 520px"
              className="mx-auto w-full max-w-md rounded-3xl object-cover shadow-lg"
            />
          </Reveal>
          <Reveal delay={80} className="order-1 lg:order-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Available today</h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  Available now
                </span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {PROVIDER_AVAILABLE.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Coming next</h3>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  Coming soon
                </span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {PROVIDER_NEXT.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/provider/register">Join CareNBuddi</CtaLink>
              <CtaLink href="/provider/status" variant="secondary">
                Check application status
              </CtaLink>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-slate-600">
              Applying does not publish a public profile yet. Patients can send visit requests, but
              there is no provider-side confirmation, so a request is not a confirmed appointment.
            </p>
          </Reveal>
        </div>
      </Section>

      <CommunitySection />
      <AcademySection />

      {/* ---------------------------------------------------- our vision */}
      <Section
        id="our-vision"
        eyebrow="Our bigger vision"
        title="What if care could come closer to you?"
        lede="We envision a healthcare experience where distance doesn't have to be the first barrier."
      >
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            Our bigger vision
          </span>
          <p className="text-sm text-slate-600">
            Direction, not a delivery plan. None of these ambitions is available in the app today.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <MarketingImage
              image={MARKETING_IMAGES.patientInHospital}
              sizes="(max-width: 1024px) 92vw, 480px"
              className="w-full rounded-3xl object-cover shadow-lg"
            />
            <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-0">
              {VISION_FLOW.map((node, i) => (
                <div key={node.label} className="flex w-full flex-col items-center sm:flex-1 sm:flex-row">
                  <div
                    className={`w-full rounded-xl border bg-white px-3 py-3 text-center shadow-sm sm:w-auto sm:flex-1 ${
                      node.logo ? "border-brand-300" : "border-slate-200"
                    }`}
                  >
                    <span
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg ${
                        node.logo ? "" : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      {node.logo ? (
                        <LogoMark className="h-9 w-9" />
                      ) : (
                        <node.Icon className="h-4 w-4" />
                      )}
                    </span>
                    <p className="mt-1.5 text-xs font-semibold text-slate-900">{node.label}</p>
                  </div>
                  {i < VISION_FLOW.length - 1 ? (
                    <span
                      aria-hidden
                      className="mx-auto my-1 flex h-4 w-4 items-center justify-center text-brand-500 sm:mx-2 sm:my-0"
                    >
                      <ChevronRightIcon className="hidden h-4 w-4 sm:block" />
                      <ChevronDownIcon className="h-4 w-4 sm:hidden" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {BIGGER_VISION.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold">Emergency response coordination</span> is a future
          ambition, not a live service. CareNBuddi does not dispatch emergency services today; the
          app provides verified emergency numbers and guidance, and in an emergency you should
          contact local services directly.
        </p>

        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Care, connected.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">
            CareNBuddi is building a more connected healthcare experience. What you can use today
            is only the beginning of what we&apos;re creating together.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <CtaLink href="/onboarding">Get Started</CtaLink>
            <CtaLink href="#whats-ahead" variant="secondary">
              Discover What&apos;s Ahead
            </CtaLink>
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------- who we are */}
      <Section
        id="who-we-are"
        eyebrow="Who we are"
        title="Care should meet you where you are."
        lede="CareNBuddi was created from a simple belief: getting healthcare should not be harder than it needs to be. Built in Nigeria, it is designed around real people and real healthcare challenges."
        tone="tint"
      >
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal className="h-full">
            <div
              className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <BookIcon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                Our inspiration
              </p>
              <h3 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">
                Every minute matters.
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                Inspired by the story of Bethany Hamilton in Soul Surfer, we were reminded of
                something important: in an emergency, care shouldn&apos;t always have to wait until
                a patient reaches the hospital.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80} className="h-full">
            <div
              className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}
            >
              <p className="text-[15px] leading-relaxed text-slate-600 sm:text-base">
                CareNBuddi uses technology to help people connect with healthcare, manage their care
                and find the right next step &mdash; whether they are at home, working remotely,
                travelling, or simply trying to navigate the healthcare system.
              </p>
              <div className="mt-5 rounded-xl bg-brand-900 p-5">
                <p className="text-base font-semibold leading-snug text-white sm:text-lg">
                  &ldquo;We don&apos;t believe technology should replace human care. We believe it
                  should help people reach it.&rdquo;
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------- meet the team */}
      <Section id="team" eyebrow="The team" title="Meet Our Team">
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="h-full">
            <div
              className={`flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm ${CARD}`}
            >
              <span className="block aspect-square w-full overflow-hidden rounded-2xl bg-brand-100">
                <MarketingImage
                  image={MARKETING_IMAGES.founderPhoto}
                  sizes="280px"
                  className="h-full w-full object-cover"
                />
              </span>
              <p className="mt-4 text-base font-semibold text-slate-900">Temitope F. Adekunle</p>
              <p className="mt-0.5 text-sm font-medium text-brand-700">
                CEO / Co-founder, CareNBuddi
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Product Developer, Health Educator &amp; Mental Health Counselor
              </p>
            </div>
          </Reveal>

          {TEAM_ROLES.map((role, i) => (
            <Reveal key={role.title} delay={(i + 1) * 70} className="h-full">
              <div
                className={`flex h-full flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm ${CARD}`}
              >
                <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <role.Icon className="h-14 w-14" />
                </span>
                <p className="mt-4 text-base font-semibold text-slate-900">{role.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">CareNBuddi</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- faq */}
      <Section id="faq" eyebrow="FAQ" title="Questions people ask about CareNBuddi">
        <Reveal>
          <Faq />
        </Reveal>
      </Section>

      {/* --------------------------------------------------- final cta */}
      <section className="relative overflow-hidden bg-brand-900 px-4 py-20 sm:px-6">
        <MarketingImage
          image={MARKETING_IMAGES.lagosSurgeon}
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          decorative
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Take control of your healthcare journey.
            </h2>
            <p className="mt-4 text-lg text-brand-100">
              Connect with the care you need, when you need it.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaLink href="/onboarding" variant="onBrand">
                Get Started
              </CtaLink>
              <Link
                href="/provider/register"
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Join CareNBuddi
              </Link>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-brand-100">
              <span className="inline-flex items-center gap-2">
                <ShieldIcon className="h-4 w-4" />
                You control what you save
              </span>
              <span className="inline-flex items-center gap-2">
                <StethoscopeIcon className="h-4 w-4" />
                Built for patients and providers
              </span>
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
