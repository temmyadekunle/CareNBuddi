"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Chip, Screen, SectionHeader } from "@/components/app-ui";
import { ChevronRightIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

interface Msg {
  role: "user" | "bot";
  text: string;
}

const CHIPS = [
  { key: "askx_chip_bp", en: "Blood pressure", probe: "blood pressure" },
  { key: "askx_chip_diabetes", en: "Diabetes", probe: "diabetes" },
  { key: "askx_chip_care", en: "Where to get care", probe: "where can i go" },
  { key: "askx_chip_cost", en: "Costs and HMO", probe: "cost" },
] as const;

function reply(t: (key: string, fallback?: string) => string, key: string, fallback: string): string {
  return t(key, fallback);
}

function match(t: (key: string, fallback?: string) => string, q: string): string {
  const s = q.toLowerCase();
  if (s.includes("blood pressure") || s.includes("hypertension") || s.includes("bp")) {
    return reply(
      t,
      "askx_a_bp",
      "A healthy blood pressure is generally below 120/80 mmHg. If yours is often above 130/80, talk to a provider. Record readings in your journal and follow the Hypertension Journey under Health → Chronic Care.",
    );
  }
  if (s.includes("diabetes") || s.includes("sugar") || s.includes("glucose")) {
    return reply(
      t,
      "askx_a_diabetes",
      "Diabetes means blood sugar stays too high. Regular meals, daily movement and prescribed medication all help. See the Diabetes Journey under Health → Chronic Care, or find a screening near you.",
    );
  }
  if ((s.includes("find") && s.includes("hospital")) || s.includes("where can i go") || s.includes("clinic")) {
    return reply(
      t,
      "askx_a_findcare",
      "Use Find Care to search hospitals, clinics, labs and pharmacies by state and LGA. Community screening days are often the lowest-cost option.",
    );
  }
  if (s.includes("sick") || s.includes("symptom") || s.includes("pain")) {
    return reply(
      t,
      "askx_a_symptoms",
      "Note your symptoms in your journal so you have a record to share. For red-flag symptoms — chest pain, trouble breathing, severe bleeding — call emergency services from Get Help Now.",
    );
  }
  if (s.includes("emergency") || s.includes("ambulance")) {
    return reply(
      t,
      "askx_a_emergency",
      "Open Get Help Now for emergency numbers and first-aid steps. National emergency line: 112.",
    );
  }
  if (s.includes("free") || s.includes("afford") || s.includes("cost") || s.includes("hmo") || s.includes("insurance")) {
    return reply(
      t,
      "askx_a_cost",
      "Primary health centres usually cost less than private hospitals. Community health days are often free or sponsored. Providers show affordability tiers (₦–₦₦₦) on Find Care.",
    );
  }
  if (s.includes("vaccine") || s.includes("immuniz")) {
    return reply(
      t,
      "askx_a_vaccine",
      "Routine childhood vaccines and boosters are available at PHCs and clinics. Ask a provider, or check your Health Passport for your immunisation history.",
    );
  }
  if (s.includes("pregnant") || s.includes("maternal")) {
    return reply(
      t,
      "askx_a_pregnancy",
      "Antenatal care should start early. Look for maternal health services on Find Care, and add a Care Circle member to help track appointments.",
    );
  }
  return reply(
    t,
    "askx_a_default",
    "I can help you navigate CareNBuddi: finding care, understanding conditions, preparing for a visit, or using your journal and passport. Try asking about blood pressure, diabetes, costs, or where to get care.",
  );
}

export default function AskPage() {
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      role: "bot",
      text: t(
        "askx_greeting",
        "Hello! I am Ask CareNBuddi. I can help you understand health topics and use the app — I am not a doctor. What would you like to know?",
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setMessages((m) => [...m, { role: "user", text: value }, { role: "bot", text: match(t, value) }]);
    setInput("");
  };

  return (
    <Screen>
      <SectionHeader
        title={t("ask_title", "Ask CareNBuddi")}
        subtitle={t("askx_disclaimer", "Educational information only — it does not replace professional medical care.")}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => (
          <Chip key={chip.key} onClick={() => send(chip.probe)}>
            {t(chip.key, chip.en)}
          </Chip>
        ))}
      </div>

      <Card className="mt-3" padded={false}>
        <div className="space-y-2.5 p-3" aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2.5 text-sm text-white"
                  : "max-w-[92%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800"
              }
            >
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <label className="sr-only" htmlFor="ask-input">
          {t("ask_ph", "Ask about a condition, finding care, costs…")}
        </label>
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          enterKeyHint="send"
          placeholder={t("ask_ph", "Ask about a condition, finding care, costs…")}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <Button type="submit" className="min-h-11 px-4" aria-label={t("ask_send", "Send")}>
          <ChevronRightIcon className="h-5 w-5" />
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="rose">{t("askx_emergency_hint", "Emergency? Call 112 from Get Help Now.")}</Badge>
      </div>
    </Screen>
  );
}