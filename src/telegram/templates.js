const { Markup } = require("telegraf");

function escapeHTML(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .substring(0, 1000);
}

// ─── number emojis ────────────────────────────────────────────────────────────
const numberEmojis = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
];

// ─── file type display ────────────────────────────────────────────────────────
const FILE_EMOJI = {
  pdf: "📕", // red book — recognizable, distinct
  ppt: "📙", // orange book — slides/presentations
  doc: "📗", // green book — documents/notes
  image: "🖼️", // image set / photo exam
  other: "📎",
};

const FILE_LABEL = {
  pdf: "PDF",
  ppt: "Slides",
  doc: "Document",
  image: "Image",
  other: "File",
};

function getFileEmoji(fileType, isGrouped) {
  if (isGrouped) return "🗂️"; // multi-page image set (exam album)
  return FILE_EMOJI[fileType] || FILE_EMOJI.other;
}

function getFileLabel(fileType, isGrouped) {
  if (isGrouped) return "Exam Set";
  return FILE_LABEL[fileType] || FILE_LABEL.other;
}

// ─── title helper ─────────────────────────────────────────────────────────────
function getTitle(resource) {
  let title = resource.title || resource.fileName;
  if (!title && resource.caption) title = resource.caption;
  if (!title) title = "Untitled Resource";
  if (title.length > 52) title = title.substring(0, 51) + "…";
  return escapeHTML(title);
}

// ─── size helper ──────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes || bytes === 0) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── search result list ───────────────────────────────────────────────────────
function renderListTemplate(query, total, current, totalPages, batch) {
  const plural = total === 1 ? "result" : "results";
  let msg = `🔍 <b>${escapeHTML(query)}</b>\n`;
  msg += `📦 <b>${total}</b> ${plural} · page ${current}/${totalPages}\n`;
  msg += `<code>─────────────────────</code>\n`;

  batch.forEach((resource, idx) => {
    const num = numberEmojis[idx] || `${idx + 1}.`;
    const title = getTitle(resource);
    const emoji = getFileEmoji(resource.fileType, resource._isGrouped);
    const exam = resource.isExam ? " 🎓" : "";
    const size = formatSize(resource.fileSize);
    const sizeTxt = size ? ` · <i>${size}</i>` : "";
    msg += `${num} ${emoji} ${title}${exam}${sizeTxt}\n`;
  });

  msg += `<code>─────────────────────</code>\n`;
  msg += `<i>Tap a number below to get the file ⬇️</i>`;
  return msg;
}

// ─── number buttons ───────────────────────────────────────────────────────────
function renderNumberButtons(queryHash, page, batchLength) {
  const keyboard = [];
  const row1 = [];
  const row2 = [];

  for (let idx = 0; idx < batchLength; idx++) {
    const btn = Markup.button.callback(
      `${idx + 1}`,
      `num_${queryHash}_${page}_${idx}`,
    );
    if (idx < 5) row1.push(btn);
    else row2.push(btn);
  }

  if (row1.length > 0) keyboard.push(row1);
  if (row2.length > 0) keyboard.push(row2);
  return keyboard;
}

// ─── nav buttons ──────────────────────────────────────────────────────────────
function renderNavButtons(queryHash, currentPage, totalPages) {
  const nav = [];

  nav.push(
    currentPage > 1
      ? Markup.button.callback("◀ Prev", `pg_${queryHash}_${currentPage - 1}`)
      : Markup.button.callback("·", "noop"),
  );

  nav.push(Markup.button.callback(`${currentPage} / ${totalPages}`, "noop"));

  nav.push(
    currentPage < totalPages
      ? Markup.button.callback("Next ▶", `pg_${queryHash}_${currentPage + 1}`)
      : Markup.button.callback("·", "noop"),
  );

  return nav;
}

