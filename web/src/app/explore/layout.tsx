import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore 80,000+ Past Exams & Course Materials",
  description:
    "Search and filter past exams, lecture notes, slide presentations, laboratory manuals, and curated course bundles from AAU, ASTU, AASTU, and Jimma University.",
  alternates: {
    canonical: "/explore",
  },
  openGraph: {
    title: "Explore 80,000+ Academic Resources | StudyHub",
    description:
      "Search Ethiopian university midterms, exit exams, lecture notes, and complete course packs.",
    url: "/explore",
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
