require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
  });
  console.log("✅ Connected\n");

  // Find all resources with no searchable text
  const unsearchable = await TelegramResource.find(
    {
      fileName: { $in: ["", null] },
      caption: { $in: ["", null] },
    },
    "_id channelUsername fileType groupId tags isExam",
  );

  console.log(`Found ${unsearchable.length} unsearchable resources`);

  let fixed = 0;
  for (const r of unsearchable) {
    // Build a searchable caption from the channel name
    // e.g. @GATExams → "gat exams exit exam"
    const channelTag = r.channelUsername
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .trim();
    const newCaption = channelTag;

    // Also mark as exam if it's an image (GATExams, moeexitexamofficial are exam channels)
    const shouldBeExam =
      r.fileType === "image" ||
      r.channelUsername.toLowerCase().includes("exam") ||
      r.channelUsername.toLowerCase().includes("exit");

    // Extract simple tags from channel name
    const tagWords = channelTag.split(/\s+/).filter((w) => w.length > 2);
    const newTags = [...new Set([...r.tags, ...tagWords])];
    if (shouldBeExam && !newTags.includes("exam")) newTags.push("exam");

    await TelegramResource.updateOne(
      { _id: r._id },
      {
        $set: {
          caption: newCaption,
          tags: newTags,
          isExam: shouldBeExam ? true : r.isExam,
        },
      },
    );
    fixed++;
    if (fixed % 50 === 0)
      console.log(`  Fixed ${fixed}/${unsearchable.length}...`);
  }

  console.log(`\n✅ Fixed ${fixed} unsearchable resources`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
