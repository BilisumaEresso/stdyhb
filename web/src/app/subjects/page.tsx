import Link from "next/link";

const ALL_SUBJECTS = [
  {
    title: "Computer Science",
    desc: "Algorithms, data structures, operating systems and core CS courses.",
    icon: "⌘",
    query: "Computer Science",
    count: "Thousands of files",
  },
  {
    title: "Software Engineering",
    desc: "Programming, software design, testing, OOP and development.",
    icon: "⚙",
    query: "Software Engineering",
    count: "Past exams & projects",
  },
  {
    title: "Database Systems",
    desc: "DBMS, SQL, normalization, ER diagrams and data modeling.",
    icon: "▤",
    query: "Database Systems DBMS",
    count: "Lecture slides & labs",
  },
  {
    title: "Computer Networks",
    desc: "Networking concepts, OSI layers, protocols and lab materials.",
    icon: "⌘",
    query: "Computer Networks",
    count: "Manuals & notes",
  },
  {
    title: "Mathematics",
    desc: "Calculus I & II, linear algebra, discrete math, and statistics.",
    icon: "▦",
    query: "Mathematics Calculus",
    count: "Solved problem sets",
  },
  {
    title: "Physics",
    desc: "General physics, mechanics, optics, and midterm exams.",
    icon: "⚛",
    query: "Physics",
    count: "Formula sheets & tests",
  },
  {
    title: "Chemistry",
    desc: "Foundational chemistry notes, lab reports and practice materials.",
    icon: "⌁",
    query: "Chemistry",
    count: "Freshman bundles",
  },
  {
    title: "Information Systems",
    desc: "Systems analysis, enterprise architecture, MIS and IT fundamentals.",
    icon: "⌗",
    query: "Information Systems",
    count: "Course outlines",
  },
  {
    title: "Artificial Intelligence",
    desc: "Machine learning, neural networks, and intelligent agent systems.",
    icon: "◉",
    query: "Artificial Intelligence Machine Learning",
    count: "Slides & code notes",
  },
];

export default function SubjectsPage() {
  return (
    <main>
      <section className="page-hero container">
        <span className="eyebrow">
          <i className="dot"></i> Browse by topic
        </span>
        <h1>
          Choose your <span className="accent">subject.</span>
        </h1>
        <p>
          Start with a subject and find materials related to your courses, from lecture notes to past
          exams.
        </p>
      </section>

      <section className="container section" style={{ paddingTop: "10px" }}>
        <div className="subject-grid">
          {ALL_SUBJECTS.map((subj) => (
            <Link
              key={subj.title}
              className="subject-card"
              href={`/explore?q=${encodeURIComponent(subj.query)}`}
            >
              <div className="subject-icon">{subj.icon}</div>
              <div>
                <h3>{subj.title}</h3>
                <small>{subj.desc}</small>
                <small
                  style={{
                    display: "block",
                    marginTop: "8px",
                    color: "var(--green)",
                    fontWeight: 700,
                  }}
                >
                  {subj.count}
                </small>
              </div>
              <span className="arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta">
          <div>
            <h2>Can't find your course?</h2>
            <p>Search with a course code, topic, or keyword to discover more.</p>
          </div>
          <Link className="btn" href="/explore">
            Search resources&nbsp; →
          </Link>
        </div>
      </section>
    </main>
  );
}
