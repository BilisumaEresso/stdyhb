/**
 * Read-Only Dry-Run Purification Preview Script.
 * DOES NOT ALTER, DELETE, OR MODIFY ANY DATA.
 * DOES NOT START BOT SERVER OR TELEGRAM POLLING.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

// 1. Strict Commercial & Spam Patterns
const AD_PATTERNS = [
  /\b(telebirr|cbe|commercial bank|account number|ብር|ክፍያ|ዋጋ|መክፈል)\b/i,
  /\b(vip\s*channel|vip\s*group|paid\s*channel|subscription\s*fee|betting|forex|crypto|airtime|giveaway)\b/i,
  /\b(contact\s*admin\s*for\s*answers|buy\s*exam\s*answers|ፈተና\s*እንሸጣለን|መልስ\s*ለመግዛት)\b/i,
  /\b(discount\s*\d+%|promo\s*code|bonus\s*\d+|sponsored\s*by)\b/i,
  /\b(join\s*our\s*vip|join\s*for\s*more\s*answers)\b/i
];

// 2. Pure Administrative Announcements & Notices (Not actual study materials)
const NOTICE_PATTERNS = [
  /\b(ምዝገባ|ቅበላ|የምዝገባ\s*ቀን|የቅበላ\s*ቀን|የተመደባችሁ|የጥሪ\s*ማስታወቂያ)\b/i,
  /\b(registration\s*date|registration\s*deadline|placement\s*result|orientation\s*day|admitted\s*students)\b/i,
  /\b(ክፍት\s*የሥራ\s*ቦታ|ደመወዝ|የቅጥር\s*ማስታወቂያ|vacancy|job\s*opportunity|hiring)\b/i,
  /\b(senate\s*decision|presidential\s*directive|graduation\s*ceremony|holiday\s*schedule|remedial\s*registration)\b/i,
  /\b(tech\s*fest|welcome\s*party|campus\s*event|food\s*menu|dorm\s*placement)\b/i
];

// 3. Exam Schedule announcements vs Exam papers
// E.g., "Mid exam schedule announced" is a schedule notice, NOT an exam question paper
const SCHEDULE_ONLY_PATTERN = /\b(exam\s*schedule|exam\s*timetable|exam\s*dates|mid\s*exam\s*schedule|final\s*exam\s*schedule|የፈተና\s*ጊዜ\s*ሰሌዳ|የፈተና\s*ቀን)\b/i;

function matchesAny(text, patterns) {
  if (!text) return false;
  return patterns.some(p => p.test(text));
}

async function dryRunPreview() {
  console.log('Connecting to MongoDB for Read-Only Dry-Run...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected.\n');

  const cursor = TelegramResource.find().lean().cursor();

  const stats = {
    total: 0,
    kept: {
      examAlbums: 0,
      genuineDocs: 0,
      genuineSingleImages: 0,
      totalKept: 0,
    },
    flagged: {
      commercialAds: 0,
      adminNotices: 0,
      scheduleAnnouncements: 0,
      corruptOrTiny: 0,
      unidentifiableZeroSignal: 0,
      totalFlagged: 0,
    },
    archivedImpact: {
      keptInArchive: 0,
      flaggedInArchive: 0,
    }
  };

  const sampleKept = [];
  const sampleAds = [];
  const sampleNotices = [];
  const sampleSchedules = [];

  for await (const doc of cursor) {
    stats.total++;
    const caption = doc.caption || '';
    const fileName = doc.fileName || '';
    const fullText = `${caption} ${fileName}`;
    const isArchived = Boolean(doc.archiveMessageId);

    // Rule 1: Grouped Photo Albums (CRITICAL USER FOCUS)
    if (doc.groupId) {
      // Grouped albums are 100% PROTECTED unless pure betting/crypto spam
      const isPureSpam = matchesAny(fullText, [/\b(betting|forex|crypto|airtime giveaway)\b/i]);
      if (!isPureSpam) {
        stats.kept.examAlbums++;
        stats.kept.totalKept++;
        if (isArchived) stats.archivedImpact.keptInArchive++;
        if (sampleKept.length < 5) {
          sampleKept.push({
            id: doc._id,
            type: 'Exam Album (Grouped)',
            groupId: doc.groupId,
            channel: doc.channelUsername,
            caption: caption.replace(/\r?\n/g, ' ').substring(0, 100),
            archived: isArchived
          });
        }
        continue;
      }
    }

    // Rule 2: Corrupted or Tiny Stubs (< 2KB non-photo or 0-byte)
    if (doc.fileSize > 0 && doc.fileSize < 2048 && doc.fileType !== 'image') {
      stats.flagged.corruptOrTiny++;
      stats.flagged.totalFlagged++;
      if (isArchived) stats.archivedImpact.flaggedInArchive++;
      continue;
    }

    // Rule 3: Commercial Ads & Scams
    if (matchesAny(fullText, AD_PATTERNS)) {
      stats.flagged.commercialAds++;
      stats.flagged.totalFlagged++;
      if (isArchived) stats.archivedImpact.flaggedInArchive++;
      if (sampleAds.length < 5) {
        sampleAds.push({
          id: doc._id,
          fileType: doc.fileType,
          channel: doc.channelUsername,
          fileName,
          caption: caption.replace(/\r?\n/g, ' ').substring(0, 100),
          archived: isArchived
        });
      }
      continue;
    }

    // Rule 4: Administrative Announcements & Notices
    if (matchesAny(fullText, NOTICE_PATTERNS)) {
      stats.flagged.adminNotices++;
      stats.flagged.totalFlagged++;
      if (isArchived) stats.archivedImpact.flaggedInArchive++;
      if (sampleNotices.length < 5) {
        sampleNotices.push({
          id: doc._id,
          fileType: doc.fileType,
          channel: doc.channelUsername,
          fileName,
          caption: caption.replace(/\r?\n/g, ' ').substring(0, 100),
          archived: isArchived
        });
      }
      continue;
    }

    // Rule 5: Schedule Announce Only (e.g., photo of exam date table, but not question paper)
    if (doc.fileType === 'image' && matchesAny(fullText, [SCHEDULE_ONLY_PATTERN])) {
      stats.flagged.scheduleAnnouncements++;
      stats.flagged.totalFlagged++;
      if (isArchived) stats.archivedImpact.flaggedInArchive++;
      if (sampleSchedules.length < 5) {
        sampleSchedules.push({
          id: doc._id,
          channel: doc.channelUsername,
          caption: caption.replace(/\r?\n/g, ' ').substring(0, 100),
          archived: isArchived
        });
      }
      continue;
    }

    // Rule 6: Single Image with 0 tags, 0 course code, 0 exam mark (isolated flyer)
    if (doc.fileType === 'image' && (!doc.tags || doc.tags.length === 0) && !doc.isExam && !doc.courseCode) {
      stats.flagged.unidentifiableZeroSignal++;
      stats.flagged.totalFlagged++;
      if (isArchived) stats.archivedImpact.flaggedInArchive++;
      continue;
    }

    // Default: KEEP as genuine study resource!
    if (doc.fileType === 'image') {
      stats.kept.genuineSingleImages++;
    } else {
      stats.kept.genuineDocs++;
    }
    stats.kept.totalKept++;
    if (isArchived) stats.archivedImpact.keptInArchive++;
    if (sampleKept.length < 8 && doc.fileType !== 'image') {
      sampleKept.push({
        id: doc._id,
        type: `Document (${doc.fileType})`,
        fileName,
        channel: doc.channelUsername,
        caption: caption.replace(/\r?\n/g, ' ').substring(0, 100),
        archived: isArchived
      });
    }
  }

  console.log('====================================================');
  console.log('📊 DRY-RUN PURIFICATION AUDIT RESULTS');
  console.log('====================================================');
  console.log(`Total Resources Processed: ${stats.total.toLocaleString()}\n`);

  console.log(`✅ [KEPT] Genuine Academic Resources: ${stats.kept.totalKept.toLocaleString()} (${Math.round((stats.kept.totalKept / stats.total) * 100)}%)`);
  console.log(`   • Exam Photo Albums (100% Protected): ${stats.kept.examAlbums.toLocaleString()} images`);
  console.log(`   • Genuine Documents (PDF, PPT, DOC): ${stats.kept.genuineDocs.toLocaleString()} files`);
  console.log(`   • Single Exam Images: ${stats.kept.genuineSingleImages.toLocaleString()} images`);

  console.log(`\n❌ [FLAGGED] Junk, Ads & Announcements: ${stats.flagged.totalFlagged.toLocaleString()} (${Math.round((stats.flagged.totalFlagged / stats.total) * 100)}%)`);
  console.log(`   • Commercial Ads & Payment Slips: ${stats.flagged.commercialAds.toLocaleString()}`);
  console.log(`   • Administrative Announcements (Registration/Notices): ${stats.flagged.adminNotices.toLocaleString()}`);
  console.log(`   • Schedule-Only Date Announcements: ${stats.flagged.scheduleAnnouncements.toLocaleString()}`);
  console.log(`   • Corrupted or Tiny Stubs (< 2KB): ${stats.flagged.corruptOrTiny.toLocaleString()}`);
  console.log(`   • Unidentifiable Single Non-Exam Flyers: ${stats.flagged.unidentifiableZeroSignal.toLocaleString()}`);

  console.log(`\n📦 Telegram Archive Channel Impact:`);
  console.log(`   • Clean Academic Files in Archive: ${stats.archivedImpact.keptInArchive.toLocaleString()} (Will be preserved)`);
  console.log(`   • Junk / Ads / Notices in Archive: ${stats.archivedImpact.flaggedInArchive.toLocaleString()} (Candidates for archive cleanup)`);

  console.log('\n====================================================');
  console.log('🔍 CONCRETE SAMPLES FROM EACH BUCKET');
  console.log('====================================================');

  console.log('\n--- 1. Sample KEPT Academic Materials (Protected) ---');
  sampleKept.forEach((s, idx) => {
    console.log(`[Kept #${idx+1}] ${s.type} | Channel: @${s.channel} | Archived: ${s.archived ? 'YES' : 'NO'}`);
    if (s.fileName) console.log(`     File: ${s.fileName}`);
    if (s.caption) console.log(`     Caption: "${s.caption}..."`);
  });

  console.log('\n--- 2. Sample FLAGGED Commercial Ads ---');
  sampleAds.forEach((s, idx) => {
    console.log(`[Ad #${idx+1}] Type: ${s.fileType} | Channel: @${s.channel} | Archived: ${s.archived ? 'YES' : 'NO'}`);
    if (s.fileName) console.log(`     File: ${s.fileName}`);
    console.log(`     Caption: "${s.caption}..."`);
  });

  console.log('\n--- 3. Sample FLAGGED Administrative Announcements ---');
  sampleNotices.forEach((s, idx) => {
    console.log(`[Notice #${idx+1}] Type: ${s.fileType} | Channel: @${s.channel} | Archived: ${s.archived ? 'YES' : 'NO'}`);
    if (s.fileName) console.log(`     File: ${s.fileName}`);
    console.log(`     Caption: "${s.caption}..."`);
  });

  console.log('\n--- 4. Sample FLAGGED Schedule-Only Announcements ---');
  sampleSchedules.forEach((s, idx) => {
    console.log(`[Schedule #${idx+1}] Channel: @${s.channel} | Archived: ${s.archived ? 'YES' : 'NO'}`);
    console.log(`     Caption: "${s.caption}..."`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Dry-run preview complete.');
}

dryRunPreview().catch(err => {
  console.error('Error during dry-run:', err);
  process.exit(1);
});
