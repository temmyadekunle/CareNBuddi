"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { FileTextIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { fullDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { KEYS, seedRecords, todayIso, uid, useStoredCollection } from "@/lib/storage";
import { RECORD_CATEGORIES, type MedicalRecord, type RecordCategory } from "@/lib/types";

const CATEGORY_TONES: Record<RecordCategory, "brand" | "green" | "amber" | "rose" | "slate"> = {
  visit: "brand",
  lab: "amber",
  imaging: "slate",
  prescription: "rose",
  vaccination: "green",
};

const CATEGORY_KEYS: Record<RecordCategory, [string, string]> = {
  visit: ["rc2_cat_visit", "Visit"],
  lab: ["rc2_cat_lab", "Lab result"],
  imaging: ["rc2_cat_imaging", "Imaging"],
  prescription: ["rc2_cat_prescription", "Prescription"],
  vaccination: ["rc2_cat_vaccination", "Vaccination"],
};

export default function RecordsPage() {
  const t = useT();
  const { push } = useToast();
  const [records, setRecords] = useStoredCollection(KEYS.records, seedRecords);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<RecordCategory>("visit");
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [filter, setFilter] = useState<RecordCategory | "all">("all");
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MedicalRecord | null>(null);

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const filtered = filter === "all" ? sorted : sorted.filter((r) => r.category === filter);

  const reset = () => {
    setTitle("");
    setProvider("");
    setSummary("");
    setLink("");
    setDate(todayIso());
    setCategory("visit");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: MedicalRecord = {
      id: uid(),
      title: title.trim(),
      provider: provider.trim(),
      date,
      category,
      summary: summary.trim(),
      link: link.trim(),
    };
    setRecords((prev) => [...prev, record]);
    reset();
    setOpen(false);
    push(t("rc2_saved", "Record saved"), "success");
  };

  const confirmRemove = () => {
    if (!toDelete) return;
    setRecords((prev) => prev.filter((r) => r.id !== toDelete.id));
    setToDelete(null);
    push(t("rc2_removed", "Record deleted"));
  };

  return (
    <Screen>
      <SectionHeader
        title={t("rc2_title", "Medical records")}
        subtitle={t("rc2_sub", "Keep a linkable archive of visits, labs and prescriptions.")}
      />

      <Button full className="mt-3" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        {t("rc2_add", "Add record")}
      </Button>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("rc2_filter_all", "All")}
        </Chip>
        {RECORD_CATEGORIES.map((c) => {
          const [key, fallback] = CATEGORY_KEYS[c.value as RecordCategory];
          return (
            <Chip key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
              {t(key, fallback)}
            </Chip>
          );
        })}
      </div>

      <div className="mt-3 space-y-2.5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileTextIcon className="h-6 w-6" />}
            title={t("rc2_empty_title", "No records here yet")}
            body={t("rc2_empty_body", "Add a visit, lab result or vaccination to keep it with you.")}
            action={
              <Button tone="secondary" onClick={() => setOpen(true)}>
                {t("rc2_add", "Add record")}
              </Button>
            }
          />
        ) : (
          filtered.map((record) => {
            const [catKey, catFallback] = CATEGORY_KEYS[record.category];
            return (
              <Card key={record.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">{record.title}</h3>
                      <Badge tone={CATEGORY_TONES[record.category]}>{t(catKey, catFallback)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {record.provider} · {fullDate(record.date)}
                    </p>
                  </div>
                  <IconButton
                    label={t("rc2_delete", "Delete record")}
                    onClick={() => setToDelete(record)}
                    className="shrink-0 text-rose-500 hover:bg-rose-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </IconButton>
                </div>
                {record.summary ? <p className="mt-2 text-sm text-slate-700">{record.summary}</p> : null}
                {record.link ? (
                  <a
                    href={record.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-brand-700"
                  >
                    {t("rc2_open", "Open attached record")}
                  </a>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("rc2_add_title", "Add a record")}
        footer={
          <Button full onClick={submit}>
            {t("rc2_save", "Save record")}
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("rc2_f_title", "Title")}>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("rc2_f_ph_title", "e.g. Blood test results")}
              className={inputClass}
            />
          </Field>
          <Field label={t("rc2_f_provider", "Provider / facility")}>
            <input
              type="text"
              required
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder={t("rc2_f_ph_provider", "e.g. Dr. Smith, City Clinic")}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("rc2_f_date", "Date")}>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("rc2_f_category", "Category")}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecordCategory)}
                className={inputClass}
              >
                {RECORD_CATEGORIES.map((c) => {
                  const [key, fallback] = CATEGORY_KEYS[c.value as RecordCategory];
                  return (
                    <option key={c.value} value={c.value}>
                      {t(key, fallback)}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
          <Field label={t("rc2_f_summary", "Summary / result")}>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("rc2_f_summary_ph", "Key findings or notes…")}
              className={inputClass}
            />
          </Field>
          <Field label={t("rc2_f_link", "Link (optional)")}>
            <input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={toDelete !== null}
        title={t("rc2_confirm_title", "Delete this record?")}
        body={t("rc2_confirm_body", "This cannot be undone.")}
        confirmLabel={t("rc2_confirm_yes", "Yes, delete")}
        cancelLabel={t("rc2_confirm_no", "Keep it")}
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}