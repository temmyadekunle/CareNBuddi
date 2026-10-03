"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

interface Msg { role: "user" | "bot"; text: string }

const DISCLAIMER = "This is educational information and does not replace professional medical care.";

function answer(q: string): string {
  const s = q.toLowerCase();
  if (s.includes("blood pressure") || s.includes("hypertension") || s.includes("bp"))
    return "A healthy blood pressure is generally below 120/80 mmHg. If yours is often above 130/80, talk to a provider. You can record readings in your journal and follow the Hypertension Journey under Health → Chronic Care.";
  if (s.includes("diabetes") || s.includes("sugar") || s.includes("glucose"))
    return "Diabetes means blood sugar stays too high. Regular meals, daily movement, and medication (if prescribed) help. See the Diabetes Journey under Health → Chronic Care, or find a screening near you.";
  if ((s.includes("find") && s.includes("hospital")) || s.includes("where can i go") || s.includes("clinic"))
    return "Use the Find Care page to search hospitals, clinics, labs and pharmacies by state and LGA. Community screening days are often the lowest-cost option.";
  if (s.includes("sick") || s.includes("symptom") || s.includes("pain"))
    return "Note your symptoms in the Journal page so you have a record to share. For red-flag symptoms (chest pain, trouble breathing, severe bleeding), call emergency services from Get Help Now.";
  if (s.includes("emergency") || s.includes("ambulance"))
    return "Open Get Help Now (/emergency) for emergency numbers and first-aid steps. National emergency: 112.";
  if (s.includes("free") || s.includes("afford") || s.includes("cost") || s.includes("hmo") || s.includes("insurance"))
    return "Primary health centres usually cost less than private hospitals. Community health days are often free or sponsored. Providers show affordability tiers (₦–₦₦₦) on Find Care.";
  if (s.includes("vaccine") || s.includes("immuniz"))
    return "Routine childhood vaccines and boosters are available at PHCs and clinics. Ask a provider or check your Health Passport for your immunization history.";
  if (s.includes("pregnant") || s.includes("maternal"))
    return "Antenatal care should start early — look for maternal health services on Find Care, and consider a Care Circle member to track appointments.";
  return "I can help you navigate HealthLink: finding care, understanding conditions, preparing for a visit, or using your journal and passport. Try asking about blood pressure, diabetes, costs, or where to get care.";
}

export default function AskPage() {
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hello! I'm Ask HealthLink. I can help you understand health topics and navigate the platform — not replace a doctor. What would you like to know?" },
  ]);
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "bot", text: answer(text) }]);
    setInput("");
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("ask_title", "Ask HealthLink")}</h1>
      <p className="mt-1 text-sm text-slate-500">{DISCLAIMER}</p>

      <div className="mt-6 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "ml-auto bg-brand-700 text-white" : "bg-slate-100 text-slate-800"}`}>
            {m.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("ask_ph", "Ask about a condition, finding care, costs…")}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-300"
        />
        <button className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">{t("ask_send", "Send")}</button>
      </form>
    </main>
  );
}
