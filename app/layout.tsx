import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

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
};

export const viewport: Viewport = {
  themeColor: "#0B6B6D",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}