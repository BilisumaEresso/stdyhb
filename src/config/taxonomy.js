/**
 * StudyHub Academic Taxonomy Service & Helper Module
 *
 * Exposes the centralized Ethiopian Academic Taxonomy configuration
 * for backend services, search engines, Telegram bots, and APIs.
 */

const taxonomy = require("./taxonomy.json");

const COLLECTIONS = taxonomy.collections;
const EDUCATION_GROUPS = taxonomy.educationGroups;
const EDUCATION_GRADES = taxonomy.educationGrades;
const SUBJECT_CATEGORIES = taxonomy.subjectCategories;
const FRESHMAN_STREAMS = taxonomy.freshmanStreams;
const FRESHMAN_COURSES = taxonomy.freshmanCourses;
const ALIASES = taxonomy.aliases;

// Pre-indexed lookup maps for O(1) resolution
const collectionById = new Map();
const collectionByAlias = new Map();
for (const col of COLLECTIONS) {
  collectionById.set(col.id, col);
  for (const alias of col.aliases) {
    collectionByAlias.set(alias.toLowerCase().trim(), col);
  }
}

const educationGroupById = new Map();
for (const grp of EDUCATION_GROUPS) {
  educationGroupById.set(grp.id, grp);
}

const educationGradeById = new Map();
for (const grd of EDUCATION_GRADES) {
  educationGradeById.set(grd.id, grd);
}

const categoryById = new Map();
const categoryByAlias = new Map();
for (const cat of SUBJECT_CATEGORIES) {
  categoryById.set(cat.id, cat);
  if (cat.aliases) {
    for (const alias of cat.aliases) {
      categoryByAlias.set(alias.toLowerCase().trim(), cat);
    }
  }
}

const streamById = new Map();
for (const st of FRESHMAN_STREAMS) {
  streamById.set(st.id, st);
}

const courseById = new Map();
const courseByAlias = new Map();
for (const crs of FRESHMAN_COURSES) {
  courseById.set(crs.id, crs);
  if (crs.aliases) {
    for (const alias of crs.aliases) {
      courseByAlias.set(alias.toLowerCase().trim(), crs);
    }
  }
}

const aliasByKey = new Map();
for (const [key, val] of Object.entries(ALIASES)) {
  aliasByKey.set(key.toLowerCase().trim(), val);
  if (val.aliases) {
    for (const a of val.aliases) {
      aliasByKey.set(a.toLowerCase().trim(), val);
    }
  }
}

/**
 * Get collection by ID or alias
 */
function getCollection(idOrAlias) {
  if (!idOrAlias || typeof idOrAlias !== "string") return null;
  const normalized = idOrAlias.toLowerCase().trim();
  return collectionById.get(normalized) || collectionByAlias.get(normalized) || null;
}

/**
 * Get education group by ID
 */
function getEducationGroup(id) {
  if (!id || typeof id !== "string") return null;
  return educationGroupById.get(id.toLowerCase().trim()) || null;
}

/**
 * Get education grade by ID
 */
function getEducationGrade(id) {
  if (!id || typeof id !== "string") return null;
  return educationGradeById.get(id.toLowerCase().trim()) || null;
}

/**
 * Get subject category by ID or alias
 */
function getSubjectCategory(idOrAlias) {
  if (!idOrAlias || typeof idOrAlias !== "string") return null;
  const normalized = idOrAlias.toLowerCase().trim();
  return categoryById.get(normalized) || categoryByAlias.get(normalized) || null;
}

/**
 * Get all categories belonging to an education group
 */
function getCategoriesByGroup(groupId) {
  if (!groupId || typeof groupId !== "string") return [];
  const normalized = groupId.toLowerCase().trim();
  return SUBJECT_CATEGORIES.filter(cat => cat.groupId === normalized);
}

/**
 * Get freshman stream by ID
 */
function getFreshmanStream(streamId) {
  if (!streamId || typeof streamId !== "string") return null;
  return streamById.get(streamId.toLowerCase().trim()) || null;
}

/**
 * Get all freshman courses for a stream
 */
function getFreshmanCoursesByStream(streamId) {
  if (!streamId || typeof streamId !== "string") return [];
  const normalized = streamId.toLowerCase().trim();
  const stream = streamById.get(normalized);
  if (!stream) return [];
  return stream.courseIds.map(id => courseById.get(id)).filter(Boolean);
}

/**
 * Get freshman course by ID or alias
 */
function getFreshmanCourse(idOrAlias) {
  if (!idOrAlias || typeof idOrAlias !== "string") return null;
  const normalized = idOrAlias.toLowerCase().trim();
  return courseById.get(normalized) || courseByAlias.get(normalized) || null;
}

/**
 * Resolve an alias or search term to taxonomy target
 */
function resolveAlias(term) {
  if (!term || typeof term !== "string") return null;
  const normalized = term.toLowerCase().trim();
  return aliasByKey.get(normalized) || null;
}

/**
 * Validation helpers
 */
function isValidCollectionId(id) {
  return collectionById.has(id);
}

function isValidCategoryId(id) {
  return categoryById.has(id);
}

function isValidGroupId(id) {
  return educationGroupById.has(id);
}

function isValidStreamId(id) {
  return streamById.has(id);
}

function isValidCourseId(id) {
  return courseById.has(id);
}

module.exports = {
  TAXONOMY: taxonomy,
  COLLECTIONS,
  EDUCATION_GROUPS,
  EDUCATION_GRADES,
  SUBJECT_CATEGORIES,
  FRESHMAN_STREAMS,
  FRESHMAN_COURSES,
  ALIASES,
  getCollection,
  getEducationGroup,
  getEducationGrade,
  getSubjectCategory,
  getCategoriesByGroup,
  getFreshmanStream,
  getFreshmanCoursesByStream,
  getFreshmanCourse,
  resolveAlias,
  isValidCollectionId,
  isValidCategoryId,
  isValidGroupId,
  isValidStreamId,
  isValidCourseId
};
