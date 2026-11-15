import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import { DocumentLang } from "@/components/document-lang";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CareNBuddi",
  description:
    "Your Health, Your Buddi — Personal Health Navigation System: learn about your health, check your numbers, find appropriate care, connect with providers and stay on track.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/brand/icon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/icon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/brand/apple-touch-icon.png", sizes: "180x180" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#087F8C",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <ThemeProvider>{children}</ThemeProvider>
        <DocumentLang />
        <PwaRegister />
      </body>
    </html>
  );
}