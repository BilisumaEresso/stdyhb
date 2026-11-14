const { MongoClient } = require("mongodb");

async function testDsa() {
  const client = new MongoClient("mongodb://127.0.0.1:27017", { family: 4 });
  await client.connect();
  const db = client.db("studyhub_isolated_restore_test_20261113");
  const col = db.collection("telegramresources");

  const q1 = "dsa ppt";
  const q2 = "dsa data structures ppt";
  const q3 = 'dsa "data structures" ppt';

  const c1 = await col.countDocuments({ $text: { $search: q1 } });
  const c2 = await col.countDocuments({ $text: { $search: q2 } });
  const c3 = await col.countDocuments({ $text: { $search: q3 } });

  console.log(`"${q1}" => Count: ${c1}`);
  console.log(`"${q2}" => Count: ${c2}`);
  console.log(`"${q3}" => Count: ${c3}`);

  // Also check top 3 results for q1 vs q2
  console.log(`\nTop 3 for "${q1}":`);
  const r1 = await col.find({ $text: { $search: q1 } }, { score: { $meta: "textScore" }, projection: { fileName: 1, caption: 1 } }).sort({ score: { $meta: "textScore" } }).limit(3).toArray();
  r1.forEach(d => console.log(' ', d.fileName || d.caption?.substring(0, 50)));

  console.log(`\nTop 3 for "${q2}":`);
  const r2 = await col.find({ $text: { $search: q2 } }, { score: { $meta: "textScore" }, projection: { fileName: 1, caption: 1 } }).sort({ score: { $meta: "textScore" } }).limit(3).toArray();
  r2.forEach(d => console.log(' ', d.fileName || d.caption?.substring(0, 50)));

  await client.close();
}

testDsa().catch(console.error);
