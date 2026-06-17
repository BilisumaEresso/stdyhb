/**
 * Subject aliases for Ethiopian university courses
 * Maps common course terms to standard keywords
 */

const SUBJECT_ALIASES = {
  // Engineering & Technology
  dsa: { aliases: ["data structures", "data structure and algorithm", "algorithms", "data structures and algorithms", "dsa"], keywords: ["array", "linked list", "stack", "queue", "tree", "graph", "sorting", "searching", "recursion", "dynamic programming"], typos: ["dtaa structures", "algorthm", "datastructure"] },
  os: { aliases: ["operating system", "operating systems", "os"], keywords: ["process", "thread", "scheduling", "deadlock", "memory management", "virtual memory", "paging", "file system", "interrupt", "synchronization"], typos: ["opearting system", "operatng system", "oss"] },
  cn: { aliases: ["computer network", "computer networks", "networking", "cn"], keywords: ["osi", "tcp/ip", "routing", "switching", "ip address", "subnetting", "protocol", "lan", "wan", "dns"], typos: ["computer netwrok", "cnn", "networks"] },
  dbms: { aliases: ["database", "database systems", "dbms", "database management system"], keywords: ["sql", "relation", "normalization", "entity", "primary key", "foreign key", "transaction", "join", "index", "er diagram"], typos: ["dbsm", "databse", "data base"] },
  se: { aliases: ["software engineering", "software development", "se"], keywords: ["sdlc", "requirements", "design", "testing", "maintenance", "uml", "agile", "scrum", "case study", "version control"], typos: ["softwere engineering", "software enginering", "sew"] },
  coa: { aliases: ["computer organization", "computer architecture", "architecture and organization", "coa"], keywords: ["cpu", "memory hierarchy", "instruction set", "pipeline", "cache", "register", "control unit", "alu", "bus", "assembly"], typos: ["computer archtecture", "coa", "computer organzation"] },
  java: { aliases: ["java programming", "object oriented programming in java", "oop java", "java"], keywords: ["class", "object", "inheritance", "polymorphism", "interface", "exception", "thread", "collection", "lambda", "jdbc"], typos: ["jvaa", "jav programming", "javaa"] },
  cpp: { aliases: ["c++", "cpp", "c plus plus", "object oriented programming"], keywords: ["class", "object", "pointer", "reference", "inheritance", "polymorphism", "template", "constructor", "destructor", "file handling"], typos: ["c pluspl us", "c+++", "cp"] },
  python: { aliases: ["python programming", "python", "intro to python"], keywords: ["variable", "list", "dictionary", "function", "loop", "module", "object", "file", "exception", "data analysis"], typos: ["pyhton", "pythn", "pythong"] },
  webdev: { aliases: ["web development", "web programming", "internet programming", "front end"], keywords: ["html", "css", "javascript", "dom", "ajax", "bootstrap", "responsive", "api", "form", "client server"], typos: ["web devolpment", "webdev", "we development"] },
  c: { aliases: ["c programming", "programming in c", "structured programming"], keywords: ["variable", "pointer", "array", "function", "loop", "struct", "file handling", "memory", "recursion", "header file"], typos: ["c prograaming", "prog in c", "cc programming"] },
  math1: { aliases: ["engineering mathematics", "calculus", "math i", "math 1"], keywords: ["limits", "derivative", "integral", "matrix", "vector", "series", "differential equation", "trigonometry", "function", "complex number"], typos: ["calclus", "maths 1", "eng math"] },
  statics: { aliases: ["engineering mechanics", "statics", "mechanics i"], keywords: ["force", "moment", "equilibrium", "free body diagram", "friction", "center of gravity", "truss", "beam", "couple", "resultant"], typos: ["staitcs", "static", "mechnics"] },
  dynamics: { aliases: ["mechanics ii", "dynamics", "engineering dynamics"], keywords: ["velocity", "acceleration", "kinematics", "kinetics", "work energy", "momentum", "rotation", "particle", "rigid body", "impulse"], typos: ["dynimics", "dynamcis", "mechanicss"] },
  mechanics: { aliases: ["mechanics of materials", "strength of materials", "solid mechanics"], keywords: ["stress", "strain", "torsion", "bending", "shear force", "beam deflection", "column", "elasticity", "compression", "modulus"], typos: ["mechnics of materials", "strengh of materials", "solid mechnics"] },
  thermo: { aliases: ["thermodynamics", "engineering thermodynamics", "thermo"], keywords: ["system", "property", "energy", "enthalpy", "entropy", "heat", "work", "cycle", "steam table", "refrigeration"], typos: ["thermodinamics", "thermodyanamics", "thermo dynamics"] },
  fluid: { aliases: ["fluid mechanics", "fluid dynamics", "hydraulics"], keywords: ["pressure", "flow", "continuity", "bernoulli", "reynolds", "pipe flow", "viscosity", "pump", "turbulence", "boundary layer"], typos: ["flud mechanics", "fluid mechnaics", "hydralics"] },
  materials: { aliases: ["engineering materials", "materials science", "material science"], keywords: ["metal", "polymer", "ceramic", "composite", "phase diagram", "heat treatment", "crystal", "hardness", "fatigue", "creep"], typos: ["materails", "materials science", "eng materials"] },
  survey: { aliases: ["surveying", "basic surveying", "land surveying"], keywords: ["leveling", "bearing", "distance", "theodolite", "total station", "traverse", "contour", "map", "benchmark", "coordinate"], typos: ["surveing", "surveyiing", "land survery"] },
  geotech: { aliases: ["geotechnical engineering", "soil mechanics", "geology for engineers"], keywords: ["soil", "compaction", "permeability", "bearing capacity", "consolidation", "shear strength", "foundation", "earth pressure", "settlement", "slope stability"], typos: ["geotechinical", "soil mechnics", "geotecnical"] },
  rcc: { aliases: ["reinforced concrete", "rc design", "concrete structures"], keywords: ["beam", "slab", "column", "reinforcement", "load", "shear", "moment", "deflection", "development length", "bond"], typos: ["reinfoirced concrete", "rc desgin", "concret structures"] },
  steel: { aliases: ["steel structure", "steel design", "metal structures"], keywords: ["tension", "compression", "buckling", "connection", "weld", "bolt", "truss", "frame", "beam", "section"], typos: ["stel structure", "steel desgign", "metal structre"] },
  transport: { aliases: ["transportation engineering", "highway engineering", "road engineering"], keywords: ["traffic", "pavement", "intersection", "capacity", "alignment", "subgrade", "bitumen", "drainage", "road design", "signal"], typos: ["transporation", "high way engineering", "road enginering"] },
  autoCAD: { aliases: ["autocad", "cad", "computer aided design", "drawing"], keywords: ["2d", "3d", "dimension", "layer", "block", "scale", "section", "elevation", "plan", "plot"], typos: ["autocad", "auto cad", "cadd"] },
  archi: { aliases: ["architecture", "architectural design", "architectural engineering"], keywords: ["space", "form", "site", "plan", "section", "elevation", "rendering", "lighting", "structure", "circulation"], typos: ["archtecture", "architcture", "archi design"] },
  cim: { aliases: ["construction management", "construction engineering and management", "cim"], keywords: ["project", "estimate", "schedule", "bidding", "contract", "planning", "resource", "risk", "cost control", "site management"], typos: ["constrction management", "constuction", "c & m"] },
  chemE: { aliases: ["chemical engineering", "process engineering", "chem eng"], keywords: ["mass balance", "heat transfer", "reactor", "distillation", "separation", "thermodynamics", "fluid flow", "process control", "reaction engineering", "unit operation"], typos: ["chemcal engineering", "chemical enginering", "chem engg"] },
  biomed: { aliases: ["biomedical engineering", "medical engineering", "biomed"], keywords: ["biomechanics", "biosignal", "medical device", "imaging", "sensor", "prosthetics", "physiology", "instrumentation", "repair", "biomaterial"], typos: ["biomedikal", "biomedical eng", "medcial engineering"] },
  elec: { aliases: ["electrical engineering", "electrical", "power engineering"], keywords: ["circuit", "voltage", "current", "resistance", "power", "transformer", "motor", "generator", "control", "electromagnet"], typos: ["electrcal", "eletrical", "electrc"] },
  electronics: { aliases: ["electronics engineering", "electronic devices", "analog electronics"], keywords: ["diode", "transistor", "amplifier", "oscillator", "rectifier", "feedback", "signal", "filter", "op amp", "biasing"], typos: ["electornics", "eletronics", "analog elec"] },
  power: { aliases: ["power systems", "electrical power systems", "power engineering"], keywords: ["generation", "transmission", "distribution", "load flow", "fault", "protection", "switchgear", "substation", "relay", "stability"], typos: ["pwer systems", "power sytem", "electrical pwer"] },
  control: { aliases: ["control systems", "automatic control", "instrumentation and control"], keywords: ["feedback", "transfer function", "stability", "root locus", "bode", "pid", "state space", "sensor", "controller", "response"], typos: ["contol systems", "control sytems", "auto control"] },
  comms: { aliases: ["communication systems", "telecommunication", "signal processing"], keywords: ["modulation", "demodulation", "bandwidth", "sampling", "noise", "antenna", "carrier", "encoding", "digital signal", "filter"], typos: ["commication", "telecomunication", "comms systems"] },
  process: { aliases: ["process control", "process dynamics", "instrumentation"], keywords: ["pid", "feedback", "transmitter", "controller", "stability", "process variable", "set point", "loop", "sensor", "actuator"], typos: ["proccess control", "process contorl", "instrumetation"] },

  // Computer Science & IT
  introprog: { aliases: ["introduction to programming", "programming basics", "intro programming"], keywords: ["algorithm", "variable", "condition", "loop", "array", "function", "debugging", "pseudocode", "flowchart", "problem solving"], typos: ["intoduction programming", "intrro to programming", "programing basics"] },
  algo: { aliases: ["algorithms", "design and analysis of algorithms", "algorithm design"], keywords: ["greedy", "divide and conquer", "dynamic programming", "complexity", "recurrence", "backtracking", "graph algorithm", "sorting", "searching", "amortized"], typos: ["algoritms", "algorthms", "algorythm"] },
  dld: { aliases: ["digital logic design", "digital electronics", "logic design"], keywords: ["gate", "boolean", "k map", "flip flop", "counter", "register", "combinational", "sequential", "multiplexer", "decoder"], typos: ["digtal logic", "digital logics", "logic desgign"] },
  compnet: { aliases: ["computer networks", "networking", "data communications"], keywords: ["osi", "tcp", "udp", "ip", "routing", "switching", "subnetting", "protocol", "dns", "socket"], typos: ["computer netwroks", "networing", "comp network"] },
  rm: { aliases: ["research methods", "research methodology", "research writing"], keywords: ["hypothesis", "sampling", "questionnaire", "analysis", "citation", "proposal", "methodology", "validity", "reliability", "literature review"], typos: ["reseach methods", "research methedology", "rmethod"] },
  infoSec: { aliases: ["information security", "computer security", "cyber security", "infosec"], keywords: ["confidentiality", "integrity", "authentication", "encryption", "access control", "malware", "firewall", "attack", "risk", "vulnerability"], typos: ["informtion security", "cybersecurty", "infosec"] },
  ai: { aliases: ["artificial intelligence", "ai", "intelligent systems"], keywords: ["search", "heuristic", "expert system", "agent", "knowledge representation", "reasoning", "planning", "inference", "machine learning", "decision"], typos: ["artifical intelligence", "arti intelligence", "a.i"] },
  ml: { aliases: ["machine learning", "ml", "data mining basics"], keywords: ["classification", "regression", "clustering", "feature", "training", "testing", "overfitting", "model", "neural network", "prediction"], typos: ["machin learning", "mchine learning", "mling"] },
  web: { aliases: ["web technology", "web programming", "internet technology"], keywords: ["html", "css", "javascript", "server", "client", "api", "dom", "framework", "session", "cookie"], typos: ["web technolgy", "web progamming", "weeb"] },
  mobile: { aliases: ["mobile app development", "android development", "mobile programming"], keywords: ["activity", "fragment", "intent", "layout", "service", "permission", "database", "ui", "api", "notification"], typos: ["moblie development", "android dev", "mobile app dev"] },
  sqa: { aliases: ["software quality assurance", "software testing", "qa"], keywords: ["test case", "test plan", "unit test", "integration test", "system test", "validation", "verification", "bug", "defect", "automation"], typos: ["softwre quality", "software testng", "sqa"] },
  hci: { aliases: ["human computer interaction", "ui ux", "user interface design"], keywords: ["usability", "interface", "interaction", "prototype", "user experience", "accessibility", "evaluation", "wireframe", "feedback", "design"], typos: ["human compueter", "hcii", "uiux"] },
  se2: { aliases: ["advanced software engineering", "software project management"], keywords: ["agile", "scrum", "risk management", "estimation", "architecture", "refactoring", "devops", "testing", "deployment", "teamwork"], typos: ["softwere project", "software eng", "sw engineering"] },

  // Health & Medical Sciences
  anat: { aliases: ["anatomy", "human anatomy"], keywords: ["bone", "muscle", "nerve", "organ", "thorax", "abdomen", "limb", "joint", "brain", "circulation"], typos: ["anatamy", "ananatomy", "human anat"], },
  physio: { aliases: ["physiology", "human physiology"], keywords: ["homeostasis", "cell", "nerve impulse", "muscle contraction", "heart", "respiration", "renal", "endocrine", "digestive", "reproduction"], typos: ["physiologe", "phisiology", "human physio"] },
  biochem: { aliases: ["biochemistry", "medical biochemistry"], keywords: ["protein", "enzyme", "carbohydrate", "lipid", "metabolism", "dna", "rna", "vitamin", "hormone", "acid base"], typos: ["biochemestry", "bio chemistry", "biochemisry"] },
  micro: { aliases: ["microbiology", "medical microbiology"], keywords: ["bacteria", "virus", "fungi", "parasite", "sterilization", "culture", "infection", "immunity", "pathogen", "antibiotic"], typos: ["microbology", "micrbiology", "medical micro"] },
  patho: { aliases: ["pathology", "general pathology"], keywords: ["inflammation", "necrosis", "tumor", "edema", "healing", "cell injury", "biopsy", "lesion", "cancer", "disease"], typos: ["patholgy", "pathalogy", "patho"] },
  pharma: { aliases: ["pharmacology", "pharmacy", "drug study"], keywords: ["drug", "dose", "adverse effect", "mechanism", "absorption", "metabolism", "receptor", "interaction", "toxicity", "antibiotic"], typos: ["pharmocology", "pharamcy", "pharma"] },
  medsurg: { aliases: ["medical surgical nursing", "med surg", "adult health nursing"], keywords: ["assessment", "intervention", "postoperative", "pain", "wound", "infection", "care plan", "vital sign", "diagnosis", "rehabilitation"], typos: ["med surg nursing", "medical surgcial", "medsug"] },
  maternal: { aliases: ["maternal and child health", "obstetrics", "midwifery"], keywords: ["pregnancy", "labor", "delivery", "antenatal", "postnatal", "newborn", "fetal", "complication", "family planning", "breastfeeding"], typos: ["maternal health", "matenal and child", "obstrics"] },
  peds: { aliases: ["pediatrics", "child health", "pediatric nursing"], keywords: ["growth", "development", "vaccination", "nutrition", "fever", "dehydration", "respiratory", "infection", "child care", "immunization"], typos: ["pediatrics", "pedatric", "child helath"] },
  psych: { aliases: ["psychiatry", "mental health", "mental illness"], keywords: ["depression", "anxiety", "schizophrenia", "counseling", "behavior", "stress", "therapy", "diagnosis", "substance use", "mental status"], typos: ["psyciatry", "psychaitry", "mental helath"] },
  community: { aliases: ["community health", "public health nursing", "community medicine"], keywords: ["prevention", "promotion", "epidemiology", "screening", "sanitation", "immunization", "health education", "outbreak", "survey", "care"], typos: ["commmunity health", "public helath", "community medcine"] },
  epi: { aliases: ["epidemiology", "biostatistics and epidemiology"], keywords: ["incidence", "prevalence", "risk", "outbreak", "cohort", "case control", "surveillance", "determinant", "study design", "bias"], typos: ["epidemology", "epidimeology", "epi"] },
  nutrition: { aliases: ["human nutrition", "diet and nutrition"], keywords: ["diet", "macro nutrient", "micro nutrient", "energy", "malnutrition", "digestion", "growth", "food safety", "supplement", "assessment"], typos: ["nutriton", "human nutriton", "nutritionn"] },
  nursingfund: { aliases: ["fundamentals of nursing", "basic nursing", "nursing fundamentals"], keywords: ["infection control", "bed making", "vital sign", "hygiene", "assessment", "documentation", "medication", "patient care", "safety", "communication"], typos: ["fundementals nursing", "basic nusing", "nursing fund"] },

  // Business & Economics
  acc101: { aliases: ["accounting", "principles of accounting", "financial accounting"], keywords: ["debit", "credit", "journal", "ledger", "trial balance", "income statement", "balance sheet", "cash flow", "asset", "liability"], typos: ["accountng", "accouting", "finacial accounting"] },
  costacct: { aliases: ["cost accounting", "management accounting", "managerial accounting"], keywords: ["cost", "budget", "variance", "break even", "overhead", "standard costing", "marginal cost", "absorption", "inventory", "decision"], typos: ["cost accountng", "managment accounting", "cost acc"] },
  audit: { aliases: ["auditing", "audit practice", "external audit"], keywords: ["evidence", "risk", "control", "materiality", "sampling", "report", "assertion", "fraud", "internal control", "opinion"], typos: ["auditting", "audt", "auditng"] },
  finance: { aliases: ["corporate finance", "financial management", "finance"], keywords: ["capital", "investment", "risk", "return", "dividend", "valuation", "working capital", "leverage", "budget", "cost of capital"], typos: ["finace", "finanse", "financial managment"] },
  econ1: { aliases: ["economics", "intro to economics", "microeconomics"], keywords: ["demand", "supply", "elasticity", "utility", "market", "consumer", "production", "cost", "equilibrium", "price"], typos: ["economicss", "ecomics", "micro economcs"] },
  macro: { aliases: ["macroeconomics", "macro economics"], keywords: ["gdp", "inflation", "unemployment", "money supply", "fiscal policy", "monetary policy", "growth", "exchange rate", "aggregate demand", "business cycle"], typos: ["macroeconmics", "macroecomics", "macro economicss"] },
  statsbiz: { aliases: ["business statistics", "statistics for business", "applied statistics"], keywords: ["mean", "median", "variance", "probability", "hypothesis", "sampling", "correlation", "regression", "distribution", "test"], typos: ["statisitcs", "busines statistics", "stats"] },
  mgmt: { aliases: ["management", "principles of management", "business management"], keywords: ["planning", "organizing", "leading", "controlling", "motivation", "decision", "strategy", "team", "communication", "organization"], typos: ["managment", "mangment", "business managment"] },
  marketing: { aliases: ["marketing", "principles of marketing", "marketing management"], keywords: ["product", "price", "place", "promotion", "consumer", "segmentation", "brand", "market research", "sales", "distribution"], typos: ["markting", "marketting", "marketingg"] },
  hrm: { aliases: ["human resource management", "hrm", "personnel management"], keywords: ["recruitment", "selection", "training", "performance", "compensation", "motivation", "labor", "policy", "appraisal", "retention"], typos: ["human resourse", "hr mangement", "hrm"] },
  entrepreneurship: { aliases: ["entrepreneurship", "venture creation", "small business"], keywords: ["startup", "opportunity", "innovation", "business plan", "risk", "funding", "market", "customer", "scaling", "pitch"], typos: ["entrepeneurship", "entreprenuership", "entreprenur"] },
  logistics: { aliases: ["logistics", "supply chain management", "procurement"], keywords: ["inventory", "warehouse", "transport", "sourcing", "supplier", "distribution", "forecast", "delivery", "procurement", "chain"], typos: ["logistcs", "supply chain managment", "procument"] },
  econometrics: { aliases: ["econometrics", "economic statistics"], keywords: ["regression", "estimation", "hypothesis", "time series", "panel data", "stochastic", "bias", "forecasting", "model", "causality"], typos: ["econometriks", "econmetrics", "economtrics"] },

  // Natural & Computational Sciences
  calc1: { aliases: ["calculus", "mathematical analysis", "math for science"], keywords: ["limit", "derivative", "integral", "continuity", "function", "chain rule", "mean value", "series", "optimization", "curve"], typos: ["calclus", "calulus", "math calc"] },
  linear: { aliases: ["linear algebra", "matrix algebra", "algebra"], keywords: ["matrix", "vector", "determinant", "eigenvalue", "eigenvector", "basis", "rank", "subspace", "system", "transform"], typos: ["linar algebra", "lineer algebra", "matrix algera"] },
  diffEq: { aliases: ["differential equations", "ode", "partial differential equations"], keywords: ["solution", "order", "linear", "nonlinear", "initial value", "boundary value", "laplace", "separable", "system", "stability"], typos: ["diff eq", "differential equatons", "diffrential"] },
  prob: { aliases: ["probability", "probability and statistics"], keywords: ["event", "random variable", "distribution", "expectation", "variance", "bayes", "conditional", "sample", "estimation", "correlation"], typos: ["probablity", "probbability", "proability"] },
  statmath: { aliases: ["statistics", "mathematical statistics"], keywords: ["mean", "variance", "sampling", "hypothesis", "confidence interval", "distribution", "regression", "anova", "correlation", "test"], typos: ["statstics", "statisics", "stats math"] },
  genphys: { aliases: ["general physics", "physics i", "physics 1"], keywords: ["motion", "force", "energy", "momentum", "gravity", "electricity", "magnetism", "wave", "optics", "thermo"], typos: ["genral physics", "physiscs", "physic 1"] },
  electrmag: { aliases: ["electricity and magnetism", "electromagnetism"], keywords: ["charge", "field", "potential", "capacitance", "current", "magnetic field", "induction", "circuit", "gauss", "faraday"], typos: ["electromag", "electricty magnetism", "electro magnetism"] },
  genchem: { aliases: ["general chemistry", "chemistry i", "chemistry 1"], keywords: ["atom", "bond", "mole", "stoichiometry", "gas", "solution", "acid", "base", "equilibrium", "redox"], typos: ["genral chemistry", "chemestry", "chemistry1"] },
  orgchem: { aliases: ["organic chemistry", "chemistry ii", "organic chem"], keywords: ["hydrocarbon", "functional group", "isomer", "reaction", "alkane", "alkene", "alkyne", "aromatic", "polymer", "spectroscopy"], typos: ["orgnic chemistry", "organik chem", "org chem"] },
  biol: { aliases: ["biology", "general biology", "intro to biology"], keywords: ["cell", "genetics", "evolution", "ecology", "classification", "metabolism", "membrane", "photosynthesis", "respiration", "tissue"], typos: ["biolgy", "biollogy", "general biol"] },
  botany: { aliases: ["plant biology", "botany"], keywords: ["plant cell", "photosynthesis", "transpiration", "root", "stem", "leaf", "flower", "seed", "taxonomy", "reproduction"], typos: ["botnany", "plant biolgy", "botnay"] },
  zoology: { aliases: ["animal biology", "zoology"], keywords: ["animal tissue", "taxonomy", "evolution", "physiology", "reproduction", "vertebrate", "invertebrate", "embryology", "ecology", "behavior"], typos: ["zoolgy", "zoolgoy", "animal biolgy"] },
  ecology: { aliases: ["ecology", "environmental biology"], keywords: ["ecosystem", "population", "community", "food chain", "habitat", "biodiversity", "succession", "conservation", "pollution", "climate"], typos: ["ecolgy", "ecoloy", "environmental ecolgy"] },
  genetics: { aliases: ["genetics", "molecular genetics"], keywords: ["dna", "rna", "gene", "chromosome", "mutation", "inheritance", "genotype", "phenotype", "replication", "transcription"], typos: ["genitics", "genetcs", "geneticss"] },
  statscomp: { aliases: ["statistics for computer science", "computational statistics"], keywords: ["distribution", "sampling", "bayes", "regression", "estimation", "probability", "analysis", "model", "data", "test"], typos: ["statistcs comp", "computational stat", "stats for cs"] },
  numerical: { aliases: ["numerical methods", "numerical analysis"], keywords: ["root finding", "interpolation", "integration", "differentiation", "error", "matrix", "solution", "iteration", "approximation", "algorithm"], typos: ["numerical methd", "numerial methods", "numrical"] },

  // Social Sciences & Humanities
  law101: { aliases: ["law", "introduction to law", "legal studies"], keywords: ["constitution", "contract", "tort", "criminal", "rights", "evidence", "precedent", "jurisdiction", "liability", "justice"], typos: ["laaw", "low", "intro to l aw"] },
  psych101: { aliases: ["psychology", "intro to psychology", "general psychology"], keywords: ["behavior", "personality", "memory", "learning", "motivation", "emotion", "perception", "development", "therapy", "mental"], typos: ["psycology", "psychlogy", "general psy"] },
  social: { aliases: ["sociology", "social science", "intro to sociology"], keywords: ["society", "culture", "class", "family", "deviance", "socialization", "institution", "role", "norm", "change"], typos: ["sociolgy", "socialogy", "social study"] },
  researchSoc: { aliases: ["social research methods", "research methods in social science"], keywords: ["survey", "interview", "sampling", "questionnaire", "observation", "analysis", "methodology", "data", "ethics", "report"], typos: ["reseach soc", "social reasearch", "research methds"] },
  econsoc: { aliases: ["development studies", "social economics", "economy and society"], keywords: ["poverty", "inequality", "development", "policy", "employment", "trade", "institution", "growth", "migration", "rural"], typos: ["devlopment studies", "social economics", "econ soc"] },
  amharic: { aliases: ["amharic", "ethiopian language studies", "amh"], keywords: ["grammar", "vocabulary", "reading", "writing", "essay", "translation", "literature", "pronunciation", "composition", "syntax"], typos: ["amhric", "amahric", "amharic"] },
  english: { aliases: ["english", "english language", "communication english"], keywords: ["grammar", "essay", "reading", "writing", "speaking", "listening", "vocabulary", "summary", "presentation", "report"], typos: ["englsih", "englsh", "englis"] },
  communication: { aliases: ["communication skills", "academic communication", "public speaking"], keywords: ["presentation", "listening", "speaking", "writing", "email", "report", "discussion", "argument", "persuasion", "clarity"], typos: ["communcation", "communicaton", "communiction"] },
  civics: { aliases: ["civics", "citizenship", "ethics and civics"], keywords: ["constitution", "rights", "duties", "citizen", "democracy", "law", "ethics", "state", "governance", "responsibility"], typos: ["civicss", "citzenship", "civic"] },
  anthropology: { aliases: ["anthropology", "cultural anthropology"], keywords: ["culture", "kinship", "ritual", "belief", "society", "identity", "tradition", "ethnicity", "fieldwork", "social"], typos: ["anthropolgy", "anthropologyy", "cultural anthro"] },
  philosophy: { aliases: ["philosophy", "logic and philosophy"], keywords: ["logic", "ethics", "reasoning", "metaphysics", "epistemology", "argument", "truth", "moral", "theory", "critical thinking"], typos: ["philsophy", "filosophy", "philosphy"] },

  // Extra common Ethiopian university search terms
  seminar: { aliases: ["seminar", "seminar course", "senior seminar"], keywords: ["proposal", "review", "presentation", "research", "paper", "defense", "topic", "discussion", "reference", "writing"], typos: ["seminor", "seminaar", "semnar"] },
  internship: { aliases: ["internship", "attachment", "industrial attachment", "practicum"], keywords: ["workplace", "report", "logbook", "supervisor", "experience", "task", "training", "evaluation", "practice", "placement"], typos: ["internsip", "intership", "praticum"] },
  capstone: { aliases: ["capstone project", "project", "senior project", "graduation project"], keywords: ["proposal", "implementation", "testing", "documentation", "presentation", "design", "model", "report", "evaluation", "defense"], typos: ["capston", "capstonee", "project report"] }
};

module.exports = {
  SUBJECT_ALIASES,
  expandQuery,
};

/**
 * Expand query with subject aliases
 * Input: "dbms exam"
 * Output: "dbms OR database systems OR database management system exam"
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expandQuery(query) {
  let expanded = query;
  let appliedAliases = [];

  for (const [subject, subjectData] of Object.entries(SUBJECT_ALIASES)) {
    const lowerQuery = query.toLowerCase();
    const aliases = subjectData.aliases;

    // Check if any alias appears in query
    for (const alias of aliases) {
      const safeAlias = escapeRegExp(alias);
      const aliasRegex = new RegExp(`(^|\\W)${safeAlias}($|\\W)`, "i");
      
      if (aliasRegex.test(lowerQuery)) {
        // Replace with: "alias OR all_alternatives"
        const orPhrase = [alias, ...aliases.filter(a => a !== alias)].join(" OR ");
        expanded = expanded.replace(new RegExp(`(^|\\W)${safeAlias}($|\\W)`, "gi"), `$1(${orPhrase})$2`);
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
