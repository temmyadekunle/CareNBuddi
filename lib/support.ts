"use client";

import { uid, useStoredCollection } from "@/lib/storage";
import type { Session } from "@/lib/storage";
import type { User } from "@/lib/types";

export type SupportStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";

export type EnquiryCategory =
  | "Account and login"
  | "Profile and identity verification"
  | "Provider registration"
  | "Appointments"
  | "Technical problems"
  | "Privacy and security"
  | "General enquiries";

export const ENQUIRY_CATEGORIES = [
  "Account and login",
  "Profile and identity verification",
  "Provider registration",
  "Appointments",
  "Technical problems",
  "Privacy and security",
  "General enquiries",
] as const;

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "provider" | "admin" | "guest";
  text: string;
  sentAt: string;
  status: "sending" | "sent" | "failed";
}

export interface SupportConversation {
  id: string;
  subject: string;
  category: EnquiryCategory;
  userCategory: "patient" | "provider" | "other";
  userId: string | null;
  userName: string;
  userEmail: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  assignedAgent: string | null;
}

export interface SupportTicket {
  id: string;
  conversationId: string;
  subject: string;
  category: EnquiryCategory;
  userCategory: "patient" | "provider" | "other";
  userId: string | null;
  userName: string;
  userEmail: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  assignedAgent: string | null;
}

export const SUPPORT_EMAIL = "support@healthlink.ng";

export function useSupportData() {
  const [conversations, setConversations] = useStoredCollection<SupportConversation>(
    "healthlink:support-conversations",
    [],
  );
  const [messages, setMessages] = useStoredCollection<SupportMessage>(
    "healthlink:support-messages",
    [],
  );
  const [tickets, setTickets] = useStoredCollection<SupportTicket>("healthlink:support-tickets", []);
  return { conversations, setConversations, messages, setMessages, tickets, setTickets };
}

export interface SupportSession {
  userId: string | null;
  userEmail: string;
  userName: string;
  userRole: "patient" | "provider" | "admin" | "guest";
}

export function getSupportSession(
  session: Session | null,
  users: User[],
): SupportSession {
  if (!session?.userId) {
    return {
      userId: null,
      userEmail: "",
      userName: "Guest",
      userRole: "guest",
    };
  }
  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    return {
      userId: session.userId,
      userEmail: "",
      userName: "CareNBuddi Member",
      userRole: "guest",
    };
  }
  return {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role as "patient" | "provider" | "admin" | "guest",
  };
}
