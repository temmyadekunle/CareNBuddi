import type { Metadata } from "next";
import { CtaLink, Section } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Careers",
  description: "Open roles at CareNBuddi will be published here.",
};

export default function CareersPage() {
  return (
    <main id="top">
      <Section
        eyebrow="Careers"
        title="Careers at CareNBuddi"
        lede="We are building CareNBuddi in Nigeria — a simpler, more connected way to reach healthcare. Open roles will be published on this page."
      >
        <div className="mt-10 rounded-2xl border border-slate-200 bg-brand-50/40 p-8 text-center">
          <p className="text-lg font-semibold text-slate-900">Coming soon</p>
          <p className="mt-2 text-sm text-slate-600">
            Job openings will be shared here as they become available.
          </p>
          <div className="mt-6 flex justify-center">
            <CtaLink href="/#team">Meet the team</CtaLink>
          </div>
        </div>
      </Section>
    </main>
  );
}
