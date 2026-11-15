import type { ConsultationErrorCode } from "./consultations";
import type { ConsultationStatus } from "./consultation-core";

export type ConsultationTone = "brand" | "green" | "amber" | "rose" | "slate";

export const STATUS_TONE: Record<ConsultationStatus, ConsultationTone> = {
  requested: "amber",
  accepted: "brand",
  in_progress: "green",
  completed: "green",
  declined: "rose",
  cancelled: "slate",
  expired: "slate",
};

export const STATUS_KEY: Record<ConsultationStatus, string> = {
  requested: "vc_status_requested",
  accepted: "vc_status_accepted",
  in_progress: "vc_status_in_progress",
  completed: "vc_status_completed",
  declined: "vc_status_declined",
  cancelled: "vc_status_cancelled",
  expired: "vc_status_expired",
};

export const STATUS_FALLBACK: Record<ConsultationStatus, string> = {
  requested: "Requested",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

export interface ConsultationErrorCopy {
  titleKey: string;
  title: string;
  bodyKey: string;
  body: string;
}

const ERROR_COPY: Record<ConsultationErrorCode, ConsultationErrorCopy> = {
  cloud_required: {
    titleKey: "vc_cloud_required",
    title: "Sign-in required",
    bodyKey: "vc_cloud_required_body",
    body: "Virtual care needs the CareNBuddi backend and a signed-in account.",
  },
  auth_required: {
    titleKey: "vc_signin_required",
    title: "Sign in again",
    bodyKey: "vc_signin_required_body",
    body: "Your secure session has expired. Sign in and try again.",
  },
  forbidden: {
    titleKey: "vc_forbidden",
    title: "Not allowed",
    bodyKey: "vc_forbidden_body",
    body: "Only the assigned patient and provider can do this.",
  },
  not_found: {
    titleKey: "vc_not_found",
    title: "Consultation not found",
    bodyKey: "vc_not_found_body",
    body: "This consultation does not exist or is not available to this account.",
  },
  conflict: {
    titleKey: "vc_conflict",
    title: "That action is no longer available",
    bodyKey: "vc_conflict_body",
    body: "The time slot or consultation status has changed. Refresh and try again.",
  },
  invalid: {
    titleKey: "vc_invalid",
    title: "Check the details",
    bodyKey: "vc_invalid_body",
    body: "Choose a valid provider, time, duration and a short reason.",
  },
  video_not_configured: {
    titleKey: "vc_join_config",
    title: "Video is not configured",
    bodyKey: "vc_join_config_body",
    body: "The server has no video credentials, so a secure room cannot be created yet. Ask the administrator to configure Daily.co.",
  },
  video_unavailable: {
    titleKey: "vc_join_unavailable",
    title: "Video room unavailable",
    bodyKey: "vc_join_unavailable_body",
    body: "The secure join service could not be reached. Try again.",
  },
  video_error: {
    titleKey: "vc_join_error",
    title: "The room could not be opened",
    bodyKey: "vc_join_error_body",
    body: "The video provider rejected the request. Try again, or contact support if it continues.",
  },
  consultation_error: {
    titleKey: "vc_error",
    title: "Something went wrong",
    bodyKey: "vc_error_body",
    body: "The request could not be completed. Try again.",
  },
};

export function consultationErrorCopy(code: ConsultationErrorCode): ConsultationErrorCopy {
  return ERROR_COPY[code] ?? ERROR_COPY.consultation_error;
}

export const EVENT_KEYS: Record<string, { key: string; fallback: string }> = {
  requested: { key: "vc_event_requested", fallback: "Requested" },
  accepted: { key: "vc_event_accepted", fallback: "Accepted" },
  declined: { key: "vc_event_declined", fallback: "Declined" },
  cancelled: { key: "vc_event_cancelled", fallback: "Cancelled" },
  started: { key: "vc_event_started", fallback: "Session started" },
  completed: { key: "vc_event_completed", fallback: "Completed" },
  expired: { key: "vc_event_expired", fallback: "Expired" },
  joined: { key: "vc_event_joined", fallback: "Joined the room" },
};

export const ACTOR_KEYS: Record<string, { key: string; fallback: string }> = {
  patient: { key: "vc_role_patient", fallback: "Patient" },
  provider: { key: "vc_role_provider", fallback: "Provider" },
  admin: { key: "vc_role_admin", fallback: "Administrator" },
  system: { key: "vc_role_system", fallback: "System" },
};
