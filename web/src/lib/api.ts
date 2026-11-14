const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/+$/, "");

export interface AlternativeSource {
  channelUsername?: string;
  messageId?: number;
  url?: string;
  fileId?: string;
  archiveMessageId?: number;
  university?: string;
  downloadCount?: number;
  score?: number;
  _id?: string;
}

export interface ResourceItem {
  _id: string;
  fileName: string;
  cleanTitle?: string;
  title?: string;
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
  universities?: string[];
  downloadCount: number;
  indexedAt: string;
  groupItems?: ResourceItem[];
  alternativeSources?: AlternativeSource[];
  channelCount?: number;
  duplicateCount?: number;
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

export async function searchResources(
  params: {
    q?: string;
    university?: string;
    fileType?: string;
    isExam?: boolean;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<SearchResponse | null> {
  try {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.university) query.set("university", params.university);
    if (params.fileType) query.set("fileType", params.fileType);
    if (params.isExam) query.set("isExam", "true");
    if (params.page) query.set("page", params.page.toString());
    if (params.limit) query.set("limit", params.limit.toString());

    const res = await fetch(`${API_BASE}/search?${query.toString()}`, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw err;
    }
    console.warn("Search request failed:", err);
    return null;
  }
}

export interface SuggestionsResponse {
  success: boolean;
  data: SuggestionItem[];
}

export interface SuggestionItem {
  text: string;
  type: "subject" | "course" | "popular" | "recent";
  subjectKey?: string;
}

export async function fetchSearchSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<SuggestionItem[]> {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(`${API_BASE}/search/suggestions?q=${q}&limit=6`, { signal });
    if (!res.ok) return [];
    const json: SuggestionsResponse = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw err;
    }
    return [];
  }
}

export async function fetchSimilarResources(id: string): Promise<ResourceItem[]> {
  try {
    const res = await fetch(`${API_BASE}/resources/${id}/similar`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch (err) {
    console.warn("Failed to fetch similar resources:", err);
    return [];
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

export function getOfficeViewerUrl(streamUrl: string): string {
  const fullUrl = streamUrl.startsWith("http")
    ? streamUrl
    : typeof window !== "undefined"
    ? `${window.location.origin}${streamUrl}`
    : streamUrl;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`;
}

export function getGoogleDocsViewerUrl(streamUrl: string): string {
  const fullUrl = streamUrl.startsWith("http")
    ? streamUrl
    : typeof window !== "undefined"
    ? `${window.location.origin}${streamUrl}`
    : streamUrl;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
}
