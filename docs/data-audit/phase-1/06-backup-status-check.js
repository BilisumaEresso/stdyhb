/**
 * 06-backup-status-check.js
 * 
 * PHASE 1 — ATLAS REPLICA SET & BACKUP VERIFICATION
 * Inspects cluster topology, replica set status, and backup configuration.
 */

const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

async function checkBackupStatus() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  const db = mongoose.connection.db;

  console.log("====================================================");
  console.log("TASK 3: ATLAS CLUSTER TOPOLOGY & BACKUP STATUS");
  console.log("====================================================");

  // 1. Hello / IsMaster info
  const hello = await db.command({ hello: 1 }).catch(() => null);
  console.log(`\nReplica Set Name:   ${hello?.setName || 'None'}`);
  console.log(`Is Writable Primary: ${hello?.isWritablePrimary || hello?.ismaster}`);
  console.log(`Hosts in ReplicaSet:`);
  (hello?.hosts || []).forEach(h => console.log(`  • ${h}`));
  console.log(`Topology Type:       ${hello?.msg || 'Replica Set'}`);
  console.log(`Max Wire Version:    ${hello?.maxWireVersion}`);

  // 2. Check cluster tier indicators from host string
  const primaryHost = hello?.primary || (hello?.hosts && hello.hosts[0]) || '';
  console.log(`Primary Host:        ${primaryHost}`);

  // Masked connection details
  const uriParts = uri.match(/mongodb\+srv:\/\/[^@]+@([^/?]+)\/([^?]+)/);
  const clusterHost = uriParts ? uriParts[1] : 'Unknown';
  const targetDb = uriParts ? uriParts[2] : db.databaseName;
  console.log(`Cluster Domain:      ${clusterHost}`);
  console.log(`Target Database:     ${targetDb}`);

  // 3. Server parameters regarding backup / oplog
  // On Atlas shared tiers (M0/M2/M5), automated continuous backups and point-in-time recovery (PITR)
  // are NOT enabled by default. M0 (Free Tier) has NO automated backup service.
  // M10+ tiers have Cloud Backup with daily/continuous snapshots and PITR.
  
  // Check oplog size or local db access if permitted
  const localDb = mongoose.connection.client.db("local");
  let oplogStatus = "Inaccessible (Restricted Atlas User)";
  try {
    const oplogColls = await localDb.listCollections().toArray();
    oplogStatus = `Accessible (${oplogColls.map(c => c.name).join(', ')})`;
  } catch (err) {
    oplogStatus = `Access restricted: ${err.message}`;
  }
  console.log(`Local/Oplog Access:  ${oplogStatus}`);

  // Check admin access
  const adminDb = mongoose.connection.client.db("admin");
  let adminAccess = "Restricted";
  try {
    const adminCmd = await adminDb.command({ ping: 1 });
    adminAccess = adminCmd.ok === 1 ? "Authorized for basic admin ping" : "Failed";
  } catch (err) {
    adminAccess = `Restricted: ${err.message}`;
  }
  console.log(`Admin Ping Access:   ${adminAccess}`);

  // Check if any local backup or dump exists in the project
  const backupFiles = [];
  const findBackups = (dir) => {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item === 'node_modules' || item === '.git' || item === '.next') continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) findBackups(full);
        else if (item.endsWith('.gz') || item.endsWith('.archive') || item.endsWith('.dump') || item.includes('backup')) {
          backupFiles.push({ path: full, size: stat.size, modified: stat.mtime });
        }
      }
    } catch {}
  };
  findBackups(process.cwd());
  console.log(`\nLocal Backup Files in Repo: ${backupFiles.length}`);
  backupFiles.forEach(b => console.log(`  • ${b.path} (${(b.size / 1024 / 1024).toFixed(2)} MB, ${b.modified.toISOString()})`));

  const backupReport = {
    verifiedAt: new Date().toISOString(),
    databaseName: targetDb,
    clusterDomain: clusterHost,
    replicaSetName: hello?.setName,
    hosts: hello?.hosts,
    primary: hello?.primary,
    localDbAccess: oplogStatus,
    adminAccess,
    localBackupFiles: backupFiles
  };

  const outputPath = path.join(__dirname, "06-backup-status.json");
  fs.writeFileSync(outputPath, JSON.stringify(backupReport, null, 2));
  console.log(`\nBackup verification data saved to: ${outputPath}`);

  await mongoose.disconnect();
}

checkBackupStatus().catch(console.error);
