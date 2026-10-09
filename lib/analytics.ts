/**
 * Privacy-conscious analytics for the AI Health Guide.
 *
 * The project has no analytics infrastructure (the admin console's charts are
 * demo data), so this is deliberately minimal instead of adding a platform:
 * per-device counters only, keyed by event name. No message text, names,
 * locations or health details are ever recorded — callers pass event names
 * and nothing else. Counters live in localStorage under a dedicated key and
 * are never transmitted anywhere; read them back with readGuideEvents() if
 * you need numbers from a device (e.g. during user testing).
 *
 * Limitations (accepted for this release): counts are per-device, lost if
 * storage is cleared, and invisible to the team without physical access to a
 * test device. Server-side, the Worker only emits status-code logs.
 */

export type GuideEvent =
  | "health_guide_opened"
  | "care_request_submitted"
  | "clarification_requested"
  | "provider_results_shown"
  | "provider_details_opened"
  | "booking_flow_opened"
  | "no_matching_provider_found"
  | "care_navigation_completed"
  | "ai_request_failed"
  | "safety_response_triggered";

const STORAGE_KEY = "healthlink:guide-events";

export function trackGuideEvent(event: GuideEvent): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const counts: Partial<Record<GuideEvent, number>> = raw ? JSON.parse(raw) : {};
    counts[event] = (counts[event] ?? 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    /* storage unavailable (private mode, SSR) — analytics must never break the UI */
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[guide-event]", event);
  }
}

export function readGuideEvents(): Partial<Record<GuideEvent, number>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
