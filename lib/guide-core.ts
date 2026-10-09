/**
 * CareNBuddi AI Health Guide — shared core.
 *
 * Dependency-free on purpose: it is imported by BOTH the Next.js app bundle
 * and the Cloudflare Worker script, so provider categories, supported
 * locations, emergency signals and the AI reply contract each have exactly
 * one source of truth. Nothing here reads the network, storage or the DOM.
 */

/* ------------------------------------------------------------------ categories */

export const GUIDE_CATEGORIES = [
  "Hospital",
  "Clinic",
  "Primary health centre",
  "Laboratory",
  "Pharmacy",
  "Diagnostic centre",
  "Mental health service",
  "Maternal health service",
  "Professional",
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export function normalizeCategory(value: unknown): GuideCategory | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  for (const category of GUIDE_CATEGORIES) {
    if (category.toLowerCase() === v) return category;
  }
  const aliases: Record<string, GuideCategory> = {
    phc: "Primary health centre",
    "primary health centre (phc)": "Primary health centre",
    "primary healthcare centre": "Primary health centre",
    "health centre": "Primary health centre",
    lab: "Laboratory",
    labs: "Laboratory",
    "medical laboratory": "Laboratory",
    "mental health": "Mental health service",
    psychiatrist: "Mental health service",
    psychologist: "Mental health service",
    pharmacyanddrugstore: "Pharmacy",
    "drug store": "Pharmacy",
    drugstore: "Pharmacy",
    chemist: "Pharmacy",
    doctor: "Professional",
    nurse: "Professional",
    physician: "Professional",
    midwife: "Professional",
    "health worker": "Professional",
    "health educator": "Professional",
    maternal: "Maternal health service",
    antenatal: "Maternal health service",
    maternity: "Maternal health service",
  };
  return aliases[v] ?? null;
}

export function isGuideCategory(value: unknown): value is GuideCategory {
  return normalizeCategory(value) !== null;
}

/* ------------------------------------------------------------------ intents */

export const GUIDE_INTENTS = [
  "health_information",
  "find_provider",
  "find_service",
  "appointment_navigation",
  "unsupported_request",
] as const;

export type GuideIntent = (typeof GUIDE_INTENTS)[number];

