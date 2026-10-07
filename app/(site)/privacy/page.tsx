import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How CareNBuddi handles the information you enter into the app: what we store, why we store it, and how to ask us to remove it.",
};

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "This page is a draft",
    body: "This privacy policy is a working draft written to describe how the CareNBuddi app behaves today. It has not yet been reviewed by a lawyer. We will replace it with a reviewed, versioned policy — including our company name, registered address, data protection officer contact details and legal basis for processing — before a public launch. Please treat it as an honest description of the product, not as final legal advice.",
  },
  {
    heading: "What CareNBuddi stores",
    body: "CareNBuddi stores what you choose to enter into the app. This can include the account details you provide when you sign up or register, the health information, records and measurements you save, the profile photo you choose, the providers you save or bookmark, and the appointments you create. Browsing the app as a guest does not require an account, and guest browsing does not write your activity to an account.",
  },
  {
    heading: "Why we store it",
    body: "So the app can do what it is built to do: show you the information you saved, let you book and manage appointments, and let the providers you choose work with the information they need. We do not use your health information for advertising, and we do not sell your data.",
  },
  {
    heading: "Where it is stored",
    body: "Signed-in data is stored in our database so it can be loaded when you open the app. Some content is also cached on your own device so CareNBuddi keeps working when your connection is slow or unavailable. Clearing your browser storage, or deleting CareNBuddi from your home screen, removes that local cache from the device.",
  },
  {
    heading: "Who can see it",
    body: "Your account and your saved health information are visible to you. Providers you connect with see the information that is necessary for the care they are delivering to you, and staff who administer CareNBuddi can access the app in order to keep it working. We do not sell your information to anyone.",
  },
  {
    heading: "How long we keep it",
    body: "We keep your information for as long as your CareNBuddi account exists, so your health history does not disappear without warning. When you close your account, we delete or anonymise your information from our active systems, except where we are legally required to keep a record.",
  },
  {
    heading: "Your choices and how to ask us to delete your data",
    body: "You can review and remove individual items inside the app at any time. To close your account or ask us to delete everything we hold about you, use the support route inside the app. Our company name, postal address, email address and data protection officer contact details will be published at the bottom of this page before a public launch. We will confirm what we delete and, where we cannot delete something because a legal obligation requires us to keep it, we will explain why.",
  },
  {
    heading: "Security",
    body: "CareNBuddi uses HTTPS in transit, keeps access to the service limited to people who need it for support and maintenance, and stores secrets outside the source code. No system is perfectly secure, so please do not use CareNBuddi as the only place you keep a medical record, and do not share your account details with anyone.",
  },
  {
    heading: "Children",
    body: "CareNBuddi is not intended for children under 13. If you believe a child has created an account, contact us and we will help close it.",
  },
  {
    heading: "Changes to this policy",
    body: "When this policy changes we will update this page and note the date below. Material changes that affect how your information is used will be highlighted at the top of the page.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          How CareNBuddi handles the information you enter into the app.
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
              return to the CareNBuddi homepage
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
