import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudyHub — Academic Resource Discovery",
    short_name: "StudyHub",
    description:
      "Discover past exams, lecture notes, PDFs, and learning materials from Ethiopian university communities.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7FAFF",
    theme_color: "#0878F9",
    categories: ["education", "books", "productivity"],
    lang: "en",
    icons: [
      {
        src: "/assets/mascot.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/assets/mascot.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
