"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import {
  ResourceItem,
  getFileStreamUrl,
  getFileDownloadUrl,
  getTelegramBotDeepLink,
  fetchSimilarResources,
  getOfficeViewerUrl,
  getGoogleDocsViewerUrl,
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
import {
  StudyHubLoader,
  DocumentPreviewSkeleton,
  ButtonLoadingState,
  InlineSpinner,
  useToast,
} from "@/components/loading";

const API_BASE = "/api";

function ResourceDetailContent() {
  const params = useParams();
  const resourceId = (params?.id as string) || "";
  const { showToast } = useToast();

  // Core Data States
  const [resource, setResource] = useState<ResourceItem | null>(null);
  const [groupItems, setGroupItems] = useState<ResourceItem[]>([]);
  const [similarResources, setSimilarResources] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Group / Album Navigation State
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Multi-Selection State for Bundles
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Active Download & Fallback State
  const [downloadState, setDownloadState] = useState<{
    status: "idle" | "downloading" | "done" | "error";
    activeId?: string;
  }>({ status: "idle" });

  const [fallbackModal, setFallbackModal] = useState<{
    open: boolean;
    title: string;
    reason: string;
    botUrl: string;
    resourceId?: string;
    fileName?: string;
  }>({
    open: false,
    title: "",
    reason: "",
    botUrl: "",
  });

  // Touch swipe refs
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // 1. Initial Load of Resource & Group Items
  useEffect(() => {
    if (!resourceId) return;
    let isMounted = true;

    async function loadResource() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/resources/${resourceId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && isMounted) {
            const data: ResourceItem = json.data;
            setResource(data);

            if (data.groupItems && Array.isArray(data.groupItems) && data.groupItems.length > 0) {
              setGroupItems(data.groupItems);
              // Initialize selected items for bundles
              setSelectedItemIds(data.groupItems.map((item) => item._id));

              // If the navigated resource is part of the group, align the active index
              const targetIdx = data.groupItems.findIndex((it) => it._id === resourceId);
              if (targetIdx >= 0) {
                setActiveGroupIndex(targetIdx);
              } else {
                setActiveGroupIndex(0);
              }
            } else {
              setGroupItems([]);
              setSelectedItemIds([data._id]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load resource:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadResource();

    // Fetch similar resources asynchronously
    fetchSimilarResources(resourceId).then((items) => {
      if (isMounted && items && items.length > 0) {
        setSimilarResources(items);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [resourceId]);

  // Reset image loading states when active index changes
  useEffect(() => {
    setIsImageLoading(true);
    setImageError(false);
  }, [activeGroupIndex]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "Telegram Cloud";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isGroup = Boolean(resource?.groupId);
  const isPhotoAlbum = isGroup && resource?.fileType === "image";
  const isDocBundle = isGroup && resource?.fileType !== "image";
  const bundleCount = groupItems.length || resource?.groupTotal || 1;

  const currentItem = groupItems.length > 0 ? groupItems[activeGroupIndex] : resource;
  const currentId = currentItem ? currentItem._id : resourceId;

  // Total Bundle Size Calculation (Dynamic aggregation)
  const totalBundleSize =
    groupItems.length > 0
      ? groupItems.reduce((acc, it) => acc + (it.fileSize || 0), 0)
      : resource?.fileSize || 0;

  // Selected items size calculation
  const selectedBundleSize =
    groupItems.length > 0 && selectedItemIds.length > 0
      ? groupItems
          .filter((it) => selectedItemIds.includes(it._id))
          .reduce((acc, it) => acc + (it.fileSize || 0), 0)
      : totalBundleSize;

  // Gallery Navigation Handlers
  const goToPrevImage = useCallback(() => {
    if (groupItems.length <= 1) return;
    setActiveGroupIndex((prev) => (prev > 0 ? prev - 1 : groupItems.length - 1));
  }, [groupItems.length]);

  const goToNextImage = useCallback(() => {
    if (groupItems.length <= 1) return;
    setActiveGroupIndex((prev) => (prev < groupItems.length - 1 ? prev + 1 : 0));
  }, [groupItems.length]);

  // Keyboard navigation for image album & fullscreen
  useEffect(() => {
    if (!isPhotoAlbum) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        goToPrevImage();
      } else if (e.key === "ArrowRight") {
        goToNextImage();
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoAlbum, isFullscreen, goToPrevImage, goToNextImage]);

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const diff = touchStartXRef.current - touchEndXRef.current;
    const threshold = 45; // Min px to qualify as swipe

    if (diff > threshold) {
      // Swiped Left -> Next
      goToNextImage();
    } else if (diff < -threshold) {
      // Swiped Right -> Prev
      goToPrevImage();
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Multi-Selection Toggle Handlers
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === groupItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(groupItems.map((item) => item._id));
    }
  };

  // Active Download Manager (Handles timeouts & triggers Telegram fallback modal)
  const handleDirectDownload = async (itemToDownload?: ResourceItem | null) => {
    const item = itemToDownload || currentItem || resource;
    if (!item) return;

    const id = item._id;
    const fileName =
      item.fileName ||
      `${(resource as any)?.cleanTitle || "studyhub_resource"}.${
        item.fileType === "pdf" ? "pdf" : item.fileType === "ppt" ? "pptx" : "bin"
      }`;
    const botUrl = getTelegramBotDeepLink(id, false);

    setDownloadState({ status: "downloading", activeId: id });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s timeout

      const res = await fetch(getFileDownloadUrl(id), {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get("content-type") || "";

      // Check if response is JSON (Error or redirect payload)
      if (!res.ok || contentType.includes("application/json") || contentType.includes("text/html")) {
        let errorMsg = "Direct browser stream timed out or exceeded connection limit.";
        try {
          const errJson = await res.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch (_) {}

        setDownloadState({ status: "error", activeId: id });
        setFallbackModal({
          open: true,
          title: "Direct Download Interrupted",
          reason:
            item.fileSize && item.fileSize > 15 * 1024 * 1024
              ? `This file is large (${formatFileSize(item.fileSize)}). Mobile and browser networks often disconnect large file streams. Telegram delivers directly at maximum speed.`
              : errorMsg,
          botUrl: res.headers.get("X-Bot-Fallback-Url") || botUrl,
          resourceId: id,
          fileName,
        });
        return;
      }

      // Successful binary download
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = blobUrl;
      tempLink.download = fileName;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(blobUrl);

      setDownloadState({ status: "done", activeId: id });
      showToast(`Downloaded ${fileName}`, "success");
      setTimeout(() => setDownloadState({ status: "idle" }), 3000);
    } catch (err: any) {
      console.error("Direct download failed:", err);
      setDownloadState({ status: "error", activeId: id });
      showToast("Download stream timed out. Opening fallback options.", "error");
      setFallbackModal({
        open: true,
        title: "Download Connection Timed Out",
        reason:
          "The browser connection timed out while retrieving this file from Telegram cloud storage. Open in Telegram Bot to receive it instantly with resume support.",
        botUrl,
        resourceId: id,
        fileName,
      });
    }
  };

  // Batch download of selected items
  const handleDownloadSelected = async () => {
    const selectedItems = groupItems.filter((item) => selectedItemIds.includes(item._id));
    if (selectedItems.length === 0) return;

    // For multi-item packages, advise Telegram delivery for 1-tap reception or download in sequence
    if (selectedItems.length > 3) {
      setFallbackModal({
        open: true,
        title: `Package with ${selectedItems.length} Files`,
        reason: `Downloading ${selectedItems.length} files (${formatFileSize(
          selectedBundleSize
        )}) simultaneously in a browser can trigger pop-up blockers. Open the Telegram Bot to receive all ${selectedItems.length} files packaged neatly in one message.`,
        botUrl: getTelegramBotDeepLink(resourceId, true),
        resourceId,
        fileName: "Complete Bundle",
      });
      return;
    }

    for (const it of selectedItems) {
      await handleDirectDownload(it);
    }
  };

  // Scroll to "Similar Resources"
  const handleFindSimilarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const elem = document.getElementById("similar-resources");
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth" });
    }
  };

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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Resources</span>
        </Link>

        <h1 style={{ fontSize: "clamp(26px, 3.8vw, 40px)", marginTop: "16px" }}>
          {displayTitle}
        </h1>

        <p>
          {isDocBundle
            ? `Curated bundle containing ${bundleCount} individual files (${formatFileSize(
                totalBundleSize
              )}). You can preview each item, download selected files, or receive the full package instantly via Telegram.`
            : isPhotoAlbum
            ? `Multi-page exam photo album with ${bundleCount} pages. Swipe or use arrow keys to browse through all pages, view full-screen, or get the entire set via Telegram.`
            : "Resource details and live preview. Download directly to your device or receive high-speed delivery via Telegram."}
        </p>
      </section>

      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="detail-layout">
          {/* ── Left Preview & Content Area ───────────────────────── */}
          <div className="preview-box">
            {isLoading ? (
              <DocumentPreviewSkeleton height="560px" />
            ) : isPhotoAlbum ? (
              /* ── 1. Photo Album Gallery View ─────────────────────── */
              <div className="gallery-container">
                <div
                  className="gallery-viewport"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* Top Bar with Page Indicator & Fullscreen Button */}
                  <div className="gallery-top-controls">
                    <span className="gallery-counter-pill">
                      Page {activeGroupIndex + 1} of {groupItems.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      className="gallery-action-btn"
                      title="View Fullscreen"
                      aria-label="View Fullscreen"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>

                  {/* Previous Button */}
                  {groupItems.length > 1 && (
                    <button
                      type="button"
                      onClick={goToPrevImage}
                      className="gallery-nav-btn gallery-nav-prev"
                      aria-label="Previous Page"
                      title="Previous Page (Left Arrow)"
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}

                  {/* Active Image Canvas with key to prevent state sticking */}
                  {isImageLoading && !imageError && (
                    <div
                      style={{
                        position: "absolute",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2,
                      }}
                    >
                      <StudyHubLoader
                        size="sm"
                        message={`Loading page ${activeGroupIndex + 1}...`}
                      />
                    </div>
                  )}

                  {imageError ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
                      <AlertCircle size={36} style={{ color: "var(--accent)", margin: "0 auto 12px" }} />
                      <h4 style={{ fontSize: "16px", color: "var(--text)" }}>Image Preview Unavailable</h4>
                      <p style={{ fontSize: "13px", maxWidth: "320px", margin: "6px auto 16px" }}>
                        This exam page could not be streamed directly in browser.
                      </p>
                      <a
                        href={getTelegramBotDeepLink(resourceId, true)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ padding: "8px 16px", fontSize: "13px" }}
                      >
                        <Send size={14} />
                        <span>View in Telegram Bot</span>
                      </a>
                    </div>
                  ) : (
                    <img
                      key={currentId}
                      src={getFileStreamUrl(currentId)}
                      alt={`Exam page ${activeGroupIndex + 1}`}
                      className="gallery-img"
                      style={{
                        opacity: isImageLoading ? 0.2 : 1,
                      }}
                      onLoad={() => setIsImageLoading(false)}
                      onError={() => {
                        setIsImageLoading(false);
                        setImageError(true);
                      }}
                    />
                  )}

                  {/* Next Button */}
                  {groupItems.length > 1 && (
                    <button
                      type="button"
                      onClick={goToNextImage}
                      className="gallery-nav-btn gallery-nav-next"
                      aria-label="Next Page"
                      title="Next Page (Right Arrow)"
                    >
                      <ChevronRight size={24} />
                    </button>
                  )}
                </div>

                {/* Thumbnail Strip with Active Glow */}
                {groupItems.length > 1 && (
                  <div className="gallery-thumb-strip">
                    {groupItems.map((item, idx) => {
                      const isActive = activeGroupIndex === idx;
                      return (
                        <div
                          key={item._id}
                          onClick={() => setActiveGroupIndex(idx)}
                          className={`gallery-thumb-item ${isActive ? "active" : ""}`}
                          title={`Jump to Page ${idx + 1}`}
                        >
                          <img
                            src={getFileStreamUrl(item._id)}
                            alt={`Thumb ${idx + 1}`}
                            loading="lazy"
                            onError={(e) => {
                              // Fallback thumb if error
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <span className="gallery-thumb-number">{idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : isDocBundle ? (
              /* ── 2. Multi-File Document Bundle View ───────────────── */
              <div style={{ width: "100%", textAlign: "left" }}>
                {/* Bundle Header & Selection Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>
                      Bundle Contents ({groupItems.length} files)
                    </h3>
                    <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
                      Total Size: <strong>{formatFileSize(totalBundleSize)}</strong>
                      {selectedItemIds.length > 0 && selectedItemIds.length !== groupItems.length && (
                        <span>
                          {" "}
                          • Selected: {selectedItemIds.length} files (
                          {formatFileSize(selectedBundleSize)})
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Batch Selection Controls */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="btn btn-outline"
                      style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
                    >
                      {selectedItemIds.length === groupItems.length ? (
                        <>
                          <CheckSquare size={13} />
                          <span>Deselect All</span>
                        </>
                      ) : (
                        <>
                          <Square size={13} />
                          <span>Select All</span>
                        </>
                      )}
                    </button>

                    {selectedItemIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadSelected}
                        className="btn btn-primary"
                        style={{ padding: "6px 14px", fontSize: "12px", borderRadius: "8px" }}
                      >
                        <Download size={13} />
                        <span>Download Selected ({selectedItemIds.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bundle Index List */}
                <div style={{ display: "grid", gap: "10px", marginBottom: "22px" }}>
                  {groupItems.map((item, idx) => {
                    const isSelected = activeGroupIndex === idx;
                    const isChecked = selectedItemIds.includes(item._id);
                    const itemSize = formatFileSize(item.fileSize);
                    const isDownloadingThis =
                      downloadState.status === "downloading" && downloadState.activeId === item._id;

                    return (
                      <div
                        key={item._id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          borderRadius: "14px",
                          border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--card-border)",
                          background: isSelected ? "var(--primary-soft)" : "var(--surface)",
                          boxShadow: "var(--shadow-card)",
                          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {/* Checkbox for batch select */}
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(item._id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: isChecked ? "var(--primary)" : "var(--muted)",
                              display: "flex",
                              alignItems: "center",
                            }}
                            title={isChecked ? "Deselect item" : "Select item"}
                          >
                            {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>

                          <span
                            className={`file-type ${item.fileType || "pdf"}`}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              flexShrink: 0,
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

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? "var(--primary)" : "var(--text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                              }}
                            >
                              {item.fileName || `Item ${idx + 1}`}
                            </span>
                            <span className="muted" style={{ fontSize: "12px" }}>
                              {itemSize}
                            </span>
                          </div>
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

                          <button
                            type="button"
                            onClick={() => handleDirectDownload(item)}
                            disabled={isDownloadingThis}
                            className="btn btn-primary"
                            style={{ padding: "6px 10px", fontSize: "12px", borderRadius: "8px" }}
                            title="Download this file"
                          >
                            {isDownloadingThis ? (
                              <InlineSpinner size={13} color="white" />
                            ) : (
                              <Download size={13} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Currently Selected Document Preview Frame */}
                {currentItem && (
                  <div
                    style={{
                      width: "100%",
                      height: "500px",
                      marginTop: "16px",
                      borderRadius: "16px",
                      overflow: "hidden",
                      border: "1px solid var(--card-border)",
                      boxShadow: "var(--shadow-card)",
                      background: "var(--surface)",
                    }}
                  >
                    {currentItem.fileType === "pdf" ? (
                      <iframe
                        key={currentId}
                        src={getFileStreamUrl(currentId)}
                        style={{ width: "100%", height: "100%", border: 0 }}
                        title="Selected Document Preview"
                      />
                    ) : currentItem.fileType === "ppt" || currentItem.fileType === "doc" ? (
                      <iframe
                        key={currentId}
                        src={getOfficeViewerUrl(getFileStreamUrl(currentId))}
                        style={{ width: "100%", height: "100%", border: 0 }}
                        title="Office Document Preview"
                      />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "24px",
                          textAlign: "center",
                        }}
                      >
                        <FileText size={48} className="muted" style={{ marginBottom: "16px" }} />
                        <h4 style={{ fontSize: "18px" }}>{currentItem.fileName}</h4>
                        <p className="muted" style={{ fontSize: "13px", marginTop: "4px" }}>
                          Format: {currentItem.fileType?.toUpperCase()} · Size:{" "}
                          {formatFileSize(currentItem.fileSize)}
                        </p>
                        <ButtonLoadingState
                          variant="primary"
                          isLoading={downloadState.status === "downloading" && downloadState.activeId === currentItem._id}
                          isSuccess={downloadState.status === "done" && downloadState.activeId === currentItem._id}
                          loadingText="Preparing..."
                          successText="Ready!"
                          onClick={() => handleDirectDownload(currentItem)}
                          icon={<Download size={15} />}
                          style={{ marginTop: "16px", padding: "8px 20px" }}
                        >
                          Download Item
                        </ButtonLoadingState>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : resource?.fileType === "pdf" ? (
              /* ── 3. Single PDF Viewer ─────────────────────────────── */
              <div style={{ width: "100%", height: "600px", position: "relative" }}>
                <iframe
                  key={resourceId}
                  src={getFileStreamUrl(resourceId)}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    borderRadius: "14px",
                    boxShadow: "var(--shadow-card)",
                  }}
                  title="PDF Preview"
                />
              </div>
            ) : resource?.fileType === "ppt" || resource?.fileType === "doc" ? (
              /* ── 4. PowerPoint / Word Presentation Card & Office Embed ── */
              <div style={{ width: "100%", textAlign: "center", padding: "16px 0" }}>
                <div
                  style={{
                    width: "min(100%, 440px)",
                    background: "var(--surface)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "20px",
                    boxShadow: "var(--shadow-card)",
                    padding: "32px 24px",
                    margin: "0 auto",
                    textAlign: "center",
                  }}
                >
                  <div
                    className={`file-type ${badgeTypeClass}`}
                    style={{
                      width: "60px",
                      height: "60px",
                      margin: "0 auto 18px",
                      borderRadius: "14px",
                    }}
                  >
                    {resource?.fileType === "ppt" ? (
                      <FilePptIcon size={32} />
                    ) : (
                      <FileDocIcon size={32} />
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--primary)",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    {resource?.fileType === "ppt" ? "POWERPOINT PRESENTATION" : "WORD DOCUMENT"}
                  </span>

                  <h3 style={{ fontSize: "19px", marginBottom: "8px" }}>{displayTitle}</h3>

                  <p className="muted" style={{ fontSize: "13px", lineHeight: "1.5" }}>
                    {resource?.courseCode || "Academic Curriculum"} •{" "}
                    {resource?.university || "University Course Material"}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "8px",
                      margin: "24px 0 12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDirectDownload(resource)}
                      className="btn btn-primary"
                      style={{ padding: "8px 18px", fontSize: "13px" }}
                    >
                      <Download size={14} />
                      <span>Download {resource?.fileType === "ppt" ? ".PPTX" : ".DOCX"}</span>
                    </button>

                    <a
                      href={getOfficeViewerUrl(getFileStreamUrl(resourceId))}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline"
                      style={{ padding: "8px 14px", fontSize: "13px" }}
                    >
                      <ExternalLink size={14} />
                      <span>Office Viewer</span>
                    </a>
                  </div>
                </div>

                <p className="muted" style={{ margin: "22px 0 0", fontSize: "14px" }}>
                  {getTypeDescription()} · Instant high-speed delivery available
                </p>
              </div>
            ) : (
              /* ── 5. Generic Document Card ─────────────────────────── */
              <div style={{ width: "100%", textAlign: "center", padding: "40px 0" }}>
                <div
                  style={{
                    width: "280px",
                    background: "var(--surface)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "18px",
                    boxShadow: "var(--shadow-card)",
                    padding: "28px 22px",
                    margin: "0 auto",
                    textAlign: "left",
                  }}
                >
                  <div
                    className={`file-type ${badgeTypeClass}`}
                    style={{ width: "42px", height: "42px", marginBottom: "16px" }}
                  >
                    {getTypeBadge()}
                  </div>
                  <strong
                    style={{
                      fontFamily: "Manrope",
                      fontSize: "14px",
                      fontWeight: 700,
                      display: "block",
                    }}
                  >
                    {resource?.courseCode || "ACADEMIC DOCUMENT"}
                  </strong>
                  <div
                    style={{
                      height: "6px",
                      background: "var(--surface-3)",
                      borderRadius: "4px",
                      margin: "14px 0 8px",
                    }}
                  />
                  <div
                    style={{
                      height: "6px",
                      width: "70%",
                      background: "var(--surface-3)",
                      borderRadius: "4px",
                      margin: "8px 0",
                    }}
                  />
                  <div
                    style={{
                      height: "6px",
                      width: "85%",
                      background: "var(--surface-3)",
                      borderRadius: "4px",
                      margin: "8px 0",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      marginTop: "20px",
                      marginBottom: 0,
                    }}
                  >
                    {getTypeDescription()}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Detail Sidebar ──────────────────────────────── */}
          <aside className="detail-side">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                className={`file-type ${badgeTypeClass}`}
                style={{ width: "46px", height: "46px", borderRadius: "12px" }}
              >
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
                  {isGroup ? `${bundleCount} Items Package` : "Single Resource"}
                </span>
              </div>
            </div>

            <h3 style={{ marginTop: "16px", fontSize: "18px", lineHeight: "1.4" }}>
              {displayTitle}
            </h3>

            {resource?.caption && resource?.caption !== displayTitle && (
              <p
                className="muted"
                style={{ fontSize: "13px", marginTop: "8px", lineHeight: "1.5" }}
              >
                {resource.caption}
              </p>
            )}

            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--line)",
                margin: "18px 0",
              }}
            />

            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <span
                  className="muted"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <Building2 size={12} />
                  <span>Subject / University</span>
                </span>
                <strong
                  style={{
                    color: "var(--text)",
                    fontSize: "14px",
                    display: "block",
                    marginTop: "3px",
                  }}
                >
                  {resource?.university || resource?.courseCode || "General University Studies"}
                </strong>
              </div>

              <div>
                <span
                  className="muted"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <BookOpen size={12} />
                  <span>Resource Classification</span>
                </span>
                <strong
                  style={{
                    color: "var(--text)",
                    fontSize: "14px",
                    display: "block",
                    marginTop: "3px",
                  }}
                >
                  {getTypeDescription()}
                </strong>
              </div>

              {/* Total Aggregated File Size */}
              <div>
                <span
                  className="muted"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <HardDrive size={12} />
                  <span>{isGroup ? "Total Bundle Size" : "File Size"}</span>
                </span>
                <strong
                  style={{
                    color: "var(--text)",
                    fontSize: "14px",
                    display: "block",
                    marginTop: "3px",
                  }}
                >
                  {formatFileSize(totalBundleSize)}
                  {isGroup && (
                    <span className="muted" style={{ fontWeight: 400, fontSize: "12px", marginLeft: "6px" }}>
                      ({bundleCount} {bundleCount === 1 ? "file" : "files"})
                    </span>
                  )}
                </strong>
              </div>

              <div>
                <span
                  className="muted"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <Send size={12} />
                  <span>Source Channel</span>
                </span>
                <strong
                  style={{
                    color: "var(--text)",
                    fontSize: "14px",
                    display: "block",
                    marginTop: "3px",
                  }}
                >
                  {resource?.channelUsername ? `@${resource.channelUsername}` : "Verified Student Channel"}
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: "24px", display: "grid", gap: "10px" }}>
              <a
                className="btn btn-primary"
                href={getTelegramBotDeepLink(resourceId, isGroup)}
                target="_blank"
                rel="noreferrer"
                style={{ padding: "12px 18px", fontSize: "14px" }}
                onClick={() => showToast("Opening Telegram Bot...", "telegram", 2500)}
              >
                <Send size={16} />
                <span>{getTelegramButtonText()}</span>
              </a>

              <ButtonLoadingState
                variant="outline"
                isLoading={downloadState.status === "downloading" && (!downloadState.activeId || downloadState.activeId === currentId)}
                isSuccess={downloadState.status === "done" && (!downloadState.activeId || downloadState.activeId === currentId)}
                loadingText="Preparing Stream..."
                successText="Download Ready!"
                onClick={() => handleDirectDownload()}
                icon={<Download size={15} />}
                style={{ padding: "11px 18px", fontSize: "14px" }}
              >
                {isDocBundle ? "Download Current File" : "Direct Download"}
              </ButtonLoadingState>

              {/* Find Similar Button (Updated per user instruction) */}
              <button
                type="button"
                onClick={handleFindSimilarClick}
                className="btn btn-ghost"
                style={{ width: "100%", borderRadius: "12px", fontSize: "13px" }}
              >
                <Search size={14} />
                <span>Find Similar</span>
              </button>
            </div>
          </aside>
        </div>

        {/* ── Similar Academic Resources Section ───────────────────── */}
        <div id="similar-resources" style={{ marginTop: "54px", paddingTop: "32px", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--primary)",
                }}
              >
                Recommendations
              </span>
              <h3 style={{ fontSize: "22px", marginTop: "4px" }}>Similar Academic Resources</h3>
            </div>

            <Link
              href={`/explore?q=${encodeURIComponent(resource?.courseCode || resource?.university || "")}`}
              className="muted"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <span>Explore More</span>
              <ExternalLink size={13} />
            </Link>
          </div>

          {similarResources.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "18px",
              }}
            >
              {similarResources.map((item) => (
                <Link
                  key={item._id}
                  href={`/resource/${item._id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "18px",
                    background: "var(--surface)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "16px",
                    boxShadow: "var(--shadow-card)",
                    transition: "all 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
                    textDecoration: "none",
                  }}
                  className="similar-card"
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span
                        className={`file-type ${item.fileType || "pdf"}`}
                        style={{ width: "32px", height: "32px", borderRadius: "8px" }}
                      >
                        {item.fileType === "ppt" ? (
                          <FilePptIcon size={16} />
                        ) : item.fileType === "doc" ? (
                          <FileDocIcon size={16} />
                        ) : item.fileType === "image" ? (
                          <FileImageIcon size={16} />
                        ) : (
                          <FilePdfIcon size={16} />
                        )}
                      </span>
                      <span className="muted" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                        {item.fileType?.toUpperCase() || "PDF"}
                      </span>
                    </div>

                    <strong
                      style={{
                        fontSize: "14px",
                        lineHeight: "1.4",
                        color: "var(--text)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.cleanTitle || item.title || item.fileName || "Academic Document"}
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                    <span className="muted" style={{ fontSize: "12px" }}>
                      {item.university || item.courseCode || "Verified Resource"}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--primary)" }}>
                      {formatFileSize(item.fileSize)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ padding: "32px", textAlign: "center", background: "var(--surface)", borderRadius: "16px", border: "1px solid var(--card-border)" }}>
              <p className="muted" style={{ margin: 0, fontSize: "14px" }}>
                Looking for more materials in this topic?{" "}
                <Link
                  href={`/explore?q=${encodeURIComponent(resource?.courseCode || resource?.university || "")}`}
                  style={{ color: "var(--primary)", fontWeight: 600 }}
                >
                  Search in Explore directory &rarr;
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Fullscreen Lightbox Modal for Photo Albums ───────────── */}
      {isFullscreen && isPhotoAlbum && (
        <div className="lightbox-modal" onClick={() => setIsFullscreen(false)}>
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              zIndex: 100000,
            }}
          >
            <span className="gallery-counter-pill" style={{ fontSize: "13px" }}>
              Page {activeGroupIndex + 1} of {groupItems.length}
            </span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="gallery-action-btn"
              style={{ width: "40px", height: "40px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "none" }}
              aria-label="Close Fullscreen"
            >
              <X size={20} />
            </button>
          </div>

          <div className="lightbox-modal-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={getFileStreamUrl(currentId)}
              alt={`Fullscreen Exam Page ${activeGroupIndex + 1}`}
              className="lightbox-modal-img"
            />

            {groupItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPrevImage}
                  className="gallery-nav-btn gallery-nav-prev"
                  style={{ left: "-24px" }}
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  className="gallery-nav-btn gallery-nav-next"
                  style={{ right: "-24px" }}
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Telegram Fallback Modal (Triggered when Direct Download stalls) ── */}
      {fallbackModal.open && (
        <div className="download-modal-backdrop" onClick={() => setFallbackModal((prev) => ({ ...prev, open: false }))}>
          <div className="download-modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(8, 120, 249, 0.12)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Send size={26} />
            </div>

            <h3 style={{ fontSize: "20px", marginBottom: "8px" }}>{fallbackModal.title}</h3>

            <p className="muted" style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
              {fallbackModal.reason}
            </p>

            <div style={{ display: "grid", gap: "10px" }}>
              <a
                href={fallbackModal.botUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ padding: "12px", fontSize: "14px", textDecoration: "none" }}
              >
                <Send size={16} />
                <span>Open in Telegram Bot (Instant)</span>
              </a>

              <button
                type="button"
                onClick={() => setFallbackModal((prev) => ({ ...prev, open: false }))}
                className="btn btn-ghost"
                style={{ padding: "10px", fontSize: "13px" }}
              >
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
