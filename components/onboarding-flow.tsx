"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/app-ui";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { ConnectedArt, FindCareArt, ManageArt } from "@/components/brand-art";
import { useT } from "@/lib/i18n";
import { readLocal, writeLocal } from "@/lib/storage";

const ONBOARDED_KEY = "healthlink:onboarded";
const LAST_STEP = 2;

/* Slide keyframes live with the flow so onboarding never depends on the app
   shell's motion utilities. Prefers-reduced-motion turns the slide off. */
const STAGE_CSS = `
.ob-stage {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  animation-fill-mode: both;
}
.ob-stage-fwd { animation-name: ob-slide-fwd; }
.ob-stage-back { animation-name: ob-slide-back; }
@keyframes ob-slide-fwd {
  from { opacity: 0; transform: translate3d(16px, 0, 0); }
  to { opacity: 1; transform: none; }
}
@keyframes ob-slide-back {
  from { opacity: 0; transform: translate3d(-16px, 0, 0); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ob-stage { animation: none; }
}
`;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

type Copy = { key: string; fallback: string };
type Screen = {
  art: ComponentType<{ className?: string }>;
  title: Copy;
  body: Copy;
  bullets: Copy[];
};

const SCREENS: Screen[] = [
  {
    art: ConnectedArt,
    title: { key: "onb_1_title", fallback: "Your health, connected." },
    body: {
      key: "onb_1_body",
      fallback:
        "Keep your records, results and care team together in one secure place.",
    },
    bullets: [
      {
        key: "onb_1_b1",
        fallback: "Save your health details once and share them with any provider.",
      },
      {
        key: "onb_1_b2",
        fallback: "Your information stays on your device and is private by default.",
      },
      {
        key: "onb_1_b3",
        fallback: "Use CareNBuddi in English, Yoruba, Hausa or Igbo.",
      },
    ],
  },
  {
    art: FindCareArt,
    title: { key: "onb_2_title", fallback: "Find the care you need." },
    body: {
      key: "onb_2_body",
      fallback:
        "Search verified hospitals, clinics, laboratories and pharmacies near you.",
    },
    bullets: [
      {
        key: "onb_2_b1",
        fallback: "Filter by state, LGA, service and what you can afford.",
      },
      {
        key: "onb_2_b2",
        fallback: "Call, WhatsApp or request a visit in a few taps.",
      },
      {
        key: "onb_2_b3",
        fallback: "The CareNBuddi team checks every provider before you see them.",
      },
    ],
  },
  {
    art: ManageArt,
    title: { key: "onb_3_title", fallback: "Manage your health in one place." },
    body: {
      key: "onb_3_body",
      fallback:
        "Reminders, journal entries, test results and your care circle, side by side.",
    },
    bullets: [
      {
        key: "onb_3_b1",
        fallback: "Never miss a medication or screening reminder.",
      },
      {
        key: "onb_3_b2",
        fallback: "Follow your whole health journey on one timeline.",
      },
      {
        key: "onb_3_b3",
        fallback: "Look after the health of your family with Care Circle.",
      },
    ],
  },
];

export function OnboardingFlow() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const finish = useCallback(() => {
    if (readLocal<string>(ONBOARDED_KEY) !== "1") writeLocal(ONBOARDED_KEY, "1");
    router.push("/app");
  }, [router]);

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(LAST_STEP, target));
      setDirection(clamped >= step ? 1 : -1);
      setStep(clamped);
    },
    [step],
  );

  const goNext = useCallback(() => {
    if (step >= LAST_STEP) {
      finish();
      return;
    }
    setDirection(1);
    setStep(step + 1);
  }, [step, finish]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skip = useCallback(() => {
    setDirection(1);
    setStep(LAST_STEP);
    finish();
  }, [finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goBack]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const { art: Art, title, body, bullets } = SCREENS[step];
  const isLast = step >= LAST_STEP;

  return (
    <>
      <style>{STAGE_CSS}</style>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden bg-white">
        {/* top bar — brand + out */}
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <LogoMark className="h-10 w-10" />
          <button
            type="button"
            onClick={skip}
            className={`tap min-h-10 rounded-lg px-2 text-sm font-semibold text-slate-500 hover:text-brand-700 ${FOCUS}`}
          >
            {t("onb_skip", "Skip")}
          </button>
        </header>

        {/* scrollable middle — illustration + copy */}
        <div
          ref={scrollRef}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-1"
        >
          <div
            className={
              direction === 1 ? "ob-stage ob-stage-fwd" : "ob-stage ob-stage-back"
            }
          >
            <div className="mx-auto w-full max-w-[19rem] pt-2">
              <Art className="h-auto w-full" />
            </div>
            <div aria-live="polite" className="mt-5">
              <h1 className="text-[26px] font-bold leading-[1.15] tracking-tight text-slate-900">
                {t(title.key, title.fallback)}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {t(body.key, body.fallback)}
              </p>
              <ul className="mt-5 space-y-2.5">
                {bullets.map((bullet) => (
                  <li key={bullet.key} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <span className="text-[13px] leading-snug text-slate-600">
                      {t(bullet.key, bullet.fallback)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* bottom bar — progress + primary action, inside thumb reach */}
        <footer className="safe-bottom shrink-0 px-5 pt-3">
          <div className="mb-3 flex items-center gap-1.5">
            {SCREENS.map((screen, i) => (
              <button
                key={screen.title.key}
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`${t("onb_step_word", "Step")} ${i + 1}`}
                className={`tap h-2 rounded-full ${FOCUS} ${
                  i === step ? "w-7 bg-brand-700" : i < step ? "w-2 bg-brand-300" : "w-2 bg-slate-200"
                }`}
              />
            ))}
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-slate-400">
              {step === 0
                ? t("onb_step_1", "1 of 3")
                : step === 1
                  ? t("onb_step_2", "2 of 3")
                  : t("onb_step_3", "3 of 3")}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                aria-label={t("onb_back", "Go back")}
                className={`tap flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700 ${FOCUS}`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            )}
            <Button full onClick={goNext} className={FOCUS}>
              {isLast ? t("onb_start", "Get started") : t("onb_next", "Next")}
              {isLast ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}
