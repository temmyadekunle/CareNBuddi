"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  ListRow,
  SectionHeader,
  Segmented,
  Switch,
  useToast,
} from "@/components/app-ui";
import {
  AlertIcon,
  BellIcon,
  ChatIcon,
  EmergencyIcon,
  HelpIcon,
  LanguageIcon,
  LockIcon,
  LogOutIcon,
  MessageIcon,
  PhoneIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  WalletIcon,
} from "@/components/icons";
import { LangSwitcher } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useCloud } from "@/lib/supabase/cloud";
import { KEYS, useSession, useStoredValue } from "@/lib/storage";

export const UNITS_KEY = "healthlink:prefs-units";
export const NOTIFICATIONS_KEY = "healthlink:prefs-notifications";

export type Units = "metric" | "imperial";

export interface NotificationPrefs {
  appointments: boolean;
  medication: boolean;
  tips: boolean;
}

export interface PassportPrefs {
  hmo: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export const PASSPORT_DEFAULTS: PassportPrefs = {
  hmo: "",
  emergencyContact: "",
  emergencyPhone: "",
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  appointments: true,
  medication: true,
  tips: false,
};

const SUPPORT_EMAIL = "support@healthlink.ng";

const TONES = {
  brand: "bg-brand-50 text-brand-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
} as const;

type Tone = keyof typeof TONES;

export function ProfileSettings() {
  const t = useT();
  const router = useRouter();
  const { push } = useToast();
  const cloud = useCloud();
  const [, setSession] = useSession();

  const [units, setUnits] = useStoredValue<Units>(UNITS_KEY, "metric");
  const [notifications, setNotifications] = useStoredValue<NotificationPrefs>(
    NOTIFICATIONS_KEY,
    DEFAULT_NOTIFICATIONS,
  );
  const [passport] = useStoredValue<PassportPrefs>(KEYS.passport, PASSPORT_DEFAULTS);

  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    push(t("a_syncing", "Syncing…"), "info");
    try {
      if (cloud.enabled) await cloud.signOut();
    } catch {
      // the local session is cleared either way
    } finally {
      setSigningOut(false);
    }
    setSession((prev) => ({ ...prev, userId: null }));
    setConfirmOut(false);
    push(t("prof_signed_out", "You are signed out"), "info");
    router.push("/auth/sign-in");
  };

