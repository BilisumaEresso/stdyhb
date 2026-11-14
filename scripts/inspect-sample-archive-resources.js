/**
 * inspect-sample-archive-resources.js
 * Fetches full records for the sample archive post IDs provided by the user,
 * identifies all siblings (sharing the same groupId),
 * and analyzes patterns.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

const rawIds = [
  98657, 98641, 98640, 98633, 98632, 98630, 98634, 98628, 98627, 98626,
  98624, 98623, 98619, 98621, 98618, 98490, 98461, 98460, 98459, 98457,
  98448, 98417, 98416, 98370, 98280, 98278, 98277, 98276, 98274, 98275,
  98271, 98150, 98106, 98107, 98110, 97973, 97944, 97762, 97758, 97756,
  97739, 97733, 97709, 97708, 97575, 97571, 97570, 97569, 97561, 97558,
  97557, 97473, 97464, 97434, 97430, 97270, 97251, 97237, 97227, 97226,
  97230, 97225, 97118, 97081, 94866, 94810, 90655, 90650, 90649, 90644,
  90640, 90127, 89063, 88759
];

const uniqueIds = Array.from(new Set(rawIds));

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Connected to DB. Checking ${uniqueIds.length} sample archive IDs...\n`);

  // Try matching archiveMessageId
  const byArchiveId = await TelegramResource.find({
    archiveMessageId: { $in: uniqueIds }
  }).lean();

  // Try matching messageId just in case
  const byMsgId = await TelegramResource.find({
    messageId: { $in: uniqueIds }
  }).lean();

  console.log(`Matched by archiveMessageId: ${byArchiveId.length}`);
  console.log(`Matched by messageId:        ${byMsgId.length}`);

  const primaryDocs = byArchiveId.length > 0 ? byArchiveId : byMsgId;
  const matchField = byArchiveId.length > 0 ? 'archiveMessageId' : 'messageId';

  if (primaryDocs.length === 0) {
    console.log("⚠️ No documents directly matched. Let's inspect max archiveMessageId in DB:");
    const maxArchive = await TelegramResource.find({ archiveMessageId: { $ne: null } })
      .sort({ archiveMessageId: -1 })
      .limit(5)
      .select('archiveMessageId messageId channelUsername caption fileType')
      .lean();
    console.log("Top archiveMessageIds in DB:", maxArchive);
    await mongoose.disconnect();
    return;
  }

  // Find all sibling groups
  const groupIds = Array.from(new Set(primaryDocs.map(d => d.groupId).filter(Boolean)));
  console.log(`Found ${groupIds.length} distinct groupIds among matched resources.\n`);

  // Fetch all siblings
  let allRelatedDocs = [];
  if (groupIds.length > 0) {
    allRelatedDocs = await TelegramResource.find({
      groupId: { $in: groupIds }
    }).lean();
  }

  // Combine primary docs and siblings, deduplicating by _id
  const docMap = new Map();
  primaryDocs.forEach(d => docMap.set(d._id.toString(), d));
  allRelatedDocs.forEach(d => docMap.set(d._id.toString(), d));

  const fullSample = Array.from(docMap.values());
  console.log(`Total sample items including all album siblings: ${fullSample.length}\n`);

  // Print detail of each group
  const groupedByGroupId = {};
  const ungrouped = [];

  for (const doc of fullSample) {
    if (doc.groupId) {
      if (!groupedByGroupId[doc.groupId]) groupedByGroupId[doc.groupId] = [];
      groupedByGroupId[doc.groupId].push(doc);
    } else {
      ungrouped.push(doc);
    }
  }

  console.log("====================================================");
  console.log("DETAILED INSPECTION OF USER-FLAGGED SAMPLES");
  console.log("====================================================");

  let groupCounter = 1;
  for (const [gId, members] of Object.entries(groupedByGroupId)) {
    const first = members[0];
    console.log(`\n📦 ALBUM ${groupCounter++} (groupId: ${gId}, Total Files: ${members.length})`);
    console.log(`   Source Channel: @${first.channelUsername}`);
    console.log(`   File Type:      ${first.fileType}`);
    console.log(`   isExam:         ${first.isExam}`);
    console.log(`   CourseCode:     "${first.courseCode || ''}"`);
    console.log(`   Tags:           [${(first.tags || []).join(', ')}]`);
    console.log(`   CleanTitle:     "${first.cleanTitle || ''}"`);
    console.log(`   ArchiveMsgIds:  [${members.map(m => m.archiveMessageId).join(', ')}]`);
    console.log(`   Captions (lines):`);
    const cap = (first.caption || '').split('\n').filter(Boolean).slice(0, 5);
    cap.forEach(c => console.log(`      > ${c.substring(0, 100)}`));
    console.log(`   Individual Files:`);
    members.forEach((m, idx) => {
      console.log(`      ${idx+1}. archMsg=${m.archiveMessageId} msgId=${m.messageId} size=${(m.fileSize/1024).toFixed(1)}KB file="${m.fileName || 'N/A'}" clean="${m.cleanTitle || 'N/A'}"`);
    });
  }

  if (ungrouped.length > 0) {
    console.log(`\n📄 UNGROUPED / SINGLES (${ungrouped.length} files):`);
    ungrouped.forEach((u, i) => {
      console.log(`   ${i+1}. archMsg=${u.archiveMessageId} ch=@${u.channelUsername} [${u.fileType}] isExam=${u.isExam} tags=[${u.tags?.join(', ')}]`);
      console.log(`      cleanTitle="${u.cleanTitle}"`);
      console.log(`      cap="${(u.caption || '').substring(0, 80).replace(/\n/g, ' ')}"`);
    });
  }

  // Statistical & Pattern Diagnostics across the flagged samples
  console.log("\n====================================================");
  console.log("📊 PATTERN & SIGNATURE DIAGNOSTICS");
  console.log("====================================================");

  const channelFreq = {};
  const tagFreq = {};
  const captionWords = {};
  let totalWithExam = 0;
  let totalWithCourseCode = 0;
  const fileSizes = [];

  fullSample.forEach(d => {
    channelFreq[d.channelUsername] = (channelFreq[d.channelUsername] || 0) + 1;
    if (d.isExam) totalWithExam++;
    if (d.courseCode) totalWithCourseCode++;
    if (d.fileSize) fileSizes.push(d.fileSize);
    (d.tags || []).forEach(t => tagFreq[t] = (tagFreq[t] || 0) + 1);

    const cap = (d.caption || '').toLowerCase();
    const words = cap.replace(/[^\w\u1200-\u137F]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    words.forEach(w => captionWords[w] = (captionWords[w] || 0) + 1);
  });

  console.log("1. Distribution by Source Channel:");
  Object.entries(channelFreq).sort((a,b) => b[1]-a[1]).forEach(([ch, count]) => {
    console.log(`   @${ch}: ${count} files (${((count/fullSample.length)*100).toFixed(1)}%)`);
  });

  console.log(`\n2. Flag Analysis:`);
  console.log(`   isExam = true:        ${totalWithExam} / ${fullSample.length} (${((totalWithExam/fullSample.length)*100).toFixed(1)}%)`);
  console.log(`   has courseCode:       ${totalWithCourseCode} / ${fullSample.length}`);

  console.log(`\n3. Most Frequent Tags:`);
  Object.entries(tagFreq).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([tag, count]) => {
    console.log(`   #${tag}: ${count}`);
  });

  console.log(`\n4. Most Frequent Words in Captions:`);
  Object.entries(captionWords).sort((a,b) => b[1]-a[1]).slice(0, 25).forEach(([word, count]) => {
    console.log(`   "${word}": ${count}`);
  });

  if (fileSizes.length > 0) {
    const avgSize = fileSizes.reduce((a,b) => a+b, 0) / fileSizes.length;
    const minSize = Math.min(...fileSizes);
    const maxSize = Math.max(...fileSizes);
    console.log(`\n5. File Sizes:`);
    console.log(`   Min: ${(minSize/1024).toFixed(1)} KB | Avg: ${(avgSize/1024).toFixed(1)} KB | Max: ${(maxSize/1024).toFixed(1)} KB`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Diagnostics finished successfully.");
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
