"use client";

import { useState } from "react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { ActivityIcon, PillIcon, PlusIcon, TrashIcon, UserIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, useStoredCollection } from "@/lib/storage";

interface CareMember {
  id: string;
  name: string;
  relation: string;
  bp: string;
  medication: string;
  appointment: string;
  nextScreening: string;
}

const seedCircle: CareMember[] = [
  {
    id: "cm-1",
    name: "Mum",
    relation: "Mother",
    bp: "128/84 mmHg",
    medication: "8:00 PM daily",
    appointment: "Oct 15",
    nextScreening: "November",
  },
];

const EMPTY: Omit<CareMember, "id"> = {
  name: "",
  relation: "",
  bp: "",
  medication: "",
  appointment: "",
  nextScreening: "",
};

export default function CareCirclePage() {
  const t = useT();
  const { push } = useToast();
  const [circle, setCircle] = useStoredCollection<CareMember>(KEYS.careCircle, seedCircle);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<CareMember, "id">>(EMPTY);

  const add = () => {
    if (!draft.name.trim()) return;
    setCircle((prev) => [...prev, { ...draft, id: crypto.randomUUID() }]);
    setDraft(EMPTY);
    setOpen(false);
    push(t("cc2_added", "Care Circle updated"), "success");
  };

  const remove = (id: string) => {
    setCircle((prev) => prev.filter((m) => m.id !== id));
    push(t("cc2_removed", "Removed"), "success");
  };

  const fields = [
    ["bp", t("cc2_bp", "BP")],
    ["medication", t("cc2_med", "Medication")],
    ["appointment", t("cc2_appt", "Appointment")],
    ["nextScreening", t("cc2_screen", "Next screening")],
  ] as const;

  return (
    <Screen>
      <SectionHeader
        title={t("cc2_title", "Care Circle")}
        subtitle={t("cc2_sub", "Keep track of the health of the people you care for.")}
      />

      <Button full className="mt-3" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        {t("cc2_addb", "Add family member")}
      </Button>

      <div className="mt-4 space-y-3">
        {circle.length === 0 ? (
          <EmptyState
            icon={<UserIcon className="h-6 w-6" />}
            title={t("cc2_empty", "No one added yet")}
            body={t("cc2_empty_d", "Add the people you care for to keep their key health details close.")}
          />
        ) : (
          circle.map((m) => (
            <Card key={m.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-slate-900">{m.name}</h2>
                  {m.relation && <p className="truncate text-xs text-slate-500">{m.relation}</p>}
                </div>
                <Button tone="ghost" onClick={() => remove(m.id)} aria-label={t("cc2_remove", "Remove")}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 space-y-1.5">
                {m.bp && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <ActivityIcon className="h-3.5 w-3.5" />
                      {t("cc2_bp", "BP")}
                    </span>
                    <Badge tone="brand">{m.bp}</Badge>
                  </div>
                )}
                {m.medication && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <PillIcon className="h-3.5 w-3.5" />
                      {t("cc2_med", "Medication")}
                    </span>
                    <span className="truncate font-medium text-slate-900">{m.medication}</span>
                  </div>
                )}
                {m.appointment && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">{t("cc2_appt", "Appointment")}</span>
                    <span className="truncate font-medium text-slate-900">{m.appointment}</span>
                  </div>
                )}
                {m.nextScreening && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">{t("cc2_screen", "Next screening")}</span>
                    <span className="truncate font-medium text-slate-900">{m.nextScreening}</span>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("cc2_add", "Add a family member")}
        footer={
          <Button full onClick={add}>
            {t("cc2_save", "Save")}
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label={t("cc2_name", "Name / label")}>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("cc2_rel", "Relationship")}>
            <input
              value={draft.relation}
              onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
              className={inputClass}
            />
          </Field>
          {fields.map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </BottomSheet>
    </Screen>
  );
}