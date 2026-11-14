require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const searchService = require("../src/search/search.service");

async function polishTitles() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Polishing Generic Photo Album Titles ===");

  const genericTitles = ["Mid", "Exam", "Final", "Quiz", "Test", "Untitled", "Untitled Resource"];
  const albums = await TelegramResource.find({
    fileType: "image",
    groupId: { $ne: null },
    cleanTitle: { $in: genericTitles }
  }).lean();

  console.log(`Found ${albums.length} image resources with generic titles.`);

  const bulkOps = [];
  for (const r of albums) {
    if (r.caption) {
      const better = searchService.cleanCaptionTitle(r.caption, null);
      if (better && !genericTitles.includes(better) && better.length > 5) {
        bulkOps.push({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { cleanTitle: better } }
          }
        });
      }
    }
  }

  if (bulkOps.length > 0) {
    console.log(`Updating ${bulkOps.length} resources with polished titles...`);
    await TelegramResource.bulkWrite(bulkOps);
    console.log("✅ Polishing complete.");
  } else {
    console.log("No resources required title updates.");
  }

  // Check messages 27, 28, 29 in keleme_2013 again
  const samples = await TelegramResource.find({
    channelUsername: "keleme_2013",
    messageId: { $in: [27, 28, 29] }
  }).select("messageId cleanTitle groupId groupIndex groupTotal").lean();

  console.log("\nUpdated sample @keleme_2013 msgs 27, 28, 29:");
  samples.forEach(s => console.log(`  Msg ${s.messageId} | ${s.groupId} (${s.groupIndex}/${s.groupTotal}) | "${s.cleanTitle}"`));

  await mongoose.disconnect();
}

polishTitles().catch(console.error);
