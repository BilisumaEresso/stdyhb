import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Student Guide — FAQ & Search Tips",
  description:
    "Learn how to find past exams, download academic files via Telegram bot (@studyhub_resource_bot), access 3-tier course bundles, and submit campus materials.",
  alternates: {
    canonical: "/help",
  },
  openGraph: {
    title: "Help & Student Guide | StudyHub",
    description:
      "Step-by-step guides and FAQs on discovering academic resources and downloading materials directly inside Telegram.",
    url: "/help",
  },
};

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      "name": "How do I receive academic documents directly to Telegram?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "Every document, slide deck, or exam on StudyHub includes a 'Send to Bot' button. Clicking it launches our official companion bot (@studyhub_resource_bot) in Telegram, which immediately transfers the original uncompressed PDF or document straight into your chat.",
      },
    },
    {
      "@type": "Question",
      "name": "Is StudyHub completely free for Ethiopian university students?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "Yes, 100% free. StudyHub was created to eliminate the friction of searching through chaotic Telegram channels. All past exams, model answer keys, lecture slides, and course handouts are freely accessible without paywalls.",
      },
    },
    {
      "@type": "Question",
      "name": "How do I find past midterm, final, and university exit exams?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "You can filter specifically for exams on the Explore page by selecting 'Past Exam' in the format selector, or search by course code (e.g., 'CoSc2011', 'Math1011') or keywords like 'Exit Exam', 'COC', 'Midterm', or 'Model Exam'.",
      },
    },
    {
      "@type": "Question",
      "name": "Which Ethiopian universities and colleges are indexed?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":
          "StudyHub indexes academic repositories across Addis Ababa University (AAU), Adama Science & Technology University (ASTU), Addis Ababa Science & Technology University (AASTU), Jimma University (JU), Hawassa University (HU), Bahir Dar University (BDU), and University of Gondar (UoG).",
      },
    },
  ],
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      {children}
    </>
  );
}
