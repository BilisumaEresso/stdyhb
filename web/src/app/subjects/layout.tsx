import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subject Directory & Academic Disciplines",
  description:
    "Browse Ethiopian university course materials by subject: Computer Science, Software Engineering, Database Systems, Networks, Mathematics, Physics, Chemistry, and Electrical Engineering.",
  alternates: {
    canonical: "/subjects",
  },
  openGraph: {
    title: "Subject Directory | StudyHub",
    description:
      "Browse university study materials and past examinations by academic discipline.",
    url: "/subjects",
  },
};

export default function SubjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
