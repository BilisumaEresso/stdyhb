const TelegramChannel = require("../../db/models/TelegramChannel");
const TelegramResource = require("../../db/models/TelegramResource");
const User = require("../../db/models/User");
const ChannelRecommendation = require("../../db/models/ChannelRecommendation");
const ResourceReport = require("../../db/models/ResourceReport");
const SearchHistory = require("../../db/models/SearchHistory");
const {
  getArchiveMetrics,
  isArchiveSyncActive,
  startArchiveSync,
  stopArchiveSync,
  makeProgressBar,
} = require("../../services/archiveSync.service");
const {
  indexChannel,
  indexAllChannels,
  isIndexingInProgress,
  getIndexingDiagnostics,
  abortIndexing,
} = require("../../search/telegramIndexer");
const { Markup } = require("telegraf");

// ─── Admin Logging ────────────────────────────────────────────────────────

const adminLogs = [];
const MAX_LOGS = 50;

function pushAdminLog(level, message) {
  adminLogs.push({ level, message, time: new Date() });
  if (adminLogs.length > MAX_LOGS) adminLogs.shift();
}

function getAdminLogs(count = 20) {
  return adminLogs.slice(-count).reverse();
}

// ─── Admin Authorization ─────────────────────────────────────────────────

/**
 * Helper to synchronously check if a user is an admin
 */
const isAdminUser = (userId) => {
  const adminIds = process.env.ADMIN_ID ? process.env.ADMIN_ID.split(",") : [];
  return adminIds.includes(userId?.toString());
};

/**
 * Helper to check if a Telegram ID is admin
 */
function isAdminId(id) {
  return isAdminUser(id);
}

/**
 * Middleware to restrict commands to ADMIN_ID from .env
 */
const isAdmin = async (ctx, next) => {
  if (!isAdminUser(ctx.from?.id)) {
    return ctx.reply(
      "❌ Admin only. You are not authorized to use this command.",
    );
  }
  return next();
};

// ─── Admin Panel ─────────────────────────────────────────────────────────

/**
 * Generate the admin panel message with live stats
 */
async function getAdminPanelMessage() {
  try {
    const resourceCount = await TelegramResource.countDocuments();
    const userCount = await User.countDocuments();
    const channels = await TelegramChannel.find({});
    const activeCount = channels.filter(
      (c) => c.active && c.healthStatus !== "DEAD",
    ).length;
    const deadCount = channels.filter((c) => c.healthStatus === "DEAD").length;
    const indexing = isIndexingInProgress();
    const pendingRecs = await ChannelRecommendation.countDocuments({ status: "pending" });
    const pendingReports = await ResourceReport.countDocuments({ status: "pending" });
    const archiveInfo = await getArchiveMetrics().catch(() => null);

    let message =
      `🛠 <b>StudyHub Admin Panel</b>\n\n` +
      `📦 Resources: <b>${resourceCount.toLocaleString()}</b>\n` +
      `👥 Users: <b>${userCount.toLocaleString()}</b>\n` +
      `📡 Channels: <b>${activeCount}</b> active / <b>${deadCount}</b> dead\n` +
      `⏱ Indexer: ${indexing ? "🔄 <b>Running</b>" : "💤 <b>Idle</b>"}\n`;

    if (archiveInfo) {
      message += `💾 Archive: <b>${archiveInfo.percentage}%</b> (${archiveInfo.archived.toLocaleString()}/${archiveInfo.total.toLocaleString()})\n`;
    }

    message +=
      `⚠️ Moderation: <b>${pendingRecs}</b> pending ch. / <b>${pendingReports}</b> file reports\n\n` +
      `<i>Last updated: ${new Date().toLocaleTimeString()}</i>`;

    return message;
  } catch (error) {
    console.error("[ADM-PANEL] Error generating message:", error);
    return "❌ Error loading panel. Try again.";
  }
}

/**
 * Generate standard admin panel keyboard
 */
function renderAdminPanelKeyboard(pendingReports = 0, pendingRecs = 0) {
  const pendingLabel = pendingRecs > 0 ? `📋 Pending (${pendingRecs})` : "📋 Pending";
  const reportsLabel = pendingReports > 0 ? `⚠️ Reports (${pendingReports})` : "⚠️ Reports";

  return Markup.inlineKeyboard([
    // Stats & Monitoring
    [
      Markup.button.callback("📊 Full Stats", "adm_stats"),
      Markup.button.callback("🏥 Channel Health", "adm_health"),
    ],
    [
      Markup.button.callback(pendingLabel, "adm_pending"),
      Markup.button.callback(reportsLabel, "adm_reports"),
    ],

    // Indexer Control
    [
      Markup.button.callback("▶ Run Full Scan", "adm_scan"),
      Markup.button.callback("⏸ Status", "adm_indexstatus"),
    ],

    // Archive & Channels
    [
      Markup.button.callback("💾 Archive Monitor", "adm_archive"),
      Markup.button.callback("📡 Channels", "adm_channels"),
    ],

    // Broadcast & Users
    [
      Markup.button.callback("📢 Broadcast", "adm_broadcast"),
      Markup.button.callback("👥 User List", "adm_users"),
    ],

    // Quick Actions
    [
      Markup.button.callback("🔄 Refresh", "adm_refresh"),
      Markup.button.callback("❓ Help", "adm_help"),
    ],
  ]);
}

/**
 * Standard back button keyboard for all sub-views
 */
const backToAdminKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main")],
]);

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format an interactive pending recommendation card with action buttons and pagination
 */
function renderPendingRecommendationView(recommendations, page = 0) {
  if (!recommendations || recommendations.length === 0) {
    return {
      text: "✅ <b>No pending channel recommendations.</b>\n\nAll submitted channels have been reviewed.",
      keyboard: backToAdminKeyboard,
    };
  }

  const safePage = Math.max(0, Math.min(page, recommendations.length - 1));
  const rec = recommendations[safePage];
  const total = recommendations.length;
  const username = (rec.channelUsername || "").replace(/^@/, "");

  const submitterName = rec.recommendedBy?.firstName
    ? `${rec.recommendedBy.firstName}${rec.recommendedBy.lastName ? " " + rec.recommendedBy.lastName : ""}`
    : (rec.recommendedBy?.username ? `@${rec.recommendedBy.username}` : (rec.recommendedBy?.telegramId ? `ID: ${rec.recommendedBy.telegramId}` : "Anonymous"));

  const uni = rec.university || "All Universities";
  const type = rec.type || "Other";
  const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : "Recently";
  const reason = rec.reason ? `\n📝 <b>Note:</b> <i>${escapeHtml(rec.reason)}</i>` : "";

  let text = `📋 <b>Pending Channel Recommendation</b> (${safePage + 1} of ${total})\n\n`;
  text += `📡 <b>Channel:</b> @${username}\n`;
  text += `🏛️ <b>University:</b> ${escapeHtml(uni)}\n`;
  text += `📚 <b>Content Type:</b> ${escapeHtml(type)}\n`;
  text += `👤 <b>Submitted by:</b> ${escapeHtml(submitterName)}\n`;
  text += `📅 <b>Date:</b> ${dateStr}${reason}\n\n`;
  text += `<i>Approve to add this channel to StudyHub and queue automatic indexing.</i>`;

  const rows = [
    [
      Markup.button.callback("✅ Approve & Index", `adm_appr_${rec._id}_${safePage}`),
      Markup.button.callback("❌ Reject", `adm_rejc_${rec._id}_${safePage}`),
    ],
    [
      Markup.button.url("🔗 Open Channel", `https://t.me/${username}`),
    ],
  ];

  if (total > 1) {
    const navRow = [];
    if (safePage > 0) {
      navRow.push(Markup.button.callback("◀ Prev", `adm_rec_page_${safePage - 1}`));
    }
    navRow.push(Markup.button.callback(`📄 ${safePage + 1}/${total}`, "adm_rec_noop"));
    if (safePage < total - 1) {
      navRow.push(Markup.button.callback("Next ▶", `adm_rec_page_${safePage + 1}`));
    }
    rows.push(navRow);
  }

  rows.push([
    Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main"),
  ]);

  return {
    text,
    keyboard: Markup.inlineKeyboard(rows),
    currentPage: safePage,
    currentRec: rec,
  };
}

