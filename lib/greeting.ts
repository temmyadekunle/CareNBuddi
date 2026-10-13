export type Greeting = "morning" | "afternoon" | "evening" | "late";

export interface GreetingResult {
  key: string;
  text: (name?: string) => string;
}

const BOUNDARIES: [number, Greeting][] = [
  [5, "morning"],
  [12, "afternoon"],
  [17, "evening"],
  [21, "late"],
];

export function getGreeting(hour: number): Greeting {
  if (hour >= 21 || hour < 5) return "late";
  if (hour >= 17) return "evening";
  if (hour >= 12) return "afternoon";
  return "morning";
}

export function greetingForHour(hour: number, name?: string): GreetingResult {
  const g = getGreeting(hour);
  const t = (n?: string) => {
    const target = n?.trim();
    if (target) {
      return g === "late" ? `Welcome back, ${target}.` : `Good ${g}, ${target}.`;
    }
    return g === "late" ? "Welcome back." : `Good ${g}.`;
  };
  return {
    key: `greeting_${g}`,
    text: t,
  };
}

export function greetingKey(hour: number): string {
  return greetingForHour(hour).key;
}

export function greetingText(hour: number, name?: string): string {
  return greetingForHour(hour, name).text(name);
}
