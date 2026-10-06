import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you use the HealthLink app: what it is for, what we are not responsible for, and the rules for providers who join.",
};

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "This page is a draft",
    body: "These terms are a working draft describing how HealthLink works today. They have not yet been reviewed by a lawyer, and they do not yet include our company name, registered address or jurisdiction. We will publish reviewed terms — with a version number and effective date — before a public launch. Until then, please read them as a plain description of the service.",
  },
  {
    heading: "What HealthLink is",
    body: "HealthLink is a software platform. It helps people find healthcare providers, organise health information, manage appointments, reminders and health activities, and connect with healthcare professionals. It also gives providers a way to publish their details and manage appointment requests.",
  },
  {
    heading: "HealthLink is not a medical service",
    body: "HealthLink does not diagnose, treat, prescribe or advise on medical matters. It does not replace a consultation with a qualified doctor or other licensed professional, and it is not an emergency service. If you think you have a medical emergency, contact your local emergency number or go to the nearest hospital.",
  },
  {
    heading: "Information you enter",
    body: "You are responsible for the accuracy of what you enter, and for keeping your account secure. Do not enter information for someone else without their agreement, and do not use HealthLink to send unlawful, abusive or misleading content.",
  },
  {
    heading: "Providers who join",
    body: "Providers and facilities join with accurate information about themselves, their services and their availability. You are responsible for the clinical care you provide and for your relationship with your patients. Listing a provider on HealthLink does not mean HealthLink endorses, verifies or supervises that provider.",
  },
  {
    heading: "Availability",
    body: "We work to keep HealthLink available and to keep your information available to you, but we cannot promise that the service will never be interrupted. HealthLink is provided on an as-is basis, and to the extent permitted by law we are not liable for indirect or consequential loss arising from your use of it.",
  },
  {
    heading: "Ending use",
    body: "You can stop using HealthLink and close your account at any time. We may suspend an account that is used to break these terms, to harm other people, or where required by law. When an account is closed, the privacy policy explains what happens to the information behind it.",
  },
  {
    heading: "Acceptance",
    body: "By creating an account or using HealthLink you accept these terms. If you do not accept them, please do not use the service.",
  },
];

export default function TermsPage() {
  return (
    <main className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          The terms that apply when you use the HealthLink app.
        </p>
        <p className="mt-2 text-sm text-slate-500">Draft — last updated 5 October 2026.</p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold text-slate-900">{section.heading}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">Questions</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Use the support route inside the app. Our email address and postal address will be
            published here before a public launch. You can also{" "}
            <Link href="/" className="font-semibold text-brand-700 underline underline-offset-2">
              return to the HealthLink homepage
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
