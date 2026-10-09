"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Chip, IconButton, inputClass } from "@/components/app-ui";
import { BookSheet } from "@/components/book-sheet";
import { ChatIcon, ChevronRightIcon, CloseIcon, EmergencyIcon } from "@/components/icons";
import { ProviderCard } from "@/components/provider-card";
import { trackGuideEvent } from "@/lib/analytics";
import {
  PROVIDER_CATEGORY_LABELS,
  type Provider,
} from "@/lib/content";
import {
  containsEmergencySignal,
  localCategoryHint,
  type GuideCategory,
  type GuideReply,
} from "@/lib/guide-core";
import { useLang, useT } from "@/lib/i18n";
import { KEYS, seedProviders, useStoredCollection } from "@/lib/storage";

type Mode = "ask" | "find";

interface GuideAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

type Bubble =
  | { id: string; role: "user"; kind: "text"; text: string }
  | {
      id: string;
      role: "guide";
      kind: "text" | "note" | "error" | "safety";
      text: string;
      actions?: GuideAction[];
    }
  | {
      id: string;
      role: "guide";
      kind: "providers";
      text: string;
      providers: Provider[];
      categoryLabel: string;
      stateLabel: string | null;
      preferences: string[];
      actions: GuideAction[];
    };

type TextBubble = Extract<Bubble, { role: "user" }> | Extract<Bubble, { role: "guide"; kind: "text" }>;

const SUGGESTIONS: Record<Mode, string[]> = {
  ask: [
    "How do I book an appointment?",
    "What services can you help with?",
    "I'm not sure what I need",
  ],
  find: [
    "Find a doctor",
    "Find a laboratory",
    "Find a pharmacy",
    "Find a mental health professional",
  ],
};

let seq = 0;
function nextId(): string {
  seq += 1;
  return `m${seq}`;
}

function findCareUrl(opts: { category?: GuideCategory; state?: string | null; q?: string }): string {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  if (opts.state) params.set("state", opts.state);
  if (opts.q) params.set("q", opts.q);
  const query = params.toString();
  return query ? `/find-care?${query}` : "/find-care";
}

/**
 * CareNBuddi AI Health Guide — Home card plus the in-app assistant panel.
 *
 * The assistant interprets requests through a server-side Worker endpoint
 * (/api/health-guide) and always renders provider results from the same
 * directory the Find Care page reads (device storage seeded from the app's
 * provider dataset) — never from the model. The emergency pathway runs on a
 * deterministic client pre-check before any network call, with a second
 * pre-AI check in the Worker.
 */
