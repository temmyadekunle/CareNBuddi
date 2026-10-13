"use client";

import { useEffect, useState } from "react";
import { getGreeting, greetingText } from "./greeting";

export type { Greeting } from "./greeting";

function currentHour(): number {
  return new Date().getHours();
}

function nextBoundaryAfter(hour: number): number {
  const boundaries = [5, 12, 17, 21, 29];
  for (const b of boundaries) {
    if (b > hour) return b;
  }
  return 29;
}

function msToNextBoundary(): number {
  const now = new Date();
  const h = now.getHours();
  const next = nextBoundaryAfter(h);
  const nextDate = new Date(now);
  nextDate.setHours(next % 24, 0, 0, 0);
  if (next >= 24) nextDate.setDate(nextDate.getDate() + 1);
  return nextDate.getTime() - now.getTime();
}

export function useGreeting(name?: string): string {
  const [hour, setHour] = useState(() => currentHour());

  useEffect(() => {
    const tick = () => setHour(currentHour());

    const timer =
      msToNextBoundary() > 0
        ? setInterval(tick, Math.min(msToNextBoundary(), 61000))
        : setInterval(tick, 61000);

    const onFocus = () => {
      setHour(currentHour());
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, []);

  return greetingText(hour, name);
}

export { getGreeting };
