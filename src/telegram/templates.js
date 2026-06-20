const { Markup } = require("telegraf");

function escapeHTML(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .substring(0, 1000);
}

const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function getTitle(resource) {
  let title = resource.title || resource.fileName;
  if (!title && resource.caption) {
    title = resource.caption;
  } else if (!title) {
    title = "Untitled Resource";
  }
  if (title.length > 55) {
    title = title.substring(0, 54) + "…";
  }
  return escapeHTML(title);
}

function getTypeEmoji(resource) {
  if (!resource._telegramResource) return "💻";
  if (resource._isGrouped) return "🖼️";
  const typeMap = { pdf: "📄", ppt: "📊", doc: "📝", image: "🖼️" };
  return typeMap[resource.fileType] || "📎";
}

function renderListTemplate(query, total, current, totalPages, batch) {
  let msg = `🔍 <b>${escapeHTML(query)}</b>\n`;
  msg += `📦 ${total} resources found · Page ${current} of ${totalPages}\n`;
  msg += `<code>──────────────────────</code>\n`;
  
  batch.forEach((resource, idx) => {
    const numEmoji = numberEmojis[idx] || `${idx + 1}.`;
    const title = getTitle(resource);
    const typeEmoji = getTypeEmoji(resource);
    const examBadge = resource.isExam ? " 🎓" : "";
    
    msg += `${numEmoji}  ${title} ${typeEmoji}${examBadge}\n`;
  });
  
  msg += `<code>──────────────────────</code>`;
  return msg;
}

function renderNumberButtons(queryHash, page, batchLength) {
  const keyboard = [];
  let numberRow1 = [];
  let numberRow2 = [];
  
  for (let idx = 0; idx < batchLength; idx++) {
    const btn = Markup.button.callback(`${idx + 1}`, `num_${queryHash}_${page}_${idx}`);
    if (idx < 5) numberRow1.push(btn);
    else numberRow2.push(btn);
  }
  
  if (numberRow1.length > 0) keyboard.push(numberRow1);
  if (numberRow2.length > 0) keyboard.push(numberRow2);
  
  return keyboard;
}

function renderNavButtons(queryHash, currentPage, totalPages) {
  const navRow = [];
  
  if (currentPage > 1) {
    navRow.push(Markup.button.callback("◀", `pg_${queryHash}_${currentPage - 1}`));
  } else {
    navRow.push(Markup.button.callback("◀", `noop`));
  }
  
  navRow.push(Markup.button.callback(`Page ${currentPage} of ${totalPages}`, `noop`));
  
  if (currentPage < totalPages) {
    navRow.push(Markup.button.callback("▶", `pg_${queryHash}_${currentPage + 1}`));
  } else {
    navRow.push(Markup.button.callback("▶", `noop`));
  }
  
  return navRow;
}

function renderDetailCard(resource) {
  const typeEmoji = getTypeEmoji(resource);
  const title = getTitle(resource);
  
  let msg = `<code>──────────────────────</code>\n`;
  msg += `${typeEmoji} <b>${title}</b>\n`;
  
  if (resource.isExam) {
    msg += `🎓 <b>Exam Material</b>\n`;
  }
  
  if (resource.tags && resource.tags.length > 0) {
    const formattedTags = resource.tags.slice(0, 5).map(t => `#${t.replace(/\s+/g, "_")}`).join(" ");
    msg += `${formattedTags}\n`;
  }
  
  if (resource.channelUsername) {
    msg += `📢 @${resource.channelUsername}\n`;
  }
  
  if (resource.caption) {
    if (resource.caption.length > 120) {
      msg += `<blockquote expandable>${escapeHTML(resource.caption)}</blockquote>\n`;
    } else {
      msg += `<i>${escapeHTML(resource.caption)}</i>\n`;
    }
  }
  
  msg += `<code>──────────────────────</code>`;
  return msg;
}

function renderFileDelivered(channelUsername) {
  return `✅ <b>Here's your file</b>\n📢 From @${channelUsername}`;
}

function renderNoResults(query) {
  let msg = `<code>──────────────────────</code>\n`;
  msg += `😕 <b>No results for "${escapeHTML(query)}"</b>\n\n`;
  msg += `Try:\n`;
  msg += `  · Shorter keywords\n`;
  msg += `  · Subject abbreviation (e.g. dbms, oop)\n`;
  msg += `  · Add "exam" or "notes" to your query\n`;
  msg += `<code>──────────────────────</code>`;
  return msg;
}

function renderError() {
  let msg = `<code>──────────────────────</code>\n`;
  msg += `❌ <b>Resource unavailable</b>\n`;
  msg += `This file may have been deleted from its source channel.\n`;
  msg += `<code>──────────────────────</code>`;
  return msg;
}

function welcomeNew(user) {
  let msg = `👋 <b>Welcome, ${escapeHTML(user.firstName || "Student")}!</b>\n`;
  msg += `Your academic search engine.\n\n`;
  msg += `<code>───────────────────</code>\n`;
  msg += `<b>What you can find</b>\n`;
  msg += `  Past exams & solved papers\n`;
  msg += `  Lecture notes & handouts\n`;
  msg += `  PPT slides & study guides\n`;
  msg += `  Resources from 30+ channels\n\n`;
  msg += `<b>How to use</b>\n`;
  msg += `  Just type any topic to search\n`;
  msg += `  e.g. "dbms exam" or\n`;
  msg += `  "networking notes"\n\n`;
  msg += `<blockquote expandable><b>Tip:</b> the more specific your search, the better the results. Try combining the subject and the file type!</blockquote>\n`;
  msg += `<code>───────────────────</code>\n`;
  msg += `Type anything below to get started ⬇️`;
  return msg;
}

function welcomeReturning(user) {
  let msg = `Welcome back, <b>${escapeHTML(user.firstName || "Student")}</b>.\n`;
  msg += `${user.searchCount || 0} searches so far.\n\n`;
  msg += `Type anything to search.`;
  return msg;
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
  escapeHTML
};
