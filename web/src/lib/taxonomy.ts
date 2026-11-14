/**
 * Centralized Ethiopian Academic Taxonomy for StudyHub Web
 *
 * Imports directly from the single source of truth: src/config/taxonomy.json
 * Provides typed access to collections, categories, education groups,
 * freshman streams, courses, and search aliases.
 */

import rawTaxonomy from "../../../src/config/taxonomy.json";

export interface Collection {
  id: string;
  name: string;
  amharicName?: string;
  description: string;
  aliases: string[];
  documentTypes: string[];
  icon: string;
  displayOrder: number;
  languages?: string[];
  streams?: string[];
  legacyAliases?: string[];
}

export interface EducationGroup {
  id: string;
  name: string;
  amharicName?: string;
  description: string;
  gradeIds: string[];
  categoryIds: string[];
  displayOrder: number;
}

export interface EducationGrade {
  id: string;
  name: string;
  amharicName?: string;
  groupId: string;
  levels?: (string | number)[];
  year?: number | number[];
  note?: string;
}

export interface SubjectCategory {
  id: string;
  name: string;
  amharicName?: string;
  groupId: string;
  icon: string;
  description: string;
  disciplines?: string[];
  departments?: string[];
  aliases: string[];
  keywords: string[];
  displayOrder: number;
}

export interface FreshmanStream {
  id: string;
  name: string;
  amharicName?: string;
  description: string;
  courseIds: string[];
}

export interface UniversityMetadata {
  exampleCourseCodes?: string[];
  note?: string;
  semester?: string | number;
  institutionalVariations?: string;
}

export interface FreshmanCourse {
  id: string;
  name: string;
  code?: string;
  exampleCourseCodes?: string[];
  universityMetadata?: UniversityMetadata;
  streams: string[];
  categoryRef: string;
  aliases: string[];
  canonicalExpansion: string;
  keywords: string[];
  description: string;
}

export interface TaxonomyAlias {
  key: string;
  name: string;
  targetType: "category" | "course" | "collection";
  targetId: string;
  canonicalExpansion: string;
  aliases: string[];
  keywords: string[];
}

export interface TaxonomyData {
  version: string;
  lastUpdated: string;
  title: string;
  description: string;
  meta: {
    totalCollections: number;
    totalEducationGroups: number;
    totalPrimaryCategories: number;
    totalFreshmanStreams: number;
    totalFreshmanCourses: number;
  };
  collections: Collection[];
  educationGroups: EducationGroup[];
  educationGrades: EducationGrade[];
  subjectCategories: SubjectCategory[];
  freshmanStreams: FreshmanStream[];
  freshmanCourses: FreshmanCourse[];
  aliases: Record<string, TaxonomyAlias>;
}

export const TAXONOMY = rawTaxonomy as unknown as TaxonomyData;

export const COLLECTIONS = TAXONOMY.collections;
export const EDUCATION_GROUPS = TAXONOMY.educationGroups;
export const EDUCATION_GRADES = TAXONOMY.educationGrades;
export const SUBJECT_CATEGORIES = TAXONOMY.subjectCategories;
export const FRESHMAN_STREAMS = TAXONOMY.freshmanStreams;
export const FRESHMAN_COURSES = TAXONOMY.freshmanCourses;
export const ALIASES = TAXONOMY.aliases;

// Pre-indexed lookup maps for O(1) lookups
const collectionById = new Map<string, Collection>();
const collectionByAlias = new Map<string, Collection>();
for (const col of COLLECTIONS) {
  collectionById.set(col.id, col);
  for (const alias of col.aliases) {
    collectionByAlias.set(alias.toLowerCase().trim(), col);
  }
}

const educationGroupById = new Map<string, EducationGroup>();
for (const grp of EDUCATION_GROUPS) {
  educationGroupById.set(grp.id, grp);
}

const educationGradeById = new Map<string, EducationGrade>();
for (const grd of EDUCATION_GRADES) {
  educationGradeById.set(grd.id, grd);
}

const categoryById = new Map<string, SubjectCategory>();
const categoryByAlias = new Map<string, SubjectCategory>();
for (const cat of SUBJECT_CATEGORIES) {
  categoryById.set(cat.id, cat);
  if (cat.aliases) {
    for (const alias of cat.aliases) {
      categoryByAlias.set(alias.toLowerCase().trim(), cat);
    }
  }
}

const streamById = new Map<string, FreshmanStream>();
for (const st of FRESHMAN_STREAMS) {
  streamById.set(st.id, st);
}

const courseById = new Map<string, FreshmanCourse>();
const courseByAlias = new Map<string, FreshmanCourse>();
for (const crs of FRESHMAN_COURSES) {
  courseById.set(crs.id, crs);
  if (crs.aliases) {
    for (const alias of crs.aliases) {
      courseByAlias.set(alias.toLowerCase().trim(), crs);
    }
  }
}

const aliasByKey = new Map<string, TaxonomyAlias>();
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
export function getCollection(idOrAlias?: string): Collection | null {
  if (!idOrAlias) return null;
  const normalized = idOrAlias.toLowerCase().trim();
  return collectionById.get(normalized) || collectionByAlias.get(normalized) || null;
}

/**
 * Get education group by ID
 */
export function getEducationGroup(id?: string): EducationGroup | null {
  if (!id) return null;
  return educationGroupById.get(id.toLowerCase().trim()) || null;
}

/**
 * Get education grade by ID
 */
export function getEducationGrade(id?: string): EducationGrade | null {
  if (!id) return null;
  return educationGradeById.get(id.toLowerCase().trim()) || null;
}

/**
 * Get subject category by ID or alias
 */
export function getSubjectCategory(idOrAlias?: string): SubjectCategory | null {
  if (!idOrAlias) return null;
  const normalized = idOrAlias.toLowerCase().trim();
  return categoryById.get(normalized) || categoryByAlias.get(normalized) || null;
}

/**
 * Get all categories belonging to an education group
 */
export function getCategoriesByGroup(groupId?: string): SubjectCategory[] {
  if (!groupId) return [];
  const normalized = groupId.toLowerCase().trim();
  return SUBJECT_CATEGORIES.filter(cat => cat.groupId === normalized);
}

/**
 * Get freshman stream by ID
 */
export function getFreshmanStream(streamId?: string): FreshmanStream | null {
  if (!streamId) return null;
  return streamById.get(streamId.toLowerCase().trim()) || null;
}

/**
 * Get all freshman courses for a stream
 */
export function getFreshmanCoursesByStream(streamId?: string): FreshmanCourse[] {
  if (!streamId) return [];
  const normalized = streamId.toLowerCase().trim();
  const stream = streamById.get(normalized);
  if (!stream) return [];
  return stream.courseIds.map(id => courseById.get(id)).filter((c): c is FreshmanCourse => !!c);
}

/**
 * Get freshman course by ID or alias
 */
export function getFreshmanCourse(idOrAlias?: string): FreshmanCourse | null {
  if (!idOrAlias) return null;
  const normalized = idOrAlias.toLowerCase().trim();
  return courseById.get(normalized) || courseByAlias.get(normalized) || null;
}

/**
 * Resolve an alias or search term to taxonomy target
 */
export function resolveAlias(term?: string): TaxonomyAlias | null {
  if (!term) return null;
  const normalized = term.toLowerCase().trim();
  return aliasByKey.get(normalized) || null;
}
