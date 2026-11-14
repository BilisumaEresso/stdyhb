const { MongoClient } = require("mongodb");

async function testPhrases() {
  const client = new MongoClient("mongodb://127.0.0.1:27017", { family: 4 });
  await client.connect();
  const db = client.db("studyhub_isolated_restore_test_20261113");
  const col = db.collection("telegramresources");

  const terms = [
    'dbms',
    'database',
    'dbms database',
    'exam',
    'dbms exam',
    'dbms database exam',
    'dsa',
    'dsa ppt',
    'data structures',
    '"data structures"',
    'dsa "data structures" ppt',
    'computer networks',
    '"computer networks"',
    'computer networks final exam',
    'mathematics for natural sciences',
    '"mathematics for natural sciences"',
    'math for natural sciences'
  ];

  for (const t of terms) {
    const count = await col.countDocuments({ $text: { $search: t } });
    console.log(`Query: ${t.padEnd(40)} => Count: ${count}`);
  }

  await client.close();
}

testPhrases().catch(console.error);
