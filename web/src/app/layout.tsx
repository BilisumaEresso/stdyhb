import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TelegramProvider from "@/components/TelegramProvider";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://webstudyhub.vercel.app";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7FAFF" },
    { media: "(prefers-color-scheme: dark)", color: "#071426" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StudyHub — Academic Resource Discovery for Ethiopian Students",
    template: "%s | StudyHub",
  },
  description:
    "Discover 80,000+ past exams, lecture notes, model answers, course slides, and academic PDFs indexed from Ethiopian university communities (AAU, ASTU, AASTU, Jimma, Hawassa, Bahir Dar).",
  keywords: [
    "StudyHub",
    "Ethiopian University Past Exams",
    "AAU past exams",
    "AAU exit exams",
    "ASTU lecture notes",
    "AASTU exam papers",
    "Jimma University materials",
    "Hawassa University slides",
    "Bahir Dar University notes",
    "freshman courses Ethiopia",
    "physics midterm exam Ethiopia",
    "calculus model exam",
    "computer science notes",
    "DBMS lecture slides",
    "Telegram student bot Ethiopia",
    "Ethiopia academic resources",
    "COC exam model",
    "CoSc2011",
  ],
  authors: [{ name: "StudyHub Community", url: siteUrl }],
  creator: "StudyHub",
  publisher: "StudyHub Academic Platform",
  category: "education",
  alternates: {
    canonical: "./",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/logo.svg" },
    ],
    apple: "/assets/mascot.png",
  },
  openGraph: {
    title: "StudyHub — Academic Resource Discovery for Ethiopian Students",
    description:
      "Discover past exams, lecture notes, presentations, and academic materials from Ethiopian university communities — all in one focused search platform.",
    url: siteUrl,
    siteName: "StudyHub",
    images: [
      {
        url: "/assets/mascot.png",
        width: 800,
        height: 800,
        alt: "StudyHub Official Mascot - The Academic Robot",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyHub — Academic Resource Discovery for Ethiopian Students",
    description:
      "Access 80,000+ past examinations, lecture notes, and study packages from Ethiopian university student communities.",
    images: ["/assets/mascot.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

// JSON-LD Structured Data for Google Sitelinks Searchbox and Knowledge Graph
const jsonLdWebsite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "StudyHub",
  alternateName: ["StudyHub Ethiopia", "StudyHub Academic Discovery"],
  url: siteUrl,
  description:
    "Academic resource discovery platform for Ethiopian university students indexing past examinations, lecture notes, and course materials.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/explore?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "StudyHub",
  url: siteUrl,
  logo: `${siteUrl}/assets/logo.svg`,
  description:
    "Student-focused educational technology platform enabling Ethiopian university students to discover and share verified learning materials.",
  sameAs: ["https://t.me/studyhub_resource_bot"],
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
        {/* Schema.org JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
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
