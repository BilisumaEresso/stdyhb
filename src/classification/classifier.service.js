/**
 * StudyHub Academic Resource Classifier Service
 *
 * Deterministic, rule-based classification engine that assigns canonical
 * taxonomy collections and categories to StudyHub academic resources.
 *
 * Strictly read-only: does not modify input objects or database records.
 * Uses centralized taxonomy (src/config/taxonomy.json) as the single source of truth.
 */

const {
  COLLECTIONS,
  EDUCATION_GROUPS,
  SUBJECT_CATEGORIES,
  FRESHMAN_COURSES,
  ALIASES,
} = require("../config/taxonomy");

// Known Ethiopian literature / book channels
const FICTION_CHANNELS = new Set([
  "amharic_fiction_books",
  "ethio_pdf_books",
  "ethio_pdf_books1",
  "muscatnonfiction",
  "kooblife",
]);

// Known exam channels
const EXAM_CHANNELS = new Set([
  "exitexamethiopia",
  "exit_exam_questions",
  "gatexams",
  "aau_exam_collection",
  "exambankfreshman",
  "exit_exams",
  "hundechannelexam",
  "moeexitexamofficial",
  "managementexitexam",
]);

// Known freshman curriculum channels
const FRESHMAN_CHANNELS = new Set([
  "freshman_classroom",
  "freshman_materials",
  "freshmanebook",
  "exambankfreshman",
  "ethfresh",
  "hawasaafresh",
]);

// Known secondary education channels
const SECONDARY_CHANNELS = new Set([
  "grade9_12textbooks1",
  "class_10_social_science_notes",
]);

// Known Ethiopian universities regex
const ETHIOPIAN_UNIVERSITIES_REGEX =
  /\b(aau|astu|aastu|bdu|ju|hu|hawassa|mekelle|gondar|arba\s*minch|dilla|wollo|wolaita|debre\s*berhan|debre\s*markos|jigjiga|wachemo|dire\s*dawa|ambo|semera|mattu|wollega|kotebe|addis\s*ababa\s*university|adama\s*science|jimma\s*university|bahir\s*dar\s*university|haramaya)\b/i;

