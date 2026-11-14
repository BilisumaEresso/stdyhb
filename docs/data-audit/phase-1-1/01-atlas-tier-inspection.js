/**
 * 01-atlas-tier-inspection.js
 * 
 * PHASE 1.1 — TASK 1: VERIFY ATLAS CLUSTER TIER & BACKUP CONFIGURATION
 * Read-only diagnostic probing cluster parameters, privileges, oplog, and storage stats.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function runTierInspection() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing from environment");
  }

  console.log("Connecting to MongoDB Atlas (read-only diagnostics)...");
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  const client = mongoose.connection.client;
  const db = mongoose.connection.db;
  const adminDb = client.db("admin");
  const localDb = client.db("local");

  const results = {
    timestamp: new Date().toISOString(),
    connection: {},
    auth: {},
    buildInfo: {},
    serverStatusAvailable: false,
    serverStatusSummary: null,
    dbStats: {},
    oplogStats: {},
    clusterTierEvidence: {}
  };

  // 1. Connection & Hello
  try {
    const hello = await db.command({ hello: 1 });
    results.connection = {
      setName: hello.setName,
      isWritablePrimary: hello.isWritablePrimary,
      primary: hello.primary,
      hosts: hello.hosts,
      passives: hello.passives || [],
      arbiters: hello.arbiters || [],
      maxWireVersion: hello.maxWireVersion,
      minWireVersion: hello.minWireVersion,
      msg: hello.msg
    };
  } catch (err) {
    results.connection = { error: err.message };
  }

  // 2. Auth & ConnectionStatus (Roles & Privileges)
  try {
    const authStatus = await db.command({ connectionStatus: 1, showPrivileges: true });
    results.auth = {
      authenticatedUsers: authStatus.authInfo?.authenticatedUsers?.map(u => ({ user: u.user, db: u.db })),
      authenticatedUserRoles: authStatus.authInfo?.authenticatedUserRoles,
      privilegeCount: authStatus.authInfo?.authenticatedUserPrivileges?.length || 0,
      privileges: authStatus.authInfo?.authenticatedUserPrivileges?.map(p => ({
        resource: p.resource,
        actions: p.actions
      }))
    };
  } catch (err) {
    results.auth = { error: err.message };
  }

  // 3. BuildInfo
  try {
    const buildInfo = await db.command({ buildInfo: 1 });
    results.buildInfo = {
      version: buildInfo.version,
      gitVersion: buildInfo.gitVersion,
      sysInfo: buildInfo.sysInfo,
      loaderFlags: buildInfo.loaderFlags,
      compilerFlags: buildInfo.compilerFlags,
      allocator: buildInfo.allocator,
      javascriptEngine: buildInfo.javascriptEngine,
      bits: buildInfo.bits,
      debug: buildInfo.debug,
      maxBsonObjectSize: buildInfo.maxBsonObjectSize,
      storageEngines: buildInfo.storageEngines,
      modules: buildInfo.modules
    };
  } catch (err) {
    results.buildInfo = { error: err.message };
  }

  // 4. Test serverStatus
  try {
    const sStatus = await adminDb.command({ serverStatus: 1 });
    results.serverStatusAvailable = true;
    results.serverStatusSummary = {
      host: sStatus.host,
      version: sStatus.version,
      process: sStatus.process,
      uptime: sStatus.uptime,
      connections: sStatus.connections,
      opcounters: sStatus.opcounters,
      mem: sStatus.mem,
      storageEngine: sStatus.storageEngine?.name
    };
  } catch (err) {
    results.serverStatusAvailable = false;
    results.serverStatusSummary = { error: err.message };
  }

  // 5. Database Stats for studyhub
  try {
    const dStats = await db.command({ dbStats: 1 });
    results.dbStats = {
      db: dStats.db,
      collections: dStats.collections,
      objects: dStats.objects,
      avgObjSize: dStats.avgObjSize,
      dataSizeMB: (dStats.dataSize / 1024 / 1024).toFixed(2),
      storageSizeMB: (dStats.storageSize / 1024 / 1024).toFixed(2),
      indexes: dStats.indexes,
      indexSizeMB: (dStats.indexSize / 1024 / 1024).toFixed(2),
      totalSizeMB: (dStats.totalSize / 1024 / 1024).toFixed(2),
      scaleFactor: dStats.scaleFactor
    };
  } catch (err) {
    results.dbStats = { error: err.message };
  }

  // 6. Oplog stats & window
  try {
    const oplogColl = localDb.collection("oplog.rs");
    const oplogStats = await localDb.command({ collStats: "oplog.rs" });
    const first = await oplogColl.find({}).sort({ $natural: 1 }).limit(1).project({ ts: 1 }).toArray();
    const last = await oplogColl.find({}).sort({ $natural: -1 }).limit(1).project({ ts: 1 }).toArray();

    let windowHours = null;
    let oldestDate = null;
    let newestDate = null;

    if (first.length > 0 && last.length > 0) {
      const tFirst = new Date(first[0].ts.getHighBits() * 1000);
      const tLast = new Date(last[0].ts.getHighBits() * 1000);
      oldestDate = tFirst.toISOString();
      newestDate = tLast.toISOString();
      windowHours = Number(((tLast - tFirst) / 1000 / 3600).toFixed(2));
    }

    results.oplogStats = {
      accessible: true,
      count: oplogStats.count,
      sizeMB: (oplogStats.size / 1024 / 1024).toFixed(2),
      maxSizeMB: (oplogStats.maxSize / 1024 / 1024).toFixed(2),
      storageSizeMB: (oplogStats.storageSize / 1024 / 1024).toFixed(2),
      oldestEntry: oldestDate,
      newestEntry: newestDate,
      retentionWindowHours: windowHours
    };
  } catch (err) {
    results.oplogStats = {
      accessible: false,
      error: err.message
    };
  }

  // 7. Check for Atlas API / CLI indicators
  const envKeys = Object.keys(process.env);
  const atlasEnvVars = envKeys.filter(k => /ATLAS|MONGODB/i.test(k) && !/URI|PATH/i.test(k));
  results.atlasApiConfigured = atlasEnvVars.length > 0;
  results.atlasEnvVarsPresent = atlasEnvVars;

  // Analysis of Tier
  // M0 characteristics:
  // - 512 MB total storage quota (storageSize + indexSize < 512MB)
  // - Hostnames typically have 'ac-xxxx-shard-00-xx' on shared infrastructure
  // - Shared replica set
  // - No Cloud Backup or continuous snapshots in Atlas UI
  // Dedicated (M10+) characteristics:
  // - Typically larger configured storage, dedicated nodes, cloud backup snapshots
  const totalDbMB = parseFloat(results.dbStats.totalSizeMB || "0");
  const oplogSizeMB = parseFloat(results.oplogStats.sizeMB || "0");
  
  results.clusterTierEvidence = {
    totalDatabaseSizeMB: totalDbMB,
    oplogSizeMB: oplogSizeMB,
    primaryNode: results.connection.primary,
    replicaSetName: results.connection.setName,
    modules: results.buildInfo.modules, // e.g. ["enterprise"]
    isEnterprise: results.buildInfo.modules?.includes("enterprise") || false
  };

  const outputPath = path.join(__dirname, "01-atlas-tier-inspection.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log("\n--- TIER INSPECTION SUMMARY ---");
  console.log(`Server Version:         ${results.buildInfo.version}`);
  console.log(`Modules:                ${JSON.stringify(results.buildInfo.modules)}`);
  console.log(`Replica Set:            ${results.connection.setName}`);
  console.log(`Primary Node:           ${results.connection.primary}`);
  console.log(`Nodes in Set:           ${results.connection.hosts?.length}`);
  console.log(`Database Storage:       ${results.dbStats.storageSizeMB} MB`);
  console.log(`Database Index:         ${results.dbStats.indexSizeMB} MB`);
  console.log(`Database Total:         ${results.dbStats.totalSizeMB} MB`);
  console.log(`Oplog Configured Size:  ${results.oplogStats.maxSizeMB} MB`);
  console.log(`Oplog Current Size:     ${results.oplogStats.sizeMB} MB`);
  console.log(`Oplog Retention Window: ${results.oplogStats.retentionWindowHours} hours`);
  console.log(`ServerStatus Allowed:   ${results.serverStatusAvailable}`);
  console.log(`Atlas API Keys in Env:  ${results.atlasApiConfigured ? 'Yes' : 'None'}`);
  console.log(`Results saved to:       ${outputPath}\n`);

  await mongoose.disconnect();
}

runTierInspection().catch(err => {
  console.error("Tier inspection failed:", err);
  process.exit(1);
});
