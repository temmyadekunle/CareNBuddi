import Link from "next/link";
import { AppDownload, InstallSteps } from "@/components/app-download";
import { ConnectedArt, FindCareArt, ManageArt } from "@/components/brand-art";
import {
  ActivityIcon,
  BellIcon,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  HeartPulseIcon,
  LanguageIcon,
  PhoneIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  StethoscopeIcon,
  UserIcon,
  WalletIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { Faq } from "@/components/marketing/faq";
import { MarketingImage } from "@/components/marketing/marketing-image";
import { PhoneMockup } from "@/components/marketing/phone-mockup";
import { Reveal } from "@/components/marketing/reveal";
import { CtaLink, Section } from "@/components/marketing/section";
import { Testimonials } from "@/components/marketing/testimonials";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

/**
 * One hover treatment and one reveal rule for every card on the page, so the
 * whole site moves the same way.
 */
const CARD = "transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md";

const BENEFITS = [
  {
    Icon: SearchIcon,
    title: "Find care easily",
    body: "Search hospitals, clinics, PHCs, laboratories and pharmacies by name or area.",
  },
  {
    Icon: CalendarIcon,
    title: "Book appointments",
    body: "Request a visit and see what is coming up without digging through messages.",
  },
  {
    Icon: FileTextIcon,
    title: "Keep health information organised",
    body: "Store records, results and details together so they are there when you need them.",
  },
  {
    Icon: ChatIcon,
    title: "Stay connected with professionals",
    body: "Reach providers directly and keep your healthcare activities in one place.",
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
    body: "Book appointments, manage health information and stay connected.",
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
    title: "Book Appointments",
    body: "Schedule healthcare appointments conveniently and keep track of what is next.",
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
    Icon: ChatIcon,
    title: "Healthcare Connections",
    body: "Make it easier to stay connected with the healthcare professionals looking after you.",
  },
  {
    Icon: ChartIcon,
    title: "Personal Health Dashboard",
    body: "Get a simple overview of your healthcare activities and health journey.",
  },
];

const PATIENT_POINTS = [
  "Find care near you and discover providers",
  "Book and keep track of appointments",
  "Follow your health activities and reminders",
  "Keep important health information organised",
];

const PROVIDER_POINTS = [
  "Build a digital presence patients can find",
  "Get discovered by people searching for care",
  "Manage appointment requests in one place",
  "Improve communication with the people you care for",
  "Give patients a clearer, simpler experience",
];

const FEATURE_PHOTOS = [
  {
    image: "vitalsCheck",
    title: "Check-ins you can rely on",
    body: "Log blood pressure, weight and blood sugar, then watch how they change over time.",
  },
  {
    image: "vaccination",
    title: "Vaccines and doses, tracked",
    body: "Keep a record of what has been given and when the next dose is due.",
  },
  {
    image: "medication",
    title: "Prescriptions in one place",
    body: "Hold on to your prescriptions and medicines so they are there when you need them.",
  },
] as const;

const PRINCIPLES = [
  {
    title: "Simple",
    body: "Designed to make healthcare easier to navigate, not harder.",
    Icon: ActivityIcon,
  },
  {
    title: "Connected",
    body: "Bringing patients and healthcare providers closer together.",
    Icon: ChatIcon,
  },
  {
    title: "Accessible",
    body: "Designed with real people and real healthcare needs in mind.",
    Icon: LanguageIcon,
  },
  {
    title: "Personal",
    body: "Your healthcare experience, organised around you.",
    Icon: HeartPulseIcon,
  },
];

const PRODUCT_FACTS = [
  { label: "Languages", value: "English, Yoruba, Hausa & Igbo" },
  { label: "Care directory", value: "Hospitals, clinics, PHCs, labs & pharmacies" },
  { label: "Works on", value: "Any modern phone, online or offline" },
];

const TRUST_POINTS = [
  { label: "Works on any modern phone", Icon: PhoneIcon },
  { label: "Offline-capable after first load", Icon: RefreshIcon },
  { label: "Four languages from day one", Icon: LanguageIcon },
  { label: "No payment needed to get started", Icon: WalletIcon },
];

const VISION_LINES = [
  "Patients can connect more easily with healthcare providers.",
  "Families can stay better informed.",
  "Important health information is easier to manage.",
  "Technology bridges the gap between \u201cI need care\u201d and \u201cI know what to do next.\u201d",
];

const VISION_FLOW = [
  { label: "Patient", Icon: UserIcon, logo: false },
  { label: "CareNBuddi", Icon: HeartPulseIcon, logo: true },
  { label: "Healthcare Provider", Icon: StethoscopeIcon, logo: false },
] as const;

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
              Find the care you need, connect with healthcare professionals, and manage your
              health journey &mdash; all in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/onboarding">Get Started</CtaLink>
              <CtaLink href="#features" variant="secondary">
                Explore CareNBuddi
              </CtaLink>
            </div>
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

      {/* -------------------------------------------------- trust benefits */}
      <section className="border-y border-slate-200 bg-white px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Healthcare made simpler.
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((item, i) => (
              <Reveal key={item.title} delay={i * 70}>
                <div
                  className={`h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <item.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- how it works */}
      <Section
        id="how-it-works"
        eyebrow="How it works"
        title="Three steps to a clearer healthcare journey"
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

      {/* ------------------------------------------------------ features */}
      <Section
        id="features"
        eyebrow="Key features"
        title="Everything you need to manage your health"
        lede="One app for finding care, keeping track of appointments and staying on top of your health."
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

      {/* -------------------------------------------------- for patients */}
      <Section
        id="for-patients"
        eyebrow="For patients"
        title="Healthcare that works around you."
        lede="Finding care should not mean juggling phone numbers, paper notes and memory. CareNBuddi puts the important parts in one calm, simple place."
        tone="tint"
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
        lede="CareNBuddi gives doctors, nurses, clinics and facilities a clearer way to be found and to organise the care they deliver."
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
            <ul className="space-y-3.5">
              {PROVIDER_POINTS.map((point) => (
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
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/provider/register">Join CareNBuddi</CtaLink>
              <CtaLink href="/provider" variant="secondary">
                Provider view
              </CtaLink>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------- app showcase */}
      <Section
        id="app"
        eyebrow="The app"
        title="Everything you need, right at your fingertips."
        lede="CareNBuddi brings essential healthcare tools together in one simple experience."
        tone="tint"
      >
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { screen: "home", label: "Home" },
              { screen: "findCare", label: "Find Care" },
              { screen: "appointments", label: "Appointments" },
              { screen: "health", label: "Your health" },
            ] as const
          ).map((item, i) => (
            <Reveal key={item.label} delay={i * 80}>
              <PhoneMockup screen={item.screen} label={item.label} />
            </Reveal>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-xl text-center">
          <p className="text-sm text-slate-600">
            Add CareNBuddi to your home screen and it opens like a normal app.
          </p>
          <div className="mt-4 flex justify-center">
            <CtaLink href="/onboarding">Get Started</CtaLink>
          </div>
          <div className="mt-8 text-left">
            <AppDownload />
            <InstallSteps />
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------- why */}
      <Section
        id="why"
        eyebrow="Why CareNBuddi"
        title="Healthcare shouldn't feel complicated."
        lede="We built CareNBuddi around a simple idea: the people using it are busy, often on a poor connection, and should not have to work hard to get care."
      >
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <Reveal delay={120}>
          <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3">
            {PRODUCT_FACTS.map((fact) => (
              <div key={fact.label}>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                  {fact.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{fact.value}</p>
              </div>
            ))}
          </div>
        </Reveal>
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
          <Reveal className="flex h-full flex-col gap-6">
            <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${CARD}`}>
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
            <div className="flex flex-1 items-center rounded-2xl bg-brand-900 p-6">
              <p className="text-lg font-semibold leading-snug text-white">
                &ldquo;We don&apos;t believe technology should replace human care. We believe it
                should help people reach it.&rdquo;
              </p>
            </div>
          </Reveal>

          <Reveal delay={80} className="flex h-full flex-col gap-6">
            <p className="text-[15px] leading-relaxed text-slate-600 sm:text-base">
              CareNBuddi uses technology to help people connect with healthcare, manage their care
              and find the right next step &mdash; whether they are at home, working remotely,
              travelling, or simply trying to navigate the healthcare system.
            </p>
            <figure
              className={`flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${CARD}`}
            >
              <MarketingImage
                image={MARKETING_IMAGES.founderPhoto}
                sizes="(max-width: 1024px) 92vw, 480px"
                className="aspect-[16/10] w-full object-cover object-top"
              />
              <figcaption className="p-5">
                <p className="text-base font-semibold text-slate-900">Temitope F. Adekunle</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Health Educator &amp; Mental Health Counselor, CareNBuddi
                </p>
              </figcaption>
            </figure>
          </Reveal>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <point.Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-slate-700">{point.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------- our vision */}
      <Section
        id="our-vision"
        eyebrow="Our vision"
        title="What if care could come closer to you?"
        lede="We envision a healthcare experience where distance doesn't have to be the first barrier."
      >
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <MarketingImage
              image={MARKETING_IMAGES.patientInHospital}
              sizes="(max-width: 1024px) 92vw, 560px"
              className="w-full rounded-3xl object-cover shadow-lg"
            />
          </Reveal>
          <Reveal delay={80}>
            <ul className="space-y-3.5">
              {VISION_LINES.map((line) => (
                <li key={line} className="flex items-start gap-3 text-slate-700">
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
                  <span className="text-[15px] leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-lg font-semibold text-slate-900">
              CareNBuddi is building that bridge.
            </p>
          </Reveal>
        </div>

        {/* ------------------------------------------- the care flow */}
        <Reveal delay={60}>
          <div className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-0">
            {VISION_FLOW.map((node, i) => (
              <div key={node.label} className="flex flex-col items-center sm:flex-row">
                <div
                  className={`w-full rounded-2xl border bg-white px-5 py-5 text-center shadow-sm sm:w-52 ${
                    node.logo ? "border-brand-300" : "border-slate-200"
                  }`}
                >
                  <span
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${
                      node.logo ? "" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {node.logo ? (
                      <LogoMark className="h-12 w-12 rounded-xl" />
                    ) : (
                      <node.Icon className="h-5 w-5" />
                    )}
                  </span>
                  <p className="mt-2.5 text-sm font-semibold text-slate-900">{node.label}</p>
                </div>
                {i < VISION_FLOW.length - 1 ? (
                  <span aria-hidden className="mx-auto my-1 flex h-5 w-5 items-center justify-center text-brand-500 sm:mx-3 sm:my-0">
                    <ChevronRightIcon className="hidden h-5 w-5 sm:block" />
                    <ChevronDownIcon className="h-5 w-5 sm:hidden" />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mx-auto mt-12 max-w-xl text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Care, connected.
          </p>
          <div className="mt-5 flex justify-center">
            <CtaLink href="/onboarding">Get Started</CtaLink>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------- testimonials */}
      <Section
        id="testimonials"
        eyebrow="Testimonials"
        title="What people expect from their healthcare"
        tone="tint"
      >
        <div className="mt-10">
          <Reveal>
            <Testimonials />
          </Reveal>
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
                className="inline-flex min-h-[2.75rem] items_center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
