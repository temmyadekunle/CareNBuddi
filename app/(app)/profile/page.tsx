"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AvatarLarge,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Field,
  inputClass,
  ListRow,
  Screen,
  SectionHeader,
  useToast,
} from "@/components/app-ui";
import {
  CameraIcon,
  CalendarIcon,
  EditIcon,
  EmergencyIcon,
  PhoneIcon,
  UserIcon,
} from "@/components/icons";
import {
  PASSPORT_DEFAULTS,
  ProfileSettings,
  type PassportPrefs,
} from "@/components/profile-settings";
import { useT } from "@/lib/i18n";
import { fileToSquareDataUrl, readPhoto, removePhoto, savePhoto } from "@/lib/profile-photo";
import {
  KEYS,
  seedBookings,
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
  admin: "HealthLink team",
} as const;

function roleTone(role: Role) {
  return ROLE_TONE[role] ?? "slate";
}

export default function ProfilePage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [passport, setPassport] = useStoredValue<PassportPrefs>(KEYS.passport, PASSPORT_DEFAULTS);

  const [editOpen, setEditOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoState, setPhotoState] = useState(() => ({
    userId: session.userId,
    src: readPhoto(session.userId),
  }));
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState({ name: "", phone: "" });
  const [emergencyDraft, setEmergencyDraft] = useState({ contact: "", phone: "" });

  const me = users.find((u) => u.id === session.userId);
  const myBookings = bookings.filter((b) => b.userId === session.userId);

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
    // Reset first, so choosing the same file twice still fires a change.
    event.target.value = "";
    if (!file || !me) return;

    setPhotoBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      if (savePhoto(me.id, dataUrl)) {
        setPhotoState({ userId: me.id, src: dataUrl });
        push(t("prof_photo_saved", "Photo updated"), "success");
      } else {
        push(t("prof_photo_no_room", "This device is out of storage space."), "error");
      }
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

  const openProfileSheet = () => {
    setDraft({ name: me?.name ?? "", phone: me?.phone ?? "" });
    setEditOpen(true);
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
    setEditOpen(false);
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

  const telHref = `tel:${(passport.emergencyPhone ?? "").replace(/[^\d+]/g, "")}`;

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
          {/* profile header ------------------------------------------------- */}
          <Card className="mt-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <AvatarLarge name={me.name} src={photo} />
                <button
                  type="button"
                  onClick={pickPhoto}
                  disabled={photoBusy}
                  aria-label={t("prof_change_photo", "Change photo")}
                  className="tap -mt-3 ml-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-brand-700 disabled:opacity-60"
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
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold tracking-tight text-slate-900">
                  {me.name}
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-500">{me.email}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {me.phone || t("prof_no_phone", "No phone number added")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={roleTone(me.role)}>
                    {t(ROLE_LABEL_KEY[me.role], ROLE_FALLBACK[me.role])}
                  </Badge>
                  <Badge tone="slate">{me.lang.toUpperCase()}</Badge>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="secondary" onClick={openProfileSheet}>
                <EditIcon className="h-4 w-4" />
                {t("prof_edit", "Edit profile")}
              </Button>
              {photo ? (
                <Button tone="secondary" onClick={clearPhoto}>
                  {t("prof_photo_remove", "Remove photo")}
                </Button>
              ) : null}
              <Link href="/account" className="tap inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                {t("prof_account_sync", "Account & sync")}
              </Link>
            </div>
          </Card>

          {/* emergency contact ---------------------------------------------- */}
          <SectionHeader title={t("prof_emergency", "Emergency contact")} />
          <Card className="border-rose-200/70">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <EmergencyIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {passport.emergencyContact ||
                    t("prof_no_emergency", "No emergency contact yet")}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {passport.emergencyPhone ||
                    t("prof_no_emergency_d", "Add someone a responder can call for you")}
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {passport.emergencyPhone ? (
                <a
                  href={telHref}
                  className="tap inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <PhoneIcon className="h-4 w-4" />
                  {t("prof_call", "Call")}
                </a>
              ) : null}
              <Button tone="secondary" onClick={openEmergencySheet}>
                <EditIcon className="h-4 w-4" />
                {t("pp_edit", "Edit")}
              </Button>
              <Link
                href="/passport"
                className="tap inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t("pp_title", "Health Passport")}
              </Link>
            </div>
          </Card>

          {/* my requests ----------------------------------------------------- */}
          <SectionHeader
            title={t("pr_requests", "My requests")}
            action={t("prof_view_all", "View all")}
            href="/appointments"
          />
          <Card padded={false} className="overflow-hidden">
            <ListRow
              href="/appointments"
              icon={<CalendarIcon className="h-5 w-5" />}
              tone="green"
              title={
                myBookings.length === 1
                  ? t("prof_bookings_1", "1 booking request")
                  : `${myBookings.length} ${t("prof_bookings_n", "booking requests")}`
              }
              subtitle={
                myBookings.length === 0
                  ? t("pr_no_requests", "No booking requests yet.")
                  : t(
                      "prof_bookings_d",
                      "Track the status of every visit you have requested.",
                    )
              }
            />
          </Card>

          <ProfileSettings />
        </>
      )}

      {/* edit profile sheet ------------------------------------------------- */}
      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("prof_edit", "Edit profile")}
        footer={<Button full onClick={saveProfile}>{t("c_save", "Save")}</Button>}
      >
        <div className="space-y-4">
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
          <Field label={t("a_email", "Email")} hint={t("prof_email_fixed", "Email cannot be changed here")}>
            <input value={me?.email ?? ""} readOnly className={`${inputClass} min-h-11 opacity-70`} />
          </Field>
        </div>
      </BottomSheet>

      {/* emergency contact sheet -------------------------------------------- */}
      <BottomSheet
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        title={t("prof_emergency", "Emergency contact")}
        footer={<Button full onClick={saveEmergency}>{t("c_save", "Save")}</Button>}
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
        </div>
      </BottomSheet>
    </Screen>
  );
}
