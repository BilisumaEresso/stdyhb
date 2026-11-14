/**
 * test-search-comparison.js
 * 
 * Compares MongoDB text search behavior with the buggy query vs clean query
 * against the isolated local test database.
 */

const { MongoClient } = require("mongodb");

async function compareSearches() {
  const client = new MongoClient("mongodb://127.0.0.1:27017", { family: 4 });
  await client.connect();
  const db = client.db("studyhub_isolated_restore_test_20261113");
  const col = db.collection("telegramresources");

  console.log("=== COMPARING MONGODB $TEXT QUERIES ON ISOLATED TEST DB ===");

  const buggyQuery = "dbms OR database OR database systems OR database management system exam";
  const buggyCount = await col.countDocuments({ $text: { $search: buggyQuery } });
  console.log(`\nBuggy Query: "${buggyQuery}"`);
  console.log(`Document matches: ${buggyCount}`);

  // Inspect top 5 titles from buggy query
  const buggyDocs = await col.find(
    { $text: { $search: buggyQuery } },
    { score: { $meta: "textScore" }, projection: { fileName: 1, caption: 1 } }
  ).sort({ score: { $meta: "textScore" } }).limit(5).toArray();
  console.log("Top 5 titles with buggy query:");
  buggyDocs.forEach((d, i) => console.log(`  ${i+1}. ${d.fileName || d.caption?.substring(0, 50)}`));

  // Query without OR: dbms database exam
  const simpleQuery = "dbms database exam";
  const simpleCount = await col.countDocuments({ $text: { $search: simpleQuery } });
  console.log(`\nClean Space Query: "${simpleQuery}"`);
  console.log(`Document matches: ${simpleCount}`);

  // Query with phrase quote: dbms "database systems" exam
  const phraseQuery = 'dbms "database systems" exam';
  const phraseCount = await col.countDocuments({ $text: { $search: phraseQuery } });
  console.log(`\nClean Phrase Query: "${phraseQuery}"`);
  console.log(`Document matches: ${phraseCount}`);

  // Query with exact word OR
  const orCount = await col.countDocuments({ $text: { $search: "OR" } });
  console.log(`\nDocuments matching literal token "OR": ${orCount}`);

  await client.close();
}

compareSearches().catch(console.error);