const REPORT_REASONS = {
  download_failed: "❌ Download Failed",
  password_locked: "🔒 Password Locked",
  corrupt_content: "📑 Corrupt / Blank Content",
  wrong_subject: "🏷️ Wrong Subject",
  other: "⚠️ Other Issue",
};

/**
 * Format an interactive broken file report card with action buttons and pagination
 */
function renderReportCardView(reports, page = 0) {
  if (!reports || reports.length === 0) {
    return {
      text: "✅ <b>No pending broken file reports.</b>\n\nAll reported resources have been reviewed or resolved.",
      keyboard: backToAdminKeyboard,
    };
  }

  const safePage = Math.max(0, Math.min(page, reports.length - 1));
  const rep = reports[safePage];
  const total = reports.length;
  const res = rep.resourceId;
  const user = rep.userId;

  const fileName = res?.fileName || rep.resourceTitle || "Untitled Resource";
  const channel = (res?.channelUsername || rep.channelUsername || "unknown").replace(/^@/, "");
  const reasonLabel = REPORT_REASONS[rep.reason] || rep.reason || "Unspecified";
  const dateStr = rep.createdAt ? new Date(rep.createdAt).toLocaleDateString() : "Recently";

  const reporter = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : (user?.username ? `@${user.username}` : (rep.telegramId ? `ID: ${rep.telegramId}` : "Anonymous"));

  const fileSize = res?.fileSize ? ` · ${(res.fileSize / 1024 / 1024).toFixed(1)} MB` : "";
  const fileType = res?.fileType ? res.fileType.toUpperCase() : "FILE";
  const isAvailable = res ? (res.isAvailable !== false ? "🟢 Active in Search" : "🔴 Already Disabled") : "❓ Missing Resource";

  let text = `⚠️ <b>Broken File Report</b> (${safePage + 1} of ${total})\n\n`;
  text += `📄 <b>File:</b> <code>${escapeHtml(fileName)}</code>\n`;
  text += `📁 <b>Format:</b> ${fileType}${fileSize}\n`;
  text += `📡 <b>Channel:</b> @${channel}\n`;
  text += `⚠️ <b>Report Reason:</b> <b>${escapeHtml(reasonLabel)}</b>\n`;
  text += `👤 <b>Reported by:</b> ${escapeHtml(reporter)}\n`;
  text += `📅 <b>Date:</b> ${dateStr}\n`;
  text += `📊 <b>Status:</b> ${isAvailable}\n\n`;
  text += `<i>Disable the file to immediately remove it from student search results, or dismiss if valid.</i>`;

  const rows = [
    [
      Markup.button.callback("🗑️ Disable File", `adm_rep_dis_${rep._id}_${safePage}`),
      Markup.button.callback("✅ Dismiss Report", `adm_rep_dism_${rep._id}_${safePage}`),
    ],
  ];

  if (res?.messageId && channel && channel !== "unknown") {
    rows.push([
      Markup.button.url("🔗 Open File in Channel", `https://t.me/${channel}/${res.messageId}`),
    ]);
  }

  if (total > 1) {
    const navRow = [];
    if (safePage > 0) {
      navRow.push(Markup.button.callback("◀ Prev", `adm_rep_page_${safePage - 1}`));
    }
    navRow.push(Markup.button.callback(`📄 ${safePage + 1}/${total}`, "adm_rep_noop"));
    if (safePage < total - 1) {
      navRow.push(Markup.button.callback("Next ▶", `adm_rep_page_${safePage + 1}`));
    }
    rows.push(navRow);
  }

  rows.push([
    Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main"),
  ]);

  return {
    text,
    keyboard: Markup.inlineKeyboard(rows),
    currentPage: safePage,
    currentReport: rep,
  };
}

/**
 * Format an interactive archive channel monitor view
 */
