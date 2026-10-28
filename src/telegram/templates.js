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

// ─── campus matching helper ───────────────────────────────────────────────────
function isCampusResource(resource, user) {
  if (!user || !user.university || typeof user.university !== "string") return false;
  const uni = user.university.trim().toLowerCase();
  if (!uni || uni.length < 2) return false;

  const channel = (resource.channelUsername || "").toLowerCase();
  const fileName = (resource.fileName || "").toLowerCase();
  const caption = (resource.caption || "").toLowerCase();
  const tags = Array.isArray(resource.tags)
    ? resource.tags.join(" ").toLowerCase()
    : "";

  const combined = `${channel} ${fileName} ${caption} ${tags}`;
  return combined.includes(uni);
}

// ─── search result list ───────────────────────────────────────────────────────
function renderListTemplate(
  query,
  total,
  current,
  totalPages,
  batch,
  activeFilter = "all",
  user = null
) {
  const plural = total === 1 ? "result" : "results";
  const filterBadges = {
    all: "",
    exam: " · 🎓 <b>Exams</b>",
    ppt: " · 📙 <b>Slides</b>",
    pdf: " · 📕 <b>PDFs</b>",
    uni: " · 🏛️ <b>My Campus</b>",
  };
  const filterBadge = filterBadges[activeFilter] || "";

  let msg = `🔍 <b>${escapeHTML(query)}</b>${filterBadge}\n`;
  msg += `📦 <b>${total}</b> ${plural} · page ${current}/${totalPages || 1}\n`;
  msg += `<code>─────────────────────</code>\n`;

  if (!batch || batch.length === 0) {
    msg += `<i>No materials match this filter.\nTap [🔄 All] or another filter below ⬇️</i>\n`;
  } else {
    batch.forEach((resource, idx) => {
      const num = numberEmojis[idx] || `${idx + 1}.`;
      const title = getTitle(resource);
      const emoji = getFileEmoji(resource.fileType, resource._isGrouped);
      const exam = resource.isExam ? " 🎓" : "";
      const size = formatSize(resource.fileSize);
      const sizeTxt = size ? ` · <i>${size}</i>` : "";
      const campusBadge = isCampusResource(resource, user)
        ? ` 🏛️ <b>[${escapeHTML(user.university.toUpperCase())}]</b>`
        : "";
      msg += `${num} ${emoji} ${title}${campusBadge}${exam}${sizeTxt}\n`;
    });
  }

  msg += `<code>─────────────────────</code>\n`;
  msg += `<i>Tap a number to get the file, or filter by category ⬇️</i>`;
  return msg;
}

// ─── number buttons ───────────────────────────────────────────────────────────
function renderNumberButtons(queryHash, page, batchLength, activeFilter = "all") {
  const keyboard = [];
  const row1 = [];
  const row2 = [];

  for (let idx = 0; idx < batchLength; idx++) {
    const btn = Markup.button.callback(
      `${idx + 1}`,
      `num_${queryHash}_${page}_${idx}_${activeFilter}`,
    );
    if (idx < 5) row1.push(btn);
    else row2.push(btn);
  }

  if (row1.length > 0) keyboard.push(row1);
  if (row2.length > 0) keyboard.push(row2);
  return keyboard;
}

// ─── nav buttons ──────────────────────────────────────────────────────────────
function renderNavButtons(queryHash, currentPage, totalPages, activeFilter = "all") {
  const nav = [];

  nav.push(
    currentPage > 1
      ? Markup.button.callback("◀ Prev", `pg_${queryHash}_${currentPage - 1}_${activeFilter}`)
      : Markup.button.callback("·", "noop"),
  );

  nav.push(Markup.button.callback(`${currentPage} / ${totalPages || 1}`, "noop"));

  nav.push(
    currentPage < totalPages
      ? Markup.button.callback("Next ▶", `pg_${queryHash}_${currentPage + 1}_${activeFilter}`)
      : Markup.button.callback("·", "noop"),
  );

  return nav;
}

