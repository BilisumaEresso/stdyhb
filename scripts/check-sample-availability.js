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

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await TelegramResource.find({ archiveMessageId: { $in: rawIds } }).lean();

  let activeCount = 0;
  let inactiveCount = 0;
  let groupedCount = 0;
  let singleCount = 0;

  console.log(`Matched ${docs.length} sample documents:\n`);
  docs.forEach((d, i) => {
    if (d.isAvailable === false) inactiveCount++;
    else activeCount++;

    if (d.groupId) groupedCount++;
    else singleCount++;

    console.log(`${i+1}. archMsg=${d.archiveMessageId} avail=${d.isAvailable} grp=${d.groupId ? 'YES' : 'NO'} type=${d.fileType} ch=@${d.channelUsername}`);
    console.log(`   cleanTitle: "${d.cleanTitle}"`);
    console.log(`   cap: "${(d.caption || '').substring(0, 90).replace(/\n/g, ' ')}"`);
  });

  console.log(`\nSummary: Active=${activeCount}, Inactive=${inactiveCount}, Grouped=${groupedCount}, Single=${singleCount}`);
  await mongoose.disconnect();
}
check();
