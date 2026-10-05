"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Avatar, Badge, Button, Card, Rating } from "@/components/app-ui";
import {
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  MessageIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
} from "@/components/icons";
import { formatDay, nextAvailableSlots } from "@/lib/appointments";
import {
  COST_TIER_LABELS,
  PROVIDER_CATEGORY_LABELS,
  providerCostTier,
  whatsappUrl,
  type CostTier,
  type Provider,
} from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";

const COST_TONE: Record<CostTier, "green" | "amber" | "rose"> = {
  low: "green",
  mid: "amber",
  high: "rose",
};

const ICON_ACTION =
  "tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700";

const subscribeToNothing = () => () => {};

const readHydrated = () => true;
const readServer = () => false;

export function ProviderCard({
  provider,
  onBook,
}: {
  provider: Provider;
  onBook?: () => void;
}) {
  const t = useT();
  const lang = useLang();

  const hydrated = useSyncExternalStore(subscribeToNothing, readHydrated, readServer);
  const slot = hydrated ? nextAvailableSlots(1)[0] : "";
  const slotLabel = slot
    ? `${formatDay(slot.slice(0, 10))} · ${slot.slice(11, 16)}`
    : t("fc_slots_call", "Call for available times");

  const tier = providerCostTier(provider.category);
  const categoryLabel =
    PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <Avatar name={provider.name} role="doctor" size={44} seed={provider.name.length} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {provider.name}
              </p>
              <p className="truncate text-xs text-slate-500">{categoryLabel}</p>
            </div>
            {provider.verified && (
              <Badge tone="brand">
                <ShieldIcon className="mr-1 h-3 w-3" />
                {t("f_verified", "Verified")}
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {provider.rating !== undefined && <Rating value={provider.rating} />}
            <span className="inline-flex min-w-0 max-w-[11rem] items-center gap-1 text-xs text-slate-500">
              <PinIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{provider.city}</span>
            </span>
            <Badge tone={COST_TONE[tier]}>{COST_TIER_LABELS[tier]}</Badge>
            {provider.emergency && <Badge tone="rose">{t("f_open_24", "Open 24 hours")}</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {provider.services.slice(0, 3).map((service) => (
          <span
            key={service}
            className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
          >
            {service}
          </span>
        ))}
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <ClockIcon className="h-3.5 w-3.5 shrink-0 text-brand-600" />
        <span className="truncate">
          <span className="font-semibold text-slate-700">
            {t("fc_next_slot", "Next available")}
          </span>{" "}
          {slotLabel}
        </span>
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <Button className="flex-1" onClick={onBook}>
          <CalendarIcon className="h-4 w-4" />
          {t("fc_book", "Book")}
        </Button>
        <a
          href={`tel:${provider.phone}`}
          aria-label={t("f_call", "Call")}
          title={t("f_call", "Call")}
          className={ICON_ACTION}
        >
          <PhoneIcon className="h-[1.15rem] w-[1.15rem]" />
        </a>
        <a
          href={whatsappUrl(provider)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("f_whatsapp", "WhatsApp")}
          title={t("f_whatsapp", "WhatsApp")}
          className={ICON_ACTION}
        >
          <MessageIcon className="h-[1.15rem] w-[1.15rem]" />
        </a>
        <Link
          href={`/find-care/${provider.id}`}
          aria-label={t("fc_details", "Details")}
          title={t("fc_details", "Details")}
          className={ICON_ACTION}
        >
          <ChevronRightIcon className="h-[1.15rem] w-[1.15rem]" />
        </Link>
      </div>
    </Card>
  );
}