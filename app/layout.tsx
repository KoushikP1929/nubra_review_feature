import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nubra Trade Review",
  description: "Monthly post-trade review for retail traders",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        {children}
        <footer className="border-t border-zinc-200 py-6">
          <p className="mx-auto w-full max-w-6xl px-6 text-xs text-zinc-500">
            Nubra Trade Review — prototype. Sample data only; no live broker or
            Nubra API integration. All analytics are calculated by the backend.
          </p>
        </footer>
      </body>
    </html>
  );
}
