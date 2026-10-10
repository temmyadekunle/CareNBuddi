"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  AvatarLarge,
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  ListRow,
  Screen,
  Segmented,
  inputClass,
  useToast,
} from "@/components/app-ui";
import {
  ActivityIcon,
  AlertIcon,
  BellIcon,
  CameraIcon,
  CardIcon,
  ChatIcon,
  EmergencyIcon,
  HelpIcon,
  InfoIcon,
  LanguageIcon,
  LockIcon,
  LogOutIcon,
  MessageIcon,
  PhoneIcon,
  SearchIcon,
  ShieldIcon,
  StethoscopeIcon,
  TrashIcon,
  UserIcon,
  WalletIcon,
} from "@/components/icons";
import {
  DEFAULT_NOTIFICATIONS,
  NOTIFICATIONS_KEY,
  PASSPORT_DEFAULTS,
  PrivacyBlock,
  SwitchRow,
  UNITS_KEY,
  type NotificationPrefs,
  type PassportPrefs,
  type Units,
} from "@/components/profile-settings";
import { useT } from "@/lib/i18n";
import { fileToSquareDataUrl, readPhoto, removePhoto, savePhoto } from "@/lib/profile-photo";
import { ProfileCropper } from "@/components/profile-cropper";
import { useCloud } from "@/lib/supabase/cloud";
import {
  KEYS,
  seedUsers,
  useSession,
  useStoredCollection,
  useStoredValue,
} from "@/lib/storage";
import type { Role } from "@/lib/types";

const ROLE_TONE = {
  consumer: "brand",
  provider: "green",
  admin: "amber",
} as const;

const ROLE_LABEL_KEY = {
  consumer: "a_consumer",
  provider: "a_provider",
  admin: "a_admin",
} as const;

const ROLE_FALLBACK = {
  consumer: "Patient / community member",
  provider: "Healthcare provider",
  admin: "CareNBuddi team",
} as const;

const SUPPORT_EMAIL = "support@healthlink.ng";

function roleTone(role: Role) {
  return ROLE_TONE[role] ?? "slate";
}