function renderArchiveMonitorView(metrics) {
  const isRunning = metrics.isRunning;
  let text = `💾 <b>Archive Channel Monitor</b>\n\n`;
  text += `Coverage: <b>${metrics.percentage}%</b> ${metrics.progressBar}\n\n`;
  text += `📦 Total Resources: <b>${metrics.total.toLocaleString()}</b>\n`;
  text += `✅ Backed Up to Archive: <b>${metrics.archived.toLocaleString()}</b>\n`;
  text += `⏳ Pending Backfill: <b>${metrics.unarchived.toLocaleString()}</b> across <b>${metrics.pendingChannelCount}</b> channels\n\n`;

  if (isRunning && metrics.stats) {
    const elapsedSec = metrics.stats.startedAt
      ? Math.round((Date.now() - new Date(metrics.stats.startedAt).getTime()) / 1000)
      : 0;
    text += `🔄 <b>Sync Status:</b> RUNNING\n`;
    text += `⏱ Running for: ${elapsedSec}s\n`;
    text += `📡 Current Channel: ${metrics.stats.currentChannel ? `@${metrics.stats.currentChannel}` : "Preparing..."}\n`;
    text += `✓ Processed: <b>${metrics.stats.processed}</b> (✅ ${metrics.stats.succeeded} / ❌ ${metrics.stats.failed})\n\n`;
  } else {
    text += `💤 <b>Sync Status:</b> IDLE\n`;
    text += `<i>Automatic opportunistic archiving is always active on every student file download.</i>\n\n`;
  }

  const actionRow = isRunning
    ? [
        Markup.button.callback("⏹ Stop Sync", "adm_archive_stop"),
        Markup.button.callback("🔄 Refresh Status", "adm_archive"),
      ]
    : [
        Markup.button.callback("▶ Start Archive Sync", "adm_archive_start"),
        Markup.button.callback("🔄 Refresh", "adm_archive"),
      ];

  const keyboard = Markup.inlineKeyboard([
    actionRow,
    [Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main")],
  ]);

  return { text, keyboard };
}

const CHANNELS_PER_PAGE = 4;

/**
 * Fetch paginated channels from MongoDB based on filter
 */
async function getChannelManagerData(page = 0, filter = "all") {
  let query = {};
  if (filter === "active") {
    query = { active: true };
  } else if (filter === "issues") {
    query = {
      $or: [
        { healthStatus: { $in: ["DEGRADED", "DEAD"] } },
        { failureCount: { $gt: 0 } },
      ],
    };
  }

  const totalCount = await TelegramChannel.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / CHANNELS_PER_PAGE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  const channels = await TelegramChannel.find(query)
    .sort({ active: -1, totalIndexed: -1, username: 1 })
    .skip(safePage * CHANNELS_PER_PAGE)
    .limit(CHANNELS_PER_PAGE);

  return {
    channels,
    page: safePage,
    totalPages,
    totalCount,
    filter,
  };
}

/**
 * Format an interactive channel manager view with 1-tap toggles, scan, and filter pills
 */
function renderChannelManagerView({ channels, page, totalPages, totalCount, filter }) {
  const filterTitles = {
    all: "All Channels",
    active: "Active Channels",
    issues: "Problematic Channels (Degraded/Dead)",
  };

  const filterRow = [
    Markup.button.callback(filter === "all" ? "• All •" : "🔄 All", "adm_ch_flt_all"),
    Markup.button.callback(filter === "active" ? "• Active •" : "✅ Active", "adm_ch_flt_active"),
    Markup.button.callback(filter === "issues" ? "• Issues •" : "⚠️ Issues", "adm_ch_flt_issues"),
  ];

  if (!channels || channels.length === 0) {
    let emptyText = `📡 <b>Channel Manager</b>\nFilter: <b>${filterTitles[filter] || filter}</b>\n\n`;
    emptyText += `No channels match this filter.`;

    return {
      text: emptyText,
      keyboard: Markup.inlineKeyboard([
        filterRow,
        [Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main")],
      ]),
    };
  }

  let text = `📡 <b>Channel Manager</b> (Page ${page + 1} of ${totalPages} · ${totalCount} total)\n`;
  text += `Filter: <b>${filterTitles[filter] || filter}</b>\n\n`;

  const inlineKeyboard = [];

  channels.forEach((ch, idx) => {
    const itemNum = page * CHANNELS_PER_PAGE + idx + 1;
    const activeBadge = ch.active ? "✅" : "❌ (Inactive)";
    const healthBadge =
      ch.healthStatus === "DEAD"
        ? "🔴 DEAD"
        : ch.healthStatus === "DEGRADED"
        ? "⚠️ DEGRADED"
        : "🟢 ACTIVE";
    const lastScan = ch.lastScannedAt
      ? new Date(ch.lastScannedAt).toLocaleDateString()
      : "Never";
    const uni = ch.university || "General";

    text += `${itemNum}. <b>@${ch.username}</b> ${activeBadge}\n`;
    text += `   🏛️ Uni: ${escapeHtml(uni)} | 📦 Indexed: <b>${(ch.totalIndexed || 0).toLocaleString()}</b>\n`;
    text += `   🏥 Health: ${healthBadge} | 📅 Scanned: ${lastScan}\n\n`;

    // 1-Tap action row for this channel
    inlineKeyboard.push([
      Markup.button.callback(
        `⚡ Scan @${ch.username.substring(0, 10)}`,
        `adm_ch_scan_${ch.username}_${page}_${filter}`,
      ),
      Markup.button.callback(
        ch.active ? "⏸ Deactivate" : "▶ Activate",
        `adm_ch_tog_${ch.username}_${page}_${filter}`,
      ),
      Markup.button.url("🔗 Open", `https://t.me/${ch.username}`),
    ]);
  });

  // Filter selection row
  inlineKeyboard.push(filterRow);

  // Pagination row if > 1 page
  if (totalPages > 1) {
    const navRow = [];
    if (page > 0) {
      navRow.push(
        Markup.button.callback("◀ Prev", `adm_ch_page_${page - 1}_${filter}`),
      );
    }
    navRow.push(
      Markup.button.callback(`📄 ${page + 1}/${totalPages}`, "adm_ch_noop"),
    );
    if (page < totalPages - 1) {
      navRow.push(
        Markup.button.callback("Next ▶", `adm_ch_page_${page + 1}_${filter}`),
      );
    }
    inlineKeyboard.push(navRow);
  }

  inlineKeyboard.push([
    Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main"),
  ]);

  return { text, keyboard: Markup.inlineKeyboard(inlineKeyboard) };
}

/**
 * Format an interactive user profile card with recent searches and 1-tap Ban/Unban toggle
 */
function renderUserProfileCard(user, recentSearches = []) {
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "Unnamed Student";
  const handle = user.username ? `@${user.username}` : "(no username)";
  const uni = user.university || "Not set";
  const dept = user.department || "Not set";
  const yearStr = user.year ? `Year ${user.year}` : "";
  const semStr = user.semester ? `Sem ${user.semester}` : "";
  const level = [yearStr, semStr].filter(Boolean).join(", ") || "Unspecified";
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "Unknown";
  const lastActive = user.lastActive
    ? new Date(user.lastActive).toLocaleString()
    : "Never";
  const statusBadge = user.isBanned
    ? `🔴 <b>SUSPENDED / BANNED</b> (since ${user.bannedAt ? new Date(user.bannedAt).toLocaleDateString() : "recently"})`
    : `🟢 <b>ACTIVE</b> (In good standing)`;

  let text = `👤 <b>Student Profile Inspector</b>\n\n`;
  text += `👤 <b>Name:</b> ${escapeHtml(name)} (${escapeHtml(handle)})\n`;
  text += `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n`;
  text += `🏛️ <b>University:</b> ${escapeHtml(uni)}\n`;
  text += `📚 <b>Department:</b> ${escapeHtml(dept)}\n`;
  text += `🎓 <b>Academic Level:</b> ${level}\n`;
  text += `📊 <b>Total Searches:</b> <b>${(user.searchCount || 0).toLocaleString()}</b>\n`;
  text += `📅 <b>Joined:</b> ${joinDate}\n`;
  text += `⏱ <b>Last Active:</b> ${lastActive}\n`;
  text += `🛡 <b>Account Status:</b> ${statusBadge}\n\n`;

  if (recentSearches && recentSearches.length > 0) {
    text += `🔍 <b>Recent Searches:</b>\n`;
    recentSearches.slice(0, 4).forEach((s) => {
      text += `• <i>"${escapeHtml(s.query)}"</i>\n`;
    });
    text += `\n`;
  }

  const buttons = [
    [
      Markup.button.callback(
        user.isBanned ? "✅ Unban User" : "🚫 Ban User",
        `adm_usr_ban_${user._id}`,
      ),
    ],
  ];

  if (user.username) {
    buttons.push([
      Markup.button.url(
        "💬 Send Direct Telegram Message",
        `https://t.me/${user.username}`,
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback("👥 Back to Users", "adm_users"),
    Markup.button.callback("◀ Admin Panel", "adm_panel_main"),
  ]);

  return { text, keyboard: Markup.inlineKeyboard(buttons) };
}

/**
 * Format real-time live indexer diagnostics with queue progress, yield stats, and abort control
 */
function renderIndexerDiagnosticsView(diag, pendingUnindexedCount = 0) {
  const isRunning = diag.isRunning;
  const statusIcon = isRunning
    ? diag.status === "STOPPING"
      ? "⏹️"
      : "🔄"
    : "💤";
  const progressBar = makeProgressBar(diag.percent || 0);

  let text = `⏱ <b>Live Indexer Diagnostics & Control</b>\n\n`;
  text += `<b>Worker Status:</b> ${statusIcon} <b>${diag.status}</b>\n`;
  if (diag.elapsedSec > 0) {
    const m = Math.floor(diag.elapsedSec / 60);
    const s = diag.elapsedSec % 60;
    text += `⏱ <b>Elapsed Time:</b> ${m > 0 ? `${m}m ` : ""}${s}s\n`;
  }
  if (isRunning && diag.currentChannel) {
    text += `📡 <b>Current Channel:</b> @${diag.currentChannel}\n`;
  }

  if (diag.totalChannels > 0) {
    text += `📊 <b>Queue Progress:</b> <b>${diag.completedChannels} / ${diag.totalChannels}</b> channels ${progressBar} ${diag.percent}%\n\n`;
  } else {
    text += `\n`;
  }

  text += `📈 <b>Run Yield:</b>\n`;
  text += `• 🆕 Newly Indexed: <b>${(diag.totalIndexed || 0).toLocaleString()}</b>\n`;
  text += `• ⏭️ Skipped (Duplicates): <b>${(diag.totalSkipped || 0).toLocaleString()}</b>\n`;
  text += `• ⚠️ Errors: <b>${diag.errors || 0}</b>\n`;
  if (diag.lastError) {
    text += `• ⚠️ <i>Last error: ${escapeHtml(diag.lastError.substring(0, 60))}</i>\n`;
  }

  if (pendingUnindexedCount > 0) {
    text += `\nℹ️ <i>Channels not fully indexed in database: ${pendingUnindexedCount}</i>\n`;
  }

  const actionButtons = [];
  if (isRunning) {
    actionButtons.push([
      Markup.button.callback("⏹ Abort Scan", "adm_scan_abort"),
      Markup.button.callback("🔄 Refresh Diagnostics", "adm_indexstatus"),
    ]);
  } else {
    actionButtons.push([
      Markup.button.callback("▶ Run Full Scan", "adm_scan"),
      Markup.button.callback("🔄 Refresh Diagnostics", "adm_indexstatus"),
    ]);
  }

  actionButtons.push([
    Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main"),
  ]);

  return { text, keyboard: Markup.inlineKeyboard(actionButtons) };
}

/**
 * Send the admin panel
 */
const adminPanelCommand = async (ctx) => {
  try {
    const message = await getAdminPanelMessage();
    const pendingRecs = await ChannelRecommendation.countDocuments({ status: "pending" });
    const pendingReports = await ResourceReport.countDocuments({ status: "pending" });
    const keyboard = renderAdminPanelKeyboard(pendingReports, pendingRecs);

    await ctx.reply(message, {
      parse_mode: "HTML",
      ...keyboard,
    });
  } catch (error) {
    console.error("[ADM-PANEL] Error sending panel:", error);
    await ctx.reply("❌ Error showing admin panel.");
  }
};

/**
 * Register all admin panel handlers
 */
const registerAdminPanelHandlers = (bot) => {
  // Helper: Check admin access
  const requireAdmin = (handler) => {
    return async (ctx) => {
      if (!isAdminId(ctx.from.id)) {
        return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
      }
      return handler(ctx);
    };
  };

  // 📊 STATS
  bot.action(
    "adm_stats",
    requireAdmin(async (ctx) => {
      try {
        const resourceCount = await TelegramResource.countDocuments();
        const userCount = await User.countDocuments();
        const channels = await TelegramChannel.find({});
        const downloads = await TelegramResource.aggregate([
          { $group: { _id: null, total: { $sum: "$downloadCount" } } },
        ]);
        const downloadTotal = downloads[0]?.total || 0;

        const stats =
          `📊 <b>Full Statistics</b>\n\n` +
          `📦 Resources: <b>${resourceCount.toLocaleString()}</b>\n` +
          `👥 Users: <b>${userCount.toLocaleString()}</b>\n` +
          `📡 Channels: <b>${channels.length}</b>\n` +
          `📥 Total Downloads: <b>${downloadTotal.toLocaleString()}</b>\n\n` +
          `<i>Generated: ${new Date().toLocaleString()}</i>`;

        await ctx
          .editMessageText(stats, {
            parse_mode: "HTML",
            reply_markup: backToAdminKeyboard.reply_markup,
          })
          .catch(async () => {
            await ctx.reply(stats, {
              parse_mode: "HTML",
              reply_markup: backToAdminKeyboard.reply_markup,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-STATS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading stats", { show_alert: true });
      }
    }),
  );

  // 🏥 CHANNEL HEALTH
  bot.action(
    "adm_health",
    requireAdmin(async (ctx) => {
      try {
        const channels = await TelegramChannel.find({}).sort({
          healthStatus: 1,
        });
        let message = "🏥 <b>Channel Health Status</b>\n\n";

        const activeCount = channels.filter(
          (c) => c.healthStatus === "ACTIVE",
        ).length;
        const degradedCount = channels.filter(
          (c) => c.healthStatus === "DEGRADED",
        ).length;
        const deadCount = channels.filter(
          (c) => c.healthStatus === "DEAD",
        ).length;

        message += `✅ Active: <b>${activeCount}</b>\n`;
        message += `⚠️ Degraded: <b>${degradedCount}</b>\n`;
        message += `❌ Dead: <b>${deadCount}</b>\n\n`;

        if (deadCount > 0) {
          message += "<b>Dead Channels:</b>\n";
          channels
            .filter((c) => c.healthStatus === "DEAD")
            .slice(0, 10)
            .forEach((ch) => {
              message += `• @${ch.username} (${ch.failureCount} failures)\n`;
            });
        }

        message += `\n<i>Last scan: ${channels[0]?.lastSuccessfulScan?.toLocaleString() || "Never"}</i>`;

        await ctx
          .editMessageText(message, {
            parse_mode: "HTML",
            reply_markup: backToAdminKeyboard.reply_markup,
          })
          .catch(async () => {
            await ctx.reply(message, {
              parse_mode: "HTML",
              reply_markup: backToAdminKeyboard.reply_markup,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-HEALTH] Error:", error);
        await ctx.answerCbQuery("❌ Error loading health", {
          show_alert: true,
        });
      }
    }),
  );

  // 📋 PENDING CHANNELS (Interactive Moderation Workflow)
  bot.action(
    "adm_pending",
    requireAdmin(async (ctx) => {
      try {
        const pending = await ChannelRecommendation.find({ status: "pending" })
          .populate("recommendedBy")
          .sort({ createdAt: -1 });

        const view = renderPendingRecommendationView(pending, 0);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-PENDING] Error:", error);
        await ctx.answerCbQuery("❌ Error loading pending", {
          show_alert: true,
        });
      }
    }),
  );

  // Pagination for pending channels
  bot.action(
    /^adm_rec_page_(\d+)$/,
    requireAdmin(async (ctx) => {
      try {
        const page = parseInt(ctx.match[1], 10) || 0;
        const pending = await ChannelRecommendation.find({ status: "pending" })
          .populate("recommendedBy")
          .sort({ createdAt: -1 });

        const view = renderPendingRecommendationView(pending, page);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-REC-PAGE] Error:", error);
        await ctx.answerCbQuery("❌ Error changing page", { show_alert: true });
      }
    }),
  );

  bot.action(
    "adm_rec_noop",
    requireAdmin(async (ctx) => {
      await ctx.answerCbQuery();
    }),
  );

  // 1-Tap Approve & Index
  bot.action(
    /^adm_appr_([a-f0-9]+)_(\d+)$/,
    requireAdmin(async (ctx) => {
      try {
        const recId = ctx.match[1];
        const page = parseInt(ctx.match[2], 10) || 0;
        const rec = await ChannelRecommendation.findById(recId).populate("recommendedBy");

        if (!rec || rec.status !== "pending") {
          await ctx.answerCbQuery("⚠️ Already processed or not found.", { show_alert: true });
        } else {
          rec.status = "approved";
          await rec.save();

          await TelegramChannel.findOneAndUpdate(
            { username: rec.channelUsername },
            {
              username: rec.channelUsername,
              university: rec.university === "All Universities" ? "" : rec.university,
              department: "",
              type: "general",
              priority: 1,
              active: true,
              lastScannedAt: null,
              totalIndexed: 0,
            },
            { upsert: true, new: true },
          );

          // Queue automatic scan in background
          indexChannel(rec.channelUsername).catch((err) => {
            console.error(`[ADM-APPROVE] Background scan error for @${rec.channelUsername}:`, err);
          });

          // Notify recommending student
          if (rec.recommendedBy && rec.recommendedBy.telegramId) {
            await ctx.telegram
              .sendMessage(
                rec.recommendedBy.telegramId,
                `✅ <b>Good news!</b> Your recommendation for <b>@${rec.channelUsername}</b> has been approved and added to StudyHub!\n\nThank you for contributing! 🎓`,
                { parse_mode: "HTML" },
              )
              .catch(() => {});
          }

          await ctx.answerCbQuery(`✅ @${rec.channelUsername} approved & added!`);
        }

        // Re-render pending list in-place
        const remaining = await ChannelRecommendation.find({ status: "pending" })
          .populate("recommendedBy")
          .sort({ createdAt: -1 });

        const view = renderPendingRecommendationView(
          remaining,
          Math.min(page, Math.max(0, remaining.length - 1)),
        );

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-APPROVE] Error:", error);
        await ctx.answerCbQuery("❌ Error processing approval", { show_alert: true });
      }
    }),
  );

  // 1-Tap Reject
  bot.action(
    /^adm_rejc_([a-f0-9]+)_(\d+)$/,
    requireAdmin(async (ctx) => {
      try {
        const recId = ctx.match[1];
        const page = parseInt(ctx.match[2], 10) || 0;
        const rec = await ChannelRecommendation.findById(recId).populate("recommendedBy");

        if (!rec || rec.status !== "pending") {
          await ctx.answerCbQuery("⚠️ Already processed or not found.", { show_alert: true });
        } else {
          rec.status = "rejected";
          await rec.save();

          // Notify student politely
          if (rec.recommendedBy && rec.recommendedBy.telegramId) {
            await ctx.telegram
              .sendMessage(
                rec.recommendedBy.telegramId,
                `Thanks for suggesting <b>@${rec.channelUsername}</b>! We reviewed it, but unfortunately it doesn't meet our criteria for indexing at this time.`,
                { parse_mode: "HTML" },
              )
              .catch(() => {});
          }

          await ctx.answerCbQuery(`❌ Recommendation for @${rec.channelUsername} rejected.`);
        }

        // Re-render pending list in-place
        const remaining = await ChannelRecommendation.find({ status: "pending" })
          .populate("recommendedBy")
          .sort({ createdAt: -1 });

        const view = renderPendingRecommendationView(
          remaining,
          Math.min(page, Math.max(0, remaining.length - 1)),
        );

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-REJECT] Error:", error);
        await ctx.answerCbQuery("❌ Error processing rejection", { show_alert: true });
      }
    }),
  );

  // ⚠️ BROKEN FILE REPORTS (Interactive Dashboard)
  bot.action(
    "adm_reports",
    requireAdmin(async (ctx) => {
      try {
        const reports = await ResourceReport.find({ status: "pending" })
          .populate("resourceId")
          .populate("userId")
          .sort({ createdAt: -1 });

        const view = renderReportCardView(reports, 0);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-REPORTS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading reports", { show_alert: true });
      }
    }),
  );

  // Pagination for reports
  bot.action(
    /^adm_rep_page_(\d+)$/,
    requireAdmin(async (ctx) => {
      try {
        const page = parseInt(ctx.match[1], 10) || 0;
        const reports = await ResourceReport.find({ status: "pending" })
          .populate("resourceId")
          .populate("userId")
          .sort({ createdAt: -1 });

        const view = renderReportCardView(reports, page);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-REP-PAGE] Error:", error);
        await ctx.answerCbQuery("❌ Error changing page", { show_alert: true });
      }
    }),
  );

  bot.action(
    "adm_rep_noop",
    requireAdmin(async (ctx) => {
      await ctx.answerCbQuery();
    }),
  );

  // 1-Tap Disable Broken File & Resolve Report
  bot.action(
    /^adm_rep_dis_([a-f0-9]+)_(\d+)$/,
    requireAdmin(async (ctx) => {
      try {
        const reportId = ctx.match[1];
        const page = parseInt(ctx.match[2], 10) || 0;
        const report = await ResourceReport.findById(reportId).populate("resourceId");

        if (!report || report.status !== "pending") {
          await ctx.answerCbQuery("⚠️ Report already processed or not found.", { show_alert: true });
        } else {
          report.status = "resolved";
          await report.save();

          if (report.resourceId) {
            const resId = report.resourceId._id || report.resourceId;
            await TelegramResource.findByIdAndUpdate(resId, {
              isAvailable: false,
            });
          }

          await ctx.answerCbQuery("🗑️ Resource disabled and hidden from search!");
        }

        // Re-render remaining reports in-place
        const remaining = await ResourceReport.find({ status: "pending" })
          .populate("resourceId")
          .populate("userId")
          .sort({ createdAt: -1 });

        const view = renderReportCardView(
          remaining,
          Math.min(page, Math.max(0, remaining.length - 1)),
        );

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-REP-DIS] Error:", error);
        await ctx.answerCbQuery("❌ Error disabling resource", { show_alert: true });
      }
    }),
  );

  // 1-Tap Dismiss Report (No changes to resource)
  bot.action(
    /^adm_rep_dism_([a-f0-9]+)_(\d+)$/,
    requireAdmin(async (ctx) => {
      try {
        const reportId = ctx.match[1];
        const page = parseInt(ctx.match[2], 10) || 0;
        const report = await ResourceReport.findById(reportId);

        if (!report || report.status !== "pending") {
          await ctx.answerCbQuery("⚠️ Report already processed or not found.", { show_alert: true });
        } else {
          report.status = "reviewed";
          await report.save();
          await ctx.answerCbQuery("✅ Report dismissed.");
        }

        // Re-render remaining reports in-place
        const remaining = await ResourceReport.find({ status: "pending" })
          .populate("resourceId")
          .populate("userId")
          .sort({ createdAt: -1 });

        const view = renderReportCardView(
          remaining,
          Math.min(page, Math.max(0, remaining.length - 1)),
        );

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-REP-DISM] Error:", error);
        await ctx.answerCbQuery("❌ Error dismissing report", { show_alert: true });
      }
    }),
  );

  // 💾 ARCHIVE MONITOR
  bot.action(
    "adm_archive",
    requireAdmin(async (ctx) => {
      try {
        const metrics = await getArchiveMetrics();
        const view = renderArchiveMonitorView(metrics);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-ARCHIVE] Error:", error);
        await ctx.answerCbQuery("❌ Error loading archive status", { show_alert: true });
      }
    }),
  );

  bot.action(
    "adm_archive_start",
    requireAdmin(async (ctx) => {
      try {
        const result = await startArchiveSync({ batchSize: 10, maxBatches: 50 });
        if (!result.success) {
          await ctx.answerCbQuery(`⚠️ ${result.message}`, { show_alert: true });
        } else {
          await ctx.answerCbQuery("🔄 Archive sync started in background!");
        }

        const metrics = await getArchiveMetrics();
        const view = renderArchiveMonitorView(metrics);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-ARCHIVE-START] Error:", error);
        await ctx.answerCbQuery("❌ Error starting sync", { show_alert: true });
      }
    }),
  );

  bot.action(
    "adm_archive_stop",
    requireAdmin(async (ctx) => {
      try {
        const result = stopArchiveSync();
        if (!result.success) {
          await ctx.answerCbQuery(`⚠️ ${result.message}`, { show_alert: true });
        } else {
          await ctx.answerCbQuery("⏹ Stop signal sent to archive worker.");
        }

        const metrics = await getArchiveMetrics();
        const view = renderArchiveMonitorView(metrics);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-ARCHIVE-STOP] Error:", error);
        await ctx.answerCbQuery("❌ Error stopping sync", { show_alert: true });
      }
    }),
  );

  // 📡 CHANNEL MANAGER (Interactive Browser, Toggles & Force Scan)
  bot.action(
    "adm_channels",
    requireAdmin(async (ctx) => {
      try {
        const data = await getChannelManagerData(0, "all");
        const view = renderChannelManagerView(data);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-CHANNELS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading channels", { show_alert: true });
      }
    }),
  );

  // Filter selection (all, active, issues)
  bot.action(
    /^adm_ch_flt_([a-z]+)$/,
    requireAdmin(async (ctx) => {
      try {
        const filter = ctx.match[1];
        const data = await getChannelManagerData(0, filter);
        const view = renderChannelManagerView(data);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-CH-FLT] Error:", error);
        await ctx.answerCbQuery("❌ Error applying filter", { show_alert: true });
      }
    }),
  );

  // Pagination with filter preserved
  bot.action(
    /^adm_ch_page_(\d+)_([a-z]+)$/,
    requireAdmin(async (ctx) => {
      try {
        const page = parseInt(ctx.match[1], 10) || 0;
        const filter = ctx.match[2] || "all";
        const data = await getChannelManagerData(page, filter);
        const view = renderChannelManagerView(data);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-CH-PAGE] Error:", error);
        await ctx.answerCbQuery("❌ Error changing page", { show_alert: true });
      }
    }),
  );

  bot.action(
    "adm_ch_noop",
    requireAdmin(async (ctx) => {
      await ctx.answerCbQuery();
    }),
  );

  // 1-Tap Toggle Active/Inactive
  bot.action(
    /^adm_ch_tog_([a-zA-Z0-9_]+)_(\d+)_([a-z]+)$/,
    requireAdmin(async (ctx) => {
      try {
        const username = ctx.match[1];
        const page = parseInt(ctx.match[2], 10) || 0;
        const filter = ctx.match[3] || "all";

        const ch = await TelegramChannel.findOne({ username });
        if (!ch) {
          await ctx.answerCbQuery("⚠️ Channel not found in database", {
            show_alert: true,
          });
        } else {
          ch.active = !ch.active;
          await ch.save();
          await ctx.answerCbQuery(
            `@${username} is now ${ch.active ? "✅ ACTIVE" : "⏸ INACTIVE"}`,
          );
        }

        const data = await getChannelManagerData(page, filter);
        const view = renderChannelManagerView(data);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-CH-TOG] Error:", error);
        await ctx.answerCbQuery("❌ Error toggling channel", {
          show_alert: true,
        });
      }
    }),
  );

  // 1-Tap Force Scan Channel
  bot.action(
    /^adm_ch_scan_([a-zA-Z0-9_]+)_(\d+)_([a-z]+)$/,
    requireAdmin(async (ctx) => {
      try {
        const username = ctx.match[1];
        indexChannel(username).catch((err) => {
          console.error(`[ADM-CH-SCAN] Error indexing @${username}:`, err);
        });

        await ctx.answerCbQuery(`⚡ Force scan started for @${username}!`);
      } catch (error) {
        console.error("[ADM-CH-SCAN] Error:", error);
        await ctx.answerCbQuery("❌ Error starting scan", { show_alert: true });
      }
    }),
  );

  // 📜 RECENT LOGS
  bot.action(
    "adm_logs",
    requireAdmin(async (ctx) => {
      try {
        const logs = getAdminLogs(20);

        if (logs.length === 0) {
          await ctx
            .editMessageText("📜 <b>No errors logged yet.</b>", {
              parse_mode: "HTML",
              reply_markup: backToAdminKeyboard.reply_markup,
            })
            .catch(async () => {
              await ctx.reply("📜 No errors logged yet.", {
                parse_mode: "HTML",
                reply_markup: backToAdminKeyboard.reply_markup,
              });
            });
          await ctx.answerCbQuery();
          return;
        }

        let message = `📜 <b>Recent Logs</b> (last ${Math.min(20, logs.length)})\n\n`;
        message += `<pre>`;
        logs.forEach((log) => {
          const time = log.time.toLocaleTimeString();
          const level = log.level.toUpperCase();
          message += `[${time}] ${level}: ${log.message.substring(0, 50)}\n`;
        });
        message += `</pre>`;

        await ctx
          .editMessageText(message, {
            parse_mode: "HTML",
            reply_markup: backToAdminKeyboard.reply_markup,
          })
          .catch(async () => {
            await ctx.reply(message, {
              parse_mode: "HTML",
              reply_markup: backToAdminKeyboard.reply_markup,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-LOGS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading logs", { show_alert: true });
      }
    }),
  );

  // ▶ RUN FULL SCAN
  bot.action(
    "adm_scan",
    requireAdmin(async (ctx) => {
      try {
        if (isIndexingInProgress()) {
          await ctx.answerCbQuery("⚠️ Full scan is already in progress!", {
            show_alert: true,
          });
        } else {
          // Fire off scan in background
          indexAllChannels().catch((err) => {
            console.error("[ADM-SCAN] Background error:", err);
            pushAdminLog("error", `Scan failed: ${err.message}`);
          });
          await ctx.answerCbQuery("🔄 Full channel scan started!");
        }

        const diag = getIndexingDiagnostics();
        const unindexedCount = await TelegramChannel.countDocuments({
          fullyIndexed: false,
        });
        const view = renderIndexerDiagnosticsView(diag, unindexedCount);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-SCAN] Error:", error);
        await ctx.answerCbQuery("❌ Error starting scan", { show_alert: true });
      }
    }),
  );

  // ⏸ INDEXER STATUS & DIAGNOSTICS
  bot.action(
    "adm_indexstatus",
    requireAdmin(async (ctx) => {
      try {
        const diag = getIndexingDiagnostics();
        const unindexedCount = await TelegramChannel.countDocuments({
          fullyIndexed: false,
        });
        const view = renderIndexerDiagnosticsView(diag, unindexedCount);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-INDEXSTATUS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading diagnostics", {
          show_alert: true,
        });
      }
    }),
  );

  // ⏹ ABORT SCAN
  bot.action(
    "adm_scan_abort",
    requireAdmin(async (ctx) => {
      try {
        const result = abortIndexing();
        if (!result.success) {
          await ctx.answerCbQuery(`⚠️ ${result.message}`, { show_alert: true });
        } else {
          await ctx.answerCbQuery("⏹ Abort signal sent to indexer worker.");
        }

        const diag = getIndexingDiagnostics();
        const unindexedCount = await TelegramChannel.countDocuments({
          fullyIndexed: false,
        });
        const view = renderIndexerDiagnosticsView(diag, unindexedCount);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-SCAN-ABORT] Error:", error);
        await ctx.answerCbQuery("❌ Error aborting scan", { show_alert: true });
      }
    }),
  );

  // 📢 BROADCAST
  bot.action(
    "adm_broadcast",
    requireAdmin(async (ctx) => {
      try {
        const message =
          `📢 <b>Targeted Campus Broadcasts</b>\n\n` +
          `To compose a broadcast, send:\n` +
          `<code>/broadcast &lt;message text&gt;</code>\n\n` +
          `<b>Features:</b>\n` +
          `• <b>Campus Targeting:</b> Target all students, active users (30d), or specific campuses (AASTU, AAU, ASTU) using 1-tap pills before sending.\n` +
          `• <b>Media Support:</b> Attach a photo or video with a caption.\n` +
          `• <b>Interactive Buttons:</b> Add clickable URL buttons at the end:\n` +
          `  <code>BUTTON: Join Channel | https://t.me/channel</code>\n` +
          `• <b>Delivery Stats:</b> Live progress counter and delivery/block report.`;

        await ctx
          .editMessageText(message, {
            parse_mode: "HTML",
            reply_markup: backToAdminKeyboard.reply_markup,
          })
          .catch(async () => {
            await ctx.reply(message, {
              parse_mode: "HTML",
              reply_markup: backToAdminKeyboard.reply_markup,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-BROADCAST] Error:", error);
        await ctx.answerCbQuery("❌ Error", { show_alert: true });
      }
    }),
  );

  // 👥 USER LIST & RECENT ACTIVITY
  bot.action(
    "adm_users",
    requireAdmin(async (ctx) => {
      try {
        const total = await User.countDocuments();
        const newToday = await User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        const activeToday = await User.countDocuments({
          lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        const bannedCount = await User.countDocuments({ isBanned: true });

        // Retrieve 5 most recently active students
        const recentUsers = await User.find({})
          .sort({ lastActive: -1 })
          .limit(5);

        let message =
          `👥 <b>User Management & Metrics</b>\n\n` +
          `👥 Total Registered: <b>${total.toLocaleString()}</b>\n` +
          `🆕 Joined Today: <b>${newToday}</b>\n` +
          `⚡ Active Today: <b>${activeToday}</b>\n` +
          `🚫 Suspended / Banned: <b>${bannedCount}</b>\n\n` +
          `<b>Recent Students:</b>\n`;

        const buttons = [];

        recentUsers.forEach((u, i) => {
          const name = u.firstName || u.username || `User ${u.telegramId}`;
          const uni = u.university ? ` (${u.university})` : "";
          const status = u.isBanned ? "🚫" : "🟢";
          message += `${i + 1}. ${status} <b>${escapeHtml(name)}</b>${uni} · ID: <code>${u.telegramId}</code>\n`;

          buttons.push([
            Markup.button.callback(
              `🔍 Inspect ${name.substring(0, 16)}`,
              `adm_usr_inspect_${u._id}`,
            ),
          ]);
        });

        message += `\n<i>Tip: Use <code>/user &lt;id_or_username&gt;</code> to inspect any user directly.</i>`;

        buttons.push([
          Markup.button.callback("◀ Back to Admin Panel", "adm_panel_main"),
        ]);

        const keyboard = Markup.inlineKeyboard(buttons);

        await ctx
          .editMessageText(message, {
            parse_mode: "HTML",
            ...keyboard,
          })
          .catch(async () => {
            await ctx.reply(message, {
              parse_mode: "HTML",
              ...keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-USERS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading users", { show_alert: true });
      }
    }),
  );

  // Inspect user profile
  bot.action(
    /^adm_usr_inspect_([a-f0-9]+)$/,
    requireAdmin(async (ctx) => {
      try {
        const userId = ctx.match[1];
        const user = await User.findById(userId);
        if (!user) {
          return ctx.answerCbQuery("⚠️ User not found", { show_alert: true });
        }

        const recentSearches = await SearchHistory.find({ userId: user._id })
          .sort({ searchedAt: -1 })
          .limit(4);

        const view = renderUserProfileCard(user, recentSearches);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-USR-INSPECT] Error:", error);
        await ctx.answerCbQuery("❌ Error inspecting user", {
          show_alert: true,
        });
      }
    }),
  );

  // Toggle Ban / Unban user
  bot.action(
    /^adm_usr_ban_([a-f0-9]+)$/,
    requireAdmin(async (ctx) => {
      try {
        const userId = ctx.match[1];
        const user = await User.findById(userId);
        if (!user) {
          return ctx.answerCbQuery("⚠️ User not found", { show_alert: true });
        }

        user.isBanned = !user.isBanned;
        user.bannedAt = user.isBanned ? new Date() : null;
        await user.save();

        await ctx.answerCbQuery(
          user.isBanned ? "🚫 User suspended/banned!" : "✅ User unbanned!",
        );

        const recentSearches = await SearchHistory.find({ userId: user._id })
          .sort({ searchedAt: -1 })
          .limit(4);

        const view = renderUserProfileCard(user, recentSearches);

        await ctx
          .editMessageText(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          })
          .catch(async () => {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          });
      } catch (error) {
        console.error("[ADM-USR-BAN] Error:", error);
        await ctx.answerCbQuery("❌ Error toggling ban", { show_alert: true });
      }
    }),
  );

  // 🔄 REFRESH / RETURN TO MAIN PANEL
  const handleReturnToPanel = async (ctx, notification = null) => {
    try {
      const message = await getAdminPanelMessage();
      const pendingRecs = await ChannelRecommendation.countDocuments({ status: "pending" });
      const pendingReports = await ResourceReport.countDocuments({ status: "pending" });
      const keyboard = renderAdminPanelKeyboard(pendingReports, pendingRecs);

      await ctx
        .editMessageText(message, {
          parse_mode: "HTML",
          ...keyboard,
        })
        .catch(async () => {
          await ctx.reply(message, {
            parse_mode: "HTML",
            ...keyboard,
          });
        });

      await ctx.answerCbQuery(notification || undefined);
    } catch (error) {
      console.error("[ADM-PANEL-RETURN] Error:", error);
      await ctx.answerCbQuery("❌ Error loading panel", { show_alert: true });
    }
  };

  bot.action("adm_refresh", requireAdmin((ctx) => handleReturnToPanel(ctx, "✅ Updated")));
  bot.action("adm_panel_main", requireAdmin((ctx) => handleReturnToPanel(ctx)));

  // ❓ HELP
  bot.action(
    "adm_help",
    requireAdmin(async (ctx) => {
      try {
        const help =
          `<b>Admin Commands</b>\n\n` +
          `/admin — open this panel\n` +
          `/stats — usage statistics\n` +
          `/channelhealth — channel scan status\n` +
          `/addchannel @username — add a new channel\n` +
          `/removechannel @username — remove a channel\n` +
          `/listchannels — list all channels\n` +
          `/forcescan @username — force scan one channel\n` +
          `/pendingchannels — review recommendations\n` +
          `/broadcast — send message to all users`;

        await ctx
          .editMessageText(help, {
            parse_mode: "HTML",
            reply_markup: backToAdminKeyboard.reply_markup,
          })
          .catch(async () => {
            await ctx.reply(help, {
              parse_mode: "HTML",
              reply_markup: backToAdminKeyboard.reply_markup,
            });
          });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-HELP] Error:", error);
        await ctx.answerCbQuery("❌ Error loading help", { show_alert: true });
      }
    }),
  );
};

/**
 * /addchannel <username> [university] [department] [type] [priority]
 */
const addChannelCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply(
      "⚠️ Usage: /addchannel <username> [university] [department] [type] [priority]\nExample: /addchannel ethioacadamic AA AAU general 1",
    );
  }

  let username = args[0].replace("@", "");
  const university = args[1] || "";
  const department = args[2] || "";
  const type = args[3] || "general";
  const priority = args[4] ? parseInt(args[4]) : 1;

  try {
    await TelegramChannel.findOneAndUpdate(
      { username },
      {
        username,
        university,
        department,
        type,
        priority,
        active: true,
        lastScannedAt: null, // Force full scan next time
        totalIndexed: 0,
      },
      { upsert: true, new: true },
    );
    await ctx.reply(
      `✅ Channel @${username} added successfully and queued for full scan.`,
    );
  } catch (error) {
    console.error("[Admin] Error adding channel:", error);
    await ctx.reply("❌ Failed to add channel.");
  }
};

/**
 * /removechannel <username>
 */
const removeChannelCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply("⚠️ Usage: /removechannel <username>");
  }

  let username = args[0].replace("@", "");

  try {
    const channel = await TelegramChannel.findOneAndUpdate(
      { username },
      { active: false },
      { new: true },
    );

    if (channel) {
      await ctx.reply(`✅ Channel @${username} has been deactivated.`);
    } else {
      await ctx.reply(`⚠️ Channel @${username} not found in database.`);
    }
  } catch (error) {
    console.error("[Admin] Error removing channel:", error);
    await ctx.reply("❌ Failed to remove channel.");
  }
};

/**
 * /channels or /listchannels — open interactive channel manager
 */
const channelsCommand = async (ctx) => {
  try {
    const data = await getChannelManagerData(0, "all");
    const view = renderChannelManagerView(data);

    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...view.keyboard,
    });
  } catch (error) {
    console.error("[ChannelsCommand] Error:", error);
    return ctx.reply("❌ Error loading channel manager.");
  }
};

