"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Screen, SectionHeader } from "@/components/app-ui";
import { HelpIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { useSession, useStoredCollection, uid } from "@/lib/storage";
import { ENQUIRY_CATEGORIES, SUPPORT_EMAIL, getSupportSession, useSupportData, type SupportConversation, type SupportMessage } from "@/lib/support";

const OPERATING_HOURS = {
  weekdays: { open: 8, close: 20 },
  weekends: { open: 9, close: 17 },
};

export default function SupportPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection("healthlink:users", []);
  const { conversations, messages, setConversations, setMessages } = useSupportData();
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState<(typeof ENQUIRY_CATEGORIES)[number] | "">("");
  const [newMessage, setNewMessage] = useState("");
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("healthlink:support-active");
    if (saved) setActiveConversation(saved);
  }, []);

  useEffect(() => {
    if (activeConversation) {
      sessionStorage.setItem("healthlink:support-active", activeConversation);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollTo({ top: messagesEndRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeConversation]);

  const supportSession = getSupportSession(session, users);
  const userConversations = conversations.filter((c) => c.userId === supportSession.userId);
  const activeConv = conversations.find((c) => c.id === activeConversation);
  const convMessages = messages.filter((m) => m.conversationId === activeConversation).sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  function createConversation() {
    if (!newSubject.trim() || !newCategory) return;
    const conv: SupportConversation = {
      id: uid(),
      subject: newSubject,
      category: newCategory,
      userCategory: supportSession.userRole === "provider" ? "provider" : supportSession.userRole === "admin" ? "provider" : supportSession.userRole === "guest" ? "other" : "patient",
      userId: supportSession.userId,
      userName: supportSession.userName,
      userEmail: supportSession.userEmail,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedAgent: null,
    };
    setConversations((prev) => [conv, ...prev]);
    const msg: SupportMessage = {
      id: uid(),
      conversationId: conv.id,
      senderId: supportSession.userId ?? "guest",
      senderName: supportSession.userName,
      senderRole: supportSession.userRole,
      text: newMessage,
      sentAt: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [...prev, msg]);
    setActiveConversation(conv.id);
    setNewSubject("");
    setNewCategory("");
    setNewMessage("");
  }

  function sendMessage() {
    if (!newMessage.trim() || !activeConversation) return;
    const conv = conversations.find((c) => c.id === activeConversation);
    if (!conv) return;
    const msg: SupportMessage = {
      id: uid(),
      conversationId: activeConversation,
      senderId: supportSession.userId ?? "guest",
      senderName: supportSession.userName,
      senderRole: supportSession.userRole,
      text: newMessage,
      sentAt: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [...prev, msg]);
    setConversations((prevs) =>
      prevs.map((c) => (c.id === activeConversation ? { ...c, updatedAt: new Date().toISOString(), status: "open" } : c)),
    );
    setNewMessage("");
  }

  function isInOperatingHours(now = new Date()): boolean {
    const day = now.getDay();
    const hour = now.getHours();
    const hours = day === 0 || day === 6 ? OPERATING_HOURS.weekends : OPERATING_HOURS.weekdays;
    return hour >= hours.open && hour < hours.close;
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { className: string; label: string }> = {
      open: { className: "bg-amber-50 text-amber-700", label: "Open" },
      in_progress: { className: "bg-blue-50 text-blue-700", label: "In Progress" },
      waiting: { className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300", label: "Waiting" },
      resolved: { className: "bg-green-50 text-green-700", label: "Resolved" },
      closed: { className: "bg-slate-200 text-slate-600", label: "Closed" },
    };
    const v = variants[status] || variants.open;
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${v.className}`}>{v.label}</span>;
  }

  const operatingNow = isInOperatingHours();

  return (
    <Screen>
      <SectionHeader
        title={t("n_support", "Support")}
        subtitle={t("prof_help_sub", "Chat with us or email for help")}
      />

      {!activeConversation ? (
        <div className="px-4 pb-20">
          <Card className="mb-4">
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {operatingNow ? t("sup_operating", "We're online") : t("sup_closed", "We're offline")}
              </p>
              <div className="flex gap-3">
                <Button
                  tone="secondary"
                  className="flex-1"
                  onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=CareNBuddi Support`, "_blank")}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span>{t("sup_email", "Email")}</span>
                </Button>
                <Button tone="secondary" className="flex-1" onClick={() => {}}>
                  <HelpIcon className="h-4 w-4" />
                  <span>{t("sup_chat", "Chat")}</span>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("sup_subject", "Subject")}</label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder={t("sup_subject_ph", "What do you need help with?")}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("sup_category", "Category")}</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as (typeof ENQUIRY_CATEGORIES)[number] | "")}
              >
                <option value="">{t("sup_pick_category", "Select a category")}</option>
                {ENQUIRY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`sup_cat_${c.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`, c)}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("sup_message", "Message")}</label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t("sup_message_ph", "Describe your issue or question…")}
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <Button tone="secondary" className="w-full" disabled={!newSubject.trim() || !newCategory || !newMessage.trim()} onClick={createConversation}>
              {t("sup_start_chat", "Start conversation")}
            </Button>
          </Card>

          {userConversations.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t("sup_your_chats", "Your conversations")}</p>
              <div className="space-y-2">
                {userConversations.slice(0, 20).map((c) => (
                  <Card key={c.id} className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setActiveConversation(c.id)}>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.subject}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.category}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(c.updatedAt).toLocaleString()}</p>
                    </div>
                    {getStatusBadge(c.status)}
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex h-[calc(100vh-10rem)] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{activeConv?.subject}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{activeConv?.category}</p>
            </div>
            <button onClick={() => setActiveConversation(null)} className="tap text-xs font-semibold text-brand-700">
              {t("sup_back", "Back")}
            </button>
          </div>
          <div ref={messagesEndRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {convMessages.map((m) => (
              <div key={m.id} className={`max-w-[80%] ${m.senderRole === supportSession.userRole ? "ml-auto text-right" : "mr-auto text-left"}`}>
                <div className={`inline-block rounded-2xl px-3 py-2 text-sm ${m.senderRole === supportSession.userRole ? "bg-brand-100 text-slate-900" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}>
                  {m.text}
                </div>
                <p className="text-[10px] text-slate-400">{new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-end gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t("sup_type_msg", "Type your message…")}
                rows={Math.min(4, Math.max(1, newMessage.split("\n").length))}
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <Button tone="secondary" disabled={!newMessage.trim()} onClick={sendMessage}>
                {t("sup_send", "Send")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