export default function ProfilePage() {
  const t = useT();
  const router = useRouter();
  const { push } = useToast();
  const cloud = useCloud();
  const [session, setSession] = useSession();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);
  const [passport, setPassport] = useStoredValue<PassportPrefs>(
    KEYS.passport,
    PASSPORT_DEFAULTS,
  );
  const [units, setUnits] = useStoredValue<Units>(UNITS_KEY, "metric");
  const [notifications, setNotifications] = useStoredValue<NotificationPrefs>(
    NOTIFICATIONS_KEY,
    DEFAULT_NOTIFICATIONS,
  );

  const [personalOpen, setPersonalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [soon, setSoon] = useState<null | "payments" | "wallet">(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("healthlink:theme") as "light" | "dark" | null;
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    localStorage.setItem("healthlink:theme", theme);
  }, [theme]);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoState, setPhotoState] = useState(() => ({
    userId: session.userId,
    src: readPhoto(session.userId),
  }));
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState({ name: "", phone: "" });
  const [emergencyDraft, setEmergencyDraft] = useState({ contact: "", phone: "" });

  const me = users.find((u) => u.id === session.userId);

  /**
   * The photo lives in device storage rather than in React state, because a
   * data URL is far too large to keep in a module-level cache. Re-read it
   * whenever the signed-in account changes, and after every save or removal.
   */
  if (photoState.userId !== session.userId) {
    setPhotoState({ userId: session.userId, src: readPhoto(session.userId) });
  }
  const photo = photoState.userId === session.userId ? photoState.src : null;

  const pickPhoto = () => fileRef.current?.click();

  const onPhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !me) return;

    setPhotoBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      setCropperImage(dataUrl);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      push(
        code === "too-large"
          ? t("prof_photo_too_large", "That image is too large. Choose a smaller one.")
          : t("prof_photo_failed", "We could not use that image. Try another one."),
        "error",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const clearPhoto = () => {
    if (!me) return;
    if (removePhoto(me.id)) {
      setPhotoState({ userId: me.id, src: null });
      push(t("prof_photo_removed", "Photo removed"), "success");
    } else {
      push(t("prof_photo_failed", "We could not use that image. Try another one."), "error");
    }
  };

  const openPersonalSheet = () => {
    setDraft({ name: me?.name ?? "", phone: me?.phone ?? "" });
    setPersonalOpen(true);
  };

  const saveProfile = () => {
    if (!me) return;
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    setUsers((prev) =>
      prev.map((u) =>
        u.id === me.id ? { ...u, name: name || u.name, phone: phone || undefined } : u,
      ),
    );
    setPersonalOpen(false);
    push(t("prof_saved", "Profile updated"), "success");
  };

  const openEmergencySheet = () => {
    setEmergencyDraft({
      contact: passport.emergencyContact ?? "",
      phone: passport.emergencyPhone ?? "",
    });
    setEmergencyOpen(true);
  };

  const saveEmergency = () => {
    setPassport((prev) => ({
      ...prev,
      emergencyContact: emergencyDraft.contact.trim(),
      emergencyPhone: emergencyDraft.phone.trim(),
    }));
    setEmergencyOpen(false);
    push(t("prof_emergency_saved", "Emergency contact updated"), "success");
  };

  const handleCropSave = (dataUrl: string) => {
    if (!me) return;
    if (savePhoto(me.id, dataUrl)) {
      setPhotoState({ userId: me.id, src: dataUrl });
      push(t("prof_photo_saved", "Photo updated"), "success");
    } else {
      push(t("prof_photo_no_room", "This device is out of storage space."), "error");
    }
    setCropperImage(null);
  };

  const handleCropCancel = () => {
    setCropperImage(null);
  };

  const telHref = `tel:${(passport.emergencyPhone ?? "").replace(/[^\d+]/g, "")}`;

  const goFromHelp = (href: string) => {
    setHelpOpen(false);
    router.push(href);
  };

  const mailSupport = () => {
    setHelpOpen(false);
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
  };

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

  const menuCard = "mt-3 overflow-hidden divide-y divide-slate-100";

  return (
    <Screen>
      {/* heading ---------------------------------------------------------- */}
      <div className="pt-1">
        <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">
          {t("n_profile", "Profile")}
        </h1>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {t("prof_sub", "Your details, preferences and privacy in one place.")}
        </p>
      </div>

      {!me ? (
        <div className="mt-5">
          <EmptyState
            icon={<UserIcon className="h-6 w-6" />}
            title={t("prof_signed_out_title", "You are not signed in")}
            body={t(
              "prof_signed_out_d",
              "Sign in to keep your bookings and records together, or carry on as a guest.",
            )}
            action={
              <Link href="/auth/sign-in" className="mt-2 w-full max-w-[16rem]">
                <Button full>{t("a_signin", "Sign in")}</Button>
              </Link>
            }
          />
          <div className="mt-3 flex justify-center">
            <Link
              href="/app"
              className="tap flex min-h-11 items-center text-xs font-semibold text-brand-700"
            >
              {t("gate_continue_guest", "Continue as guest")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* identity ---------------------------------------------------- */}
          <Card className="mt-5">
            <div className="flex flex-col items-center pb-1 pt-2 text-center">
              <div className="relative">
                <AvatarLarge name={me.name} src={photo} size={96} />
                <button
                  type="button"
                  onClick={pickPhoto}
                  disabled={photoBusy}
                  aria-label={t("prof_change_photo", "Change photo")}
                  className="tap absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-brand-700 disabled:opacity-60"
                >
                  <CameraIcon className="h-4 w-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPhotoSelected}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                />
              </div>
              <h2 className="mt-3 truncate text-lg font-bold tracking-tight text-slate-900">
                {me.name}
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">{me.email}</p>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <Badge tone={roleTone(me.role)}>
                  {t(ROLE_LABEL_KEY[me.role], ROLE_FALLBACK[me.role])}
                </Badge>
                <Badge tone="slate">{me.lang.toUpperCase()}</Badge>
              </div>
            </div>
          </Card>

          {/* menu ---------------------------------------------------------- */}
          <Card padded={false} className={`mt-4 ${menuCard}`}>
            <ListRow
              onClick={openPersonalSheet}
              icon={<UserIcon className="h-5 w-5" />}
              tone="brand"
              title={t("prof_personal", "Personal Information")}
            />
            <ListRow
              href="/account"
              icon={<LockIcon className="h-5 w-5" />}
              tone="slate"
              title={t("prof_acct_sec", "Account & Security")}
            />
            <ListRow
              onClick={() => setSoon("payments")}
              icon={<CardIcon className="h-5 w-5" />}
              tone="green"
              title={t("prof_payments", "Payment Methods")}
            />
            <ListRow
              onClick={() => setSoon("wallet")}
              icon={<WalletIcon className="h-5 w-5" />}
              tone="green"
              title={t("prof_wallet", "CareNBuddi Wallet")}
            />
            <ListRow
              onClick={() => setNotifOpen(true)}
              icon={<BellIcon className="h-5 w-5" />}
              tone="coral"
              title={t("prof_notifications", "Notifications")}
            />
            <ListRow
              onClick={() => setPrivacyOpen(true)}
              icon={<ShieldIcon className="h-5 w-5" />}
              tone="green"
              title={t("prof_privacy_consent", "Privacy & Consent")}
            />
            <ListRow
              onClick={openEmergencySheet}
              icon={<EmergencyIcon className="h-5 w-5" />}
              tone="rose"
              title={t("prof_emerg_contacts", "Emergency Contacts")}
            />
            <ListRow
              href="/care-circle"
              icon={<ActivityIcon className="h-5 w-5" />}
              tone="brand"
              title={t("n_carecircle", "Care Circle")}
            />
          </Card>

          <Card padded={false} className={menuCard}>
            <ListRow
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              icon={<ActivityIcon className="h-5 w-5" />}
              tone="slate"
              title={t("prof_theme", theme === "light" ? "Dark mode" : "Light mode")}
              meta={
                theme === "light"
                  ? <span className="text-xs text-slate-500">{t("prof_theme_light", "Light")}</span>
                  : <span className="text-xs text-slate-500">{t("prof_theme_dark", "Dark")}</span>
              }
            />
          </Card>

          <Card padded={false} className={menuCard}>
            {me.role === "provider" ? (
              <ListRow
                href="/provider"
                icon={<StethoscopeIcon className="h-5 w-5" />}
                tone="green"
                title={t("prof_provider_dash", "Provider dashboard")}
              />
            ) : (
              <ListRow
                href="/provider/register"
                icon={<StethoscopeIcon className="h-5 w-5" />}
                tone="green"
                title={t("prof_become_provider", "Become a Provider")}
              />
            )}
          </Card>

          <Card padded={false} className={menuCard}>
            <ListRow
              onClick={() => setHelpOpen(true)}
              icon={<HelpIcon className="h-5 w-5" />}
              tone="slate"
              title={t("prof_help_support", "Help & Support")}
            />
            <ListRow
              onClick={() => setAboutOpen(true)}
              icon={<InfoIcon className="h-5 w-5" />}
              tone="slate"
              title={t("prof_about", "About CareNBuddi")}
            />
          </Card>

          <Card padded={false} className={`mb-2 ${menuCard}`}>
            <ListRow
              onClick={() => {
                if (!signingOut) setConfirmOut(true);
              }}
              icon={<LogOutIcon className="h-5 w-5" />}
              tone="rose"
              chevron={false}
              title={t("prof_logout", "Log Out")}
            />
          </Card>
        </>
      )}

      {/* personal information sheet ---------------------------------------- */}
      <BottomSheet
        open={personalOpen}
        onClose={() => setPersonalOpen(false)}
        title={t("prof_personal", "Personal Information")}
        footer={
          <Button full onClick={saveProfile}>
            {t("c_save", "Save")}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" onClick={pickPhoto} disabled={photoBusy}>
              <CameraIcon className="h-4 w-4" />
              {photo ? t("prof_photo_change", "Change photo") : t("prof_photo_add", "Add photo")}
            </Button>
            {photo ? (
              <Button tone="secondary" onClick={clearPhoto}>
                <TrashIcon className="h-4 w-4" />
                {t("prof_photo_remove", "Remove photo")}
              </Button>
            ) : null}
          </div>
          <Field label={t("a_name", "Full name")}>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={`${inputClass} min-h-11`}
            />
          </Field>
          <Field
            label={t("auth_phone_label", "Phone (optional)")}
            hint={t("auth_phone_hint", "Used by providers to confirm a visit")}
          >
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              placeholder={t("prof_phone_ph", "+234 ...")}
              className={`${inputClass} min-h-11`}
            />
          </Field>
          <Field
            label={t("a_email", "Email")}
            hint={t("prof_email_fixed", "Email cannot be changed here")}
          >
            <input
              value={me?.email ?? ""}
              readOnly
              className={`${inputClass} min-h-11 opacity-70`}
            />
          </Field>

          <Field
            label={t("a_email", "Email")}
            hint={t("prof_email_fixed", "Email cannot be changed here")}
          >
            <input
              value={me?.email ?? ""}
              readOnly
              className={`${inputClass} min-h-11 opacity-70`}
            />
          </Field>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-900">{t("prof_govt_id", "Government ID")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("prof_govt_id_d", "Used for verification and secure access to health services.")}</p>
            <div className="mt-3 space-y-3">
              <Field label={t("prof_nin", "NIN (National Identification Number)")} hint={t("prof_nin_hint", "11-digit National Identity Number")}>
                <input
                  value={passport.nin ?? ""}
                  onChange={(e) => setPassport((p) => ({ ...p, nin: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="12345678901"
                  className={`${inputClass} min-h-11`}
                />
              </Field>
              <Field label={t("prof_bvn", "BVN (Bank Verification Number)")} hint={t("prof_bvn_hint", "11-digit Bank Verification Number")}>
                <input
                  value={passport.bvn ?? ""}
                  onChange={(e) => setPassport((p) => ({ ...p, bvn: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="12345678901"
                  className={`${inputClass} min-h-11`}
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
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

          <div className="border-t border-slate-100 pt-1">
            <ListRow
              onClick={() => {
                setPersonalOpen(false);
                router.push("/account");
              }}
              icon={<LanguageIcon className="h-5 w-5" />}
              tone="brand"
              title={t("a_language", "Language")}
              subtitle={t("a_language_d", "Change the language of the dashboard and health content.")}
            />
          </div>
        </div>
      </BottomSheet>

      {/* coming soon sheet -------------------------------------------------- */}
      <BottomSheet
        open={soon !== null}
        onClose={() => setSoon(null)}
        title={
          soon === "payments"
            ? t("prof_payments", "Payment Methods")
            : t("prof_wallet", "CareNBuddi Wallet")
        }
        footer={
          <Button full tone="secondary" onClick={() => setSoon(null)}>
            {t("c_close", "Close")}
          </Button>
        }
      >
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            {soon === "payments" ? (
              <CardIcon className="h-7 w-7" />
            ) : (
              <WalletIcon className="h-7 w-7" />
            )}
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {t("prof_coming_soon", "Coming soon")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {soon === "payments"
              ? t("prof_payments_soon", "Saving cards and paying for services is on the way.")
              : t("prof_wallet_soon", "Your CareNBuddi Wallet balance will live here.")}
          </p>
        </div>
      </BottomSheet>

      {/* notifications sheet ------------------------------------------------ */}
      <BottomSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title={t("prof_notifications", "Notifications")}
        footer={
          <Button full onClick={() => setNotifOpen(false)}>
            {t("c_done", "Done")}
          </Button>
        }
      >
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
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
      </BottomSheet>

      {/* privacy & consent sheet -------------------------------------------- */}
      <BottomSheet
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t("prof_privacy_consent", "Privacy & Consent")}
        footer={
          <Button full onClick={() => setPrivacyOpen(false)}>
            {t("c_done", "Done")}
          </Button>
        }
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
              "When a CareNBuddi cloud account is connected, your records are encrypted in transit and synced so you can use the app on another device. Open Account & Security to connect or disconnect.",
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

      {/* emergency contacts sheet -------------------------------------------- */}
      <BottomSheet
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        title={t("prof_emerg_contacts", "Emergency Contacts")}
        footer={
          <Button full onClick={saveEmergency}>
            {t("c_save", "Save")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("pp_ec", "Emergency contact")}>
            <input
              value={emergencyDraft.contact}
              onChange={(event) =>
                setEmergencyDraft({ ...emergencyDraft, contact: event.target.value })
              }
              placeholder={t("prof_emergency_ph", "e.g. Tayo Ogunleye (sibling)")}
              className={`${inputClass} min-h-11`}
            />
          </Field>
          <Field label={t("pp_ecp", "Emergency phone")}>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={emergencyDraft.phone}
              onChange={(event) =>
                setEmergencyDraft({ ...emergencyDraft, phone: event.target.value })
              }
              placeholder={t("prof_phone_ph", "+234 ...")}
              className={`${inputClass} min-h-11`}
            />
          </Field>
          <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-[11px] leading-relaxed text-rose-700">
            {t(
              "prof_emergency_note",
              "This is the number shown on your Health Passport emergency card.",
            )}
          </p>
          {passport.emergencyPhone ? (
            <a
              href={telHref}
              className="tap inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <PhoneIcon className="h-4 w-4" />
              {t("prof_call", "Call")}
            </a>
          ) : null}
        </div>
      </BottomSheet>

      {/* help & support sheet ------------------------------------------------ */}
      <BottomSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("prof_help_support", "Help & Support")}
        footer={
          <Button full tone="secondary" onClick={() => setHelpOpen(false)}>
            {t("c_close", "Close")}
          </Button>
        }
      >
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
          <ListRow
            onClick={() => goFromHelp("/emergency")}
            icon={<EmergencyIcon className="h-5 w-5" />}
            tone="rose"
            title={t("em_title", "Get Help Now")}
          />
          <ListRow
            onClick={() => goFromHelp("/ask")}
            icon={<ChatIcon className="h-5 w-5" />}
            tone="brand"
            title={t("n_ask", "Ask")}
          />
          <ListRow
            onClick={mailSupport}
            icon={<MessageIcon className="h-5 w-5" />}
            tone="slate"
            title={t("prof_contact_support", "Contact support")}
            subtitle={SUPPORT_EMAIL}
          />
          <ListRow
            onClick={() => goFromHelp("/find-care")}
            icon={<SearchIcon className="h-5 w-5" />}
            tone="green"
            title={t("n_find", "Find care")}
          />
        </div>
      </BottomSheet>

      {/* about sheet --------------------------------------------------------- */}
      <BottomSheet
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title={t("prof_about", "About CareNBuddi")}
        footer={
          <Button full tone="secondary" onClick={() => setAboutOpen(false)}>
            {t("c_close", "Close")}
          </Button>
        }
      >
        <div className="flex flex-col items-center py-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mark.png"
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl"
          />
          <p className="mt-3 text-base font-bold text-slate-900">CareNBuddi</p>
          <p className="mt-0.5 text-sm font-semibold text-brand-700">
            {t("a_tagline", "Your Health, Your Buddi.")}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {t(
              "prof_about_d",
              "Find the care you need, connect with healthcare professionals, and manage your health journey — all in one place.",
            )}
          </p>
        </div>
      </BottomSheet>

      {/* sign out ------------------------------------------------------------ */}
      <ConfirmDialog
        open={confirmOut}
        title={t("prof_signout_title", "Sign out of CareNBuddi?")}
        body={t(
          "prof_signout_body",
          "Your saved records stay on this device. You can sign back in at any time.",
        )}
        confirmLabel={t("prof_logout", "Log Out")}
        cancelLabel={t("c_cancel", "Cancel")}
        onConfirm={() => void signOut()}
        onCancel={() => setConfirmOut(false)}
      />

      {/* profile cropper ------------------------------------------------------- */}
      {cropperImage && (
        <ProfileCropper
          imageSrc={cropperImage}
          onCrop={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </Screen>
  );
}
