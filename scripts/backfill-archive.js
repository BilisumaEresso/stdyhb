/**
 * StudyHub Archive Backfill Tool
 * 
 * Forwards unarchived resources from source channels to ARCHIVE_CHAT_ID in safe batches,
 * permanently saving them so file delivery NEVER fails due to channel forward restrictions
 * or channel deletions.
 * 
 * Usage: node scripts/backfill-archive.js [optional_limit]
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { getClient } = require("../src/search/telegramIndexer");
const TelegramResource = require("../src/db/models/TelegramResource");

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

async function runBackfill() {
  const archiveChatId = process.env.ARCHIVE_CHAT_ID
    ? parseInt(process.env.ARCHIVE_CHAT_ID)
    : null;

  if (!archiveChatId) {
    console.error("❌ ARCHIVE_CHAT_ID is not configured in .env!");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const tg = await getClient();
  console.log("✅ MTProto Telegram client connected");

  const totalUnarchived = await TelegramResource.countDocuments({
    $or: [{ archiveMessageId: null }, { archiveMessageId: { $exists: false } }],
  });

  console.log(`\n📦 Total unarchived resources found: ${totalUnarchived}`);
  if (totalUnarchived === 0) {
    console.log("🎉 All resources are already fully archived!");
    await mongoose.disconnect();
    return;
  }

  // Group unarchived items by channel
  const channels = await TelegramResource.distinct("channelUsername", {
    $or: [{ archiveMessageId: null }, { archiveMessageId: { $exists: false } }],
    channelUsername: { $ne: null },
  });

  console.log(`📡 Found ${channels.length} channels with unarchived materials.`);

  let totalArchivedSession = 0;
  let totalFailedSession = 0;
  const BATCH_SIZE = 10;

  for (const channelUsername of channels) {
    const unarchivedItems = await TelegramResource.find({
      channelUsername,
      $or: [
        { archiveMessageId: null },
        { archiveMessageId: { $exists: false } },
      ],
    })
      .sort({ messageDate: 1 })
      .select("_id messageId channelUsername fileName");

    if (unarchivedItems.length === 0) continue;

    console.log(
      `\n🔄 Archiving @${channelUsername}: ${unarchivedItems.length} items...`
    );

    for (let i = 0; i < unarchivedItems.length; i += BATCH_SIZE) {
      const batch = unarchivedItems.slice(i, i + BATCH_SIZE);
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
            totalArchivedSession++;
          }
        }

        process.stdout.write(
          `  ✓ Archived ${Math.min(i + BATCH_SIZE, unarchivedItems.length)}/${unarchivedItems.length} items\r`
        );

        // Safe delay to protect against Telegram flood limits
        await sleep(1500);
      } catch (err) {
        console.warn(
          `\n  ⚠️ Batch failed for @${channelUsername} (msgs: ${messageIds.join(", ")}): ${err.message}`
        );
        totalFailedSession += batch.length;

        // If flood wait, respect Telegram timeout
        if (err.message.includes("FLOOD_WAIT_")) {
          const waitSeconds = parseInt(err.message.split("FLOOD_WAIT_")[1], 10) || 30;
          console.log(`  ⏳ Flood limit hit. Sleeping for ${waitSeconds} seconds...`);
          await sleep((waitSeconds + 2) * 1000);
        } else {
          await sleep(2000);
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`🏁 Archive Backfill Completed!`);
  console.log(`✅ Successfully archived: ${totalArchivedSession}`);
  console.log(`⚠️ Failed/Restricted items: ${totalFailedSession}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

if (require.main === module) {
  runBackfill().catch((err) => {
    console.error("Backfill Fatal Error:", err);
    process.exit(1);
  });
}

module.exports = { runBackfill };
