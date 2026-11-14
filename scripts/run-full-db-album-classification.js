/**
 * run-full-db-album-classification.js
 * Safely streams all active grouped images from MongoDB Atlas using cursor.next()
 * Evaluates the 6 junk signatures and reports exact counts and samples.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ─── Classification Signatures ───────────────────────────────────────────────

const APP_AND_COMMERCIAL_PATTERNS = [
  /\b(playstore|play\s*store|app\s*store|download\s*app|apk|botlink|exitexamai|koderlab)\b/i,
  /(\u12a0\u1355\u120d\u12ac\u123d\u1295|\u12a0\u1355\u120d\u12ac\u1235\u1295|\u12c4\u1265\u1233\u12ed\u1275)/, // አፕሊኬሽን / አፕሊኬስን / ዌብሳይት
  /\b(entrance\s*hub|examclass|qeleme\s*examclass|\u1240\u1208\u121c\s*examclass)\b/i,
  /\b(bootcamp|coding\s*class|training\s*institute|tutoring\s*package)\b/i,
  /(\u1235\u120d\u1320\u1293\s*\u12a5\u1295\u1230\u1323\u1208\u1295|\u121d\u12dd\u1308\u1263\s*\u1270\u12a8\u134d\u1277\u120d)/, // ስልጠና እንሰጣለን / ምዝገባ ተከፍቷል
  /(አስጠኚ\s*ይፈልጋሉ|ኮርስ\s*ለመግዛት|course\s*ለመግዛት|package\s*ለመግዛት)/i,
];

const ADMISSION_NOTICE_PATTERNS = [
  /\b(dorm\s*placement|dorm\s*assignment|campus\s*placement)\b/i,
  /(\u12f6\u122d\u121d\s*\u121d\u12f0\u1263|\u12ab\u121d\u1353\u1235\s*\u121d\u12f0\u1263|\u12e8\u1270\u1218\u12f0\u1263\u127d\u1201\u1260\u1275\u1295|\u12e8\u1270\u1218\u12f0\u1263\u127d\u1201)/, // ዶርም ምደባ / ካምፓስ ምደባ / የተመደባችሁበትን
  /(\u12e8\u121d\u12dd\u1308\u1263\s*\u130a\u12da|\u121d\u12dd\u1308\u1263\s*\u12da\u121c|\u1218\u130d\u1263\u1275\s*\u1208\u121d\u1275\u1238\u120d\u1309)/, // የምዝገባ ጊዜ / ምዝገባ ዴድላይን / መግባት ለምትፈልጉ
  /\b(urgent\s*notice|notice\s*board|urgent_notice)\b/i,
  /(#urgent_notice|#urgentnotice|#ማሳሰቢያ|#ማስታወቂያ|‼️|🚨)/,
  /(\u12e8\u1348\u1270\u1293\s*\u1355\u122e\u130d\u122b\u121d\s*\u1218\u1300\u1218\u122a\u12eb|\u12e8\u130a\u12da\s*\u1230\u120c\u12f3)/, // የፈተና ፕሮግራም መጀመሪያ / የጊዜ ሰሌዳ
];

const TICKET_AND_GUIDE_PATTERNS = [
  /\b(entrance\s*ticket|admission\s*ticket|step\s*by\s*step\s*guide|login\s*guide)\b/i,
  /(\u1218\u1348\u1270\u129b\s*\u12ab\u122d\u12f5|\u1218\u1348\u1270\u129b\s*ticket|\u1260\u12ed\u1290\s*\u1218\u1228\u1265\s*\u1270\u1348\u1273\u129e\u127d)/, // መፈተኛ ካርድ / በይነ መረብ ተፈታኞች
  /(\u12cd\u1324\u1275\s*\u1270\u1235\u1270\u12ab\u12ad\u120f\u120d|\u12cd\u1324\u1275\s*\u121b\u12e8\u1275|grade\s*12\s*result)/i, // ውጤት ተስተካክሏል / ውጤት ማየት
];

const VACANCY_PATTERNS = [
  /\b(vacancy\s*announcement|cabin\s*crew|job\s*opportunity|hiring)\b/i,
  /(\u12ad\u134d\u1275\s*\u12e8\u1225\u122b|\u12e8\u1225\u122b\s*\u121b\u1235\u1273\u12c8\u1242\u12eb|0\s*\u12d3\u1218\u1275|0\s*\u12a0\u1218\u1275)/, // ክፍት የሥራ / የሥራ ማስታወቂያ / 0 ዓመት
];

const SPORTS_MEME_PATTERNS = [
  /\b(liverpool|arsenal|manchester|chelsea|real\s*madrid|barcelona|premier\s*league|epl)\b/i,
  /(\u1273\u120b\u1245\s*\u1278\u12cb\u1273|\u12a5\u130d\u122d\s*\u12b3\u1235|\u1232\u1300\u1218\u122d\s*\u1260\u1235\u122b\u1275|\u12a8\u1265\u12f6\u1293\u120d)/, // ታላቅ ጨዋታ / እግር ኳስ / ከብዶናል
];

function isPureLinkBanner(caption) {
  const clean = (caption || '').trim().replace(/https?:\/\/\S+/gi, '').replace(/@[\w_]+/g, '').replace(/[#\s]/g, '');
  return clean.length <= 15;
}

function classifyPhotoTrash(doc) {
  const cap = (doc.caption || '').trim();

  for (const pat of APP_AND_COMMERCIAL_PATTERNS) {
    if (pat.test(cap)) {
      return { flag: true, reason: 'app_commercial_ad', match: pat.toString().substring(0, 45) };
    }
  }

  for (const pat of ADMISSION_NOTICE_PATTERNS) {
    if (pat.test(cap)) {
      return { flag: true, reason: 'admission_notice_bulletin', match: pat.toString().substring(0, 45) };
    }
  }

  for (const pat of TICKET_AND_GUIDE_PATTERNS) {
    if (pat.test(cap)) {
      return { flag: true, reason: 'ticket_or_system_guide', match: pat.toString().substring(0, 45) };
    }
  }

  for (const pat of VACANCY_PATTERNS) {
    if (pat.test(cap)) {
      return { flag: true, reason: 'job_vacancy', match: pat.toString().substring(0, 45) };
    }
  }

  for (const pat of SPORTS_MEME_PATTERNS) {
    if (pat.test(cap)) {
      return { flag: true, reason: 'sports_or_meme', match: pat.toString().substring(0, 45) };
    }
  }

  if (isPureLinkBanner(cap)) {
    return { flag: true, reason: 'channel_promo_banner', match: 'Pure link/channel handle banner' };
  }

  return { flag: false };
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 90000,
  });
  console.log('✅ Connected to MongoDB Atlas.\n');

  const albumMap = new Map();
  let totalPhotos = 0;

  console.log('Streaming active grouped images from DB...');
  console.time('Stream and Group');

  for (const isExamVal of [false, true]) {
    const cursor = mongoose.connection.collection('telegramresources')
      .find({
        isExam: isExamVal,
        fileType: 'image',
        groupId: { $ne: null },
        isAvailable: { $ne: false }
      }, {
        projection: {
          _id: 1, caption: 1, channelUsername: 1, groupId: 1, groupTotal: 1,
          archiveMessageId: 1, messageId: 1, tags: 1, isExam: 1
        }
      })
      .hint('isExam_1_fileType_1');

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      totalPhotos++;
      if (!albumMap.has(doc.groupId)) {
        albumMap.set(doc.groupId, []);
      }
      albumMap.get(doc.groupId).push(doc);

      if (totalPhotos % 4000 === 0) {
        console.log(`  Processed ${totalPhotos.toLocaleString()} images into ${albumMap.size.toLocaleString()} albums...`);
      }
    }
  }

  console.timeEnd('Stream and Group');
  console.log(`\nScan Complete:`);
  console.log(`• Total Active Photos Scanned: ${totalPhotos.toLocaleString()}`);
  console.log(`• Total Distinct Albums:       ${albumMap.size.toLocaleString()}\n`);

  let flaggedAlbums = 0;
  let flaggedPhotos = 0;
  const reasonStats = {};
  const channelTrashStats = {};
  const genuineExamSamples = [];

  for (const [gId, members] of albumMap.entries()) {
    const capDoc = members.find(m => m.caption && m.caption.trim().length > 0) || members[0];
    const res = classifyPhotoTrash(capDoc);

    if (res.flag) {
      flaggedAlbums++;
      flaggedPhotos += members.length;

      if (!reasonStats[res.reason]) {
        reasonStats[res.reason] = { albums: 0, photos: 0, samples: [] };
      }
      reasonStats[res.reason].albums++;
      reasonStats[res.reason].photos += members.length;

      const ch = capDoc.channelUsername || 'unknown';
      channelTrashStats[ch] = (channelTrashStats[ch] || 0) + members.length;

      if (reasonStats[res.reason].samples.length < 3) {
        reasonStats[res.reason].samples.push({
          groupId: gId,
          photos: members.length,
          channel: ch,
          caption: (capDoc.caption || '').replace(/\s+/g, ' ').substring(0, 95),
          match: res.match
        });
      }
    } else {
      if (genuineExamSamples.length < 6 && (capDoc.caption || '').length > 15) {
        genuineExamSamples.push({
          groupId: gId,
          photos: members.length,
          channel: capDoc.channelUsername || 'unknown',
          caption: (capDoc.caption || '').replace(/\s+/g, ' ').substring(0, 95)
        });
      }
    }
  }

  console.log('================================================================');
  console.log('📊 DATABASE-WIDE PHOTO ALBUM QUALITY AUDIT RESULTS');
  console.log('================================================================');
  console.log(`Total Active Photos in DB:       ${totalPhotos.toLocaleString()}`);
  console.log(`Total Photo Albums in DB:        ${albumMap.size.toLocaleString()}`);
  console.log('----------------------------------------------------------------');
  console.log(`🚨 Flagged Trash Albums:         ${flaggedAlbums.toLocaleString()} albums (${flaggedPhotos.toLocaleString()} photos)`);
  console.log(`✅ Preserved Legitimate Albums:   ${(albumMap.size - flaggedAlbums).toLocaleString()} albums (${(totalPhotos - flaggedPhotos).toLocaleString()} photos)`);
  console.log(`Trash Album Ratio:               ${((flaggedAlbums / albumMap.size) * 100).toFixed(1)}% of albums (${((flaggedPhotos / totalPhotos) * 100).toFixed(1)}% of photos)`);
  console.log('================================================================\n');

  console.log('📋 BREAKDOWN BY TRASH CATEGORY:');
  for (const [reason, data] of Object.entries(reasonStats)) {
    console.log(`\n▶ [${reason}]`);
    console.log(`   Volume: ${data.albums.toLocaleString()} albums | ${data.photos.toLocaleString()} photos`);
    console.log(`   Samples:`);
    data.samples.forEach((s, idx) => {
      console.log(`     ${idx + 1}. [${s.photos} imgs] @${s.channel}: "${s.caption}" (${s.match})`);
    });
  }

  console.log('\n🏛️ TOP CHANNELS CONTRIBUTING TRASH ALBUMS:');
  const sortedChannels = Object.entries(channelTrashStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
  sortedChannels.forEach(([ch, count], i) => {
    console.log(`   ${i + 1}. @${ch}: ${count.toLocaleString()} photos`);
  });

  console.log('\n🛡️ VERIFICATION: PRESERVED LEGITIMATE EXAM ALBUMS (SAMPLE):');
  genuineExamSamples.forEach((s, idx) => {
    console.log(`   ${idx + 1}. [${s.photos} imgs] @${s.channel}: "${s.caption}"`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
