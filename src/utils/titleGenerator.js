/**
 * titleGenerator.js
 *
 * Professional Display Title Normalizer for StudyHub.
 * Converts raw filenames, messy captions, and scanner artifacts into
 * clean, consistent, professional titles for both Web and Bot display.
 * Fully supports Amharic/Ethiopic script and English academic literature.
 */

// Known acronyms to preserve in UPPERCASE
const ACRONYMS = new Set([
  "OOP", "DBMS", "DSA", "AI", "ML", "OS", "SE", "CS", "IT", "IS",
  "AAU", "ASTU", "AASTU", "HU", "JU", "BDU", "MU", "WU", "AMU",
  "EUEE", "UEE", "MOE", "PDF", "PPT", "DOC", "HTTP", "HTML", "CSS", "SQL",
  "C++", "C#", "JS", "TS", "PHP", "API", "REST", "CPU", "RAM", "ROM",
  "IoT", "GUI", "CLI", "IDE", "LAN", "WAN", "IP", "TCP", "UDP"
]);

// Generic scanner/camera artifacts that should NOT be used as titles
const SCANNER_ARTIFACT_RE = /^(image_to_pdf|scan|scanner|camscanner|document|img_\d|photo_\d|wp_\d|vid_\d|file_\d|untitled|new_doc)/i;

// Generic chapter/lecture filenames that lack subject context
const GENERIC_CHAPTER_RE = /^(chapter|unit|lecture|part|section|module|ch)\s*[-_]?\s*\d+(\s*(part|pt|section)\s*\d+)?$/i;

// Priority academic / exam keywords for caption line picking
const ACADEMIC_PRIORITY_RE = /\b(exam|mid|midterm|final|quiz|test|chapter|lecture|notes?|slides?|handout|module|course\s*outline|assignment|solutions?|worksheet)\b/i;

// Ethiopic script range (Amharic, Tigrinya, Ge'ez)
const ETHIOPIC_RE = /[ሀ-፼]/;

/**
 * Capitalizes a word respecting academic acronyms and standard English rules.
 */
