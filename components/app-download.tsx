"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function AppDownload() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Link
        href="/app"
        className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        Open the app
      </Link>
      {prompt ? (
        <button
          onClick={install}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Install on this device
        </button>
      ) : null}
    </div>
  );
}

export function InstallSteps() {
  return (
    <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Android</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600">
          <li>Open HealthLink in Chrome</li>
          <li>Tap the browser menu</li>
          <li>Choose “Install app” or “Add to Home screen”</li>
        </ol>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">iPhone &amp; iPad</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600">
          <li>Open HealthLink in Safari</li>
          <li>Tap the Share button</li>
          <li>Choose “Add to Home Screen”</li>
        </ol>
      </div>
    </div>
  );
}