const listChannelsCommand = channelsCommand;

/**
 * /user <id_or_username> — inspect student profile, activity, and ban controls
 */
const userInspectorCommand = async (ctx) => {
  try {
    const rawText = ctx.message?.text || "";
    const args = rawText.split(" ").slice(1);
    if (args.length === 0) {
      return ctx.reply(
        "⚠️ Usage: <code>/user &lt;telegram_id_or_username&gt;</code>\n\nExample:\n• <code>/user 123456789</code>\n• <code>/user dawit_et</code>",
        { parse_mode: "HTML" },
      );
    }

    const input = args[0].replace(/^@/, "").trim();
    const user = await User.findOne({
      $or: [
        { telegramId: input },
        { username: new RegExp(`^${input}$`, "i") },
      ],
    });

    if (!user) {
      return ctx.reply(`❌ No user found matching "<b>${escapeHtml(input)}</b>".`, {
        parse_mode: "HTML",
      });
    }

    const recentSearches = await SearchHistory.find({ userId: user._id })
      .sort({ searchedAt: -1 })
      .limit(4);

    const view = renderUserProfileCard(user, recentSearches);

    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...view.keyboard,
    });
  } catch (error) {
    console.error("[UserInspectorCommand] Error:", error);
    return ctx.reply("❌ Error inspecting user.");
  }
};

