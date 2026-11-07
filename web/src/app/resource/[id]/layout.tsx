import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://studyhubbot.onrender.com"
      : "http://localhost:5000");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${apiUrl}/api/file/${id}`, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const resource = data?.data;
      if (resource) {
        const title = resource.fileName || resource.courseCode || "Academic Study Resource";
        const desc = resource.caption
          ? resource.caption.slice(0, 160)
          : `Download or preview ${title} (${resource.fileType?.toUpperCase() || "PDF"}) on StudyHub for Ethiopian university students.`;

        return {
          title: `${title} | StudyHub`,
          description: desc,
          alternates: {
            canonical: `/resource/${id}`,
          },
          openGraph: {
            title: `${title} | StudyHub`,
            description: desc,
            url: `/resource/${id}`,
            images: [
              {
                url: "/assets/mascot.png",
                width: 800,
                height: 800,
                alt: title,
              },
            ],
          },
        };
      }
    }
  } catch {
    // Fallback if backend is waking up or building statically
  }

  return {
    title: "Academic Study Resource | StudyHub",
    description:
      "View and download verified university study materials, lecture slides, and past exams on StudyHub.",
    alternates: {
      canonical: `/resource/${id}`,
    },
  };
}

export default function ResourceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
