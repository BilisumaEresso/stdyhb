/**
 * 02-cluster-advanced-inspection.js
 * 
 * Inspect hostInfo, getCmdLineOpts, and replSetGetConfig
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function checkAdvanced() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const adminDb = mongoose.connection.client.db("admin");

  const results = {};

  try {
    results.hostInfo = await adminDb.command({ hostInfo: 1 });
  } catch (err) {
    results.hostInfo = { error: err.message };
  }

  try {
    results.cmdLineOpts = await adminDb.command({ getCmdLineOpts: 1 });
  } catch (err) {
    results.cmdLineOpts = { error: err.message };
  }

  try {
    results.replSetStatus = await adminDb.command({ replSetGetStatus: 1 });
  } catch (err) {
    results.replSetStatus = { error: err.message };
  }

  try {
    results.listDatabases = await adminDb.command({ listDatabases: 1 });
  } catch (err) {
    results.listDatabases = { error: err.message };
  }

  const out = path.join(__dirname, "02-cluster-advanced-inspection.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("Saved to:", out);

  console.log("Host OS:", results.hostInfo?.os);
  console.log("Host System:", results.hostInfo?.system);
  console.log("CmdLine Opts:", JSON.stringify(results.cmdLineOpts?.parsed?.storage || {}));
  console.log("Databases:", results.listDatabases?.databases?.map(d => `${d.name} (${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`));

  await mongoose.disconnect();
}

checkAdvanced().catch(console.error);
