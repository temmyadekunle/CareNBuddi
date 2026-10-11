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

export type BookingStatus = "new" | "contacted" | "confirmed" | "completed" | "cancelled";

export type ConsultationType =
  | "Clinic visit"
  | "Video call"
  | "Home visit"
  | "Screening"
  | "Phone consult";

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
  specialty?: string;
  time?: string;
  kind?: ConsultationType;
  cancelledAt?: string;
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

/* --------------------------------------------------- My Health Diary */

export type FlowIntensity = "spotting" | "light" | "medium" | "heavy";
export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";
export type MoodType = "happy" | "calm" | "sad" | "anxious" | "stressed" | "irritable" | "lonely" | "tired" | "overwhelmed" | "hopeful" | "other";
export type SymptomSeverity = "mild" | "moderate" | "severe";
export type SymptomTrend = "improving" | "worsening" | "unchanged";

export interface MenstrualCycle {
  id: string;
  startDate: string;
  endDate?: string;
  flowIntensity?: FlowIntensity;
  symptoms?: string[];
  mood?: MoodType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoodEntry {
  id: string;
  date: string;
  time?: string;
  mood: MoodType;
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  sleepHours?: number;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  relatedCycleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SymptomEntry {
  id: string;
  date: string;
  time?: string;
  name: string;
  severity: SymptomSeverity;
  durationMinutes?: number;
  trend: SymptomTrend;
  notes?: string;
  relatedFactors?: string[];
  relatedCycleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthTrackingPreferences {
  menstrualTrackingEnabled: boolean;
  moodTrackingEnabled: boolean;
  symptomTrackingEnabled: boolean;
  sleepTrackingEnabled: boolean;
  energyTrackingEnabled: boolean;
  cycleLength?: number;
  periodLength?: number;
  lastPeriodStart?: string;
  remindersEnabled: boolean;
  reminderTime?: string;
}

export const DEFAULT_HEALTH_PREFERENCES: HealthTrackingPreferences = {
  menstrualTrackingEnabled: false,
  moodTrackingEnabled: true,
  symptomTrackingEnabled: true,
  sleepTrackingEnabled: true,
  energyTrackingEnabled: true,
  remindersEnabled: false,
};

export const MOOD_TYPES: { value: MoodType; label: string; color: string }[] = [
  { value: "happy", label: "Happy", color: "bg-emerald-500" },
  { value: "calm", label: "Calm", color: "bg-blue-400" },
  { value: "sad", label: "Sad", color: "bg-indigo-400" },
  { value: "anxious", label: "Anxious", color: "bg-yellow-400" },
  { value: "stressed", label: "Stressed", color: "bg-orange-400" },
  { value: "irritable", label: "Irritable", color: "bg-red-400" },
  { value: "lonely", label: "Lonely", color: "bg-purple-400" },
  { value: "tired", label: "Tired", color: "bg-gray-400" },
  { value: "overwhelmed", label: "Overwhelmed", color: "bg-red-500" },
  { value: "hopeful", label: "Hopeful", color: "bg-green-500" },
  { value: "other", label: "Other", color: "bg-slate-400" },
];

export const FLOW_INTENSITIES: { value: FlowIntensity; label: string; color: string }[] = [
  { value: "spotting", label: "Spotting", color: "bg-pink-100 text-pink-800" },
  { value: "light", label: "Light", color: "bg-pink-200 text-pink-800" },
  { value: "medium", label: "Medium", color: "bg-pink-400 text-white" },
  { value: "heavy", label: "Heavy", color: "bg-pink-600 text-white" },
];

export const SYMPTOM_SEVERITIES: { value: SymptomSeverity; label: string; color: string }[] = [
  { value: "mild", label: "Mild", color: "bg-green-100 text-green-800" },
  { value: "moderate", label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
  { value: "severe", label: "Severe", color: "bg-red-100 text-red-800" },
];

export const SYMPTOM_TRENDS: { value: SymptomTrend; label: string }[] = [
  { value: "improving", label: "Improving" },
  { value: "worsening", label: "Worsening" },
  { value: "unchanged", label: "Unchanged" },
];

export const COMMON_SYMPTOMS = [
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
  "Cramping",
  "Bloating",
  "Breast tenderness",
  "Mood swings",
  "Acne",
  "Food cravings",
  "Hot flashes",
  "Night sweats",
];