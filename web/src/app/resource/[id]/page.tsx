"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Download,
  Search,
  BookOpen,
  Layers,
  GraduationCap,
  FileText,
  Calendar,
  Building2,
  HardDrive,
  Eye,
  CheckCircle2,
} from "lucide-react";
import {
  ResourceItem,
  getFileStreamUrl,
  getFileDownloadUrl,
  getTelegramBotDeepLink,
} from "@/lib/api";
import {
  FilePdfIcon,
  FilePptIcon,
  FileDocIcon,
  FileImageIcon,
  BundlePdfIcon,
  BundleSlidesIcon,
  BundleAlbumIcon,
  BundleDocIcon,
} from "@/components/icons";

const API_BASE = "/api";

function ResourceDetailContent() {
  const params = useParams();
  const resourceId = (params?.id as string) || "";

  const [resource, setResource] = useState<ResourceItem | null>(null);
  const [groupItems, setGroupItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  useEffect(() => {
    if (!resourceId) return;
    async function loadResource() {
      try {
        const res = await fetch(`${API_BASE}/resources/${resourceId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setResource(json.data);
            if (json.data.groupItems && Array.isArray(json.data.groupItems)) {
              setGroupItems(json.data.groupItems);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load resource:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadResource();
  }, [resourceId]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "Verified Telegram File";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isGroup = Boolean(resource?.groupId);
  const isPhotoAlbum = isGroup && resource?.fileType === "image";
  const isDocBundle = isGroup && resource?.fileType !== "image";
  const bundleCount = groupItems.length || resource?.groupTotal || 1;

  const currentItem = groupItems.length > 0 ? groupItems[activeGroupIndex] : resource;
  const currentId = currentItem ? currentItem._id : resourceId;

  // 3-Tier Taxonomy Disambiguation
  const getTypeBadge = () => {
    if (isPhotoAlbum) return "PHOTO ALBUM";
    if (isDocBundle) {
      if (resource?.fileType === "pdf") return "PDF BUNDLE";
      if (resource?.fileType === "ppt") return "SLIDE PACK";
      if (resource?.fileType === "doc") return "DOC PACKET";
      return "DOCUMENT BUNDLE";
    }
    if (resource?.fileType === "image") return "PHOTO";
    if (resource?.fileType === "ppt") return "PPT";
    if (resource?.fileType === "doc") return "DOC";
    return "PDF";
  };

  const getTypeDescription = () => {
    if (isPhotoAlbum) {
      return `Multi-Page Exam Photo Album (${bundleCount} pages)`;
    }
    if (isDocBundle) {
      if (resource?.fileType === "pdf") return `Curated PDF Collection (${bundleCount} files)`;
      if (resource?.fileType === "ppt") return `Lecture Presentation Pack (${bundleCount} slide decks)`;
      if (resource?.fileType === "doc") return `Document & Worksheet Packet (${bundleCount} files)`;
      return `Academic Resource Bundle (${bundleCount} files)`;
    }
    if (resource?.fileType === "image") return "Exam Sheet / Handwritten Notes · JPG/PNG";
    if (resource?.fileType === "ppt") return "Lecture Presentation · PowerPoint";
    if (resource?.fileType === "doc") return "Word Document · DOC/DOCX";
    return resource?.isExam ? "Past Exam Preparation · PDF" : "Lecture Notes / Textbook · PDF";
  };

  const getTelegramButtonText = () => {
    if (isPhotoAlbum) return `Get all ${bundleCount} photos in Telegram`;
    if (isDocBundle) {
      if (resource?.fileType === "pdf") return `Get all ${bundleCount} PDFs in Telegram`;
      if (resource?.fileType === "ppt") return `Get all ${bundleCount} slides in Telegram`;
      return `Get complete bundle (${bundleCount} files)`;
    }
    return "Open in Telegram Bot";
  };

  const badgeTypeClass = isPhotoAlbum
    ? "image"
    : resource?.fileType === "ppt"
    ? "ppt"
    : resource?.fileType === "doc"
    ? "doc"
    : resource?.fileType === "image"
    ? "image"
    : "pdf";

  const displayTitle =
    (resource as any)?.cleanTitle ||
    (resource as any)?.title ||
    resource?.fileName ||
    "Academic Resource";

  return (
    <main>
      <section className="page-hero container">
        <Link
          className="muted"
          href="/explore"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Resources</span>
        </Link>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", marginTop: "18px" }}>
          {displayTitle}
        </h1>
        <p>
          {isDocBundle
            ? `Curated bundle containing ${bundleCount} individual files. You can preview, download individual items, or receive the complete bundle via Telegram.`
            : isPhotoAlbum
            ? `Sequential multi-page exam album (${bundleCount} pages). You can swipe through pages or receive the complete set via Telegram.`
            : "Resource details and preview. Access full study materials or send directly to Telegram."}
        </p>
      </section>

      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="detail-layout">
          {/* ── Left Preview & Content Area ───────────────────────── */}
          <div className="preview-box" style={{ alignItems: "start" }}>
            {isLoading ? (
              <div style={{ padding: "60px", textAlign: "center", width: "100%" }}>
                <p className="muted">Fetching resource details and live stream...</p>
              </div>
            ) : isPhotoAlbum ? (
              /* Photo Album View */
              <div style={{ width: "100%", textAlign: "center" }}>
                <img
                  src={getFileStreamUrl(currentId)}
                  alt="Exam page preview"
                  style={{
                    maxHeight: "540px",
                    maxWidth: "100%",
                    borderRadius: "14px",
                    boxShadow: "var(--shadow)",
                    margin: "0 auto",
                    objectFit: "contain",
                    display: "block",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />

                {groupItems.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      justifyContent: "center",
                      marginTop: "18px",
                      flexWrap: "wrap",
                    }}
                  >
                    {groupItems.map((item, idx) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => setActiveGroupIndex(idx)}
                        className={`chip ${activeGroupIndex === idx ? "selected" : ""}`}
                      >
                        Page {idx + 1} of {groupItems.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : isDocBundle ? (
              /* Multi-File Document Bundle View */
              <div style={{ width: "100%", textAlign: "left" }}>
                <div style={{ marginBottom: "18px" }}>
                  <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>
                    Bundle Contents ({groupItems.length || bundleCount} files)
                  </h3>
                  <p className="muted" style={{ fontSize: "13px" }}>
                    Select any file to preview, download individual files, or get all files natively via Telegram.
                  </p>
                </div>

                {/* Bundle Items List */}
                <div style={{ display: "grid", gap: "10px", marginBottom: "22px" }}>
                  {groupItems.map((item, idx) => {
                    const isSelected = activeGroupIndex === idx;
                    const itemExt = item.fileType === "pdf" ? "PDF" : item.fileType === "ppt" ? "PPT" : "DOC";
                    const itemSize = formatFileSize(item.fileSize);

                    return (
                      <div
                        key={item._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          border: isSelected ? "1px solid var(--primary)" : "1px solid var(--line)",
                          background: isSelected ? "var(--primary-soft)" : "var(--surface)",
                          transition: "0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                          <span
                            className={`file-type ${item.fileType || "pdf"}`}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                            }}
                          >
                            {item.fileType === "ppt" ? (
                              <FilePptIcon size={18} />
                            ) : item.fileType === "doc" ? (
                              <FileDocIcon size={18} />
                            ) : item.fileType === "image" ? (
                              <FileImageIcon size={18} />
                            ) : (
                              <FilePdfIcon size={18} />
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? "var(--primary)" : "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.fileName || `Part ${idx + 1}`}
                          </span>
                          <span className="muted" style={{ fontSize: "12px", flexShrink: 0 }}>
                            {itemSize}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "12px" }}>
                          <button
                            type="button"
                            onClick={() => setActiveGroupIndex(idx)}
                            className="btn btn-outline"
                            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
                          >
                            <Eye size={12} />
                            <span>{isSelected ? "Viewing" : "Preview"}</span>
                          </button>
                          <a
                            href={getFileDownloadUrl(item._id)}
                            download
                            className="btn btn-primary"
                            style={{ padding: "6px 10px", fontSize: "12px", borderRadius: "8px" }}
                            title="Download file"
                          >
                            <Download size={13} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Currently Selected Document Preview Frame */}
                {currentItem?.fileType === "pdf" && (
                  <div style={{ width: "100%", height: "480px", marginTop: "14px" }}>
                    <iframe
                      src={getFileStreamUrl(currentId)}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "0",
                        borderRadius: "14px",
                        boxShadow: "var(--shadow)",
                      }}
                      title="Selected Document Preview"
                    />
                  </div>
                )}
              </div>
            ) : resource?.fileType === "pdf" ? (
              /* Single PDF Viewer */
              <div style={{ width: "100%", height: "560px" }}>
                <iframe
                  src={getFileStreamUrl(resourceId)}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "0",
                    borderRadius: "14px",
                    boxShadow: "var(--shadow)",
                  }}
                  title="PDF Preview"
                />
              </div>
            ) : (
              /* Tasteful file preview placeholder */
              <div style={{ width: "100%", textAlign: "center", padding: "30px 0" }}>
                <div
                  style={{
                    width: "220px",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "16px",
                    boxShadow: "var(--shadow)",
                    padding: "24px 20px",
                    margin: "0 auto",
                    textAlign: "left",
                  }}
                >
                  <div className={`file-type ${badgeTypeClass}`} style={{ width: "36px", height: "36px", marginBottom: "16px" }}>
                    {getTypeBadge()}
                  </div>
                  <strong style={{ fontFamily: "Manrope", fontSize: "13px", fontWeight: 700, display: "block" }}>
                    {resource?.courseCode || "ACADEMIC DOCUMENT"}
                  </strong>
                  <div style={{ height: "6px", background: "var(--surface-3)", borderRadius: "4px", margin: "14px 0 8px" }} />
                  <div style={{ height: "6px", width: "70%", background: "var(--surface-3)", borderRadius: "4px", margin: "8px 0" }} />
                  <div style={{ height: "6px", width: "85%", background: "var(--surface-3)", borderRadius: "4px", margin: "8px 0" }} />
                  <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "24px", marginBottom: 0 }}>
                    {getTypeDescription()}
                  </p>
                </div>
                <p className="muted" style={{ margin: "20px 0 0", fontSize: "14px" }}>
                  {getTypeDescription()} · Ready for instant download or Telegram delivery
                </p>
              </div>
            )}
          </div>

          {/* ── Right Detail Sidebar ──────────────────────────────── */}
          <aside className="detail-side">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className={`file-type ${badgeTypeClass}`} style={{ width: "46px", height: "46px" }}>
                {resource?.fileType === "ppt" ? (
                  <FilePptIcon size={24} />
                ) : resource?.fileType === "doc" ? (
                  <FileDocIcon size={24} />
                ) : resource?.fileType === "image" ? (
                  <FileImageIcon size={24} />
                ) : (
                  <FilePdfIcon size={24} />
                )}
              </div>
              <div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--primary)",
                    display: "block",
                  }}
                >
                  {getTypeBadge()}
                </span>
                <span className="muted" style={{ fontSize: "11px" }}>
                  {isGroup ? `${bundleCount} Items Package` : "Single Document"}
                </span>
              </div>
            </div>

            <h3 style={{ marginTop: "16px", fontSize: "18px" }}>
              {displayTitle}
            </h3>

            {resource?.caption && resource?.caption !== displayTitle && (
              <p className="muted" style={{ fontSize: "13px", marginTop: "8px", lineHeight: "1.5" }}>
                {resource.caption}
              </p>
            )}

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />

            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <Building2 size={12} />
                  <span>Subject / University</span>
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px", display: "block", marginTop: "3px" }}>
                  {resource?.university || resource?.courseCode || "General University Studies"}
                </strong>
              </div>

              <div>
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <BookOpen size={12} />
                  <span>Resource Classification</span>
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px", display: "block", marginTop: "3px" }}>
                  {getTypeDescription()}
                </strong>
              </div>

              <div>
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <HardDrive size={12} />
                  <span>{isGroup ? "Total Bundle Size" : "File Size"}</span>
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px", display: "block", marginTop: "3px" }}>
                  {formatFileSize(resource?.fileSize)}
                </strong>
              </div>

              <div>
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <Send size={12} />
                  <span>Source Channel</span>
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px", display: "block", marginTop: "3px" }}>
                  {resource?.channelUsername ? `@${resource.channelUsername}` : "Verified Student Channel"}
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: "26px", display: "grid", gap: "10px" }}>
              <a
                className="btn btn-primary"
                href={getTelegramBotDeepLink(resourceId, isGroup)}
                target="_blank"
                rel="noreferrer"
              >
                <Send size={15} />
                <span>{getTelegramButtonText()}</span>
              </a>

              <a
                className="btn btn-outline"
                href={getFileDownloadUrl(currentId)}
                download
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} />
                <span>{isDocBundle ? "Download Selected File" : "Direct Download"}</span>
              </a>

              <Link
                className="btn btn-ghost"
                style={{ width: "100%", borderRadius: "12px", fontSize: "13px" }}
                href={`/explore?q=${encodeURIComponent(resource?.courseCode || resource?.university || "")}`}
              >
                <Search size={14} />
                <span>Find Similar Resources</span>
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default function ResourceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
          <p className="muted">Loading resource details...</p>
        </div>
      }
    >
      <ResourceDetailContent />
    </Suspense>
  );
}