function titleCaseWord(word, index, totalWords) {
  if (!word) return "";
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  
  // Lowercase minor connecting words unless they are the first or last word
  const lower = word.toLowerCase();
  const minorWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "of", "in"]);
  if (index > 0 && index < totalWords - 1 && minorWords.has(lower)) {
    return lower;
  }

  // Preserve mixed case like C++ or iPhone or camelCase
  if (/[a-z]/.test(word) && /[A-Z]/.test(word) && !/^[A-Z][a-z]+$/.test(word)) {
    return word;
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Cleans text from emojis, URLs, channels, hashtags, and formatting noise.
 * Fully preserves Unicode/Ethiopic letters.
 */
function cleanRawText(str) {
  if (!str) return "";
  return str
    // Remove URLs
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/t\.me\/\S+/gi, "")
    // Remove telegram @mentions
    .replace(/@[\w_]+/g, "")
    // Remove hashtags symbols (#mid_exam -> mid exam)
    .replace(/#([\w_]+)/g, " $1 ")
    // Remove file extensions
    .replace(/\.(pdf|pptx?|docx?|xlsx?|jpe?g|png|zip|rar)\b/gi, "")
    // Remove commercial promo suffixes/tags like "ExamClass", "Freshman Master Class"
    .replace(/\b(ExamClass|Freshman\s*Master\s*Class|Malefia|Qubeeac)\b/gi, "")
    // Remove duplicate copy indicators like (1), (2), _copy
    .replace(/\s*\(\d+\)\s*/g, " ")
    .replace(/_copy\b/gi, "")
    // Remove conversational prefixes: "This is ", "Here is ", "Share share"
    .replace(/^(this\s+is|here\s+is|please\s+find|share\s+share)\s+/i, "")
    // Replace underscores, repeated dashes, repeated dots with spaces
    .replace(/[_\t]+/g, " ")
    .replace(/-{2,}/g, " - ")
    .replace(/\.{2,}/g, " ")
    // Remove leading numbering like "01Chapter" -> "Chapter" or "1. " -> ""
    .replace(/^\s*\d{1,2}[\.\-\s]+(?=[A-Za-z])/g, "")
    .replace(/^\s*0\d(?=[A-Za-z])/g, "")
    // Remove stray special chars at start/end using Unicode-aware property escapes
    .replace(/^[^\p{L}\p{N}\(\)]+|[^\p{L}\p{N}\(\)]+$/gu, "")
    // Collapse multiple whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the best academic title line from a Telegram caption.
 */
function extractTitleFromCaption(caption) {
  if (!caption) return "";
  const lines = caption
    .split(/\r?\n/)
    .map((l) => cleanRawText(l))
    .filter((l) => l.length >= 3 && /[\p{L}]/u.test(l));

  if (lines.length === 0) return "";

  // If there is a line with strong academic/exam keywords, prioritize it
  const examLine = lines.find((l) => ACADEMIC_PRIORITY_RE.test(l));
  if (examLine) {
    const firstLine = lines[0];
    const examIdx = lines.indexOf(examLine);
    // If line 1 was a subject (e.g., "Object Oriented Programming" or "Physics") and examLine doesn't mention it, combine them
    if (examIdx > 0 && firstLine.length <= 40 && !examLine.toLowerCase().includes(firstLine.toLowerCase())) {
      return `${firstLine} - ${examLine}`;
    }
    return examLine;
  }

  // If first line is just a single tag word (e.g., "Logic") and line 2 exists, pick line 2
  if (lines[0].split(/\s+/).length <= 1 && lines.length > 1) {
    return lines[1];
  }

  return lines[0];
}

/**
 * Generates a clean, professional display title for a TelegramResource.
 * @param {Object} resource - TelegramResource document or plain object
 * @returns {string} Professional display title
 */
function generateDisplayTitle(resource) {
  if (!resource) return "Academic Resource";

  const rawFileName = (resource.fileName || "").trim();
  const rawCaption = (resource.caption || "").trim();

  // 1. Amharic / Ethiopic titles: the filename IS the title of the book!
  // No need to change name or title, display them with confidence.
  if (ETHIOPIC_RE.test(rawFileName)) {
    let cleanAmharic = cleanRawText(rawFileName)
      .replace(/\s*-\s*/g, " - ")
      .replace(/[:\-,\s]+$/, "")
      .trim();
    if (cleanAmharic.length > 0) {
      if (cleanAmharic.length > 70) cleanAmharic = cleanAmharic.substring(0, 69) + "…";
      return cleanAmharic;
    }
  }

  let candidate = "";

  // 2. Check if fileName exists and is NOT a generic scanner artifact
  const isScanner = !rawFileName || SCANNER_ARTIFACT_RE.test(cleanRawText(rawFileName));

  if (!isScanner) {
    candidate = cleanRawText(rawFileName);
  }

  // 3. If candidate is a generic chapter name (e.g., "Chapter 1"), try enriching from caption
  if (candidate && GENERIC_CHAPTER_RE.test(candidate)) {
    const capTitle = extractTitleFromCaption(rawCaption);
    if (capTitle && capTitle.length >= 4 && !GENERIC_CHAPTER_RE.test(capTitle)) {
      candidate = `${capTitle} - ${candidate}`;
    }
  }

  // 4. If no valid fileName (or it was a scanner artifact), extract from caption
  if (!candidate || candidate.length < 4) {
    candidate = extractTitleFromCaption(rawCaption);
  }

  // 5. Fallback to courseCode / tags / generic
  if (!candidate || candidate.length < 3) {
    if (resource.courseCode) {
      candidate = `${resource.courseCode.toUpperCase()} Study Material`;
    } else if (resource.tags && resource.tags.length > 0) {
      const topTag = resource.tags[0].replace(/_/g, " ");
      candidate = `${topTag} Resource`;
    } else {
      candidate = "Academic Resource";
    }
  }

  // 6. If candidate contains Ethiopic characters, preserve as-is without English casing
  if (ETHIOPIC_RE.test(candidate)) {
    let cleanAmharic = candidate
      .replace(/\s*-\s*/g, " - ")
      .replace(/[:\-,\s]+$/, "")
      .trim();
    if (cleanAmharic.length > 70) cleanAmharic = cleanAmharic.substring(0, 69) + "…";
    return cleanAmharic;
  }

  // 7. Format English into Title Case
  const words = candidate.split(/\s+/).filter(Boolean);
  const titleCased = words
    .map((w, idx) => titleCaseWord(w, idx, words.length))
    .join(" ");

  // 8. Clean punctuation spacing
  let finalTitle = titleCased
    .replace(/\s*-\s*/g, " - ")
    .replace(/[:\-,\s]+$/, "")
    .trim();

  // 9. Graceful truncation: max 65 chars at word boundary
  const MAX_LEN = 65;
  if (finalTitle.length > MAX_LEN) {
    const truncated = finalTitle.substring(0, MAX_LEN);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 35) {
      finalTitle = truncated.substring(0, lastSpace) + "…";
    } else {
      finalTitle = truncated.substring(0, MAX_LEN - 1) + "…";
    }
  }

  return finalTitle || "Academic Resource";
}

module.exports = {
  generateDisplayTitle,
  cleanRawText,
  titleCaseWord,
};
