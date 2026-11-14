/**
 * 01-current-database-inventory.js
 * 
 * PHASE 1 — READ-ONLY DATABASE INVENTORY
 * Verified against MongoDB Atlas production instance.
 * Does NOT modify any records, indexes, or configuration.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function checkDatabaseInventory() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not configured in .env");
    process.exit(1);
  }

  // Safe connection with retry
  let connected = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4,
      });
      connected = true;
      break;
    } catch (err) {
      console.warn(`Connection attempt ${attempt}/3 failed: ${err.message}. Retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connected) {
    console.error("Failed to connect to MongoDB after 3 attempts.");
    process.exit(1);
  }

  const db = mongoose.connection.db;
  console.log("====================================================");
  console.log("DATABASE INVENTORY — PHASE 1 BASELINE VERIFICATION");
  console.log("====================================================");
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log(`Database Name:   ${db.databaseName}`);

  const buildInfo = await db.command({ buildInfo: 1 }).catch(() => null);
  console.log(`MongoDB Version: ${buildInfo?.version || "Unknown"}`);
  console.log(`Git Version:     ${buildInfo?.gitVersion || "Unknown"}`);
  console.log(`Target Host:     Atlas Replica Set`);

  const collections = await db.listCollections().toArray();
  const sortedColls = collections.map((c) => c.name).sort();

  console.log(`\nDiscovered ${sortedColls.length} collections in database:\n`);

  const coreCollections = [
    "telegramresources",
    "telegramresourcequarantines",
    "telegramchannels",
    "users",
    "searchhistories",
    "downloadhistories",
    "savedresources",
    "channelrecommendations",
    "botsessions",
    "cachedsearches",
    "resourcereports",
    "querysessions",
  ];

  const foreignCollections = [
    "branches",
    "restaurants",
    "tables",
    "orders",
    "products",
    "categories",
    "assistances",
  ];

  const inventory = [];

  for (const name of sortedColls) {
    const coll = db.collection(name);
    const count = await coll.countDocuments();
    const indexes = await coll.indexes().catch(() => []);
    const isCore = coreCollections.includes(name);
    const isForeign = foreignCollections.includes(name);
    const classification = isCore ? "Core StudyHub" : isForeign ? "Foreign/Legacy Restaurant" : "Unknown";

    inventory.push({
      name,
      count,
      indexCount: indexes.length,
      classification,
      indexes: indexes.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })),
    });

    console.log(
      `  • ${name.padEnd(30)} Count: ${String(count).padStart(8)} | Indexes: ${String(indexes.length).padStart(2)} | [${classification}]`
    );
  }

  const outputPath = path.join(__dirname, "01-database-inventory.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        database: db.databaseName,
        mongoVersion: buildInfo?.version,
        gitVersion: buildInfo?.gitVersion,
        totalCollections: sortedColls.length,
        collections: inventory,
      },
      null,
      2
    )
  );

  console.log(`\nInventory saved to: ${outputPath}`);
  await mongoose.disconnect();
}

checkDatabaseInventory().catch(console.error);