/**
 * /indexstatus — view live indexer diagnostics directly
 */
const indexStatusCommand = async (ctx) => {
  try {
    const diag = getIndexingDiagnostics();
    const unindexedCount = await TelegramChannel.countDocuments({
      fullyIndexed: false,
    });
    const view = renderIndexerDiagnosticsView(diag, unindexedCount);

    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...view.keyboard,
    });
  } catch (error) {
    console.error("[IndexStatusCommand] Error:", error);
    return ctx.reply("❌ Error loading indexer status.");
  }
};

/**
 * /forcescan <username>
 */
const forceScanCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply("⚠️ Usage: /forcescan <username>");
  }

  let username = args[0].replace("@", "");

  try {
    const channel = await TelegramChannel.findOne({ username });
    if (!channel) {
      return ctx.reply(
        `⚠️ Channel @${username} not found in database. Add it first with /addchannel.`,
      );
    }
    if (isIndexingInProgress()) {
      await ctx.reply(
        `ℹ️ Heads up: a scheduled full scan is currently running. This force-scan will run alongside it — that's safe, but may be slower than usual.`,
      );
    }
    const statusMsg = await ctx.reply(
      `⏳ Forcing scan on @${username}... This might take a while depending on channel size.`,
    );

    indexChannel(username)
      .then(async (results) => {
        let report = `✅ <b>Force Scan Complete: @${username}</b>\n\n`;
        report += `📑 Total Parsed: ${results.indexed + results.skipped}\n`;
        report += `🆕 New/Updated: ${results.indexed}\n`;
        report += `⏭️ Skipped: ${results.skipped}\n`;

        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            undefined,
            report,
            { parse_mode: "HTML" },
          )
          .catch(() => {});
      })
      .catch(async (error) => {
        console.error("[Admin] Error forcing scan:", error);
        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            undefined,
            `❌ Failed to force scan @${username}. Error: ${error.message}`,
          )
          .catch(() => {});
      });

    return;
  } catch (error) {
    console.error("[Admin] Error forcing scan:", error);
    await ctx.reply(
      `❌ Failed to force scan @${username}. Error: ${error.message}`,
    );
  }
};

