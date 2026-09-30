export type Mood = "great" | "good" | "okay" | "low" | "poor";

export interface Vitals {
  weightKg?: number;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  sleepHours?: number;
  steps?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  mood: Mood;
  symptoms: string[];
  vitals: Vitals;
  note: string;
}

export type RecordCategory =
  | "visit"
  | "lab"
  | "imaging"
  | "prescription"
  | "vaccination";

export interface MedicalRecord {
  id: string;
  title: string;
  provider: string;
  date: string;
  category: RecordCategory;
  summary: string;
  link: string;
}

export type ReminderType = "medication" | "hydration" | "activity" | "appointment";

export type ReminderDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Reminder {
  id: string;
  title: string;
  time: string;
  type: ReminderType;
  days: ReminderDay[];
  notes: string;
  enabled: boolean;
}

export const MOODS: { value: Mood; label: string; color: string }[] = [
  { value: "great", label: "Great", color: "bg-emerald-500" },
  { value: "good", label: "Good", color: "bg-green-400" },
  { value: "okay", label: "Okay", color: "bg-yellow-400" },
  { value: "low", label: "Low", color: "bg-orange-400" },
  { value: "poor", label: "Poor", color: "bg-rose-500" },
];

export const SYMPTOMS = [
  "Headache",
  "Fatigue",
  "Nausea",
  "Dizziness",
  "Fever",
  "Cough",
  "Sore throat",
  "Body ache",
  "Shortness of breath",
  "Anxiety",
  "Insomnia",
  "Back pain",
];

export const RECORD_CATEGORIES: { value: RecordCategory; label: string }[] = [
  { value: "visit", label: "Visit" },
  { value: "lab", label: "Lab result" },
  { value: "imaging", label: "Imaging" },
  { value: "prescription", label: "Prescription" },
  { value: "vaccination", label: "Vaccination" },
];

export const REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: "medication", label: "Medication" },
  { value: "hydration", label: "Hydration" },
  { value: "activity", label: "Activity" },
  { value: "appointment", label: "Appointment" },
];

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type Role = "consumer" | "provider" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  lang: string;
  createdAt: string;
}

export type ProviderRequestStatus = "pending" | "approved" | "rejected";

export interface ProviderRequest {
  id: string;
  name: string;
  email: string;
  facility: string;
  category: string;
  state: string;
  lga: string;
  address: string;
  phone: string;
  status: ProviderRequestStatus;
  createdAt: string;
}

export type BookingStatus = "new" | "contacted" | "confirmed";

export interface Booking {
  id: string;
  providerId: string | null;
  userId: string | null;
  name: string;
  phone: string;
  message: string;
  date?: string;
  status: BookingStatus;
  createdAt: string;
}

export type ReportTarget = "topic" | "provider";

export interface Report {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  detail?: string;
  status: "open" | "resolved";
  createdAt: string;
}