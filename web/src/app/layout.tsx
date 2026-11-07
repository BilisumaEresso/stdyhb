import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TelegramProvider from "@/components/TelegramProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyHub — Academic Resource Discovery for Ethiopian Students",
  description:
    "Discover past exams, lecture notes, PDFs, presentations, and learning materials from Ethiopian university communities (AAU, ASTU, AASTU, Jimma).",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/logo.svg" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Manrope:wght@400..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TelegramProvider>
          <Suspense fallback={<header className="topbar" />}>
            <Navbar />
          </Suspense>
          {children}
          <Footer />
        </TelegramProvider>
      </body>
    </html>
  );
}
