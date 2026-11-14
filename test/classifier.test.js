/**
 * StudyHub Phase 3.3 — Resource Classifier Automated Tests
 *
 * Verifies rule-based classification against the centralized Ethiopian academic taxonomy.
 * Confirms deterministic outputs, immutability, collection/category mappings, and ambiguity handling.
 */

const assert = require("assert");
const {
  classifyResource,
  classifyAlbum,
  classifyEntity,
} = require("../src/classification/classifier.service");
const {
  SUBJECT_CATEGORIES,
  COLLECTIONS,
  FRESHMAN_COURSES,
} = require("../src/config/taxonomy");

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log("\n=======================================================");
console.log("  StudyHub Phase 3.3 — Resource Classifier Tests       ");
console.log("=======================================================\n");

// ── Group 1: Collection Recognition ──────────────────────────────
console.log("Group 1: Collection Recognition");

it("recognizes Past Exams collection from explicit isExam flag and exam title", () => {
  const resource = {
    cleanTitle: "Calculus I Midterm Examination 2023",
    fileName: "Calculus_Midterm_Exam.pdf",
    isExam: true,
    fileType: "pdf",
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("past-exams-entrance-exit"), "Should predict past-exams-entrance-exit");
  assert.strictEqual(res.method, "rule-based");
  assert(res.reasons.some((r) => r.includes("exam") || r.includes("Exam")));
});

it("recognizes Study Materials collection from lecture slides and textbook indicators", () => {
  const resource = {
    cleanTitle: "Software Engineering Lecture Slides Chapter 3",
    fileName: "SE_Chapter3_Slides.pptx",
    fileType: "ppt",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("study-materials"), "Should predict study-materials");
  assert(res.reasons.some((r) => r.toLowerCase().includes("powerpoint") || r.toLowerCase().includes("slide")));
});

it("recognizes Ethiopian Fiction & Reading collection from dedicated channel and novel keywords", () => {
  const resource = {
    cleanTitle: "Oromay Novel by Baalu Girma",
    fileName: "Oromay_Baalu_Girma.pdf",
    channelUsername: "amharic_fiction_books",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("ethiopian-fiction-reading"), "Should predict ethiopian-fiction-reading");
  assert(res.reasons.some((r) => r.toLowerCase().includes("fiction") || r.toLowerCase().includes("novel")));
});

it("recognizes University Freshman Courses collection from freshman course title and channel", () => {
  const resource = {
    cleanTitle: "Logic and Critical Thinking Freshman Module",
    fileName: "Logic_Module_2022.pdf",
    channelUsername: "freshman_materials",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("university-freshman-courses"), "Should predict university-freshman-courses");
  assert(res.reasons.some((r) => r.includes("Freshman") || r.includes("freshman")));
});

it("supports multi-collection classification (Freshman Final Exam -> past-exams + freshman-courses)", () => {
  const resource = {
    cleanTitle: "Introduction to Emerging Technologies Freshman Final Exam",
    fileName: "EmTech_Final_Exam_2023.pdf",
    isExam: true,
    fileType: "pdf",
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("past-exams-entrance-exit"), "Should include past-exams");
  assert(res.collections.includes("university-freshman-courses"), "Should include freshman-courses");
  assert.strictEqual(res.confidence, "high");
  assert.strictEqual(res.status, "classified");
});

// ── Group 2: All 21 Category Mappings ─────────────────────────────
console.log("\nGroup 2: All 21 Category Mappings Verification");

