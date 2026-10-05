"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  ListRow,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { CheckIcon, ClockIcon, PinIcon, StethoscopeIcon } from "@/components/icons";
import { seedProviderFor } from "@/lib/content";
import { useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedProviderRequests,
  seedProviders,
  seedUsers,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import type { Booking } from "@/lib/types";

const STATUS_TONE: Record<Booking["status"], "amber" | "brand" | "green" | "slate"> = {
  new: "amber",
  contacted: "brand",
  confirmed: "green",
  completed: "green",
  cancelled: "slate",
};

export default function ProviderPortalPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [providers, setProviders] = useStoredCollection(KEYS.providers, seedProviders);
  const [requests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);
  const [bookings, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const me = users.find((u) => u.id === session.userId);
  const isStaff = me?.role === "provider" || me?.role === "admin";

  const email = me?.email.toLowerCase() ?? "";
  const approvedReq = requests.find((r) => r.email.toLowerCase() === email && r.status === "approved");
  const myId = approvedReq ? `prv-${approvedReq.id}` : seedProviderFor(email)?.id;
  const myProvider = myId ? providers.find((p) => p.id === myId) : undefined;

  const [name, setName] = useState(() => myProvider?.name ?? "");
  const [phone, setPhone] = useState(() => myProvider?.phone ?? "");
  const [hours, setHours] = useState(() => myProvider?.hours ?? "");
  const [address, setAddress] = useState(() => myProvider?.address ?? "");
  const [description, setDescription] = useState(() => myProvider?.description ?? "");
  const [servicesText, setServicesText] = useState(() => myProvider?.services.join(", ") ?? "");

  const myRequests = bookings.filter((b) => b.providerId === myId);
  const hasRequest = requests.some((r) => r.email.toLowerCase() === email);
  const newCount = myRequests.filter((b) => b.status === "new").length;

  if (!session.userId || !me || !isStaff) {
    return (
      <Screen>
        <SectionHeader title={t("pv_title", "Provider")} subtitle={t("pv_guard", "Sign in as a provider or admin to continue.")} />
        <Card className="mt-4 text-center">
          <EmptyState
            icon={<StethoscopeIcon className="h-6 w-6" />}
            title={t("pvx_staff_only", "Provider access only")}
            body={t("pv_guard", "Sign in as a provider or admin to continue.")}
            action={
              <Link href="/account" className="inline-block min-h-11">
                <Button className="min-h-11">{t("a_signin", "Sign in")}</Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  const save = () => {
    if (!myProvider) return;
    setProviders((prev) =>
      prev.map((p) =>
        p.id === myProvider.id
          ? {
              ...p,
              name: name || p.name,
              phone: phone || p.phone,
              hours: hours || p.hours,
              address: address || p.address,
              description: description || p.description,
              services: servicesText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : p,
      ),
    );
    push(t("c_status", "Updated"), "success");
  };

  const setBookingStatus = (id: string, status: Booking["status"]) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  if (!myProvider) {
    return (
      <Screen>
        <SectionHeader
          title={t("pv_title", "Provider")}
          subtitle={t("pv_sub", "Manage your profile and requests.")}
        />
        <Card className="mt-4 text-center">
          <EmptyState
            icon={<StethoscopeIcon className="h-6 w-6" />}
            title={hasRequest ? t("pv_pending", "Registration pending") : t("pv_none", "No facility linked")}
            body={t("pv_pending_d", "Our team reviews each registration before the portal opens.")}
            action={
              <Link href="/provider/register" className="inline-block min-h-11">
                <Button className="min-h-11">{t("pv_register", "Register your facility")}</Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("pv_title", "Provider")}
        subtitle={`${t("pv_sub", "Manage your profile and requests.")} · ${me.name}`}
      />

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{t("pv_profile", "Profile")}</h2>
          <Badge tone="green">
            <CheckIcon className="mr-1 h-3 w-3" />
            {t("f_verified", "Verified")}
          </Badge>
        </div>

        <div className="mt-3 space-y-3">
          <Field label={t("a_name", "Full name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("a_phone", "Phone")}>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("f_hours", "Hours")}>
              <input value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label={t("prg_address", "Address")}>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("pv_services_label", "Services (comma separated)")}>
            <input value={servicesText} onChange={(e) => setServicesText(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("pv_about", "About")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
        </div>

        <Button full className="mt-4" onClick={save}>
          {t("pv_save", "Save changes")}
        </Button>
      </Card>

      <section className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{t("pv_requests", "Requests")}</h2>
          <Badge tone="amber">{`${newCount} ${t("pv_new_req", "new")}`}</Badge>
        </div>

        <div className="mt-2 space-y-2.5">
          {myRequests.length === 0 ? (
            <EmptyState
              icon={<ClockIcon className="h-6 w-6" />}
              title={t("c_none", "Nothing here yet")}
              body={t("pvx_no_requests", "Patient requests for your facility appear here.")}
            />
          ) : (
            myRequests.map((b) => (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{b.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{b.phone}</p>
                    <p className="mt-1 text-xs text-slate-600">{b.message || t("pv_no_message", "No message")}</p>
                    {b.date && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                        <PinIcon className="h-3 w-3 shrink-0" />
                        {b.date}
                      </p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                </div>

                <div className="mt-3 flex gap-2">
                  {b.status === "new" && (
                    <Button full onClick={() => setBookingStatus(b.id, "contacted")}>
                      {t("pv_confirm", "Mark contacted")}
                    </Button>
                  )}
                  {b.status === "contacted" && (
                    <Button full tone="secondary" onClick={() => setBookingStatus(b.id, "confirmed")}>
                      {t("pv_confirm_done", "Mark confirmed")}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <div className="mt-5">
        <ListRow
          title={t("pv_register", "Register your facility")}
          subtitle={t("pvx_register_d", "Update or add another location")}
          icon={<StethoscopeIcon className="h-5 w-5" />}
          href="/provider/register"
        />
      </div>
    </Screen>
  );
}