/**
 * /pendingchannels — view pending channel recommendations directly
 */
const pendingChannelsCommand = async (ctx) => {
  try {
    const pending = await ChannelRecommendation.find({ status: "pending" })
      .populate("recommendedBy")
      .sort({ createdAt: -1 });

    const view = renderPendingRecommendationView(pending, 0);

    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...view.keyboard,
    });
  } catch (error) {
    console.error("[PendingChannelsCommand] Error:", error);
    return ctx.reply("❌ Error loading pending channels.");
  }
};

/**
 * /reports — view pending broken file reports directly
 */
const reportsCommand = async (ctx) => {
  try {
    const reports = await ResourceReport.find({ status: "pending" })
      .populate("resourceId")
      .populate("userId")
      .sort({ createdAt: -1 });

    const view = renderReportCardView(reports, 0);

    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...view.keyboard,
    });
  } catch (error) {
    console.error("[ReportsCommand] Error:", error);
    return ctx.reply("❌ Error loading reports.");
  }
};

/**
 * /archive — inspect archive channel monitor directly
 */
const archiveCommand = async (ctx) => {
  try {
    const metrics = await getArchiveMetrics();
    const view = renderArchiveMonitorView(metrics);

    return ctx.reply(view.text, {
      parse_mode: "HTML",
      ...view.keyboard,
    });
  } catch (error) {
    console.error("[ArchiveCommand] Error:", error);
    return ctx.reply("❌ Error loading archive monitor.");
  }
};

