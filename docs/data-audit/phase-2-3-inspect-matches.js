const mongoose = require('mongoose');

async function testQuantumSearch() {
  await mongoose.connect('mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113');
  const collection = mongoose.connection.collection('telegramresources');

  const docs = await collection.find(
    {
      $text: { $search: "quantum mechanics lecture notes" },
      isAvailable: { $ne: false }
    },
    {
      projection: {
        cleanTitle: 1,
        fileName: 1,
        caption: 1,
        score: { $meta: "textScore" }
      }
    }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(100)
    .toArray();

  console.log(`Top 100 text matches found: ${docs.length}`);
  const matchingQuantum = docs.filter(d =>
    /quantum/i.test(d.cleanTitle || '') ||
    /quantum/i.test(d.fileName || '') ||
    /quantum/i.test(d.caption || '')
  );
  console.log(`Of the top 100, how many contain 'quantum'? ${matchingQuantum.length}`);
  matchingQuantum.forEach(d => console.log(`  - [score: ${d.score.toFixed(2)}] ${d.cleanTitle || d.fileName}`));

  // Check what score the quantum docs got
  for (const qDoc of await collection.find({ cleanTitle: /quantum/i, isAvailable: { $ne: false } }).toArray()) {
    const scored = await collection.findOne(
      { _id: qDoc._id, $text: { $search: "quantum mechanics lecture notes" } },
      { projection: { score: { $meta: "textScore" }, cleanTitle: 1 } }
    );
    console.log(`Quantum doc '${qDoc.cleanTitle}': score = ${scored ? scored.score : 'NOT MATCHED'}`);
  }

  await mongoose.disconnect();
}

testQuantumSearch().catch(err => {
  console.error(err);
  process.exit(1);
});
