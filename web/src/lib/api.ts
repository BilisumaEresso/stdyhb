const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/+$/, "");

export interface ResourceItem {
  _id: string;
  fileName: string;
  caption?: string;
  fileType: "pdf" | "ppt" | "doc" | "image" | "other";
  fileSize: number;
  channelUsername?: string;
  messageId: number;
  chatId: number;
  groupId?: string;
  groupIndex?: number;
  groupTotal?: number;
  tags?: string[];
  isExam?: boolean;
  courseCode?: string;
  university?: string;
  downloadCount: number;
  indexedAt: string;
}

export interface SearchResponse {
  success: boolean;
  data: ResourceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StatsResponse {
  success: boolean;
  data: {
    totalResources: number;
    totalExams: number;
    universities: string[];
  };
}

export async function fetchStats(): Promise<StatsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/stats`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch stats:", err);
    return null;
  }
}

export async function searchResources(params: {
  q?: string;
  university?: string;
  fileType?: string;
  isExam?: boolean;
  page?: number;
}): Promise<SearchResponse | null> {
  try {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.university) query.set("university", params.university);
    if (params.fileType) query.set("fileType", params.fileType);
    if (params.isExam) query.set("isExam", "true");
    if (params.page) query.set("page", params.page.toString());

    const res = await fetch(`${API_BASE}/search?${query.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Search request failed:", err);
    return null;
  }
}

export function getFileStreamUrl(id: string): string {
  return `${API_BASE}/files/stream/${id}`;
}

export function getFileDownloadUrl(id: string): string {
  return `${API_BASE}/files/download/${id}`;
}

export function getTelegramBotDeepLink(
  resourceId: string,
  isGroup = false,
  botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot"
): string {
  const prefix = isGroup ? "grp" : "get";
  return `https://t.me/${botUsername}?start=${prefix}_${resourceId}`;
}
