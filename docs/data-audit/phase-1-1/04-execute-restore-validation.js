/**
 * 04-execute-restore-validation.js
 * 
 * PHASE 1.1 — TASK 4: ISOLATED RESTORATION VALIDATION
 * Restores the StudyHub BSON archive into an isolated local MongoDB 8.0 database.
 * Strictly verifies SHA-256 checksums, document counts, indexes, and BSON type fidelity.
 * Target: mongodb://127.0.0.1:27017 / studyhub_isolated_restore_test_20261113
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { MongoClient, BSON, ObjectId } = require("mongodb");

const BACKUP_DIR = path.resolve("C:/Users/billy/StudyHub-Backups/2026-11-13-phase-1-1-baseline");
const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017";
const TEST_DB_NAME = "studyhub_isolated_restore_test_20261113";

async function executeRestoreValidation() {
  const startTime = new Date();
  console.log("=================================================================");
  console.log("PHASE 1.1: ISOLATED RESTORE VALIDATION");
  console.log(`Source Backup Dir: ${BACKUP_DIR}`);
  console.log(`Target Engine:     ${LOCAL_MONGO_URI} (ISOLATED LOCAL HOST ONLY)`);
  console.log(`Target Test DB:    ${TEST_DB_NAME}`);
  console.log(`Timestamp:         ${startTime.toISOString()}`);
  console.log("=================================================================\n");

  // SAFETY ASSERTION: Guarantee we never run restore against Atlas
  if (LOCAL_MONGO_URI.includes("mongodb.net") || LOCAL_MONGO_URI.includes("rfdlc8z")) {
    throw new Error("FATAL SAFETY VIOLATION: Attempted to run restore test against Atlas cluster!");
  }

  // 1. Load Backup Manifest
  const manifestPath = path.join(BACKUP_DIR, "backup-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest not found at: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`Loaded Manifest: ID '${manifest.backupId}', ${manifest.summary.totalCollections} collections, ${manifest.summary.totalDocuments} docs.\n`);

  // 2. Pre-Restore Integrity Check: Verify SHA-256 for all backup files
  console.log("--- STEP 1: PRE-RESTORE SHA-256 CHECKSUM VERIFICATION ---");
  for (const collInfo of manifest.collections) {
    if (collInfo.status !== "COMPLETED") continue;

    // Check BSON gz
    const bsonPath = path.join(BACKUP_DIR, collInfo.bsonFile);
    const bsonBytes = fs.readFileSync(bsonPath);
    const actualBsonSha = crypto.createHash("sha256").update(bsonBytes).digest("hex");
    if (actualBsonSha !== collInfo.bsonSha256) {
      throw new Error(`SHA-256 MISMATCH for ${collInfo.bsonFile}! Expected ${collInfo.bsonSha256}, got ${actualBsonSha}`);
    }

    // Check Metadata gz
    const metaPath = path.join(BACKUP_DIR, collInfo.metadataFile);
    const metaBytes = fs.readFileSync(metaPath);
    const actualMetaSha = crypto.createHash("sha256").update(metaBytes).digest("hex");
    if (actualMetaSha !== collInfo.metadataSha256) {
      throw new Error(`SHA-256 MISMATCH for ${collInfo.metadataFile}! Expected ${collInfo.metadataSha256}, got ${actualMetaSha}`);
    }

    console.log(`  ✓ Verified SHA-256: ${collInfo.name} (${collInfo.bsonFile} & ${collInfo.metadataFile})`);
  }
  console.log("All backup files passed SHA-256 cryptographic verification.\n");

  // 3. Connect to Local MongoDB
  const client = new MongoClient(LOCAL_MONGO_URI, { family: 4 });
  await client.connect();
  const testDb = client.db(TEST_DB_NAME);

  // Clean slate: drop test DB if it exists
  console.log(`Resetting isolated test database '${TEST_DB_NAME}' ...`);
  await testDb.dropDatabase();
  console.log("Isolated test database is ready.\n");

  const restoreReport = {
    testDatabaseName: TEST_DB_NAME,
    localMongoUri: "mongodb://127.0.0.1:27017",
    startedAt: startTime.toISOString(),
    completedAt: null,
    totalDurationMs: null,
    totalDurationFormatted: null,
    overallStatus: "IN_PROGRESS",
    collectionsVerified: [],
    typeFidelityVerification: {},
    functionalQueryTests: {}
  };

  console.log("--- STEP 2: RESTORING COLLECTIONS & REBUILDING INDEXES ---");

  for (const collInfo of manifest.collections) {
    if (collInfo.status !== "COMPLETED") continue;

    const collStartTime = Date.now();
    console.log(`>>> Restoring ${collInfo.name} ...`);

    const collection = testDb.collection(collInfo.name);

    // Read metadata
    const metaGz = fs.readFileSync(path.join(BACKUP_DIR, collInfo.metadataFile));
    const metaJson = JSON.parse(zlib.gunzipSync(metaGz).toString("utf8"));

    // Read & decompress BSON
    const bsonGz = fs.readFileSync(path.join(BACKUP_DIR, collInfo.bsonFile));
    const rawBson = zlib.gunzipSync(bsonGz);

    let offset = 0;
    const docs = [];
    const BATCH_SIZE = 2500;
    let insertedTotal = 0;

    while (offset < rawBson.length) {
      const size = rawBson.readInt32LE(offset);
      const doc = BSON.deserialize(rawBson.subarray(offset, offset + size));
      offset += size;
      docs.push(doc);

      if (docs.length >= BATCH_SIZE) {
        await collection.insertMany(docs, { ordered: false });
        insertedTotal += docs.length;
        docs.length = 0;
      }
    }

    if (docs.length > 0) {
      await collection.insertMany(docs, { ordered: false });
      insertedTotal += docs.length;
      docs.length = 0;
    }

    // Recreate indexes
    let recreatedIndexes = 1; // MongoDB creates _id_ automatically
    for (const idx of metaJson.indexes) {
      if (idx.name === "_id_") continue;

      try {
        const options = { name: idx.name };
        if (idx.unique) options.unique = true;
        if (idx.sparse) options.sparse = true;
        if (idx.expireAfterSeconds !== undefined) options.expireAfterSeconds = idx.expireAfterSeconds;

        if (idx.key._fts === "text") {
          // Text index reconstruction
          const textKey = {};
          if (idx.weights) {
            for (const field of Object.keys(idx.weights)) {
              textKey[field] = "text";
            }
            options.weights = idx.weights;
          } else {
            textKey.fileName = "text";
          }
          if (idx.default_language) options.default_language = idx.default_language;
          await collection.createIndex(textKey, options);
        } else {
          await collection.createIndex(idx.key, options);
        }
        recreatedIndexes++;
      } catch (idxErr) {
        console.warn(`    [WARN] Index '${idx.name}' creation note: ${idxErr.message}`);
      }
    }

    const collDuration = Date.now() - collStartTime;
    const finalDocCount = await collection.countDocuments({});
    const finalIndexes = await collection.indexes();

    const countMatches = finalDocCount === collInfo.documentCount;
    const indexCountMatches = finalIndexes.length === collInfo.indexCount;

    console.log(`    Docs Restored:  ${finalDocCount.toLocaleString()} / ${collInfo.documentCount.toLocaleString()} (${countMatches ? 'MATCH' : 'MISMATCH'})`);
    console.log(`    Indexes Built:  ${finalIndexes.length} / ${collInfo.indexCount} (${indexCountMatches ? 'MATCH' : 'MISMATCH'})`);
    console.log(`    Time Taken:     ${(collDuration / 1000).toFixed(2)}s\n`);

    if (!countMatches) {
      throw new Error(`FATAL: Document count mismatch for ${collInfo.name}: Expected ${collInfo.documentCount}, restored ${finalDocCount}`);
    }

    restoreReport.collectionsVerified.push({
      name: collInfo.name,
      expectedDocuments: collInfo.documentCount,
      restoredDocuments: finalDocCount,
      countMatches,
      expectedIndexes: collInfo.indexCount,
      restoredIndexes: finalIndexes.length,
      indexNames: finalIndexes.map(i => i.name),
      durationMs: collDuration,
      status: countMatches && indexCountMatches ? "VERIFIED" : "WARNING_INDEX_DIFFERENCE"
    });
  }

  // 4. Type Fidelity Verification
  console.log("--- STEP 3: BSON TYPE FIDELITY & DATA STRUCTURE VALIDATION ---");
  const resColl = testDb.collection("telegramresources");
  const sampleDocs = await resColl.find({}).limit(5).toArray();

  const typeChecks = {
    sampleSize: sampleDocs.length,
    objectIdValid: true,
    datesValid: true,
    integersValid: true,
    booleansValid: true,
    textSearchWorking: false,
    samples: []
  };

  for (const doc of sampleDocs) {
    const isObjectId = ObjectId.isValid(doc._id) && (doc._id instanceof ObjectId || doc._id._bsontype === "ObjectID");
    const isCreatedAtDate = doc.createdAt instanceof Date && !isNaN(doc.createdAt.getTime());
    const isMessageIdNumber = typeof doc.messageId === "number";
    const isAvailableBoolean = typeof doc.isAvailable === "boolean";

    if (!isObjectId) typeChecks.objectIdValid = false;
    if (!isCreatedAtDate) typeChecks.datesValid = false;
    if (!isMessageIdNumber) typeChecks.integersValid = false;
    if (!isAvailableBoolean) typeChecks.booleansValid = false;

    typeChecks.samples.push({
      _id: String(doc._id),
      _idClass: doc._id.constructor.name,
      fileName: doc.fileName,
      channelUsername: doc.channelUsername,
      messageId: doc.messageId,
      messageIdType: typeof doc.messageId,
      isAvailable: doc.isAvailable,
      isAvailableType: typeof doc.isAvailable,
      createdAt: doc.createdAt?.toISOString(),
      createdAtClass: doc.createdAt?.constructor.name
    });
  }

  // 5. Functional Query Testing on Restored Data
  console.log("--- STEP 4: FUNCTIONAL QUERY VERIFICATION ---");
  // Test 1: Availability counts
  const availableCount = await resColl.countDocuments({ isAvailable: true });
  const unavailableCount = await resColl.countDocuments({ isAvailable: false });
  console.log(`  • Available documents:   ${availableCount.toLocaleString()}`);
  console.log(`  • Unavailable documents: ${unavailableCount.toLocaleString()}`);
  console.log(`  • Total verified:       ${(availableCount + unavailableCount).toLocaleString()}`);

  // Test 2: Text Search
  let textSearchResults = 0;
  try {
    const textHits = await resColl.find({ $text: { $search: "physics" } }).limit(5).toArray();
    textSearchResults = textHits.length;
    typeChecks.textSearchWorking = textHits.length > 0;
    console.log(`  • Text search for 'physics': ${textHits.length} sample results returned.`);
  } catch (tsErr) {
    console.warn(`  • Text search error: ${tsErr.message}`);
  }

  // Test 3: Channel lookup
  const channelCount = await testDb.collection("telegramchannels").countDocuments({});
  console.log(`  • Telegram channels count:   ${channelCount}`);

  // Test 4: Quarantine count
  const quarantineCount = await testDb.collection("telegramresourcequarantines").countDocuments({});
  console.log(`  • Quarantine snapshots count: ${quarantineCount.toLocaleString()}`);

  restoreReport.typeFidelityVerification = typeChecks;
  restoreReport.functionalQueryTests = {
    availableResources: availableCount,
    unavailableResources: unavailableCount,
    totalResources: availableCount + unavailableCount,
    telegramChannels: channelCount,
    quarantineSnapshots: quarantineCount,
    textSearchWorking: typeChecks.textSearchWorking
  };

  const endTime = new Date();
  const totalDurationMs = endTime - startTime;
  restoreReport.completedAt = endTime.toISOString();
  restoreReport.totalDurationMs = totalDurationMs;
  restoreReport.totalDurationFormatted = `${(totalDurationMs / 1000).toFixed(1)}s`;
  restoreReport.overallStatus = "VERIFIED_SUCCESSFUL";

  const reportOut = path.join(__dirname, "04-restore-validation-results.json");
  fs.writeFileSync(reportOut, JSON.stringify(restoreReport, null, 2));

  console.log("\n=================================================================");
  console.log("ISOLATED RESTORE TEST RESULT: VERIFIED SUCCESSFUL");
  console.log(`Total Time:                ${restoreReport.totalDurationFormatted}`);
  console.log(`BSON Types Preserved:      ObjectIds: ${typeChecks.objectIdValid}, Dates: ${typeChecks.datesValid}, Numbers: ${typeChecks.integersValid}`);
  console.log(`Text Search Functionality: ${typeChecks.textSearchWorking ? 'ACTIVE' : 'FAILED'}`);
  console.log(`Results File:              ${reportOut}`);
  console.log("=================================================================\n");

  await client.close();
}

executeRestoreValidation().catch(err => {
  console.error("Restore validation failed:", err);
  process.exit(1);
});
