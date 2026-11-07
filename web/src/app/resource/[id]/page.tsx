"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ResourceItem,
  getFileStreamUrl,
  getFileDownloadUrl,
  getTelegramBotDeepLink,
} from "@/lib/api";

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
    if (isPhotoAlbum) return `📥 Get all ${bundleCount} photos in Telegram`;
    if (isDocBundle) {
      if (resource?.fileType === "pdf") return `📥 Get all ${bundleCount} PDFs in Telegram`;
      if (resource?.fileType === "ppt") return `📥 Get all ${bundleCount} slides in Telegram`;
      return `📥 Get bundle (${bundleCount} files) in Telegram`;
    }
    return "Open in Telegram ↗";
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

  const displayTitle = resource?.caption && resource?.fileName
    ? resource.fileName
    : resource?.caption || resource?.fileName || "Academic Resource";

  return (
    <main>
      <section className="page-hero container">
        <Link className="muted" href="/explore">
          ← Back to resources
        </Link>
        <h1 style={{ fontSize: "36px", marginTop: "20px" }}>
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
              <div style={{ padding: "40px", textAlign: "center", width: "100%" }}>
                <p className="muted">Fetching resource details and preview...</p>
              </div>
            ) : isPhotoAlbum ? (
              /* Photo Album View */
              <div style={{ width: "100%", textAlign: "center" }}>
                <img
                  src={getFileStreamUrl(currentId)}
                  alt="Exam page preview"
                  style={{
                    maxHeight: "520px",
                    maxWidth: "100%",
                    borderRadius: "12px",
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
                <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
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
                          border: isSelected ? "1px solid var(--green)" : "1px solid var(--line)",
                          background: isSelected ? "var(--green-soft)" : "var(--surface)",
                          transition: "0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: item.fileType === "pdf" ? "#ffebeb" : "#fff0df",
                              color: item.fileType === "pdf" ? "#d94d4d" : "#d78020",
                            }}
                          >
                            {itemExt} #{idx + 1}
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? "var(--green)" : "var(--text)",
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
                            {isSelected ? "Viewing" : "Preview"}
                          </button>
                          <a
                            href={getFileDownloadUrl(item._id)}
                            download
                            className="btn btn-primary"
                            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
                          >
                            📥
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Currently Selected Document Preview Frame */}
                {currentItem?.fileType === "pdf" && (
                  <div style={{ width: "100%", height: "450px", marginTop: "14px" }}>
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
              <div style={{ width: "100%", height: "550px" }}>
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
              /* Other format placeholder */
              <div style={{ width: "100%", textAlign: "center" }}>
                <div className="preview-sheet" style={{ margin: "0 auto" }}>
                  <strong style={{ fontFamily: "Manrope", fontSize: "12px", fontWeight: 700 }}>
                    {resource?.courseCode || "STUDY MATERIAL"}
                  </strong>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <p style={{ fontSize: "9px", color: "var(--muted)", marginTop: "20px" }}>
                    {getTypeDescription()}
                  </p>
                </div>
                <p className="muted" style={{ margin: "18px 0 0" }}>
                  {getTypeDescription()} · Ready for download
                </p>
              </div>
            )}
          </div>

          {/* ── Right Detail Sidebar ──────────────────────────────── */}
          <aside className="detail-side">
            <div className={`file-type ${badgeTypeClass}`}>{getTypeBadge()}</div>

            <h3 style={{ marginTop: "16px" }}>
              {displayTitle}
            </h3>

            {resource?.caption && resource?.caption !== displayTitle && (
              <p className="muted" style={{ fontSize: "13px", marginTop: "8px" }}>
                {resource.caption}
              </p>
            )}

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />

            <div className="resource-meta" style={{ display: "grid", gap: "14px" }}>
              <div>
                <span className="muted" style={{ display: "block", fontSize: "11px" }}>
                  Subject / University
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  {resource?.university || resource?.courseCode || "General University Studies"}
                </strong>
              </div>

              <div>
                <span className="muted" style={{ display: "block", fontSize: "11px" }}>
                  Resource Type
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  {getTypeDescription()}
                </strong>
              </div>

              <div>
                <span className="muted" style={{ display: "block", fontSize: "11px" }}>
                  {isGroup ? "Total Bundle Size" : "File Size"}
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  {formatFileSize(resource?.fileSize)}
                </strong>
              </div>

              <div>
                <span className="muted" style={{ display: "block", fontSize: "11px" }}>
                  Source Community
                </span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  {resource?.channelUsername ? `@${resource.channelUsername}` : "Verified Student Channel"}
                </strong>
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "grid", gap: "10px" }}>
              <a
                className="btn btn-primary"
                href={getTelegramBotDeepLink(resourceId, isGroup)}
                target="_blank"
                rel="noreferrer"
              >
                {getTelegramButtonText()}
              </a>

              <a
                className="btn btn-outline"
                href={getFileDownloadUrl(currentId)}
                download
                target="_blank"
                rel="noreferrer"
              >
                {isDocBundle ? `Download Selected File 📥` : `Direct Download 📥`}
              </a>

              <Link
                className="btn btn-ghost"
                style={{ width: "100%", borderRadius: "999px", fontSize: "13px" }}
                href={`/explore?q=${encodeURIComponent(resource?.courseCode || resource?.university || "")}`}
              >
                Find similar resources
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
        <div className="container" style={{ padding: "60px 0", textAlign: "center" }}>
          <p className="muted">Loading resource details...</p>
        </div>
      }
    >
      <ResourceDetailContent />
    </Suspense>
  );
}
