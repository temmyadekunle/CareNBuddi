import type { Booking, ConsultationType } from "./types";
import type { Provider } from "./content";

export type { ConsultationType };

export interface AppointmentView {
  booking: Booking;
  provider: Provider | null;
  providerName: string;
  specialty: string;
  date: string;
  time: string;
  kind: ConsultationType;
  status: Booking["status"];
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function bookingDate(booking: Booking): string {
  return booking.date ?? booking.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

export function bookingTime(booking: Booking): string {
  return booking.time ?? "09:00";
}

export function formatDay(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return `${DAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatShortDate(dateIso: string): { day: string; month: string; weekday: string } {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "", weekday: "" };
  return {
    day: String(date.getDate()),
    month: MONTHS[date.getMonth()],
    weekday: DAYS[date.getDay()].slice(0, 3),
  };
}

export function toAppointment(booking: Booking, providers: Provider[]): AppointmentView {
  const provider = booking.providerId
    ? providers.find((p) => p.id === booking.providerId) ?? null
    : null;
  return {
    booking,
    provider,
    providerName: provider?.name ?? booking.name ?? "HealthLink",
    specialty:
      booking.specialty ??
      provider?.services[0] ??
      provider?.category ??
      "General consultation",
    date: bookingDate(booking),
    time: bookingTime(booking),
    kind: booking.kind ?? "Clinic visit",
    status: booking.status,
  };
}

export function isPast(appointment: AppointmentView, today = new Date()): boolean {
  const date = new Date(`${appointment.date}T${appointment.time || "23:59"}`);
  return !Number.isNaN(date.getTime()) && date.getTime() < today.getTime();
}

/** Upcoming = future date and not cancelled/completed. */
export function partitionAppointments(appointments: AppointmentView[], today = new Date()) {
  const upcoming: AppointmentView[] = [];
  const completed: AppointmentView[] = [];
  const cancelled: AppointmentView[] = [];

  for (const appointment of appointments) {
    if (appointment.status === "cancelled") {
      cancelled.push(appointment);
    } else if (appointment.status === "completed" || isPast(appointment, today)) {
      completed.push(appointment);
    } else {
      upcoming.push(appointment);
    }
  }

  const byDate = (a: AppointmentView, b: AppointmentView) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);

  return {
    upcoming: upcoming.sort(byDate),
    completed: completed.sort((a, b) => byDate(b, a)),
    cancelled: cancelled.sort((a, b) => byDate(b, a)),
  };
}

export function nextAppointment(appointments: AppointmentView[], today = new Date()): AppointmentView | null {
  return partitionAppointments(appointments, today).upcoming[0] ?? null;
}

export const SLOTS = ["08:30", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00"];

export const CONSULTATION_TYPES: ConsultationType[] = [
  "Clinic visit",
  "Video call",
  "Phone consult",
  "Home visit",
  "Screening",
];

export function nextAvailableSlots(count = 3, from = new Date()): string[] {
  const slots: string[] = [];
  for (let dayOffset = 0; slots.length < count && dayOffset < 7; dayOffset += 1) {
    const day = new Date(from);
    day.setDate(day.getDate() + dayOffset);
    const iso = day.toISOString().slice(0, 10);
    for (const slot of SLOTS) {
      if (slots.length >= count) break;
      const when = new Date(`${iso}T${slot}`);
      if (when.getTime() > from.getTime()) slots.push(`${iso}T${slot}`);
    }
  }
  return slots;
}