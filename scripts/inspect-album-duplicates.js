require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const TelegramChannel = require("../src/db/models/TelegramChannel");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  // Check the earliest channels that actually have resources
  console.log("=== Finding the 5 oldest channels with indexed resources ===");
  const channelsWithRes = await TelegramChannel.find({ totalIndexed: { $gt: 0 } })
    .sort({ createdAt: 1 })
    .limit(10)
    .lean();

  channelsWithRes.forEach((c, i) => {
    console.log(`${i + 1}. @${c.username} (Created: ${c.createdAt?.toISOString()}, Indexed: ${c.totalIndexed})`);
  });

  // Check indexedAt range in TelegramResource
  const earliestResource = await TelegramResource.findOne().sort({ indexedAt: 1 }).lean();
  const latestResource = await TelegramResource.findOne().sort({ indexedAt: -1 }).lean();
  console.log(`\nTelegramResource indexedAt range: ${earliestResource?.indexedAt?.toISOString()} to ${latestResource?.indexedAt?.toISOString()}`);

  // Let's inspect @keleme_2013 and @freshman_materials specifically:
  // How many resources have groupId? How many don't?
  // What are the fileTypes?
  for (const ch of ["keleme_2013", "freshman_materials", "ethioacadamic", "Best_book_for_students", "Exit_Exam_Questions"]) {
    console.log(`\n================ Channel: @${ch} ================`);
    const count = await TelegramResource.countDocuments({ channelUsername: ch });
    const withGroup = await TelegramResource.countDocuments({ channelUsername: ch, groupId: { $ne: null } });
    const withoutGroup = await TelegramResource.countDocuments({ channelUsername: ch, groupId: null });
    const imageCount = await TelegramResource.countDocuments({ channelUsername: ch, fileType: "image" });
    const pdfCount = await TelegramResource.countDocuments({ channelUsername: ch, fileType: "pdf" });

    console.log(`Total: ${count} | With groupId: ${withGroup} | Without groupId: ${withoutGroup} | Images: ${imageCount} | PDFs: ${pdfCount}`);

    // Check for resources that share the same cleanTitle / fileName / caption or consecutive messageIds
    // Find potential duplicates / album items
    const sampleBundles = await TelegramResource.find({ channelUsername: ch })
      .sort({ messageId: 1 })
      .limit(30)
      .lean();

    console.log(`Sample of first 10 resources in @${ch}:`);
    sampleBundles.slice(0, 10).forEach(r => {
      console.log(`  msgId: ${r.messageId} | groupId: ${r.groupId || 'null'} (idx:${r.groupIndex}/${r.groupTotal}) | type: ${r.fileType} | title: "${r.cleanTitle || r.fileName}" | caption: "${(r.caption || '').slice(0, 40)}" | fileUniqueId: ${r.fileUniqueId}`);
    });
  }

  await mongoose.disconnect();
}

main().catch(console.error);
