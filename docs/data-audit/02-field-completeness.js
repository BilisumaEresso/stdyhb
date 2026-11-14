require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function auditFieldCompleteness() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri, { family: 4 });
  const db = mongoose.connection.db;
  const coll = db.collection('telegramresources');

  console.log('=== AUDITING FIELD COMPLETENESS ON telegramresources ===\n');

  const total = await coll.countDocuments();
  const availableTotal = await coll.countDocuments({ isAvailable: true });

  console.log(`Total Documents: ${total} (Available: ${availableTotal})\n`);

  // We will check all known fields + discover any unknown fields
  // Using an aggregation pipeline on a sample to discover all keys, plus full collection counts
  const sampleDocs = await coll.find({}).limit(500).toArray();
  const allFieldKeys = new Set();
  sampleDocs.forEach(d => {
    Object.keys(d).forEach(k => allFieldKeys.add(k));
  });

  // Expected fields
  const standardFields = [
    '_id',
    'fileId',
    'fileUniqueId',
    'messageId',
    'chatId',
    'channelUsername',
    'fileName',
    'cleanTitle',
    'caption',
    'fileType',
    'fileSize',
    'groupId',
    'groupIndex',
    'groupTotal',
    'tags',
    'isExam',
    'courseCode',
    'year',
    'university',
    'semester',
    'relevanceScore',
    'downloadCount',
    'reportCount',
    'isAvailable',
    'archiveMessageId',
    'indexedAt',
    'messageDate',
    '__v'
  ];

  standardFields.forEach(f => allFieldKeys.add(f));

  const sortedFields = Array.from(allFieldKeys).sort();

  console.log('Counting populated vs missing for all fields...');

  const results = [];

  for (const field of sortedFields) {
    // Condition for populated: exists, not null, not empty string, not empty array
    let populatedQuery = {};
    if (field === 'tags') {
      populatedQuery = { tags: { $exists: true, $ne: null, $not: { $size: 0 } } };
    } else if (['fileName', 'cleanTitle', 'caption', 'courseCode', 'university', 'semester', 'channelUsername', 'fileId', 'fileUniqueId', 'fileType'].includes(field)) {
      populatedQuery = { [field]: { $exists: true, $nin: [null, ''] } };
    } else {
      populatedQuery = { [field]: { $exists: true, $ne: null } };
    }

    const populatedCount = await coll.countDocuments(populatedQuery);
    const missingCount = total - populatedCount;
    const populatedPct = ((populatedCount / total) * 100).toFixed(2);

    // Get 3 sample non-empty values
    const samples = await coll.find(populatedQuery)
      .project({ [field]: 1 })
      .limit(3)
      .toArray();

    // Determine type from samples
    const sampleVal = samples[0]?.[field];
    let inferredType = typeof sampleVal;
    if (sampleVal instanceof Date) inferredType = 'Date';
    else if (Array.isArray(sampleVal)) inferredType = 'Array';
    else if (sampleVal && typeof sampleVal === 'object' && sampleVal._bsontype) inferredType = sampleVal._bsontype;

    const sampleString = samples.map(s => {
      const v = s[field];
      if (typeof v === 'string') return `"${v.substring(0, 30)}${v.length > 30 ? '...' : ''}"`;
      if (v instanceof Date) return v.toISOString().split('T')[0];
      if (Array.isArray(v)) return `[${v.slice(0, 3).join(', ')}]`;
      return String(v);
    }).join(' | ');

    results.push({
      field,
      dataType: inferredType,
      total,
      populatedCount,
      missingCount,
      populatedPct: parseFloat(populatedPct),
      sampleValues: sampleString
    });

    console.log(`Field: ${field.padEnd(20)} Populated: ${String(populatedCount).padStart(6)} (${populatedPct.padStart(6)}%) | Missing: ${String(missingCount).padStart(6)} | Type: ${inferredType.padEnd(8)} | Samples: ${sampleString.substring(0, 50)}`);
  }

  // Also check available items specifically
  console.log('\n--- Checking field completeness specifically for AVAILABLE items (isAvailable: true) ---');
  const availableResults = [];
  for (const item of results) {
    const field = item.field;
    let popQuery = { isAvailable: true };
    if (field === 'tags') {
      popQuery.tags = { $exists: true, $ne: null, $not: { $size: 0 } };
    } else if (['fileName', 'cleanTitle', 'caption', 'courseCode', 'university', 'semester', 'channelUsername', 'fileId', 'fileUniqueId', 'fileType'].includes(field)) {
      popQuery[field] = { $exists: true, $nin: [null, ''] };
    } else {
      popQuery[field] = { $exists: true, $ne: null };
    }

    const popCount = await coll.countDocuments(popQuery);
    const popPct = ((popCount / availableTotal) * 100).toFixed(2);
    availableResults.push({
      field,
      populatedCount: popCount,
      populatedPct: parseFloat(popPct)
    });
  }

  fs.writeFileSync('docs/data-audit/02-field-completeness.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalDocuments: total,
    availableDocuments: availableTotal,
    fields: results,
    availableFields: availableResults
  }, null, 2));

  console.log('\nWrote docs/data-audit/02-field-completeness.json');

  await mongoose.disconnect();
}

auditFieldCompleteness().catch(console.error);