// ─── detail card ──────────────────────────────────────────────────────────────
function renderDetailCard(resource) {
  const emoji = getFileEmoji(resource.fileType, resource._isGrouped);
  const label = getFileLabel(resource.fileType, resource._isGrouped);
  const title = getTitle(resource);
  const size = formatSize(resource.fileSize);

  let msg = `<code>─────────────────────</code>\n`;
  msg += `${emoji} <b>${title}</b>\n\n`;

  // badges row
  const badges = [];
  if (resource.isExam) badges.push("🎓 Exam");
  badges.push(`📁 ${label}`);
  if (size) badges.push(`💾 ${size}`);
  msg += badges.join("  ·  ") + "\n";

  // tags
  if (resource.tags && resource.tags.length > 0) {
    const tagStr = resource.tags
      .slice(0, 6)
      .map((t) => `#${t.replace(/\s+/g, "_")}`)
      .join(" ");
    msg += `\n${tagStr}\n`;
  }

  // source channel
  if (resource.channelUsername) {
    msg += `\n📡 Source: @${escapeHTML(resource.channelUsername)}\n`;
  }

  // caption (expandable if long)
  if (resource.caption && resource.caption.trim().length > 0) {
    const cap = resource.caption.trim();
    if (cap.length > 120) {
      msg += `<blockquote expandable>${escapeHTML(cap)}</blockquote>\n`;
    } else {
      msg += `\n<i>${escapeHTML(cap)}</i>\n`;
    }
  }

  msg += `<code>─────────────────────</code>`;
  return msg;
}

// ─── file delivered ───────────────────────────────────────────────────────────
function renderFileDelivered(channelUsername) {
  return (
    `✅ <b>Here's your file!</b>\n` +
    `📡 Source: @${escapeHTML(channelUsername)}\n\n` +
    `<i>Use 📚 My Saves to keep this for later.</i>`
  );
}

// ─── no results ───────────────────────────────────────────────────────────────
function renderNoResults(query) {
  let msg = `<code>─────────────────────</code>\n`;
  msg += `🔍 <b>No results for "${escapeHTML(query)}"</b>\n\n`;
  msg += `<b>Try these tips:</b>\n`;
  msg += `  📌 Use shorter keywords — <i>"dbms"</i> not <i>"database management system"</i>\n`;
  msg += `  📌 Add a type hint — <i>"dbms exam"</i> or <i>"dbms notes"</i>\n`;
  msg += `  📌 Use the course abbreviation — <i>"oop"</i>, <i>"dsa"</i>, <i>"os"</i>\n`;
  msg += `  📌 Try a different spelling\n\n`;
  msg += `<i>Know a channel with this content? Tap 📢 Recommend Channel.</i>\n`;
  msg += `<code>─────────────────────</code>`;
  return msg;
}

// ─── resource unavailable error ───────────────────────────────────────────────
function renderError() {
  let msg = `<code>─────────────────────</code>\n`;
  msg += `⚠️ <b>File unavailable</b>\n\n`;
  msg += `This file may have been removed from its source channel.\n\n`;
  msg += `<i>Try searching again — there may be another copy available.</i>\n`;
  msg += `<code>─────────────────────</code>`;
  return msg;
}

// ─── welcome: new user ────────────────────────────────────────────────────────
function welcomeNew(user) {
  const name = escapeHTML(user.firstName || "Student");
  let msg = `🎓 <b>Welcome to StudyHub, ${name}!</b>\n\n`;
  msg += `Your personal academic search engine — built for Ethiopian university students.\n\n`;
  msg += `<code>─────────────────────</code>\n`;
  msg += `<b>What you can find:</b>\n`;
  msg += `  📕 Past exams &amp; solved papers\n`;
  msg += `  📗 Lecture notes &amp; handouts\n`;
  msg += `  📙 PPT slides &amp; study guides\n`;
  msg += `  🗂️ Photo exam sets (very common!)\n`;
  msg += `  <i>Indexed from 30+ university channels</i>\n\n`;
  msg += `<b>How to search:</b>\n`;
  msg += `  Just type any subject or topic below.\n`;
  msg += `  <i>e.g. "dbms exam" · "networking notes" · "exit exam"</i>\n\n`;
  msg += `<blockquote expandable>💡 <b>Pro tip:</b> Add "exam", "notes", or "pdf" to narrow your results. The more specific, the better!</blockquote>\n`;
  msg += `<code>─────────────────────</code>\n`;
  msg += `Start by typing anything below ⬇️`;
  return msg;
}

// ─── welcome: returning user ──────────────────────────────────────────────────
function welcomeReturning(user) {
  const name = escapeHTML(user.firstName || "Student");
  const greetings = [
    `👋 Welcome back, <b>${name}</b>!`,
    `📚 Hey <b>${name}</b>, ready to study?`,
    `🎓 Good to see you, <b>${name}</b>!`,
    `🔍 Back to it, <b>${name}</b>!`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  return `${greeting}\n\nType anything to search.`;
}

module.exports = {
  renderListTemplate,
  renderNumberButtons,
  renderNavButtons,
  renderDetailCard,
  renderFileDelivered,
  renderNoResults,
  renderError,
  welcomeNew,
  welcomeReturning,
  escapeHTML,
  getFileEmoji,
  getFileLabel,
  formatSize,
};
