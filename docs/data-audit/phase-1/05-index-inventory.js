/**
 * 05-index-inventory.js
 * 
 * PHASE 1 — DATABASE INDEX INVENTORY & RECOMMENDATIONS
 * Detailed audit of indexes on core collections, TTL settings, and query coverage.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function checkIndexInventory() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  const db = mongoose.connection.db;

  const targetCollections = [
    "telegramresources",
    "telegramresourcequarantines",
    "telegramchannels",
    "cachedsearches",
    "querysessions",
    "users",
    "searchhistories",
    "downloadhistories"
  ];

  console.log("====================================================");
  console.log("TASK 2: DATABASE INDEX INVENTORY");
  console.log("====================================================");
  console.log(`Verified At: ${new Date().toISOString()}\n`);

  const report = {};

  for (const collName of targetCollections) {
    const coll = db.collection(collName);
    const indexes = await coll.indexes();
    const stats = await db.command({ collStats: collName }).catch(() => null);

    console.log(`\nCollection: [${collName}] — Indexes: ${indexes.length}`);
    console.log(`  Storage Size: ${(stats?.storageSize / 1024 / 1024).toFixed(2)} MB | Total Index Size: ${(stats?.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);

    const indexDetails = indexes.map((idx) => {
      const isTTL = idx.expireAfterSeconds !== undefined;
      const ttlSec = isTTL ? idx.expireAfterSeconds : null;
      console.log(`  • Index: ${idx.name.padEnd(45)} | Unique: ${String(!!idx.unique).padEnd(5)} | TTL: ${isTTL ? `${ttlSec}s` : 'No'}`);
      console.log(`    Keys: ${JSON.stringify(idx.key)}`);
      if (idx.weights) {
        console.log(`    Text Weights: ${JSON.stringify(idx.weights)}`);
      }
      return {
        name: idx.name,
        key: idx.key,
        unique: !!idx.unique,
        isTTL,
        expireAfterSeconds: ttlSec,
        weights: idx.weights || null,
        partialFilterExpression: idx.partialFilterExpression || null
      };
    });

    report[collName] = {
      count: stats?.count ?? (await coll.countDocuments()),
      storageSizeMB: stats?.storageSize ? (stats.storageSize / 1024 / 1024).toFixed(2) : null,
      totalIndexSizeMB: stats?.totalIndexSize ? (stats.totalIndexSize / 1024 / 1024).toFixed(2) : null,
      indexes: indexDetails
    };
  }

  const outputPath = path.join(__dirname, "05-index-inventory.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nIndex inventory saved to: ${outputPath}`);

  await mongoose.disconnect();
}

checkIndexInventory().catch(console.error);
