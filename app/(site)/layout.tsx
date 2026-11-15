import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { ConfirmCallbackConsumer } from "@/components/confirm-callback";

const TITLE = "CareNBuddi — Your Health, Your Buddi.";
const DESCRIPTION =
  "CareNBuddi connects you to the care you need. Find healthcare providers near you, request visits, keep your health information organised and reach the right people — in English, Yoruba, Hausa and Igbo.";

export const metadata: Metadata = {
  metadataBase: new URL("https://carenbuddi.vercel.app"),
  title: {
    default: TITLE,
    template: "%s | CareNBuddi",
  },
  description: DESCRIPTION,
  applicationName: "CareNBuddi",
  keywords: [
    "healthcare Nigeria",
    "find a hospital",
    "health passport",
    "health records",
    "health reminders",
    "healthcare app Nigeria",
    "CareNBuddi app",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "CareNBuddi",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_NG",
    images: [
      {
        url: "/brand/og-card.png",
        width: 1200,
        height: 630,
        alt: "CareNBuddi — Your Health, Your Buddi.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/brand/og-card.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/brand/icon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/icon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/brand/apple-touch-icon.png", sizes: "180x180" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <ConfirmCallbackConsumer />
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
