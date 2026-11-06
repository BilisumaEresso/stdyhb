require('dotenv').config();
const { isJunk, extractTags, isExam, hasAcademicSignal } = require('../src/search/telegramIndexer');

console.log('Testing Indexer Ingestion Gatekeeper:\n');

const testCases = [
  {
    desc: 'Telebirr payment scam',
    caption: 'To get full mid exam answers pay 100 birr via Telebirr 0912345678',
    fileName: 'photo.jpg',
    expectedJunk: true
  },
  {
    desc: 'Dorm placement notice',
    caption: 'የተመደባችሁ አዲስ ተማሪዎች የዶርም ምደባ ዝርዝር',
    fileName: 'notice.pdf',
    expectedJunk: true
  },
  {
    desc: 'Genuine Exam paper',
    caption: 'Data Structures and Algorithms Mid Exam 2023',
    fileName: 'DSA_Mid_Exam.pdf',
    expectedJunk: false
  },
  {
    desc: 'Genuine Lecture Slide',
    caption: 'Operating Systems Chapter 3 Process Management',
    fileName: 'OS_Chapter3.pptx',
    expectedJunk: false
  }
];

let allPassed = true;
for (const tc of testCases) {
  const junk = isJunk(tc.caption, tc.fileName);
  const tags = extractTags(tc.caption, tc.fileName);
  const exam = isExam(tc.caption, tc.fileName);
  const passed = junk === tc.expectedJunk;
  if (!passed) allPassed = false;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.desc}`);
  console.log(`   isJunk: ${junk} (expected: ${tc.expectedJunk}) | tags: [${tags.join(', ')}] | isExam: ${exam}`);
}

console.log('\nResult:', allPassed ? '✅ ALL INGESTION GATEKEEPER TESTS PASSED!' : '❌ SOME TESTS FAILED');
process.exit(allPassed ? 0 : 1);
