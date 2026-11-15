"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";

type Item = { q: string; a: string };

const ITEMS: Item[] = [
  {
    q: "What is CareNBuddi?",
    a: "CareNBuddi is a digital healthcare platform for Nigeria. It brings finding care, keeping health information organised and reaching the people who can help into one mobile app — available in English, Yoruba, Hausa and Igbo.",
  },
  {
    q: "Who can use CareNBuddi?",
    a: "Anyone looking for healthcare in Nigeria: patients and families, doctors, nurses, clinics, hospitals, laboratories and pharmacies. CareNBuddi also has dedicated views for providers and staff.",
  },
  {
    q: "Can I find healthcare providers on CareNBuddi?",
    a: "Yes. Find Care lists hospitals, clinics, primary healthcare centres, laboratories, pharmacies and diagnostic centres across seven states, with the location, call, WhatsApp and directions details for each.",
  },
  {
    q: "Can I book appointments?",
    a: "You can send a visit request from a provider's page and keep the details together in one place. Provider-side confirmation and scheduling are still being built, so a request is not a confirmed booking yet.",
  },
  {
    q: "Does CareNBuddi handle emergencies?",
    a: "No. CareNBuddi is not an emergency service and does not dispatch ambulances or responders. The app shows verified emergency numbers and helps you find nearby emergency care, but in an emergency you should contact local emergency services directly.",
  },
  {
    q: "Is CareNBuddi available on mobile?",
    a: "CareNBuddi is built mobile-first. Open it on your phone and add it to your home screen — on Android you can install it from the browser menu, and on iPhone or iPad you add it from the Safari share sheet. There is no app store download required.",
  },
  {
    q: "How do I create an account?",
    a: "Tap Get Started and follow the short setup steps to create your CareNBuddi profile. You can also browse as a guest and create an account later.",
  },
  {
    q: "Can healthcare providers join CareNBuddi?",
    a: "Yes. Healthcare professionals can apply to join, upload their credentials to private storage and follow their verification status. Public directory profiles, provider\u2013facility connections and facility profiles are coming soon.",
  },
  {
    q: "What is CareNBuddi Community?",
    a: "CareNBuddi Community is available to signed-in members: separate, moderated discussion spaces for patients and for verified healthcare professionals. Members can post, reply and report content, and moderators review reports and record their decisions. It needs the CareNBuddi backend, and community discussion is never presented as professional diagnosis or treatment.",
  },
  {
    q: "What is CareNBuddi Health Academy?",
    a: "The Health Academy is a planned learning environment for patients, families and healthcare professionals, covering health education, awareness programmes and professional development. It is an expansion of the ecosystem, not a working learning platform today.",
  },
  {
    q: "Where can I see what is available and what is planned?",
    a: "The What's Here & What's Ahead section lists each capability with its status: available now, coming soon, on our roadmap or part of our bigger vision. It is kept in line with what the app actually does, and we do not publish release dates we cannot stand behind.",
  },
  {
    q: "How is my information handled?",
    a: "CareNBuddi keeps the health information you enter so you can review and manage it, and the app shows you what has been saved. Our privacy and terms pages set out what we store, why we store it, and how to ask us to remove it.",
  },
];

/**
 * Answers describe what the product does today and what is planned. They
 * deliberately avoid claims about medical outcomes, regulatory status or
 * functionality that is not shipped.
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
