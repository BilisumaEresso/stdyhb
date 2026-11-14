/**
 * 05-check-restored-types.js
 * 
 * Inspects restored documents across collections to verify exact BSON type fidelity.
 */

const { MongoClient, ObjectId } = require("mongodb");

async function checkRestoredTypes() {
  const client = new MongoClient("mongodb://127.0.0.1:27017", { family: 4 });
  await client.connect();
  const db = client.db("studyhub_isolated_restore_test_20261113");

  console.log("=== BSON TYPE FIDELITY REPORT ===");

  // 1. telegramresources: check _id, date, messageId, isAvailable
  const resSample = await db.collection("telegramresources").findOne({ date: { $exists: true } });
  console.log("\n[telegramresources sample]:");
  console.log("  _id:", resSample?._id, "| instanceof ObjectId:", resSample?._id instanceof ObjectId);
  console.log("  messageId:", resSample?.messageId, "| typeof:", typeof resSample?.messageId);
  console.log("  date:", resSample?.date, "| instanceof Date:", resSample?.date instanceof Date);
  console.log("  isAvailable:", resSample?.isAvailable, "| typeof:", typeof resSample?.isAvailable);
  console.log("  tags is Array:", Array.isArray(resSample?.tags));

  // 2. downloadhistories: downloadedAt
  const dh = await db.collection("downloadhistories").findOne({});
  console.log("\n[downloadhistories sample]:");
  console.log("  downloadedAt:", dh?.downloadedAt, "| instanceof Date:", dh?.downloadedAt instanceof Date);

  // 3. searchhistories: createdAt
  const sh = await db.collection("searchhistories").findOne({});
  console.log("\n[searchhistories sample]:");
  console.log("  createdAt:", sh?.createdAt, "| instanceof Date:", sh?.createdAt instanceof Date);

  // 4. users: createdAt
  const usr = await db.collection("users").findOne({});
  console.log("\n[users sample]:");
  console.log("  createdAt:", usr?.createdAt, "| instanceof Date:", usr?.createdAt instanceof Date);

  // 5. botsessions: updatedAt
  const bs = await db.collection("botsessions").findOne({});
  console.log("\n[botsessions sample]:");
  console.log("  updatedAt:", bs?.updatedAt, "| instanceof Date:", bs?.updatedAt instanceof Date);

  // 6. cachedsearches: expiresAt
  const cs = await db.collection("cachedsearches").findOne({});
  console.log("\n[cachedsearches sample]:");
  console.log("  expiresAt:", cs?.expiresAt, "| instanceof Date:", cs?.expiresAt instanceof Date);

  await client.close();
}

checkRestoredTypes().catch(console.error);
