import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

const TITLE = "HealthLink — Healthcare, connected.";
const DESCRIPTION =
  "HealthLink connects you to the care you need. Find healthcare providers near you, book appointments, keep your health information organised and stay connected — in English, Yoruba, Hausa and Igbo.";

export const metadata: Metadata = {
  metadataBase: new URL("https://healthlink.folababy02.workers.dev"),
  title: {
    default: TITLE,
    template: "%s | HealthLink",
  },
  description: DESCRIPTION,
  applicationName: "HealthLink",
  keywords: [
    "healthcare Nigeria",
    "find a hospital",
    "book an appointment",
    "health records",
    "health reminders",
    "online doctor Nigeria",
    "HealthLink app",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "HealthLink",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_NG",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "48x48" },
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
