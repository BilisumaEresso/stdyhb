"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Send,
  GraduationCap,
  Building2,
  Calendar,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { ResourceItem, getTelegramBotDeepLink } from "@/lib/api";
import {
  FilePdfIcon,
  FilePptIcon,
  FileDocIcon,
  FileImageIcon,
  FileExamIcon,
  BundlePdfIcon,
  BundleSlidesIcon,
  BundleDocIcon,
  BundleAlbumIcon,
} from "@/components/icons";

interface ResourceCardProps {
  item: ResourceItem;
  onToast?: (message: string, type?: "success" | "telegram" | "error") => void;
  priority?: boolean;
}

export default function ResourceCard({ item, onToast }: ResourceCardProps) {
  const [showAltSources, setShowAltSources] = useState(false);

  const isGroup = Boolean(item.groupId);
  const groupSize = item.groupTotal || (item as any).groupSize || (item.groupItems?.length) || 1;

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format indexed date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  const fileType = (item.fileType || "pdf").toLowerCase();

  // Resource Format Label and Icon
  let typeLabel = (item.fileType || "PDF").toUpperCase();
  let bundleBadge = "";

  if (isGroup) {
    if (fileType === "image") {
      typeLabel = "ALBUM";
      bundleBadge = `${groupSize}-Page Photo Album`;
    } else if (fileType === "ppt") {
      typeLabel = "SLIDES";
      bundleBadge = `${groupSize}-Slide PPT Pack`;
    } else if (fileType === "doc") {
      typeLabel = "DOC PACK";
      bundleBadge = `${groupSize}-Doc Packet`;
    } else {
      typeLabel = "BUNDLE";
      bundleBadge = `${groupSize}-File PDF Bundle`;
    }
  }

  // File Icon
  const renderIcon = () => {
    if (isGroup) {
      if (fileType === "image") return <BundleAlbumIcon size={22} />;
      if (fileType === "ppt") return <BundleSlidesIcon size={22} />;
      if (fileType === "doc") return <BundleDocIcon size={22} />;
      return <BundlePdfIcon size={22} />;
    }
    if (fileType === "ppt") return <FilePptIcon size={22} />;
    if (fileType === "doc") return <FileDocIcon size={22} />;
    if (fileType === "image") return <FileImageIcon size={22} />;
    return <FilePdfIcon size={22} />;
  };

  const displayTitle =
    item.cleanTitle ||
    item.title ||
    item.fileName ||
    "Academic Learning Resource";

  const sizeText = formatFileSize(item.fileSize);
  const dateText = formatDate(item.indexedAt);

  // Alternative channels calculation
  const altSources = Array.isArray(item.alternativeSources) ? item.alternativeSources : [];
  const totalChannels = item.channelCount || (altSources.length > 0 ? altSources.length + 1 : 1);
  const hasAlternatives = altSources.length > 0 && totalChannels > 1;

  // Primary source channel
  const primaryChannel = item.channelUsername ? `@${item.channelUsername}` : "University Channel";

  // University name if present
  const universityName = item.university || (item.universities && item.universities[0]) || "";

  // Academic subject / course code
  const courseCode = item.courseCode || "";

  return (
    <article className="resource-card professional-card" data-file-type={fileType}>
      {/* ── Top Header: File Icon & Type Badges ──────────────────────── */}
      <div className="card-top-row">
        <div className="card-icon-group">
          <div className={`file-type-badge file-type-${fileType}`} title={`${typeLabel} Resource`}>
            {renderIcon()}
          </div>
          <span className="file-format-tag">{typeLabel}</span>
        </div>

        <div className="card-badge-row">
          {bundleBadge && (
            <span className="badge-bundle" title={bundleBadge}>
              {bundleBadge}
            </span>
          )}

          {item.isExam && (
            <span className="badge-exam" title="Verified Examination Resource">
              <GraduationCap size={12} />
              <span>Past Exam</span>
            </span>
          )}

          {universityName && (
            <span className="badge-university" title={`University: ${universityName}`}>
              <Building2 size={11} />
              <span>{universityName}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Resource Title ────────────────────────────────────────────── */}
      <h3 className="card-title">
        <Link href={`/resource/${item._id}`} className="card-title-link">
          {displayTitle}
        </Link>
      </h3>

      {/* ── Academic & File Metadata Strip ───────────────────────────── */}
      <div className="card-meta-strip">
        {courseCode && (
          <span className="meta-pill meta-course" title={`Course Code: ${courseCode}`}>
            {courseCode}
          </span>
        )}

        {sizeText && (
          <span className="meta-text" title="File Size">
            {sizeText}
          </span>
        )}

        {item.downloadCount > 0 && (
          <>
            <span className="meta-sep">•</span>
            <span className="meta-text" title="Download Count">
              <Download size={11} className="inline-icon" />
              {item.downloadCount.toLocaleString()}
            </span>
          </>
        )}

        {dateText && (
          <>
            <span className="meta-sep">•</span>
            <span className="meta-text" title={`Indexed in ${dateText}`}>
              <Calendar size={11} className="inline-icon" />
              {dateText}
            </span>
          </>
        )}
      </div>

      {/* ── Source Transparency & Alternative Channels ───────────────── */}
      <div className="card-source-section">
        <div className="source-row">
          <span className="source-label">Source:</span>
          <span className="source-channel" title={`Primary Source Channel: ${primaryChannel}`}>
            {primaryChannel}
          </span>

          {hasAlternatives && (
            <button
              type="button"
              className={`alt-sources-toggle ${showAltSources ? "active" : ""}`}
              onClick={() => setShowAltSources(!showAltSources)}
              aria-expanded={showAltSources}
              title="Click to view other channels sharing this exact file"
            >
              <Share2 size={11} />
              <span>Available in {totalChannels} channels</span>
              {showAltSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Expandable Alternative Sources Panel */}
        {hasAlternatives && showAltSources && (
          <div className="alt-sources-panel" role="region" aria-label="Alternative Channel Sources">
            <div className="alt-sources-head">
              <span>Cross-Channel Verified ({totalChannels} Sources)</span>
            </div>
            <ul className="alt-sources-list">
              <li className="alt-source-item primary-source">
                <span className="alt-ch-name">{primaryChannel}</span>
                <span className="alt-badge-primary">Current</span>
                {universityName && <span className="alt-uni">{universityName}</span>}
              </li>
              {altSources.map((alt, index) => {
                const chName = alt.channelUsername ? `@${alt.channelUsername}` : "Channel";
                const postUrl =
                  alt.channelUsername && alt.messageId
                    ? `https://t.me/${alt.channelUsername}/${alt.messageId}`
                    : null;

                return (
                  <li key={`alt-${alt.channelUsername || index}-${index}`} className="alt-source-item">
                    <span className="alt-ch-name">{chName}</span>
                    {alt.university && alt.university !== universityName && (
                      <span className="alt-uni">{alt.university}</span>
                    )}
                    {postUrl && (
                      <a
                        href={postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="alt-link"
                        title="View original message in Telegram"
                      >
                        <ExternalLink size={10} />
                        <span>View</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* ── Bottom Action Footer ──────────────────────────────────────── */}
      <div className="card-footer">
        <Link className="btn-card-details" href={`/resource/${item._id}`}>
          <span>{isGroup ? "View Bundle" : "View Details"}</span>
          <ArrowRight size={13} />
        </Link>

        <a
          className="btn-card-bot"
          href={getTelegramBotDeepLink(item._id, isGroup)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (onToast) {
              onToast(
                isGroup ? "Opening Telegram Bot for bundle..." : "Opening Telegram Bot for file...",
                "telegram"
              );
            }
          }}
          title={isGroup ? "Download complete album via Telegram Bot" : "Deliver this file via Telegram Bot"}
        >
          <Send size={13} />
          <span>Get in Bot</span>
        </a>
      </div>
    </article>
  );
}
