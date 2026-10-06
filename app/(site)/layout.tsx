import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

const TITLE = "CareNBuddi — Your Health, Your Buddi.";
const DESCRIPTION =
  "CareNBuddi connects you to the care you need. Find healthcare providers near you, book appointments, keep your health information organised and stay connected — in English, Yoruba, Hausa and Igbo.";

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
    "book an appointment",
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
        url: "/brand/logo.jpg",
        width: 1080,
        height: 1080,
        alt: "CareNBuddi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/brand/logo.jpg"],
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