export function HealthGuide() {
  const t = useT();
  const lang = useLang();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ask");
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Provider | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentRef = useRef("");

  const catLabel = (value: GuideCategory) =>
    PROVIDER_CATEGORY_LABELS[lang]?.[value] ?? value;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && booking === null) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open, booking]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);

  const welcome = (forMode: Mode): Bubble => ({
    id: nextId(),
    role: "guide",
    kind: "text",
    text:
      forMode === "find"
        ? t(
            "hg_welcome_find",
            "Hi! Tell me what kind of care you need — a doctor, nurse, laboratory, pharmacy, mental health support or a facility — plus your location if you like. I'll point you to real services in the CareNBuddi directory. This is care navigation, not diagnosis.",
          )
        : t(
            "hg_welcome_ask",
            "Hi! I'm the CareNBuddi Health Guide. Tell me what you need in your own words and I'll help you find the right service or next step. I provide health information and care navigation — not diagnosis or treatment.",
          ),
  });

  const openGuide = (nextMode: Mode) => {
    setMode(nextMode);
    setOpen(true);
    trackGuideEvent("health_guide_opened");
    setMessages((prev) => (prev.length === 0 ? [welcome(nextMode)] : prev));
  };

  const push = (bubble: Bubble) => setMessages((prev) => [...prev, bubble]);

  const pushSafety = () => {
    trackGuideEvent("safety_response_triggered");
    push({
      id: nextId(),
      role: "guide",
      kind: "safety",
      text: t(
        "hg_safety",
        "This may be a medical emergency. Stop here and get urgent help now: call 112 or go to the nearest emergency room. Do not wait for a reply from this assistant.",
      ),
    });
  };

  const buildHistory = () =>
    messages
      .filter((m): m is TextBubble => m.kind === "text")
      .slice(-8)
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        text: m.text.slice(0, 400),
      }));

  const handleReply = (reply: GuideReply) => {
    if (reply.safety) {
      pushSafety();
      return;
    }

    if (reply.needs_clarification) {
      trackGuideEvent("clarification_requested");
      push({ id: nextId(), role: "guide", kind: "text", text: reply.response });
      return;
    }

    if (reply.intent === "find_provider" || reply.intent === "find_service") {
      if (!reply.category) {
        push({ id: nextId(), role: "guide", kind: "text", text: reply.response });
        return;
      }

      const categoryLabel = catLabel(reply.category);
      const matches = providers
        .filter((p) => p.category === reply.category)
        .filter((p) => !reply.state || p.state === reply.state)
        .sort(
          (a, b) =>
            Number(b.verified) - Number(a.verified) || (b.rating ?? 0) - (a.rating ?? 0),
        );

      if (matches.length === 0) {
        trackGuideEvent("no_matching_provider_found");
        const where = reply.state
          ? t("hg_empty_in", " in {state}").replace("{state}", reply.state)
          : "";
        const actions: GuideAction[] = [];
        if (reply.state) {
          actions.push({
            label: t("hg_empty_all", "Search all locations"),
            href: findCareUrl({ category: reply.category }),
            onClick: () => trackGuideEvent("care_navigation_completed"),
            primary: true,
          });
        }
        actions.push({
          label: t("hg_empty_browse", "Open Find Care"),
          href: "/find-care",
          onClick: () => trackGuideEvent("care_navigation_completed"),
          primary: !reply.state,
        });
        push({
          id: nextId(),
          role: "guide",
          kind: "note",
          text: t("hg_empty_results", "No {category} found{where} in the CareNBuddi directory.")
            .replace("{category}", categoryLabel)
            .replace("{where}", where),
          actions,
        });
        return;
      }

      trackGuideEvent("provider_results_shown");
      push({
        id: nextId(),
        role: "guide",
        kind: "providers",
        text: reply.response,
        providers: matches.slice(0, 4),
        categoryLabel,
        stateLabel: reply.state,
        preferences: reply.preferences,
        actions: [
          {
            label: t("hg_see_all", "See all results in Find Care"),
            href: findCareUrl({ category: reply.category, state: reply.state }),
            onClick: () => trackGuideEvent("care_navigation_completed"),
            primary: true,
          },
        ],
      });
      return;
    }

    if (reply.intent === "appointment_navigation") {
      push({
        id: nextId(),
        role: "guide",
        kind: "text",
        text: reply.response,
        actions: [
          { label: t("hg_open_appts", "Open my appointments"), href: "/appointments" },
          { label: t("hg_find_to_book", "Find a provider to book"), href: "/find-care" },
        ],
      });
      return;
    }

    /* health_information and unsupported_request */
    push({
      id: nextId(),
      role: "guide",
      kind: "text",
      text: reply.response,
      actions:
        reply.intent === "unsupported_request"
          ? [{ label: t("hg_open_findcare", "Open Find Care"), href: "/find-care" }]
          : undefined,
    });
  };

  const handleFallback = (sourceText: string, unavailable: boolean) => {
    const hint = localCategoryHint(sourceText);
    const actions: GuideAction[] = [];
    if (hint?.category) {
      actions.push({
        label: t("hg_fb_search_cat", "Search {category} in Find Care")
          .replace("{category}", catLabel(hint.category)),
        href: findCareUrl({ category: hint.category }),
        onClick: () => trackGuideEvent("care_navigation_completed"),
        primary: true,
      });
    } else if (hint?.q) {
      actions.push({
        label: t("hg_fb_search_q", 'Search "{q}" in Find Care').replace("{q}", hint.q),
        href: findCareUrl({ q: hint.q }),
        onClick: () => trackGuideEvent("care_navigation_completed"),
        primary: true,
      });
    }
    actions.push({
      label: t("hg_fb_browse", "Browse Find Care"),
      href: "/find-care",
      onClick: () => trackGuideEvent("care_navigation_completed"),
      primary: actions.length === 0,
    });
    push({
      id: nextId(),
      role: "guide",
      kind: "note",
      text: unavailable
        ? t(
            "hg_unavailable",
            "The AI health guide isn't available on this deployment, so I can't interpret requests right now. Your normal Find Care search still works.",
          )
        : t(
            "hg_unconfigured",
            "The AI assistant isn't connected on this deployment, so I can't interpret requests right now. Your normal Find Care search still works.",
          ),
      actions,
    });
  };

  const errorBubble = (textKey: string, fallback: string, retry: () => void): Bubble => ({
    id: nextId(),
    role: "guide",
    kind: "error",
    text: t(textKey, fallback),
    actions: [
      { label: t("hg_retry", "Try again"), onClick: retry, primary: true },
      { label: t("hg_open_findcare", "Open Find Care"), href: "/find-care" },
    ],
  });

  const sendMessage = async (raw: string, opts?: { retry?: boolean }) => {
    const text = raw.trim();
    if (!text || busy) return;

    lastSentRef.current = text;
    trackGuideEvent("care_request_submitted");
    if (!opts?.retry) {
      push({ id: nextId(), role: "user", kind: "text", text });
    }
    setInput("");

    /* Layer 1 of the safety pathway — deterministic, before any network call. */
    if (containsEmergencySignal(text)) {
      pushSafety();
      return;
    }

    const history = buildHistory();
    setBusy(true);
    try {
      const res = await fetch("/api/health-guide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (res.status === 404 || res.status === 405) {
        trackGuideEvent("ai_request_failed");
        handleFallback(text, true);
        return;
      }
      if (res.status === 429) {
        trackGuideEvent("ai_request_failed");
        push(
          errorBubble(
            "hg_err_rate",
            "Too many requests right now. Wait a moment and try again.",
            () => void sendMessage(lastSentRef.current, { retry: true }),
          ),
        );
        return;
      }
      if (!res.ok) {
        trackGuideEvent("ai_request_failed");
        push(
          errorBubble(
            "hg_err_ai",
            "The AI service had a problem. Try again, or continue with Find Care.",
            () => void sendMessage(lastSentRef.current, { retry: true }),
          ),
        );
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        configured?: boolean;
        reply?: GuideReply;
        error?: string;
      } | null;

      if (!data || data.ok !== true) {
        trackGuideEvent("ai_request_failed");
        push(
          errorBubble(
            "hg_err_understand",
            "I couldn't process that response. Try rephrasing, or continue with Find Care.",
            () => void sendMessage(lastSentRef.current, { retry: true }),
          ),
        );
        return;
      }

      if (data.configured === false) {
        handleFallback(text, false);
        return;
      }

      if (data.reply) {
        handleReply(data.reply);
      } else {
        trackGuideEvent("ai_request_failed");
        push(
          errorBubble(
            "hg_err_understand",
            "I couldn't process that response. Try rephrasing, or continue with Find Care.",
            () => void sendMessage(lastSentRef.current, { retry: true }),
          ),
        );
      }
    } catch {
      trackGuideEvent("ai_request_failed");
      push(
        errorBubble(
          "hg_err_network",
          "You may be offline. Check your connection and try again, or continue with Find Care.",
          () => void sendMessage(lastSentRef.current, { retry: true }),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const suggestions = SUGGESTIONS[mode];

  return (
    <>
      {/* Home card ---------------------------------------------------- */}
      <Card className="border-brand-200 bg-brand-50/60">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
            <ChatIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {t("hg_card_title", "CareNBuddi Health Guide")}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-600">
              {t(
                "hg_card_sub",
                "Not sure where to start? Tell us what you need, and we'll help you find the next step.",
              )}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => openGuide("ask")}>
            {t("hg_ask", "Ask a Health Question")}
          </Button>
          <Button tone="secondary" className="flex-1" onClick={() => openGuide("find")}>
            {t("hg_find", "Help Me Find Care")}
          </Button>
        </div>
      </Card>

      {/* Assistant panel ---------------------------------------------- */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("hg_title", "CareNBuddi Health Guide")}
          className="absolute inset-0 z-40 flex flex-col bg-white"
        >
          <header className="z-10 flex shrink-0 items-center gap-2.5 border-b border-slate-200/70 bg-white/95 px-3 py-2.5 backdrop-blur-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
              <ChatIcon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                {t("hg_title", "CareNBuddi Health Guide")}
              </h2>
              <p className="truncate text-[11px] text-slate-500">
                {t("hg_header_note", "Health information & care navigation — not a diagnosis")}
              </p>
            </div>
            <IconButton
              label={t("hg_close", "Close health guide")}
              onClick={() => setOpen(false)}
              className="h-9 w-9"
            >
              <CloseIcon className="h-4.5 w-4.5" />
            </IconButton>
          </header>

          <div
            ref={scrollRef}
            aria-live="polite"
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-slate-50/60 px-4 py-3"
          >
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "user" ? (
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2.5 text-sm text-white">
                    {message.text}
                  </div>
                ) : message.kind === "safety" ? (
                  <div className="max-w-[96%] rounded-2xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-sm leading-relaxed text-rose-900">
                    <div className="flex items-start gap-2">
                      <EmergencyIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-600" />
                      <span>{message.text}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <a
                        href="tel:112"
                        className="tap inline-flex min-h-9 items-center rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white"
                      >
                        {t("home_call_112", "Call 112")}
                      </a>
                      <Link
                        href="/emergency"
                        onClick={() => setOpen(false)}
                        className="tap inline-flex min-h-9 items-center rounded-xl border border-rose-300 bg-white px-3.5 text-xs font-semibold text-rose-700"
                      >
                        {t("em_title", "Get Help Now")}
                      </Link>
                    </div>
                  </div>
                ) : message.kind === "providers" ? (
                  <div className="space-y-2.5">
                    <div className="max-w-[96%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
                      {message.text}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="brand">
                        {message.categoryLabel}
                        {message.stateLabel ? ` · ${message.stateLabel}` : ""}
                      </Badge>
                      {message.preferences.map((pref) => (
                        <Badge key={pref} tone="slate">
                          {pref}
                        </Badge>
                      ))}
                    </div>
                    {message.providers.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onBook={() => {
                          trackGuideEvent("booking_flow_opened");
                          setBooking(provider);
                        }}
                        onDetails={() => trackGuideEvent("provider_details_opened")}
                      />
                    ))}
                    <GuideActions actions={message.actions} onNavigate={() => setOpen(false)} />
                  </div>
                ) : (
                  <div
                    className={
                      message.kind === "error"
                        ? "max-w-[96%] rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-relaxed text-rose-800"
                        : message.kind === "note"
                          ? "max-w-[96%] rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700"
                          : "max-w-[96%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800"
                    }
                  >
                    {message.text}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2.5">
                        <GuideActions actions={message.actions} onNavigate={() => setOpen(false)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-3 w-fit" aria-label={t("hg_thinking", "Thinking")}>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            )}
            <div />
          </div>

          <div className="shrink-0 border-t border-slate-200/70 bg-white">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-2.5">
              {suggestions.map((suggestion) => (
                <Chip key={suggestion} onClick={() => void sendMessage(suggestion)}>
                  {suggestion}
                </Chip>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(input);
              }}
              className="flex items-end gap-2 px-3 py-2.5"
            >
              <label htmlFor="guide-input" className="sr-only">
                {t("hg_input_label", "Describe the care you need")}
              </label>
              <input
                id="guide-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                enterKeyHint="send"
                placeholder={
                  mode === "find"
                    ? t("hg_ph_find", "What kind of care do you need?")
                    : t("hg_ph_ask", "Describe what you need…")
                }
                className={`${inputClass} min-h-11 flex-1`}
              />
              <Button
                type="submit"
                className="min-h-11 w-11 shrink-0 px-0"
                disabled={busy || input.trim().length === 0}
                aria-label={t("hg_send", "Send")}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </Button>
            </form>
            <p className="px-3 pb-2 text-center text-[10px] leading-snug text-slate-400">
              {t(
                "hg_disclaimer",
                "General health information and care navigation only — not diagnosis or treatment. Emergency? Call 112.",
              )}
            </p>
          </div>

          <BookSheet
            provider={booking}
            open={booking !== null}
            onClose={() => setBooking(null)}
          />
        </div>
      )}
    </>
  );
}

function GuideActions({
  actions,
  onNavigate,
}: {
  actions: GuideAction[];
  onNavigate: () => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const content = (
          <>
            {action.label}
            {action.href && <ChevronRightIcon className="h-3.5 w-3.5" />}
          </>
        );
        if (action.href) {
          return (
            <Link
              key={action.label}
              href={action.href}
              onClick={() => {
                action.onClick?.();
                onNavigate();
              }}
              className={`tap inline-flex min-h-9 items-center gap-1 rounded-xl px-3.5 text-xs font-semibold ${
                action.primary
                  ? "bg-brand-700 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300"
              }`}
            >
              {content}
            </Link>
          );
        }
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`tap inline-flex min-h-9 items-center gap-1 rounded-xl px-3.5 text-xs font-semibold ${
              action.primary
                ? "bg-brand-700 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300"
            }`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
