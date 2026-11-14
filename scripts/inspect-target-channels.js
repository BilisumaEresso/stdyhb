require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function inspectTargetChannels() {
  await mongoose.connect(process.env.MONGO_URI);
  const channels = ['freshman_materials', 'keleme_2013', 'ethioacadamic'];

  for (const ch of channels) {
    const total = await TelegramResource.countDocuments({ channelUsername: ch });
    const available = await TelegramResource.countDocuments({ channelUsername: ch, isAvailable: { $ne: false } });
    const grouped = await TelegramResource.countDocuments({ channelUsername: ch, groupId: { $ne: null } });
    const ungrouped = await TelegramResource.countDocuments({ channelUsername: ch, groupId: null, isAvailable: { $ne: false } });
    const pdfs = await TelegramResource.countDocuments({ channelUsername: ch, fileType: 'pdf', isAvailable: { $ne: false } });
    const images = await TelegramResource.countDocuments({ channelUsername: ch, fileType: 'image', isAvailable: { $ne: false } });

    console.log(`\n=== @${ch} ===`);
    console.log(`Total: ${total} | Available: ${available}`);
    console.log(`Grouped: ${grouped} | Ungrouped: ${ungrouped}`);
    console.log(`PDFs: ${pdfs} | Images: ${images}`);

    // Check sample bundles in this channel
    const sampleGroups = await TelegramResource.aggregate([
      { $match: { channelUsername: ch, groupId: { $ne: null } } },
      { $group: { _id: "$groupId", count: { $sum: 1 }, titles: { $push: "$cleanTitle" }, types: { $push: "$fileType" }, msgIds: { $push: "$messageId" } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 }
    ]);
    console.log(`Sample bundles (count > 1): ${sampleGroups.length}`);
    sampleGroups.forEach(g => {
      console.log(`  Bundle ${g._id} (${g.count} files, msgs: ${g.msgIds.join(', ')}):`);
      g.titles.slice(0, 4).forEach((t, i) => console.log(`    [${i+1}] ${g.types[i]}: "${t}"`));
    });

    // Check sample ungrouped PDF sequences that might belong to the same bundle
    const ungroupedPdfs = await TelegramResource.find({
      channelUsername: ch,
      fileType: 'pdf',
      groupId: null,
      isAvailable: { $ne: false }
    }).sort({ messageId: 1 }).limit(10).select('messageId fileName cleanTitle caption indexedAt');

    console.log(`Sample ungrouped PDFs: ${ungroupedPdfs.length}`);
    ungroupedPdfs.forEach(p => {
      console.log(`  Msg ${p.messageId}: "${p.cleanTitle}" | File: "${p.fileName}"`);
    });
  }

  await mongoose.disconnect();
}
inspectTargetChannels().catch(console.error);
