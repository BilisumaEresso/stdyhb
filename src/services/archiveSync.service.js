const TelegramResource = require("../db/models/TelegramResource");
const { getClient } = require("../search/telegramIndexer");

let isSyncRunning = false;
let shouldStop = false;
let syncStats = {
  startedAt: null,
  processed: 0,
  succeeded: 0,
  failed: 0,
  currentChannel: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeForwarded(fwd) {
  if (Array.isArray(fwd) && Array.isArray(fwd[0])) return fwd[0];
  if (fwd && fwd.updates && Array.isArray(fwd.updates)) {
    return fwd.updates
      .filter(
        (u) =>
          u.className === "UpdateNewMessage" ||
          u.className === "UpdateNewChannelMessage"
      )
      .map((u) => u.message);
  }
  return fwd;
}

/**
 * Generate visual progress bar string: [████████░░]
 */
function makeProgressBar(percent, length = 10) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return "[" + "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty)) + "]";
}

/**
 * Get comprehensive archive health metrics from MongoDB
 */
async function getArchiveMetrics() {
  const total = await TelegramResource.countDocuments();
  const archived = await TelegramResource.countDocuments({
    archiveMessageId: { $ne: null },
  });
  const unarchived = Math.max(0, total - archived);
  const percentage = total > 0 ? ((archived / total) * 100).toFixed(1) : "0.0";
  const progressBar = makeProgressBar(parseFloat(percentage));

  const pendingChannels = await TelegramResource.distinct("channelUsername", {
    $or: [{ archiveMessageId: null }, { archiveMessageId: { $exists: false } }],
    channelUsername: { $ne: null },
  });

  return {
    total,
    archived,
    unarchived,
    percentage,
    progressBar,
    pendingChannelCount: pendingChannels.length,
    isRunning: isSyncRunning,
    stats: isSyncRunning ? syncStats : null,
  };
}

/**
 * Check if an archive sync job is currently running
 */
function isArchiveSyncActive() {
  return {
    isRunning: isSyncRunning,
    stats: syncStats,
  };
}

/**
 * Request active archive sync to stop gracefully
 */
function stopArchiveSync() {
  if (!isSyncRunning) {
    return { success: false, message: "No sync currently running" };
  }
  shouldStop = true;
  return { success: true, message: "Stop requested" };
}

/**
 * Start asynchronous archive backfill batch
 */
async function startArchiveSync(options = {}) {
  if (isSyncRunning) {
    return { success: false, message: "Archive sync is already in progress" };
  }

  const archiveChatId = process.env.ARCHIVE_CHAT_ID
    ? parseInt(process.env.ARCHIVE_CHAT_ID, 10)
    : null;

  if (!archiveChatId) {
    return { success: false, message: "ARCHIVE_CHAT_ID not configured in .env" };
  }

  isSyncRunning = true;
  shouldStop = false;
  syncStats = {
    startedAt: new Date(),
    processed: 0,
    succeeded: 0,
    failed: 0,
    currentChannel: null,
  };

  const batchSize = options.batchSize || 10;
  const maxBatches = options.maxBatches || 50; // default 500 items per run

  // Run in background without blocking
  (async () => {
    try {
      const tg = await getClient();

      const channels = await TelegramResource.distinct("channelUsername", {
        $or: [{ archiveMessageId: null }, { archiveMessageId: { $exists: false } }],
        channelUsername: { $ne: null },
      });

      let batchesProcessed = 0;

      for (const channelUsername of channels) {
        if (shouldStop || batchesProcessed >= maxBatches) break;
        syncStats.currentChannel = channelUsername;

        const unarchivedItems = await TelegramResource.find({
          channelUsername,
          $or: [
            { archiveMessageId: null },
            { archiveMessageId: { $exists: false } },
          ],
        })
          .sort({ messageDate: 1 })
          .select("_id messageId channelUsername fileName")
          .limit(batchSize * 5);

        if (unarchivedItems.length === 0) continue;

        for (let i = 0; i < unarchivedItems.length; i += batchSize) {
          if (shouldStop || batchesProcessed >= maxBatches) break;

          const batch = unarchivedItems.slice(i, i + batchSize);
          const messageIds = batch.map((r) => r.messageId);

          try {
            const forwarded = normalizeForwarded(
              await tg.forwardMessages(archiveChatId, {
                messages: messageIds,
                fromPeer: `@${channelUsername}`,
              })
            );

            const fwdList = Array.isArray(forwarded) ? forwarded : [forwarded];

            for (let j = 0; j < batch.length; j++) {
              if (fwdList[j] && fwdList[j].id) {
                await TelegramResource.findByIdAndUpdate(batch[j]._id, {
                  archiveMessageId: fwdList[j].id,
                });
                syncStats.succeeded++;
              } else {
                syncStats.failed++;
              }
              syncStats.processed++;
            }

            batchesProcessed++;
            await sleep(1500);
          } catch (err) {
            console.warn(
              `[ArchiveSync] Batch failed for @${channelUsername}: ${err.message}`
            );
            syncStats.failed += batch.length;
            syncStats.processed += batch.length;
            batchesProcessed++;

            if (err.message && err.message.includes("FLOOD_WAIT_")) {
              const waitSeconds =
                parseInt(err.message.split("FLOOD_WAIT_")[1], 10) || 30;
              await sleep((waitSeconds + 2) * 1000);
            } else {
              await sleep(2000);
            }
          }
        }
      }
    } catch (err) {
      console.error("[ArchiveSync] Background sync fatal error:", err);
    } finally {
      isSyncRunning = false;
      shouldStop = false;
      syncStats.currentChannel = null;
    }
  })();

  return { success: true, message: "Archive sync started in background" };
}

module.exports = {
  getArchiveMetrics,
  isArchiveSyncActive,
  startArchiveSync,
  stopArchiveSync,
  makeProgressBar,
};