// ─── filter pill buttons ──────────────────────────────────────────────────────
function renderFilterPills(queryHash, activeFilter = "all") {
  const pills = [
    { id: "all", label: "🔄 All" },
    { id: "exam", label: "🎓 Exams" },
    { id: "ppt", label: "📙 Slides" },
    { id: "pdf", label: "📕 PDFs" },
    { id: "uni", label: "🏛️ Campus" },
  ];

  const row1 = [];
  const row2 = [];

  pills.forEach((p, idx) => {
    const isSelected = p.id === activeFilter;
    const text = isSelected ? `• ${p.label} •` : p.label;
    const btn = Markup.button.callback(text, `flt_${queryHash}_1_${p.id}`);
    if (idx < 3) row1.push(btn);
    else row2.push(btn);
  });

  return [row1, row2];
}

// ─── detail card ──────────────────────────────────────────────────────────────
function renderDetailCard(resource, user = null) {
  const emoji = getFileEmoji(resource.fileType, resource._isGrouped);
  const label = getFileLabel(resource.fileType, resource._isGrouped);
  const title = getTitle(resource);
  const size = formatSize(resource.fileSize);
  const isMyCampus = isCampusResource(resource, user);

  let msg = `<code>─────────────────────</code>\n`;
  msg += `${emoji} <b>${title}</b>\n\n`;

  // badges row
  const badges = [];
  if (isMyCampus) {
    badges.push(`🏛️ <b>My Campus (${escapeHTML(user.university.toUpperCase())})</b>`);
  }
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
    const ch = escapeHTML(resource.channelUsername);
    const postUrl = resource.messageId
      ? `https://t.me/${resource.channelUsername}/${resource.messageId}`
      : `https://t.me/${resource.channelUsername}`;
    msg += `\n📡 Source: <a href="${postUrl}">@${ch}</a>\n`;
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

  // Profile hint if university is not set
  if (!user || !user.university) {
    msg += `\n💡 <i>Tip: Set your university in /profile to highlight materials from your campus.</i>\n`;
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

// ─── report prompt ────────────────────────────────────────────────────────────
function renderReportPrompt(
  resource,
  queryHash,
  page,
  resultIndex,
  activeFilter = "all"
) {
  const title = getTitle(resource);
  let msg = `⚠️ <b>Report an Issue with this Resource</b>\n\n`;
  msg += `📄 <b>${title}</b>\n\n`;
  msg += `Please select the issue you encountered:\n`;
  msg += `<code>─────────────────────</code>`;

  const id = resource._id.toString();
  const backCallback = `num_${queryHash}_${page}_${resultIndex}_${activeFilter}`;

  const keyboard = [
    [
      Markup.button.callback("❌ Download Failed", `repsub_${id}_download_failed`),
      Markup.button.callback("🔒 Password Locked", `repsub_${id}_password_locked`),
    ],
    [
      Markup.button.callback("📑 Corrupt / Blank", `repsub_${id}_corrupt_content`),
      Markup.button.callback("🏷️ Wrong Subject", `repsub_${id}_wrong_subject`),
    ],
    [Markup.button.callback("◀ Cancel", backCallback)],
  ];

  return { text: msg, keyboard };
}

function renderReportSubmitted(backCallback) {
  let msg = `<code>─────────────────────</code>\n`;
  msg += `✅ <b>Report Submitted!</b>\n\n`;
  msg += `Thank you for keeping StudyHub clean and accurate. Our team will review this resource.\n`;
  msg += `<code>─────────────────────</code>`;

  const keyboard = [
    [Markup.button.callback("◀ Back to Material", backCallback)],
  ];

  return { text: msg, keyboard };
}

// ─── no results ───────────────────────────────────────────────────────────────
function renderNoResults(query, suggestionItems = []) {
  let msg = `<code>─────────────────────</code>\n`;
  msg += `🔍 <b>No direct matches for "${escapeHTML(query)}"</b>\n\n`;

  const keyboard = [];

  if (suggestionItems && suggestionItems.length > 0) {
    msg += `💡 <b>Did you mean one of these?</b>\n`;
    msg += `<i>Tap below to search with the corrected term:</i>\n`;

    suggestionItems.forEach((item) => {
      let label = item.query;
      if (label.length > 28) label = label.substring(0, 27) + "…";
      keyboard.push([
        Markup.button.callback(
          `💡 Did you mean: "${label}"?`,
          `qsearch_${item.hash}`
        ),
      ]);
    });
  } else {
    msg += `<b>Try these tips:</b>\n`;
    msg += `  📌 Use shorter keywords — <i>"dbms"</i> not <i>"database management system"</i>\n`;
    msg += `  📌 Add a type hint — <i>"dbms exam"</i> or <i>"dbms notes"</i>\n`;
    msg += `  📌 Use the course abbreviation — <i>"oop"</i>, <i>"dsa"</i>, <i>"os"</i>\n`;
    msg += `  📌 Try a different spelling\n\n`;
    msg += `<i>Know a channel with this content? Tap 📢 Recommend Channel.</i>\n`;
  }

  msg += `<code>─────────────────────</code>`;
  const result = { text: msg, keyboard };
  result.toString = () => msg;
  return result;
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

// ─── search screen prompt ─────────────────────────────────────────────────────
function renderSearchPrompt(recentItems = [], suggestionItems = []) {
  const hasRecent = recentItems && recentItems.length > 0;

  let msg = `🔍 <b>Search Academic Materials</b>\n\n`;
  msg += `Type any course name, code, or topic to search:\n`;
  msg += `  • <i>"dbms exam"</i>\n`;
  msg += `  • <i>"python slides"</i>\n`;
  msg += `  • <i>"physics mid"</i>\n\n`;

  const keyboard = [];

  if (hasRecent) {
    msg += `🕒 <b>Recent Searches:</b>\n`;
    msg += `<i>Tap any button to search again:</i>`;

    const recentRows = [];
    let currentRow = [];

    recentItems.forEach((item) => {
      let label = item.query;
      if (label.length > 20) label = label.substring(0, 19) + "…";
      const btn = Markup.button.callback(`🕒 ${label}`, `qsearch_${item.hash}`);

      if (label.length <= 14 && currentRow.length < 2) {
        currentRow.push(btn);
        if (currentRow.length === 2) {
          recentRows.push(currentRow);
          currentRow = [];
        }
      } else {
        if (currentRow.length > 0) {
          recentRows.push(currentRow);
          currentRow = [];
        }
        recentRows.push([btn]);
      }
    });

    if (currentRow.length > 0) {
      recentRows.push(currentRow);
    }

    keyboard.push(...recentRows);
    keyboard.push([
      Markup.button.callback("🗑️ Clear Search History", "clear_search_history"),
    ]);
  } else {
    msg += `💡 <b>Popular Searches & Topics:</b>\n`;
    msg += `<i>Tap a suggestion below or type your own:</i>`;

    const sugRows = [];
    let currentRow = [];

    suggestionItems.forEach((item) => {
      let label = item.query;
      if (label.length > 20) label = label.substring(0, 19) + "…";
      const btn = Markup.button.callback(`💡 ${label}`, `qsearch_${item.hash}`);

      currentRow.push(btn);
      if (currentRow.length === 2) {
        sugRows.push(currentRow);
        currentRow = [];
      }
    });

    if (currentRow.length > 0) {
      sugRows.push(currentRow);
    }

    keyboard.push(...sugRows);
  }

  return { text: msg, keyboard };
}

module.exports = {
  renderListTemplate,
  renderNumberButtons,
  renderNavButtons,
  renderFilterPills,
  renderDetailCard,
  renderFileDelivered,
  renderNoResults,
  renderError,
  renderSearchPrompt,
  renderReportPrompt,
  renderReportSubmitted,
  isCampusResource,
  welcomeNew,
  welcomeReturning,
  escapeHTML,
  getFileEmoji,
  getFileLabel,
  formatSize,
};
