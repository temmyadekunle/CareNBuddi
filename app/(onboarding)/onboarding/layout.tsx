import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Splash } from "@/components/splash";

export const metadata: Metadata = {
  title: "Welcome to CareNBuddi",
  description:
    "CareNBuddi connects you to verified care near you and keeps your health in one place — Your Health, Your Buddi.",
};

/**
 * Onboarding deliberately lives in its own route group: it renders outside the
 * app shell, so there is no `Screen` wrapper and no bottom navigation here.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Splash />
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </>
  );
}
