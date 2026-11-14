require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function testResourceApi() {
  await mongoose.connect(process.env.MONGO_URI);
  const resource = await TelegramResource.findById("6a3b87b536ec1aec7217d45a").lean();
  console.log("=== Testing Resource Detail Retrieval ===");
  console.log("ID:", resource._id);
  console.log("Title:", resource.cleanTitle);
  console.log("Channel:", resource.channelUsername);

  // Replicate routes.js logic
  const altConditions = [];
  if (resource.fileName && resource.fileSize > 0) {
    altConditions.push({ fileName: resource.fileName, fileSize: resource.fileSize });
  }
  if (resource.fileUniqueId) {
    altConditions.push({ fileUniqueId: resource.fileUniqueId });
  }

  const alts = await TelegramResource.find({
    $or: altConditions,
    _id: { $ne: resource._id },
    channelUsername: { $ne: resource.channelUsername },
    isAvailable: true
  }).select("channelUsername messageId university downloadCount").lean();

  const seen = new Set();
  const alternativeSources = [];
  for (const a of alts) {
    const ch = (a.channelUsername || "").toLowerCase();
    if (ch && !seen.has(ch)) {
      seen.add(ch);
      alternativeSources.push({
        channelUsername: a.channelUsername,
        messageId: a.messageId,
        university: a.university || "",
        downloadCount: a.downloadCount || 0
      });
    }
  }

  console.log(`Found ${alternativeSources.length} distinct alternative channels:`);
  alternativeSources.forEach(s => console.log(`  - @${s.channelUsername} (msg ${s.messageId}, uni: ${s.university || 'N/A'})`));

  await mongoose.disconnect();
}
testResourceApi().catch(console.error);