// Clean text for matching
function cleanText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/\.(pdf|pptx?|docx?|jpe?g|png|webp|gif)\b/gi, " ")
    .replace(/@\w+/g, " ") // strip telegram @mentions
    .replace(/[_\-–—/\\|:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect education tier from metadata and text
 * Returns { isKg8, isSecondary, isUniversity, gradeNumber, evidence }
 */
function detectEducationTier(combinedText, resource) {
  const channelLower = (resource.channelUsername || "").toLowerCase();
  const universityField = (resource.university || "").trim();
  const courseCodeField = (resource.courseCode || "").trim();

  let isKg8 = false;
  let isSecondary = false;
  let isUniversity = false;
  let gradeNumber = null;
  const tierEvidence = [];

  // 1. Explicit KG–Grade 8 patterns (Grades 1 through 8)
  const kg8Match = combinedText.match(
    /\b(?:grade|gr|g|class)\s*([1-8])\b|\bgrade\s*(?:one|two|three|four|five|six|seven|eight)\b|\b(?:primary|elementary|middle)\s+school\b|\b(?:kg|kindergarten|nursery)\b/i
  );
  if (kg8Match) {
    isKg8 = true;
    if (kg8Match[1]) gradeNumber = parseInt(kg8Match[1], 10);
    tierEvidence.push(`KG–Grade 8 indicator: "${kg8Match[0]}"`);
  }

  // 2. Explicit Secondary patterns (Grades 9 through 12)
  const secMatch = combinedText.match(
    /\b(?:grade|gr|g|class)\s*(9|10|11|12)\b|\bgrade\s*(?:nine|ten|eleven|twelve)\b|\b(?:secondary|high)\s+school\b|\b(?:euee|matric|university\s+entrance\s+exam)\b/i
  );
  if (secMatch || SECONDARY_CHANNELS.has(channelLower)) {
    isSecondary = true;
    if (secMatch && secMatch[1]) gradeNumber = parseInt(secMatch[1], 10);
    tierEvidence.push(
      secMatch
        ? `Secondary (Grades 9–12) indicator: "${secMatch[0]}"`
        : `Secondary channel: "${channelLower}"`
    );
  }

  // 3. Explicit University / Higher Education patterns
  const uniMatch =
    universityField ||
    ETHIOPIAN_UNIVERSITIES_REGEX.test(combinedText) ||
    FRESHMAN_CHANNELS.has(channelLower) ||
    /\b(?:university|campus|faculty|department|college|undergraduate|postgraduate|freshman|sophomore|junior|senior|semester|credit\s+hour|exit\s+exam|bsc|msc|phd|degree|bachelor|internship|remedial|moshe\s+module|moshe|discrete\s+mathematics|discrete\s+math)\b/i.test(
      combinedText
    ) ||
    (/\b(?:software\s+engineers?|software\s+engineering|computer\s+science)\b/i.test(combinedText) && !isKg8 && !isSecondary);

  if (uniMatch) {
    isUniversity = true;
    if (universityField) {
      tierEvidence.push(`University metadata: "${universityField}"`);
    } else {
      tierEvidence.push("Higher education / university terminology in resource text");
    }
  }

  return { isKg8, isSecondary, isUniversity, gradeNumber, tierEvidence };
}

/**
 * Match collections from resource metadata
 */
function detectCollections(combinedText, resource, tier) {
  const collections = new Set();
  const reasons = [];
  const channelLower = (resource.channelUsername || "").toLowerCase();

  // ── 1. Past Exams, Entrance & Exit (`past-exams-entrance-exit`) ──────
  const hasExamFlag = Boolean(resource.isExam);
  const examKeywordMatch = combinedText.match(
    /\b(exam|exams|examination|examinations|midterm|midterms|final\s+exam|final\s+exams|exit\s+exam|exit\s+exams|entrance\s+exam|entrance\s+exams|euee|ministry\s+exam|model\s+exam|model\s+paper|quiz|quizzes|past\s+paper|past\s+papers|solved\s+exam|answer\s+key|marking\s+scheme)\b/i
  );
  const isActualExamPaper = combinedText.match(
    /\b(midterm|midterms|mid\s+exam|final\s+exam|final\s+exams|exit\s+exam|exit\s+exams|entrance\s+exam|entrance\s+exams|euee|ministry\s+exam|model\s+exam|model\s+paper|quiz|quizzes|past\s+paper|past\s+papers|solved\s+exam|question\s+paper|answer\s+key|marking\s+scheme)\b/i
  );
  const isExamChannel = EXAM_CHANNELS.has(channelLower);
  const isStudyFormat = resource.fileType === "ppt" || /\b(power\s*point|slides|lecture\s+notes?|textbooks?|modules?|short\s+notes?|revision\s+notes?|handouts?)\b/i.test(combinedText);

  // If a file is in study format (e.g. PPT presentation, short notes, module) and lacks an actual exam paper title,
  // do NOT classify as past-exams-entrance-exit solely because of channel name or an 'exam' tag!
  const isActualExam = isActualExamPaper || (hasExamFlag && !isStudyFormat) || (isExamChannel && !isStudyFormat);

  if (isActualExam) {
    collections.add("past-exams-entrance-exit");
    if (isActualExamPaper) {
      reasons.push(`Exam terminology identified: "${isActualExamPaper[0]}"`);
    } else if (hasExamFlag) {
      reasons.push("Explicit exam flag (isExam: true)");
    } else if (isExamChannel) {
      reasons.push(`Published on dedicated examination channel: "${channelLower}"`);
    }
  }

  // ── 2. Ethiopian Fiction & Reading (`ethiopian-fiction-reading`) ──────
  const isFictionChannel = FICTION_CHANNELS.has(channelLower);
  const fictionKeywordMatch = combinedText.match(
    /\b(novel|novels|fiction|poetry|poem|poems|folktale|literature|leboled|tarik|tarikh|drama|play|biography|memoir|ልቦለድ|ግጥም|ድርሰት|ተውኔት)\b/i
  );

  // Distinguish from academic study materials/exams
  if ((isFictionChannel || fictionKeywordMatch) && !hasExamFlag) {
    collections.add("ethiopian-fiction-reading");
    if (isFictionChannel) {
      reasons.push(`Published on Ethiopian literature/fiction channel: "${channelLower}"`);
    }
    if (fictionKeywordMatch) {
      reasons.push(`Ethiopian literature/fiction keywords identified: "${fictionKeywordMatch[0]}"`);
    }
  }

  // ── 3. University Freshman Courses (`university-freshman-courses`) ────
  const isFreshmanChannel = FRESHMAN_CHANNELS.has(channelLower);
  const freshmanTermMatch = combinedText.match(
    /\b(freshman|fresh\s+man|1st\s+year|first\s+year|common\s+courses?|remedial)\b/i
  );
  const hasMosheFreshmanModule = /\b(moshe\s+module|ministry\s+of\s+science\s+and\s+higher\s+education)\b/i.test(combinedText);
  const hasUniversityContext = Boolean(
    resource.university ||
    (typeof resource.university === "string" && resource.university.trim().length > 0) ||
    ETHIOPIAN_UNIVERSITIES_REGEX.test(combinedText)
  );

  // University-specific course code aliases that must NEVER be treated as universal freshman identifiers
  // without verified university context
  const UNIVERSITY_SPECIFIC_COURSE_CODES = new Set([
    "flen 1011",
    "flen 1012",
    "enla 1011",
    "enla 1012",
  ]);

  // Courses whose names/topics overlap with secondary/general subjects or broad university departments
  // and must NOT establish freshman collection without explicit evidence connecting to the freshman curriculum
  const GENERIC_OR_BROAD_COURSE_IDS = new Set([
    "freshman-chemistry",
    "freshman-physics",
    "freshman-biology",
    "freshman-economics",
    "freshman-anthropology",
  ]);

  // Check against the 18 freshman course definitions (only when NOT primary or secondary)
  let matchedFreshmanCourse = null;
  if (!tier.isKg8 && !tier.isSecondary) {
    const hasExplicitFreshmanEvidence = Boolean(
      freshmanTermMatch || isFreshmanChannel || hasMosheFreshmanModule
    );

    for (const crs of FRESHMAN_COURSES) {
      // Broad courses require explicit freshman connection evidence (freshman term, channel, or MoSHE module)
      if (GENERIC_OR_BROAD_COURSE_IDS.has(crs.id) && !hasExplicitFreshmanEvidence) {
        continue;
      }

      const courseNameClean = cleanText(crs.name);
      // Exact course name match
      if (combinedText.includes(courseNameClean)) {
        matchedFreshmanCourse = crs;
        break;
      }
      // Check specific freshman course aliases (avoid generic single-word aliases)
      if (crs.aliases) {
        for (const alias of crs.aliases) {
          const cleanAlias = cleanText(alias);
          // If the alias is a university-specific course code (e.g. "FLEN 1012"),
          // NEVER treat it as a universal freshman identifier: require verified university context!
          if (UNIVERSITY_SPECIFIC_COURSE_CODES.has(cleanAlias) && !hasUniversityContext) {
            continue;
          }

          // Ensure alias is specific (at least 7 characters, e.g. "math 1011", "communicative english")
          if (cleanAlias.length >= 7 && combinedText.includes(cleanAlias)) {
            matchedFreshmanCourse = crs;
            break;
          }
        }
      }
      if (matchedFreshmanCourse) break;
    }
  }

  // Freshman collection assignment:
  // Requires freshman channel, explicit freshman terminology, or MoSHE module with matched course,
  // or matched freshman course with university/freshman context.
  const hasFreshmanCollectionEvidence =
    isFreshmanChannel ||
    Boolean(freshmanTermMatch) ||
    Boolean(hasMosheFreshmanModule && matchedFreshmanCourse) ||
    Boolean(
      matchedFreshmanCourse &&
      !GENERIC_OR_BROAD_COURSE_IDS.has(matchedFreshmanCourse.id) &&
      (tier.isUniversity || freshmanTermMatch || isFreshmanChannel || hasMosheFreshmanModule)
    );

  if (hasFreshmanCollectionEvidence) {
    collections.add("university-freshman-courses");
    if (isFreshmanChannel) {
      reasons.push(`Published on university freshman channel: "${channelLower}"`);
    }
    if (freshmanTermMatch) {
      reasons.push(`Freshman curriculum terminology: "${freshmanTermMatch[0]}"`);
    }
    if (hasMosheFreshmanModule && matchedFreshmanCourse) {
      reasons.push("Official MoSHE (Ministry of Science & Higher Education) national freshman course module");
    }
    if (matchedFreshmanCourse) {
      reasons.push(`Identified standardized freshman course: "${matchedFreshmanCourse.name}"`);
    }
  }

  // ── 4. Study Materials (`study-materials`) ─────────────────────────────
  // Explicit study material evidence: slides, modules, textbooks, notes, handouts, worksheets
  const studyKeywordMatch = combinedText.match(
    /\b(textbook|textbooks|module|modules|lecture|lecture\s+notes|notes|handout|handouts|slides|presentation|ppt|pptx|syllabus|worksheet|worksheets|course\s+pack|lab\s+manual|tutorial\s+sheet|reference\s+book)\b/i
  );
  const isPpt = resource.fileType === "ppt";
  const isStudyChannel =
    SECONDARY_CHANNELS.has(channelLower) ||
    channelLower.includes("materials") ||
    channelLower.includes("handout") ||
    channelLower.includes("notes");

  // Do not assign study-materials as default fallback for every file
  if (studyKeywordMatch || isPpt || isStudyChannel) {
    collections.add("study-materials");
    if (studyKeywordMatch) {
      reasons.push(`Study material indicator identified: "${studyKeywordMatch[0]}"`);
    }
    if (isPpt) {
      reasons.push("File format is PowerPoint presentation (lecture slides)");
    }
    if (isStudyChannel) {
      reasons.push(`Channel dedicated to study resources: "${channelLower}"`);
    }
  }

  return { collections: Array.from(collections), reasons, matchedFreshmanCourse };
}

/**
 * Classify academic categories based on tier and subject evidence
 */
function detectCategories(combinedText, resource, tier, matchedFreshmanCourse) {
  const categories = new Set();
  const reasons = [];
  let isAmbiguousSubject = false;
  let ambiguousSubjectName = "";

  const { isKg8, isSecondary, isUniversity } = tier;

  // ── Freshman Mathematics Distinction (Natural vs Social Science) ──
  if (matchedFreshmanCourse && !isKg8 && !isSecondary) {
    if (matchedFreshmanCourse.id === "freshman-math-natural") {
      categories.add("university-natural-sciences");
      reasons.push("Freshman course 'Mathematics for Natural Sciences' classified under University Natural & Computational Sciences");
      return { categories: Array.from(categories), reasons, isAmbiguousSubject };
    }
    if (matchedFreshmanCourse.id === "freshman-math-social") {
      categories.add("university-natural-sciences");
      reasons.push("Freshman course 'Mathematics for Social Sciences' classified under University Natural & Computational Sciences");
      return { categories: Array.from(categories), reasons, isAmbiguousSubject };
    }
    // Other freshman courses with categoryRef
    if (matchedFreshmanCourse.categoryRef) {
      categories.add(matchedFreshmanCourse.categoryRef);
      reasons.push(`Freshman course '${matchedFreshmanCourse.name}' maps to category '${matchedFreshmanCourse.categoryRef}'`);
      return { categories: Array.from(categories), reasons, isAmbiguousSubject };
    }
  }

  // ── Subject Matchers ──────────────────────────────────────────────
  const hasMath = /\b(mathematics|math|maths|calculus|algebra|geometry|trigonometry|arithmetic)\b/i.test(combinedText);
  const hasPhysics = /\b(physics|mechanics|electromagnetism|thermodynamics|optics|quantum)\b/i.test(combinedText);
  const hasChemistry = /\b(chemistry|organic\s+chem|inorganic\s+chem|biochemistry|chemical)\b/i.test(combinedText);
  const hasBiology = /\b(biology|zoology|botany|genetics|ecology|cell\s+biology|anatomy|physiology)\b/i.test(combinedText);
  const hasLanguages = /\b(english|amharic|afaan\s+oromo|tigrinya|somali|grammar|reading\s+comprehension|literature|mother\s+tongue)\b/i.test(combinedText);
  const hasSocial = /\b(history|geography|civics|social\s+studies|citizenship|economics)\b/i.test(combinedText);

  // Discrete Mathematics for Software Engineering / Computing check:
  // When mathematics is specifically connected to computer science / software engineering,
  // or explicitly "discrete mathematics", it unambiguously belongs to University Computing & Information Sciences,
  // even if no general higher ed tier marker was explicitly found.
  const hasComputingMath =
    /\b(discrete\s+mathematics|discrete\s+math)\b/i.test(combinedText) ||
    (hasMath && /\b(software\s+engineers?|software\s+engineering|computer\s+science|cse|programming|algorithms)\b/i.test(combinedText));

  if (hasComputingMath && !isKg8 && !isSecondary) {
    categories.add("university-computing");
    reasons.push("Applied computing mathematics (e.g. Discrete Mathematics for Software Engineering) classified under University Computing & Information Sciences");
    return { categories: Array.from(categories), reasons, isAmbiguousSubject: false };
  }

  // ── Ambiguity Check ───────────────────────────────────────────────
  // If a generic subject is present but NO education tier is determined:
  const isGenericSubject = hasMath || hasPhysics || hasChemistry || hasBiology || hasLanguages || hasSocial;
  const tierCount = (isKg8 ? 1 : 0) + (isSecondary ? 1 : 0) + (isUniversity ? 1 : 0);

  if (isGenericSubject && tierCount === 0) {
    // Subject detected but education level is completely unknown
    isAmbiguousSubject = true;
    if (hasMath) ambiguousSubjectName = "Mathematics";
    else if (hasPhysics) ambiguousSubjectName = "Physics";
    else if (hasChemistry) ambiguousSubjectName = "Chemistry";
    else if (hasBiology) ambiguousSubjectName = "Biology";
    else if (hasLanguages) ambiguousSubjectName = "Language";
    else ambiguousSubjectName = "Social Science";

    reasons.push(`Ambiguous subject '${ambiguousSubjectName}' detected without explicit education level (KG-8, Secondary, or University)`);
    return { categories: [], reasons, isAmbiguousSubject };
  }

  // If conflicting tiers exist (e.g. both KG-8 and University):
  if (tierCount > 1) {
    reasons.push("Conflicting education level indicators detected across resource metadata");
    return { categories: [], reasons, isAmbiguousSubject: true };
  }

  // ── Tier 1: KG–Grade 8 ────────────────────────────────────────────
  if (isKg8) {
    if (hasMath) {
      categories.add("kg8-mathematics");
      reasons.push("KG–Grade 8 Mathematics identified");
    }
    if (hasLanguages) {
      categories.add("kg8-languages-literacy");
      reasons.push("KG–Grade 8 Languages & Literacy identified");
    }
    if (/\b(general\s+science|environmental\s+science|science)\b/i.test(combinedText) && !hasMath && !hasPhysics) {
      categories.add("kg8-general-science");
      reasons.push("KG–Grade 8 General & Environmental Science identified");
    }
    if (/\b(social\s+studies|geography)\b/i.test(combinedText)) {
      categories.add("kg8-social-studies-geography");
      reasons.push("KG–Grade 8 Social Studies & Geography identified");
    }
    if (/\b(history|civics|moral\s+education|citizenship)\b/i.test(combinedText)) {
      categories.add("kg8-history-civics");
      reasons.push("KG–Grade 8 History, Civics & Moral Education identified");
    }
    if (/\b(ict|computer|technology)\b/i.test(combinedText)) {
      categories.add("kg8-ict-technology");
      reasons.push("KG–Grade 8 ICT & Basic Technology identified");
    }
    if (/\b(art|arts|music|pe|physical\s+education|health|phe)\b/i.test(combinedText)) {
      categories.add("kg8-arts-health-pe");
      reasons.push("KG–Grade 8 Arts, Music, Health & PE identified");
    }
  }

  // ── Tier 2: Secondary (Grades 9–12) ────────────────────────────────
  if (isSecondary) {
    if (hasMath) {
      categories.add("secondary-mathematics");
      reasons.push("Secondary Mathematics (Grades 9–12) identified");
    }
    if (hasPhysics) {
      categories.add("secondary-physics");
      reasons.push("Secondary Physics (Grades 9–12) identified");
    }
    if (hasChemistry) {
      categories.add("secondary-chemistry");
      reasons.push("Secondary Chemistry (Grades 9–12) identified");
    }
    if (hasBiology) {
      categories.add("secondary-biology");
      reasons.push("Secondary Biology & Life Sciences (Grades 9–12) identified");
    }
    if (hasLanguages) {
      categories.add("secondary-languages");
      reasons.push("Secondary English & Ethiopian Languages (Grades 9–12) identified");
    }
    if (hasSocial) {
      categories.add("secondary-social-sciences");
      reasons.push("Secondary Social Sciences (History, Geography, Economics, Civics) identified");
    }
    if (/\b(information\s+technology|it|technical\s+drawing|general\s+business)\b/i.test(combinedText) && !hasPhysics) {
      categories.add("secondary-applied-technology");
      reasons.push("Secondary Applied Science & Technology identified");
    }
  }

  // ── Tier 3: University / Higher Education ─────────────────────────
  // Or tertiary-exclusive subjects that unambiguously establish university level
  const hasComputing =
    /\b(computer\s+science|software\s+engineering|information\s+systems|data\s+science|artificial\s+intelligence|cybersecurity|algorithms|data\s+structures|dsa|dbms|database|operating\s+systems|os|computer\s+networks|cn|networking|web\s+development|programming|java|c\+\+|python|digital\s+logic|dld|software\s+architecture|oop)\b/i.test(
      combinedText
    );

  const hasEngineering =
    /\b(civil\s+engineering|mechanical\s+engineering|electrical\s+engineering|chemical\s+engineering|architecture|construction|biomedical\s+engineering|materials\s+science|surveying|structural|reinforced\s+concrete|rcc|steel\s+structures|soil\s+mechanics|geotechnical|fluid\s+mechanics|hydraulics|autocad|power\s+systems|control\s+systems)\b/i.test(
      combinedText
    );

  const hasHealth =
    /\b(medicine|nursing|pharmacy|public\s+health|anatomy|physiology|pathology|pharmacology|surgery|obstetrics|gynecology|pediatrics|midwifery|medical\s+laboratory|histology|patient\s+care)\b/i.test(
      combinedText
    );

  const hasAgriculture =
    /\b(agriculture|agronomy|plant\s+science|animal\s+science|veterinary|horticulture|soil\s+science|forestry|natural\s+resources|agribusiness)\b/i.test(
      combinedText
    );

  const hasBusiness =
    /\b(accounting|finance|management|marketing|business\s+administration|banking|logistics|auditing|cost\s+accounting|financial\s+management|macroeconomics|microeconomics|econometrics|mba)\b/i.test(
      combinedText
    );

  const hasHumanities =
    /\b(law|jurisprudence|legal|education\s+curriculum|pedagogy|sociology|psychology|philosophy|logic\s+and\s+critical\s+thinking|political\s+science|journalism|linguistics|(?:social\s+)?anthropology|moral\s+and\s+civic|inclusiveness)\b/i.test(
      combinedText
    );

  // University Computing
  if (hasComputing && !isKg8 && !isSecondary) {
    categories.add("university-computing");
    reasons.push("University Computing & Information Sciences keywords identified");
  }

  // University Engineering
  if (hasEngineering && !isKg8 && !isSecondary) {
    categories.add("university-engineering");
    reasons.push("University Engineering & Built Environment keywords identified");
  }

  // University Health Sciences
  if (hasHealth && !isKg8 && !isSecondary) {
    categories.add("university-health-sciences");
    reasons.push("University Health & Medical Sciences keywords identified");
  }

  // University Agriculture
  if (hasAgriculture && !isKg8 && !isSecondary) {
    categories.add("university-agriculture");
    reasons.push("University Agriculture, Veterinary & Natural Resources keywords identified");
  }

  // University Business & Economics
  if (hasBusiness && !isKg8 && !isSecondary) {
    categories.add("university-business");
    reasons.push("University Business & Economics keywords identified");
  }

  // University Humanities, Law, Education
  if (hasHumanities && !isKg8 && !isSecondary) {
    categories.add("university-humanities");
    reasons.push("University Social Sciences, Humanities, Law & Education keywords identified");
  }

  // University Natural Sciences (Calculus, Higher Math, Higher Physics/Chem/Bio)
  if (
    isUniversity &&
    (hasMath || hasPhysics || hasChemistry || hasBiology) &&
    !hasComputing &&
    !hasEngineering &&
    !hasHealth
  ) {
    categories.add("university-natural-sciences");
    reasons.push("University Natural & Computational Sciences identified in higher education context");
  }

  return { categories: Array.from(categories), reasons, isAmbiguousSubject };
}

/**
 * Determine overall confidence and status
 */
function determineConfidenceAndStatus(collections, categories, isAmbiguous, reasons) {
  // If ambiguous or conflicting:
  if (isAmbiguous) {
    return {
      confidence: "low",
      status: collections.length > 0 ? "needs_review" : "unclassified",
    };
  }

  const hasCollections = collections.length > 0;
  const hasCategories = categories.length > 0;

  if (!hasCollections && !hasCategories) {
    return {
      confidence: "low",
      status: "unclassified",
    };
  }

  // High confidence conditions:
  // 1. Both collection and category matched with specific evidence
  // 2. Or explicit exam / freshman / secondary grade with category
  if (hasCollections && hasCategories) {
    return {
      confidence: "high",
      status: "classified",
    };
  }

  // Standalone collection match (e.g. past exams, or fiction) without category
  if (hasCollections && !hasCategories) {
    if (collections.includes("past-exams-entrance-exit") || collections.includes("ethiopian-fiction-reading")) {
      return {
        confidence: "medium",
        status: "classified",
      };
    }
    return {
      confidence: "medium",
      status: "needs_review",
    };
  }

  // Category match without explicit collection
  if (hasCategories && !hasCollections) {
    return {
      confidence: "medium",
      status: "classified",
    };
  }

  return {
    confidence: "low",
    status: "needs_review",
  };
}

/**
 * Classify a single StudyHub resource
 *
 * @param {Object} resource - TelegramResource document or plain object
 * @returns {Object} Prediction object { collections, categories, confidence, method, status, reasons }
 */
function classifyResource(resource) {
  if (!resource || typeof resource !== "object") {
    return {
      collections: [],
      categories: [],
      confidence: "low",
      method: "rule-based",
      status: "unclassified",
      reasons: ["Invalid or empty resource input"],
    };
  }

  // 1. Extract combined text representation (NEVER mutate input)
  const title = resource.cleanTitle || resource.title || "";
  const fileName = resource.fileName || "";
  const caption = resource.caption || "";
  const tags = Array.isArray(resource.tags) ? resource.tags.join(" ") : "";
  const courseCode = resource.courseCode || "";
  const university = resource.university || "";
  const channel = resource.channelUsername || "";

  const rawCombined = `${title} ${fileName} ${caption} ${tags} ${courseCode} ${university} ${channel}`;
  const combinedClean = cleanText(rawCombined);

  if (!combinedClean) {
    return {
      collections: [],
      categories: [],
      confidence: "low",
      method: "rule-based",
      status: "unclassified",
      reasons: ["Resource contains no extractable text metadata"],
    };
  }

  // Check for administrative announcements / promotional campaigns / non-academic notices
  // e.g. "Five Million Ethiopian Coders Initiative", scholarship/internship announcements, call for applications, etc.
  const isAnnouncement = /\b(five\s+million\s+ethiopian\s+coders|ethiopian\s+coders\s+initiative|ministry\s+of\s+education\s+has\s+endorsed|directed\s+the\s+university\s+to\s+facilitate|registration\s+deadline|call\s+for\s+applications?|nanodegree\s+program|certificate\s+earned|earned\s+my\s+certificate|congratulations\s+to\s+all|internship\s+opportunity|job\s+vacancy|meeting\s+notice)\b/i.test(rawCombined);

  if (isAnnouncement) {
    return {
      collections: [],
      categories: [],
      confidence: "low",
      method: "rule-based",
      status: "needs_review",
      reasons: ["Administrative announcement or technology initiative notice detected rather than academic learning resource"],
    };
  }

  // 2. Detect education tier
  const tier = detectEducationTier(combinedClean, resource);

  // 3. Detect collections
  const colResult = detectCollections(combinedClean, resource, tier);

  // 4. Detect categories
  const catResult = detectCategories(
    combinedClean,
    resource,
    tier,
    colResult.matchedFreshmanCourse
  );

  // 5. Combine reasons
  const allReasons = [...tier.tierEvidence, ...colResult.reasons, ...catResult.reasons];

  // 6. Assess confidence and status
  const { confidence, status } = determineConfidenceAndStatus(
    colResult.collections,
    catResult.categories,
    catResult.isAmbiguousSubject,
    allReasons
  );

  return {
    collections: colResult.collections,
    categories: catResult.categories,
    confidence,
    method: "rule-based",
    status,
    reasons: allReasons,
  };
}

/**
 * Consolidate and classify an album of multiple TelegramResource items
 *
 * @param {Array<Object>} albumMembers - Array of TelegramResource member items
 * @returns {Object} Consolidated prediction object
 */
function classifyAlbum(albumMembers) {
  if (!Array.isArray(albumMembers) || albumMembers.length === 0) {
    return {
      collections: [],
      categories: [],
      confidence: "low",
      method: "rule-based",
      status: "unclassified",
      reasons: ["Empty or invalid album members list"],
    };
  }

  // Find representative item (groupIndex === 1, or lowest groupIndex, or first item)
  const repItem =
    albumMembers.find((m) => m.groupIndex === 1) ||
    albumMembers.slice().sort((a, b) => (a.groupIndex || 0) - (b.groupIndex || 0))[0] ||
    albumMembers[0];

  // Consolidate non-empty metadata without mutating original members
  const consolidatedTitles = Array.from(
    new Set(albumMembers.map((m) => m.cleanTitle || m.title || "").filter(Boolean))
  ).join(" ");

  const consolidatedFileNames = Array.from(
    new Set(albumMembers.map((m) => m.fileName || "").filter(Boolean))
  ).join(" ");

  const consolidatedCaptions = Array.from(
    new Set(albumMembers.map((m) => m.caption || "").filter(Boolean))
  ).join(" ");

  const consolidatedTags = Array.from(
    new Set(
      albumMembers
        .flatMap((m) => (Array.isArray(m.tags) ? m.tags : []))
        .filter(Boolean)
    )
  );

  const hasAnyExam = albumMembers.some(
    (m) => m.isExam || (Array.isArray(m.tags) && m.tags.includes("exam"))
  );

  const consolidatedCourseCode =
    albumMembers.find((m) => m.courseCode)?.courseCode || repItem.courseCode || "";

  const consolidatedUniversity =
    albumMembers.find((m) => m.university)?.university || repItem.university || "";

  // Synthetic immutable entity
  const consolidatedEntity = {
    cleanTitle: repItem.cleanTitle || consolidatedTitles,
    fileName: repItem.fileName || consolidatedFileNames,
    caption: repItem.caption || consolidatedCaptions,
    tags: consolidatedTags,
    isExam: hasAnyExam,
    courseCode: consolidatedCourseCode,
    university: consolidatedUniversity,
    channelUsername: repItem.channelUsername || "",
    fileType: repItem.fileType || "image",
    groupId: repItem.groupId,
    groupTotal: albumMembers.length,
    _isAlbum: true,
  };

  const prediction = classifyResource(consolidatedEntity);
  prediction.reasons.unshift(
    `Consolidated Telegram album (${albumMembers.length} member files, groupId: ${repItem.groupId})`
  );

  return prediction;
}

/**
 * General entry point: classifies either a standalone resource or an album entity
 *
 * @param {Object|Array} input - Single resource object or array of album items
 * @returns {Object} Prediction
 */
function classifyEntity(input) {
  if (Array.isArray(input)) {
    return classifyAlbum(input);
  }
  return classifyResource(input);
}

module.exports = {
  classifyResource,
  classifyAlbum,
  classifyEntity,
  detectEducationTier,
  detectCollections,
  detectCategories,
  cleanText,
};