const CATEGORY_FIXTURES = [
  // KG–Grade 8 (7 categories)
  {
    catId: "kg8-languages-literacy",
    res: { cleanTitle: "Grade 4 English Student Textbook Mother Tongue", fileType: "pdf" },
  },
  {
    catId: "kg8-mathematics",
    res: { cleanTitle: "Grade 7 Mathematics Pupil Book", fileType: "pdf" },
  },
  {
    catId: "kg8-general-science",
    res: { cleanTitle: "Grade 6 General Science and Environmental Studies", fileType: "pdf" },
  },
  {
    catId: "kg8-social-studies-geography",
    res: { cleanTitle: "Grade 5 Social Studies Student Textbook", fileType: "pdf" },
  },
  {
    catId: "kg8-history-civics",
    res: { cleanTitle: "Grade 8 Citizenship and Moral Education", fileType: "pdf" },
  },
  {
    catId: "kg8-ict-technology",
    res: { cleanTitle: "Grade 7 Information Communication Technology ICT", fileType: "pdf" },
  },
  {
    catId: "kg8-arts-health-pe",
    res: { cleanTitle: "Grade 3 Performing and Visual Arts and Physical Education", fileType: "pdf" },
  },

  // Secondary (7 categories)
  {
    catId: "secondary-languages",
    res: { cleanTitle: "Grade 11 English Student Textbook Grammar & Composition", fileType: "pdf" },
  },
  {
    catId: "secondary-mathematics",
    res: { cleanTitle: "Grade 12 Mathematics Matrix and Calculus Unit", fileType: "pdf" },
  },
  {
    catId: "secondary-physics",
    res: { cleanTitle: "Grade 10 Physics Mechanics and Motion", fileType: "pdf" },
  },
  {
    catId: "secondary-chemistry",
    res: { cleanTitle: "Grade 11 Chemistry Chemical Bonding and Reactions", fileType: "pdf" },
  },
  {
    catId: "secondary-biology",
    res: { cleanTitle: "Grade 12 Biology Genetics and Cell Biology", fileType: "pdf" },
  },
  {
    catId: "secondary-social-sciences",
    res: { cleanTitle: "Grade 11 Geography and History of the Horn", fileType: "pdf" },
  },
  {
    catId: "secondary-applied-technology",
    res: { cleanTitle: "Grade 9 Information Technology and Technical Drawing", fileType: "pdf" },
  },

  // University (7 categories)
  {
    catId: "university-computing",
    res: { cleanTitle: "Database Management Systems (DBMS) Relational Model ASTU CS301", university: "ASTU" },
  },
  {
    catId: "university-engineering",
    res: { cleanTitle: "Reinforced Concrete Design RCC Civil Engineering AAU", university: "AAU" },
  },
  {
    catId: "university-natural-sciences",
    res: { cleanTitle: "Ordinary Differential Equations ODE Applied Mathematics University", university: "Hawassa University" },
  },
  {
    catId: "university-health-sciences",
    res: { cleanTitle: "Human Anatomy and Physiology Medical Surgery Lecture Notes", university: "Gondar University" },
  },
  {
    catId: "university-agriculture",
    res: { cleanTitle: "Agronomy and Crop Production Soil Science Haramaya", university: "Haramaya University" },
  },
  {
    catId: "university-business",
    res: { cleanTitle: "Corporate Finance and Cost Accounting Business Administration", university: "Addis Ababa University" },
  },
  {
    catId: "university-humanities",
    res: { cleanTitle: "Jurisprudence and Ethiopian Criminal Law Faculty of Law", university: "Jimma University" },
  },
];

for (const fixture of CATEGORY_FIXTURES) {
  it(`correctly classifies category: ${fixture.catId}`, () => {
    const res = classifyResource(fixture.res);
    assert(
      res.categories.includes(fixture.catId),
      `Expected category '${fixture.catId}', got [${res.categories.join(", ")}] for title '${fixture.res.cleanTitle}'`
    );
  });
}

// ── Group 3: Freshman Natural vs Social Science Math Distinction ──
console.log("\nGroup 3: Freshman Natural vs Social Science Mathematics");

it("classifies 'Mathematics for Natural Sciences' specifically as Natural Sciences", () => {
  const resource = {
    cleanTitle: "Mathematics for Natural Sciences Math 1011 Freshman Lecture Notes",
    courseCode: "Math 1011",
    university: "ASTU",
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("university-freshman-courses"), "Must be freshman courses");
  assert(res.categories.includes("university-natural-sciences"), "Must map to natural sciences");
  assert(!res.reasons.some((r) => r.includes("Social Sciences")), "Must NOT match social sciences");
});

