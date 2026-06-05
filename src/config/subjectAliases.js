/**
 * Subject aliases for Ethiopian university courses
 * Maps common course terms to standard keywords
 */

const SUBJECT_ALIASES = {
  dbms: {
    aliases: [
      "database systems",
      "database management system",
      "database management systems",
      "database",
      "dbms",
      "db",
    ],
    keywords: [
      "sql",
      "normalization",
      "erd",
      "entity relationship",
      "query",
      "transaction",
      "schema",
      "mongodb",
      "mysql",
      "postgresql",
      "oracle",
    ],
    typos: ["dbsm", "databse", "datbase"],
  },

  dsa: {
    aliases: [
      "data structures",
      "data structure and algorithm",
      "algorithms",
      "dsa",
    ],
    keywords: [
      "sorting",
      "searching",
      "linked list",
      "stack",
      "queue",
      "tree",
      "graph",
      "heap",
      "hashing",
      "dynamic programming",
    ],
    typos: ["algorthm", "algoritm", "dtaa structures"],
  },

  oop: {
    aliases: ["object oriented programming", "oop", "oop1", "oop2"],
    keywords: [
      "inheritance",
      "polymorphism",
      "encapsulation",
      "abstraction",
      "class",
      "object",
      "java programming",
      "c++ oop",
    ],
    typos: ["obect oriented", "ooop"],
  },

  os: {
    aliases: ["operating system", "operating systems", "os"],
    keywords: [
      "process",
      "thread",
      "cpu scheduling",
      "deadlock",
      "memory management",
      "paging",
      "semaphore",
      "synchronization",
    ],
    typos: ["oprating system", "operatig system"],
  },

  cn: {
    aliases: ["computer network", "computer networks", "networking", "cn"],
    keywords: [
      "tcp/ip",
      "osi",
      "routing",
      "switching",
      "subnetting",
      "network security",
      "protocol",
    ],
    typos: ["networkng", "copmuter network"],
  },

  se: {
    aliases: ["software engineering", "software eng", "se"],
    keywords: [
      "requirements engineering",
      "uml",
      "design patterns",
      "agile",
      "waterfall",
      "testing",
      "maintenance",
    ],
    typos: ["sofware engineering"],
  },

  web: {
    aliases: [
      "web development",
      "web programming",
      "internet programming",
      "web",
    ],
    keywords: [
      "html",
      "css",
      "javascript",
      "react",
      "nodejs",
      "express",
      "php",
      "mern",
    ],
    typos: ["javscript", "htlm", "csss"],
  },

  ml: {
    aliases: [
      "machine learning",
      "artificial intelligence",
      "deep learning",
      "ml",
      "ai",
    ],
    keywords: [
      "neural network",
      "regression",
      "classification",
      "supervised learning",
      "unsupervised learning",
      "tensorflow",
      "pytorch",
    ],
    typos: ["machin learning", "artifical intelligence"],
  },

  compiler: {
    aliases: ["compiler", "compiler design", "compilers"],
    keywords: [
      "lexical analysis",
      "syntax analysis",
      "semantic analysis",
      "parsing",
      "code generation",
    ],
    typos: ["compilor"],
  },

  calculus: {
    aliases: ["calculus", "engineering mathematics", "applied mathematics"],
    keywords: [
      "limits",
      "derivatives",
      "integration",
      "differentiation",
      "partial derivative",
    ],
    typos: ["calclus"],
  },

  algebra: {
    aliases: ["linear algebra", "algebra"],
    keywords: ["matrix", "vector", "eigenvalue", "linear equations"],
    typos: ["algbera"],
  },

  physics: {
    aliases: ["physics", "engineering physics"],
    keywords: ["mechanics", "electricity", "magnetism", "thermodynamics"],
    typos: ["physcs"],
  },

  chemistry: {
    aliases: ["chemistry", "engineering chemistry"],
    keywords: ["organic chemistry", "inorganic chemistry", "chemical bonding"],
    typos: ["chemestry"],
  },

  math: {
    aliases: ["mathematics", "math", "engineering math"],
    keywords: [
      "probability",
      "statistics",
      "discrete mathematics",
      "numerical methods",
    ],
    typos: ["mathematics"],
  },

  cn_lab: {
    aliases: ["computer network lab", "network lab"],
    keywords: ["packet tracer", "cisco", "wireshark"],
    typos: [],
  },
};

module.exports = SUBJECT_ALIASES;

/**
 * Expand query with subject aliases
 * Input: "dbms exam"
 * Output: "dbms OR database systems OR database management system exam"
 */
function expandQuery(query) {
  let expanded = query;
  let appliedAliases = [];

  for (const [subject, subjectData] of Object.entries(SUBJECT_ALIASES)) {
    const lowerQuery = query.toLowerCase();
    const aliases = subjectData.aliases;

    // Check if any alias appears in query
    for (const alias of aliases) {
      if (lowerQuery.includes(alias.toLowerCase())) {
        // Replace with: "alias OR all_alternatives"
        const orPhrase = [alias, ...aliases].join(" OR ");
        expanded = expanded.replace(new RegExp(alias, "gi"), `(${orPhrase})`);
        appliedAliases.push(subject);
        break;
      }
    }
  }

  return {
    original: query,
    expanded,
    appliedAliases: [...new Set(appliedAliases)],
  };
}

module.exports = {
  SUBJECT_ALIASES,
  expandQuery,
};
