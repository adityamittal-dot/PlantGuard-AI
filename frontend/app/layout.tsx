import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

// Fonts are bundled locally so dev/build works without internet access.
const manrope = localFont({
  src: "./fonts/Manrope.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
});

const sourceSerif = localFont({
  src: "./fonts/SourceSerif4.woff2",
  weight: "200 900",
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlantGuard AI",
  description:
    "AI-assisted visual symptom classification for plant disease awareness. Not laboratory pathogen confirmation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${sourceSerif.variable}`}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