it("classifies 'Mathematics for Social Sciences' specifically as Social Sciences", () => {
  const resource = {
    cleanTitle: "Mathematics for Social Sciences Math 1012 Freshman Course Outline",
    courseCode: "Math 1012",
    university: "AAU",
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("university-freshman-courses"), "Must be freshman courses");
  assert(res.categories.includes("university-natural-sciences"), "Must map to university-natural-sciences");
  assert(res.reasons.some((r) => r.includes("Mathematics for Social Sciences")), "Must record Social Sciences reason");
  assert(!res.reasons.some((r) => r.includes("Mathematics for Natural Sciences")), "Must NOT match natural sciences");
});

// ── Group 4: Ambiguity and Uncertainty Rules ─────────────────────
console.log("\nGroup 4: Ambiguity and Uncertainty Rules");

it("leaves ambiguous 'Mathematics' UNCLASSIFIED when education level is unknown", () => {
  const resource = {
    cleanTitle: "Mathematics Exercises and Solutions",
    fileName: "Mathematics.pdf",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert.strictEqual(res.categories.length, 0, "Must NOT guess tier without evidence");
  assert.strictEqual(res.status, "unclassified", "Status must be unclassified");
  assert.strictEqual(res.confidence, "low", "Confidence must be low");
  assert(res.reasons.some((r) => r.includes("Ambiguous subject 'Mathematics'")));
});

it("does NOT classify freshman status from vague keywords like 'math' or 'physics' alone", () => {
  const resource = {
    cleanTitle: "General Physics Formula Sheet",
    fileName: "Physics.pdf",
  };
  const res = classifyResource(resource);
  assert(!res.collections.includes("university-freshman-courses"), "Vague physics must NOT be freshman");
});

it("does NOT infer university level for General Chemistry without supporting evidence", () => {
  const resource = {
    cleanTitle: "General Chemistry Notes",
    fileName: "General_Chemistry.pdf",
  };
  const res = classifyResource(resource);
  // Without university name or freshman tag, should not assume university
  assert(!res.categories.includes("university-natural-sciences"), "Must not assume university natural sciences");
  assert.strictEqual(res.confidence, "low");
});

it("flags conflicting evidence (Grade 8 + University Calculus) for human review", () => {
  const resource = {
    cleanTitle: "Grade 8 and University Calculus Combined Study Guide",
    fileName: "guide.pdf",
  };
  const res = classifyResource(resource);
  assert(res.reasons.some((r) => r.includes("Conflicting education level")), "Must detect conflicting levels");
  assert.strictEqual(res.confidence, "low");
});

// ── Group 5: Album-Level Classification & Immutability ────────────
console.log("\nGroup 5: Album-Level Classification & Immutability");

it("consolidates multi-item Telegram albums into one coherent prediction", () => {
  const albumMembers = [
    {
      cleanTitle: "Exit Exam Question Sheet Part 1",
      fileName: "",
      caption: "National Exit Exam for Software Engineering 2023",
      tags: ["exam"],
      isExam: true,
      fileType: "image",
      groupId: "14248702666835540",
      groupIndex: 1,
      groupTotal: 3,
      channelUsername: "ExitExamEthiopia",
    },
    {
      cleanTitle: "Exit Exam Question Sheet Part 1",
      fileName: "",
      caption: "",
      tags: [],
      isExam: false,
      fileType: "image",
      groupId: "14248702666835540",
      groupIndex: 2,
      groupTotal: 3,
      channelUsername: "ExitExamEthiopia",
    },
    {
      cleanTitle: "Exit Exam Question Sheet Part 1",
      fileName: "",
      caption: "",
      tags: ["software_engineering"],
      isExam: false,
      fileType: "image",
      groupId: "14248702666835540",
      groupIndex: 3,
      groupTotal: 3,
      channelUsername: "ExitExamEthiopia",
    },
  ];

  const res = classifyAlbum(albumMembers);
  assert(res.collections.includes("past-exams-entrance-exit"), "Album should be classified as past-exams");
  assert(res.categories.includes("university-computing"), "Album should be classified as computing");
  assert.strictEqual(res.confidence, "high");
  assert.strictEqual(res.status, "classified");
  assert(res.reasons[0].includes("Consolidated Telegram album"));
});

it("never mutates original resource input objects (Immutability)", () => {
  const original = Object.freeze({
    cleanTitle: "Grade 11 Physics Textbook",
    fileName: "Physics11.pdf",
    tags: Object.freeze(["physics", "grade11"]),
    isExam: false,
    fileType: "pdf",
  });

  const prediction = classifyResource(original);
  assert(prediction.categories.includes("secondary-physics"));
  assert(prediction.collections.includes("study-materials"));
  assert.deepStrictEqual(original.tags, ["physics", "grade11"]);
});

it("produces deterministic output for identical inputs", () => {
  const resource = {
    cleanTitle: "Operating Systems Final Exam AAU CS 2022",
    courseCode: "CS201",
    university: "AAU",
    isExam: true,
  };

  const run1 = classifyResource(resource);
  const run2 = classifyResource(resource);
  assert.deepStrictEqual(run1, run2, "Runs must be completely deterministic and identical");
});

// ── Group 6: Phase 3.3.2 Targeted Refinements (Audited Examples) ─
console.log("\nGroup 6: Phase 3.3.2 Targeted Refinements (Audited Examples)");

it("refinement 1: administrative announcements (Ethiopian Coders) flag needs_review with low confidence", () => {
  const resource = {
    cleanTitle: "Ethiopian Coders",
    fileName: "Ethiopian_coders.pdf",
    caption: "Via Ministry of Education \n\nThe Ministry of Education has endorsed the Five Million Ethiopian Coders initiative and directed the University to facilitate...",
    tags: ["programming"],
    channelUsername: "astusoftware2023",
    courseCode: "AI",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert.strictEqual(res.status, "needs_review", "Administrative announcement must be needs_review");
  assert.strictEqual(res.confidence, "low", "Confidence must be low");
  assert.strictEqual(res.collections.length, 0, "Must not assign study-materials to announcement");
  assert.strictEqual(res.categories.length, 0, "Must not assign computing category to announcement");
  assert(res.reasons.some((r) => r.toLowerCase().includes("administrative announcement")));
});

it("refinement 2: General Psychology with MoSHE module recognizes freshman course and study-materials", () => {
  const resource = {
    cleanTitle: "General Psychology",
    fileName: "General Psychology.pdf",
    caption: "#Psychology \nMoSHE module",
    tags: [],
    channelUsername: "astusoftware2023",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("university-freshman-courses"), "Must include university-freshman-courses");
  assert(res.collections.includes("study-materials"), "Must include study-materials");
  assert(res.categories.includes("university-humanities"), "Must include university-humanities");
  assert.strictEqual(res.confidence, "high", "Confidence must be high");
  assert.strictEqual(res.status, "classified", "Status must be classified");
});

it("refinement 3a: FLEN1012 without university context does NOT universally trigger freshman courses collection", () => {
  const resource = {
    cleanTitle: "Communicative English Language Skills Part Two( FLEn1012)",
    fileName: "Communicative English Language Skills Part two( FLEn1012).pptx",
    caption: "Share 'Communicative English Language Skills Part two( FLEn1012).pptx'",
    tags: ["communicative_english"],
    university: "",
    courseCode: "FLEN1012",
    channelUsername: "eethio7",
    fileType: "ppt",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert(!res.collections.includes("university-freshman-courses"), "FLEN1012 without university context must NOT be universal freshman");
  assert(res.collections.includes("study-materials"), "Must include study-materials");
});

it("refinement 3b: FLEN1012 with university context recognizes freshman collection", () => {
  const resource = {
    cleanTitle: "Communicative English Language Skills Part Two( FLEn1012)",
    fileName: "Communicative English Language Skills Part two( FLEn1012).pptx",
    caption: "Share 'Communicative English Language Skills Part two( FLEn1012).pptx'",
    tags: ["communicative_english"],
    university: "Addis Ababa University",
    courseCode: "FLEN1012",
    channelUsername: "eethio7",
    fileType: "ppt",
    isExam: false,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("university-freshman-courses"), "With university context, FLEN1012 maps to freshman-courses");
  assert(res.collections.includes("study-materials"), "Must include study-materials");
  assert(res.categories.includes("university-humanities"), "Must include university-humanities");
});

it("refinement 4: Discrete Mathematics for Software Engineering maps to University Computing", () => {
  const resource = {
    cleanTitle: "Discrete Mathematics Mid Exam",
    fileName: "",
    tags: ["exam", "mid", "discrete_mathematics"],
    channelUsername: "astusoftware2023",
    isExam: true,
  };
  const res = classifyResource(resource);
  assert(res.categories.includes("university-computing"), "Must classify under university-computing");
  assert(res.collections.includes("past-exams-entrance-exit"), "Must include past-exams-entrance-exit");
  assert.strictEqual(res.status, "classified", "Must be classified, not left unclassified");
  assert.strictEqual(res.confidence, "high", "Confidence must be high");
});

it("refinement 5: General Chemistry at BDU without freshman evidence does NOT trigger freshman collection", () => {
  const resource = {
    cleanTitle: "Bahirdar - university - general - chemistry - mid - exam - 2014…",
    fileName: "-bahirdar-university-general-chemistry-mid-exam-2014-e.c.pdf",
    university: "Bahir Dar",
    channelUsername: "eethio7",
    isExam: true,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("past-exams-entrance-exit"), "Must include past-exams-entrance-exit");
  assert(!res.collections.includes("university-freshman-courses"), "Must NOT include freshman collection without freshman evidence");
  assert(res.categories.includes("university-natural-sciences"), "Must classify under university-natural-sciences");
});

it("refinement 6: Anthropology Mid Exam BDU without freshman evidence does NOT trigger freshman collection", () => {
  const resource = {
    cleanTitle: "Anthropology Mid Exam BDU",
    fileName: "Anthropology mid exam BDU .pdf",
    university: "Bahir Dar",
    channelUsername: "eethio7",
    isExam: true,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("past-exams-entrance-exit"), "Must include past-exams-entrance-exit");
  assert(!res.collections.includes("university-freshman-courses"), "Must NOT include freshman collection without freshman evidence");
  assert(res.categories.includes("university-humanities"), "Must classify under university-humanities");
});

it("refinement 7: General Psychology Freshman lecture slides (.pptx) do NOT get past-exams solely from exam tag", () => {
  const resource = {
    cleanTitle: "General Psychology Freshman",
    fileName: "General_Psychology_Freshman_Chapter1.pptx",
    caption: "Lecture presentation slides on psychology",
    tags: ["exam"],
    channelUsername: "eethio7",
    fileType: "ppt",
    isExam: true,
  };
  const res = classifyResource(resource);
  assert(res.collections.includes("study-materials"), "Must include study-materials");
  assert(res.collections.includes("university-freshman-courses"), "Must include university-freshman-courses");
  assert(!res.collections.includes("past-exams-entrance-exit"), "Lecture slides must NOT receive past-exams solely due to exam tag");
  assert(res.categories.includes("university-humanities"), "Must include university-humanities");
  assert.strictEqual(res.confidence, "high", "Confidence must be high");
});

console.log("\n=======================================================");
console.log(`  Tests Completed: ${passed}/${total} Passed          `);
console.log("=======================================================\n");