export function isGuideIntent(value: unknown): value is GuideIntent {
  return typeof value === "string" && (GUIDE_INTENTS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ locations */

/** All 36 Nigerian states plus the FCT (the app calls it "Abuja"). */
export const GUIDE_STATES: readonly string[] = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Abuja",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export function normalizeState(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/\s+state$/, "");
  if (!v) return null;
  const aliases: Record<string, string> = {
    fct: "Abuja",
    "federal capital territory": "Abuja",
    "capital territory": "Abuja",
    "lago island": "Lagos",
  };
  const alias = aliases[v];
  if (alias) return alias;
  for (const state of GUIDE_STATES) {
    if (state.toLowerCase() === v) return state;
  }
  return null;
}

/* ------------------------------------------------------------------ safety */

/**
 * Deterministic emergency signals. This is layer 1 of the safety pathway and
 * runs BEFORE any model call (client pre-check and again in the Worker), so
 * emergency handling never depends on an LLM. Patterns are intentionally
 * literal and conservative: red-flag symptoms and explicit crisis wording
 * only, so routine questions never trip them.
 */
const EMERGENCY_PATTERNS: readonly RegExp[] = [
  /\bchest (pain|tightness|pressure)\b/,
  /\bpressure in (my |the )?chest\b/,
  /\b(heart attack|cardiac arrest)\b/,
  /\b(can'?t|cannot|hard to|struggling to|trouble (with|in))\s+(breathe|breathing)\b/,
  /\bshortness of breath\b/,
  /\bnot breathing\b/,
  /\b(stop(ped)? breathing)\b/,
  /\b(choked|choking|can'?t swallow)\b/,
  /\b(unconscious|unresponsive|passed out|fainted|black ?ed? ?out)\b/,
  /\b(won'?t wake|can'?t wake|not waking up)\b/,
  /\b(severe|heavy|uncontrolled|too much)\s+bleeding\b/,
  /\b(bleeding (heavily|non-?stop)|won'?t stop bleeding)\b/,
  /\b(stroke|face (drooping|droop|falling)|slurred speech)\b/,
  /\b(seizure|convulsion|fitting)\b/,
  /\b(suicidal|kill myself|end my life|want to die|commit suicide|take my life)\b/,
  /\b(overdose|took too many|too many (pills|tablets|medicines))\b/,
  /\b(severe allergic|anaphylax|throat (closing|swelling)|lips? (swelling|swollen))\b/,
  /\b(paraly|paralysis|one side (of|goes) numb)\b/,
  /\b(baby|infant|child) (is )?(not breathing|choking|unconscious)\b/,
  /\b(miscarriage|haemorrhag|hemorrhag)\b/,
  /\bambulance\b/,
  /\bemergency (help|care|case|situation)\b/,
];

export function containsEmergencySignal(text: string): boolean {
  const s = text.toLowerCase();
  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(s));
}

export const EMERGENCY_RESPONSE_TEXT =
  "This may be a medical emergency. Stop here and get urgent help now: call your local " +
  "emergency number immediately (112 in Nigeria), or go to the nearest emergency room. " +
  "Do not wait for a reply from this assistant.";

/* ------------------------------------------------------------------ replies */

export interface GuideReply {
  intent: GuideIntent;
  category: GuideCategory | null;
  state: string | null;
  preferences: string[];
  response: string;
  needs_clarification: boolean;
  safety: boolean;
}

const MAX_RESPONSE_CHARS = 900;
const MAX_PREFERENCES = 3;

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1] : trimmed;
}

/**
 * Validates an AI-produced reply against application rules. Returns null when
 * the reply is unusable (bad JSON, unknown intent, missing response text) so
 * callers can fail honestly instead of rendering arbitrary model output.
 * Location values that do not match a supported state are dropped rather than
 * failing the whole reply — the request simply proceeds without a location
 * preference. Unknown categories fail the reply: showing results for the
 * wrong category would be worse than an explicit retry.
 */
export function parseGuideReply(raw: unknown): GuideReply | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(stripCodeFence(raw));
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;

  const intent = isGuideIntent(obj.intent) ? obj.intent : null;
  if (!intent) return null;

  const response = typeof obj.response === "string" ? obj.response.trim() : "";
  if (!response || response.length > MAX_RESPONSE_CHARS) return null;

  const category =
    obj.category === undefined || obj.category === null || obj.category === ""
      ? null
      : normalizeCategory(obj.category);
  if (
    (obj.category !== undefined && obj.category !== null && obj.category !== "") &&
    category === null
  ) {
    return null;
  }

  const state =
    obj.state === undefined || obj.state === null || obj.state === ""
      ? null
      : normalizeState(obj.state);

  const preferences = Array.isArray(obj.preferences)
    ? obj.preferences
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .map((p) => p.trim().slice(0, 60))
        .slice(0, MAX_PREFERENCES)
    : [];

  return {
    intent,
    category,
    state,
    preferences,
    response,
    needs_clarification: obj.needs_clarification === true,
    safety: obj.safety === true || containsEmergencySignal(response),
  };
}

/* ------------------------------------------------------------------ local fallback */

export interface LocalHint {
  category?: GuideCategory;
  q?: string;
}

/**
 * Keyword hint used ONLY when the AI endpoint is unavailable or
 * unconfigured. It never talks to a model: it maps obvious service words to
 * the existing Find Care filters so the user can continue with the normal
 * search. Kept deliberately small — anything smarter belongs to the AI path.
 */
export function localCategoryHint(text: string): LocalHint | null {
  const s = text.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(s);
  if (has(/\b(phc|primary health|health centre|health center)\b/)) return { category: "Primary health centre" };
  if (has(/\b(laboratory|labs?|blood test|medical test)\b/)) return { category: "Laboratory" };
  if (has(/\b(pharmacy|drug ?store|chemist|medicine|medication)\b/)) return { category: "Pharmacy" };
  if (has(/\b(diagnostic|scan|ultrasound|x-?ray)\b/)) return { category: "Diagnostic centre" };
  if (has(/\b(mental|psychiatr|psycholog|counsell|counsel|therapy|anxiety|depress)\b/)) {
    return { category: "Mental health service" };
  }
  if (has(/\b(antenatal|maternal|maternity|pregnan|midwif)\b/)) return { category: "Maternal health service" };
  if (has(/\b(hospital|medical center|medical centre)\b/)) return { category: "Hospital" };
  if (has(/\bclinic\b/)) return { category: "Clinic" };
  if (has(/\b(doctor|physician|specialist|nurse|health worker|health educator)\b/)) {
    const q = has(/\bnurse\b/) ? "nurse" : has(/\bhealth educator\b/) ? "health education" : "doctor";
    return { q };
  }
  return null;
}
