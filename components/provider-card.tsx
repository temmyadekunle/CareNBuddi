"use client";

import Link from "next/link";
import { Avatar, Badge, Button, Card } from "@/components/app-ui";
import {
  CalendarIcon,
  ChevronRightIcon,
  PinIcon,
} from "@/components/icons";
import {
  COST_TIER_LABELS,
  PROVIDER_CATEGORY_LABELS,
  providerCostTier,
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

export function ProviderCard({
  provider,
  onBook,
  onDetails,
}: {
  provider: Provider;
  onBook?: () => void;
  onDetails?: () => void;
}) {
  const t = useT();
  const lang = useLang();

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
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
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

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <Button className="flex-1" onClick={onBook}>
          <CalendarIcon className="h-4 w-4" />
          {t("fc_book", "Request visit")}
        </Button>
        <Link
          href={`/find-care/${provider.id}`}
          onClick={onDetails}
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