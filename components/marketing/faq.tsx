"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";

type Item = { q: string; a: string };

const ITEMS: Item[] = [
  {
    q: "What is HealthLink?",
    a: "HealthLink is a digital healthcare platform for Nigeria. It brings finding care, booking appointments, keeping health information organised, and staying in touch with healthcare providers into one mobile app — available in English, Yoruba, Hausa and Igbo.",
  },
  {
    q: "Who can use HealthLink?",
    a: "Anyone looking for healthcare in Nigeria: patients and families, community health workers, doctors, nurses, clinics, hospitals, laboratories and pharmacies. HealthLink also has dedicated views for providers and staff.",
  },
  {
    q: "Can I find healthcare providers on HealthLink?",
    a: "Yes. Find Care lists hospitals, clinics, primary healthcare centres, laboratories, pharmacies and diagnostic centres, with the location and contact details of each so you can reach them directly.",
  },
  {
    q: "Can I book appointments?",
    a: "Yes. You can request an appointment with a provider and keep track of what is coming up in one place, so your healthcare activities stay organised.",
  },
  {
    q: "Is HealthLink available on mobile?",
    a: "HealthLink is built mobile-first. Open it on your phone and add it to your home screen — on Android you can install it from the browser menu, and on iPhone or iPad you add it from the Safari share sheet. There is no app store download required.",
  },
  {
    q: "How do I create an account?",
    a: "Tap Get Started and follow the short setup steps to create your HealthLink profile. You can also browse as a guest and create an account later.",
  },
  {
    q: "Can healthcare providers join HealthLink?",
    a: "Yes. Providers and facilities can register on HealthLink to build a digital presence, be discovered by patients searching for care, and manage appointment requests in one place.",
  },
  {
    q: "How is my information handled?",
    a: "HealthLink keeps the health information you enter so you can review and manage it, and the app shows you what has been saved. Our privacy and terms pages set out what we store, why we store it, and how to ask us to remove it.",
  },
];

/**
 * Placeholder copy: these answers describe what the product does today. They
 * deliberately avoid claims about medical outcomes or regulatory status.
 */
export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mt-8 max-w-3xl space-y-3">
      {ITEMS.map((item, index) => {
        const open = openIndex === index;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                aria-controls={`faq-panel-${index}`}
                id={`faq-button-${index}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[15px] font-semibold text-slate-900">{item.q}</span>
                <ChevronDownIcon
                  className={`h-5 w-5 shrink-0 text-brand-700 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            {open ? (
              <div
                id={`faq-panel-${index}`}
                role="region"
                aria-labelledby={`faq-button-${index}`}
                className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600"
              >
                {item.a}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