  return (
    <div className="mt-6">
      {/* health preferences --------------------------------------------- */}
      <SectionHeader title={t("prof_health_prefs", "Health preferences")} />
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES.brand}`}>
              <LanguageIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {t("a_language", "Language")}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {t("a_language_d", "Change the language of the dashboard and health content.")}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <LangSwitcher compact />
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{t("prof_units", "Units")}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("prof_units_d", "How weight, height and temperature are shown")}
          </p>
          <div className="mt-2.5">
            <Segmented<Units>
              options={[
                { value: "metric", label: t("prof_units_metric", "Metric (kg)") },
                { value: "imperial", label: t("prof_units_imperial", "Imperial (lb)") },
              ]}
              value={units}
              onChange={setUnits}
            />
          </div>
        </div>

        <ListRow
          href="/passport"
          icon={<WalletIcon className="h-5 w-5" />}
          tone="green"
          title={t("pp_hmo", "Insurance / HMO")}
          subtitle={
            passport.hmo
              ? passport.hmo
              : t("prof_hmo_empty", "Not added yet — set it in your Health Passport")
          }
        />
      </Card>

      {/* notifications ---------------------------------------------------- */}
      <SectionHeader title={t("prof_notifications", "Notifications")} />
      <Card padded={false} className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          <SwitchRow
            icon={<BellIcon className="h-5 w-5" />}
            tone="brand"
            title={t("prof_notif_appt", "Appointment reminders")}
            subtitle={t("prof_notif_appt_d", "A nudge before each booked visit")}
            checked={notifications.appointments}
            onChange={(next) => setNotifications((prev) => ({ ...prev, appointments: next }))}
          />
          <SwitchRow
            icon={<AlertIcon className="h-5 w-5" />}
            tone="amber"
            title={t("prof_notif_meds", "Medication reminders")}
            subtitle={t("prof_notif_meds_d", "Prompts for the reminders you turn on")}
            checked={notifications.medication}
            onChange={(next) => setNotifications((prev) => ({ ...prev, medication: next }))}
          />
          <SwitchRow
            icon={<HelpIcon className="h-5 w-5" />}
            tone="green"
            title={t("prof_notif_tips", "Health tips")}
            subtitle={t("prof_notif_tips_d", "Occasional prevention and screening advice")}
            checked={notifications.tips}
            onChange={(next) => setNotifications((prev) => ({ ...prev, tips: next }))}
          />
        </div>
      </Card>

      {/* privacy & security ---------------------------------------------- */}
      <SectionHeader title={t("prof_privacy", "Privacy & security")} />
      <Card padded={false} className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          <ListRow
            href="/account"
            icon={<SettingsIcon className="h-5 w-5" />}
            tone="brand"
            title={t("prof_account_sync", "Account & sync")}
            subtitle={t(
              "prof_account_sync_d",
              "Back up your records and manage the cloud account",
            )}
          />
          <ListRow
            onClick={() => setPrivacyOpen(true)}
            icon={<ShieldIcon className="h-5 w-5" />}
            tone="green"
            title={t("prof_privacy_notice", "Privacy notice")}
            subtitle={t("prof_privacy_notice_d", "What stays on this device and what syncs")}
          />
          <ListRow
            href="/auth/forgot-password"
            icon={<LockIcon className="h-5 w-5" />}
            tone="slate"
            title={t("prof_change_password", "Change password")}
            subtitle={t("prof_change_password_d", "We email you a secure reset link")}
          />
        </div>
      </Card>

      {/* help & support --------------------------------------------------- */}
      <SectionHeader title={t("prof_help", "Help & support")} />
      <Card padded={false} className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          <ListRow
            href="/emergency"
            icon={<EmergencyIcon className="h-5 w-5" />}
            tone="rose"
            title={t("em_title", "Get Help Now")}
            subtitle={t("em_sub", "Emergency guidance and where to call for help right now.")}
          />
          <ListRow
            href="/ask"
            icon={<ChatIcon className="h-5 w-5" />}
            tone="brand"
            title={t("n_ask", "Ask")}
            subtitle={t("n_ask_d", "A navigator for conditions, care and the platform.")}
          />
          <ListRow
            href={`mailto:${SUPPORT_EMAIL}`}
            icon={<MessageIcon className="h-5 w-5" />}
            tone="slate"
            title={t("prof_contact_support", "Contact support")}
            subtitle={t("prof_support_email", "support@healthlink.ng")}
          />
          <ListRow
            href="/find-care"
            icon={<SearchIcon className="h-5 w-5" />}
            tone="green"
            title={t("n_find", "Find care")}
            subtitle={t("prof_find_d", "Search providers and clinics near you")}
          />
        </div>
      </Card>

      {/* sign out ---------------------------------------------------------- */}
      <Card className="mt-6 overflow-hidden p-0">
        <ListRow
          onClick={() => {
            if (!signingOut) setConfirmOut(true);
          }}
          icon={<LogOutIcon className="h-5 w-5" />}
          tone="rose"
          chevron={false}
          title={t("a_signout", "Sign out")}
          subtitle={t("prof_signout_d", "Your records stay on this device")}
        />
      </Card>

      <BottomSheet
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t("prof_privacy_notice", "Privacy notice")}
        footer={<Button full onClick={() => setPrivacyOpen(false)}>{t("c_save", "Save")}</Button>}
      >
        <div className="space-y-3">
          <PrivacyBlock
            icon={<PhoneIcon className="h-5 w-5" />}
            tone="brand"
            title={t("prof_privacy_local_title", "Stored on this device")}
            body={t(
              "prof_privacy_local_d",
              "By default everything you type — bookings, journal, records, passport and preferences — is written to this phone's local storage only. It is never uploaded.",
            )}
          />
          <PrivacyBlock
            icon={<ShieldIcon className="h-5 w-5" />}
            tone="green"
            title={t("prof_privacy_cloud_title", "Cloud sync only if you connect an account")}
            body={t(
              "prof_privacy_cloud_d",
              "When a CareNBuddi cloud account is connected, your records are encrypted in transit and synced so you can use the app on another device. Open Account & sync to connect or disconnect.",
            )}
          />
          <PrivacyBlock
            icon={<EmergencyIcon className="h-5 w-5" />}
            tone="rose"
            title={t("prof_privacy_share_title", "What providers see")}
            body={t(
              "prof_privacy_share_d",
              "A provider only sees the name and phone you give them when you request a visit, plus whatever you choose to show from your Health Passport.",
            )}
          />
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOut}
        title={t("prof_signout_title", "Sign out of CareNBuddi?")}
        body={t(
          "prof_signout_body",
          "Your saved records stay on this device. You can sign back in at any time.",
        )}
        confirmLabel={t("a_signout", "Sign out")}
        cancelLabel={t("c_cancel", "Cancel")}
        onConfirm={() => void signOut()}
        onCancel={() => setConfirmOut(false)}
      />
    </div>
  );
}

function SwitchRow({
  icon,
  tone,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className="flex min-h-11 shrink-0 items-center">
        <Switch checked={checked} onChange={onChange} label={title} />
      </span>
    </div>
  );
}

function PrivacyBlock({
  icon,
  tone,
  title,
  body,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  );
}