const registerAdminActionHandlers = (bot) => {
  bot.action(/approve_rec_(.+)/, async (ctx) => {
    if (!isAdminUser(ctx.from?.id)) {
      return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
    }
    try {
      const recId = ctx.match[1];
      const rec =
        await ChannelRecommendation.findById(recId).populate("recommendedBy");
      if (!rec || rec.status !== "pending") {
        return await ctx.answerCbQuery(
          "Recommendation already processed or not found.",
          { show_alert: true },
        );
      }

      rec.status = "approved";
      await rec.save();

      await TelegramChannel.findOneAndUpdate(
        { username: rec.channelUsername },
        {
          username: rec.channelUsername,
          university:
            rec.university === "All Universities" ? "" : rec.university,
          department: "",
          type: "general",
          priority: 1,
          active: true,
          lastScannedAt: null,
          totalIndexed: 0,
        },
        { upsert: true, new: true },
      );

      await ctx
        .editMessageText(
          ctx.callbackQuery.message.text + "\n\n✅ <b>APPROVED</b>",
          { parse_mode: "HTML" },
        )
        .catch(() => {});

      if (rec.recommendedBy && rec.recommendedBy.telegramId) {
        await bot.telegram
          .sendMessage(
            rec.recommendedBy.telegramId,
            `✅ Thanks! Your recommendation for @${rec.channelUsername} has been approved and added to StudyHub!`,
          )
          .catch(() => {});
      }

      await ctx.answerCbQuery("Approved!");
    } catch (err) {
      console.error("Error approving rec:", err);
      await ctx.answerCbQuery("Error processing approval", {
        show_alert: true,
      });
    }
  });

  bot.action(/reject_rec_(.+)/, async (ctx) => {
    if (!isAdminUser(ctx.from?.id)) {
      return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
    }
    try {
      const recId = ctx.match[1];
      const rec =
        await ChannelRecommendation.findById(recId).populate("recommendedBy");
      if (!rec || rec.status !== "pending") {
        return await ctx.answerCbQuery(
          "Recommendation already processed or not found.",
          { show_alert: true },
        );
      }

      rec.status = "rejected";
      await rec.save();

      await ctx
        .editMessageText(
          ctx.callbackQuery.message.text + "\n\n❌ <b>REJECTED</b>",
          { parse_mode: "HTML" },
        )
        .catch(() => {});

      if (rec.recommendedBy && rec.recommendedBy.telegramId) {
        await bot.telegram
          .sendMessage(
            rec.recommendedBy.telegramId,
            `Thanks for the suggestion! We reviewed @${rec.channelUsername} but it didn't meet our criteria right now.`,
          )
          .catch(() => {});
      }

      await ctx.answerCbQuery("Rejected!");
    } catch (err) {
      console.error("Error rejecting rec:", err);
      await ctx.answerCbQuery("Error processing rejection", {
        show_alert: true,
      });
    }
  });
};

module.exports = {
  isAdminUser,
  isAdmin,
  isAdminId,
  pushAdminLog,
  getAdminLogs,
  adminPanelCommand,
  getAdminPanelMessage,
  renderAdminPanelKeyboard,
  registerAdminPanelHandlers,
  renderPendingRecommendationView,
  pendingChannelsCommand,
  renderReportCardView,
  reportsCommand,
  renderArchiveMonitorView,
  archiveCommand,
  renderChannelManagerView,
  getChannelManagerData,
  channelsCommand,
  renderUserProfileCard,
  userInspectorCommand,
  renderIndexerDiagnosticsView,
  indexStatusCommand,
  addChannelCommand,
  removeChannelCommand,
  listChannelsCommand,
  forceScanCommand,
  registerAdminActionHandlers,
};
