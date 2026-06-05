require("dotenv").config();
const mongoose = require("mongoose");
const TelegramChannel = require("../src/db/models/TelegramChannel");

const channels = [
  // General University Resources
  {
    username: "ethioacadamic",
    displayName: "Ethio Academic",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "EthiopianStudentsTM",
    displayName: "Ethiopian Students TM",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "Best_book_for_students",
    displayName: "Best Books for Students",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "ethiouniversity1",
    displayName: "Ethio University Resources",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "ethfresh",
    displayName: "Ethio Freshman",
    university: "ALL",
    department: "Freshman",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "AplusEthiopian",
    displayName: "A+ Ethiopian",
    university: "ALL",
    department: "Freshman",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "handoutset",
    displayName: "Handouts Set",
    university: "ALL",
    department: "General",
    type: "lecture_notes",
    priority: 3,
  },
  {
    username: "campus_handout",
    displayName: "Campus Handout",
    university: "ALL",
    department: "General",
    type: "lecture_notes",
    priority: 3,
  },

  // Exit Exam
  {
    username: "Exit_Exam_Questions",
    displayName: "Exit Exam Questions",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "ExitExamEthiopia",
    displayName: "Exit Exam Ethiopia",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "exit_exam",
    displayName: "Exit Exam",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "moeexitexamofficial",
    displayName: "MoE Exit Exam Official",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "myworkacfn",
    displayName: "Accounting & Finance Exit Exam",
    university: "ALL",
    department: "Accounting",
    type: "exam_archive",
    priority: 2,
  },

  // Entrance & Exam Prep
  {
    username: "GATExams",
    displayName: "GAT Exams",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "QesemAcademy",
    displayName: "Qesem Academy",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "Marvel_Educations",
    displayName: "Marvel Educations",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "freshm_students",
    displayName: "Freshman Students",
    university: "ALL",
    department: "Freshman",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "Ethiomatric_freshmen",
    displayName: "Ethio Matric Freshman Hub",
    university: "ALL",
    department: "Freshman",
    type: "general",
    priority: 2,
  },
  {
    username: "Entranceprep2",
    displayName: "Entrance Exam Prep",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 2,
  },
  {
    username: "eethio7",
    displayName: "Freshman Exam Tube",
    university: "ALL",
    department: "Freshman",
    type: "exam_archive",
    priority: 3,
  },

  // Field Specific
  {
    username: "EthiopianLawStudentAssociation",
    displayName: "Ethiopian Law Students",
    university: "ALL",
    department: "Law",
    type: "exam_archive",
    priority: 2,
  },
  {
    username: "lawstudentgroupdiscussion",
    displayName: "Law Student Discussion",
    university: "ALL",
    department: "Law",
    type: "general",
    priority: 2,
  },
  {
    username: "managementexitexam",
    displayName: "Management Exit Exam (AAU)",
    university: "AAU",
    department: "Management",
    type: "exam_archive",
    priority: 2,
  },
  {
    username: "astusoftware2023",
    displayName: "ASTU Software Engineering",
    university: "ASTU",
    department: "Software Engineering",
    type: "exam_archive",
    priority: 3,
  },
  {
    username: "comprehensiveNursing",
    displayName: "Gondar Nursing",
    university: "UOG",
    department: "Nursing",
    type: "lecture_notes",
    priority: 2,
  },
  {
    username: "forhealthstudents",
    displayName: "Haramaya Health Students",
    university: "HU",
    department: "Health",
    type: "lecture_notes",
    priority: 2,
  },

  // Video & Tutorials
  {
    username: "ethiofreshvideo",
    displayName: "Ethio Freshman Videos",
    university: "ALL",
    department: "Freshman",
    type: "general",
    priority: 1,
  },
  {
    username: "temariLiqacademy",
    displayName: "Temari Liq Academy",
    university: "ALL",
    department: "General",
    type: "lecture_notes",
    priority: 2,
  },

  // Additional
  {
    username: "Ethio_Students_only",
    displayName: "Ethio Students Only",
    university: "ALL",
    department: "General",
    type: "exam_archive",
    priority: 2,
  },
  {
    username: "qubeeacademy",
    displayName: "Qubee Academy",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
  {
    username: "Ethiopian_education2",
    displayName: "Ethiopian Education",
    university: "ALL",
    department: "General",
    type: "lecture_notes",
    priority: 2,
  },
  {
    username: "Ethiel_Academy",
    displayName: "Ethiel Academy",
    university: "ALL",
    department: "General",
    type: "general",
    priority: 2,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  let inserted = 0;
  let updated = 0;

  for (const ch of channels) {
    const result = await TelegramChannel.updateOne(
      { username: ch.username },
      { $set: ch },
      { upsert: true },
    );
    result.upsertedCount ? inserted++ : updated++;
    console.log(
      `  ${result.upsertedCount ? "✅ added  " : "🔄 updated"} @${ch.username}`,
    );
  }

  console.log(`\nDone. ${inserted} inserted, ${updated} updated.`);
  console.log(
    `Total active channels in DB: ${await TelegramChannel.countDocuments({ active: true })}`,
  );

  await mongoose.disconnect();
}

seed().catch(console.error);
