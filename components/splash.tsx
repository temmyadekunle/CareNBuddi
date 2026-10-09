"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";

type Phase = "in" | "out" | "done";

/**
 * Startup splash: a fixed visual layer over the very first render that fades
 * itself out ~1s after mount. It touches no routing, auth, onboarding or data
 * — when it leaves, whatever the app was already doing is simply revealed.
 * Everything it shows (logo, fonts, colors) is bundled locally, so it works
 * fully offline and inside the APK's WebView.
 */
export function Splash() {
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    const startOut = setTimeout(() => setPhase("out"), 1000);
    const finish = setTimeout(() => setPhase("done"), 1400);
    return () => {
      clearTimeout(startOut);
      clearTimeout(finish);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden="true"
      className={`splash-autohide fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FAFCFC] transition-opacity duration-300 ${
        phase === "out" ? "pointer-events-none opacity-0" : ""
      }`}
    >
      <LogoMark className="splash-mark h-24 w-24" />
      <p className="splash-text mt-6 text-2xl font-semibold tracking-tight text-slate-900">
        CareNBuddi
      </p>
      <p className="splash-text splash-text-late mt-1.5 text-sm text-slate-500">
        Care, closer to you.
      </p>
    </div>
  );
}
