import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SupportInfo from "@/components/support-info";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CargoCadence | AI Truck Booking",
  description:
    "Book freight trucks across the USA with an AI assistant. Instant estimates, transparent rates and secure payments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-amber-400">
                C
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                CargoCadence
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium text-gray-700">
              <Link href="/book" className="hover:text-slate-900">
                Book a truck
              </Link>
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <div className="mt-auto">
          <Suspense fallback={null}>
            <SupportInfo variant="footer" />
          </Suspense>
        </div>
      </body>
    </html>
  );
}