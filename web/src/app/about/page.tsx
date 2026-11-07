import Link from "next/link";

export default function AboutPage() {
  return (
    <main>
      <section className="page-hero container">
        <span className="eyebrow">
          <i className="dot"></i> About StudyHub
        </span>
        <h1>
          Less searching.
          <br />
          <span className="accent">More learning.</span>
        </h1>
        <p>
          StudyHub helps Ethiopian university students discover academic resources from the
          communities and channels where students already share knowledge.
        </p>
      </section>

      <section className="container section">
        <div className="about-grid">
          <div>
            <h2>
              Academic resources, <span className="accent">within reach.</span>
            </h2>
            <p className="muted">
              Finding the right lecture note or past exam can take hours across disorganized chat
              groups. StudyHub brings resource discovery into one focused experience, so students can
              spend less time searching and more time understanding.
            </p>
            <p className="muted">
              Search by subject, topic, course code, or resource type. Explore useful materials and
              continue your study journey through a simple interface connected directly to Telegram.
            </p>
            <Link className="btn btn-primary" href="/explore" style={{ marginTop: "12px" }}>
              Explore the library&nbsp; →
            </Link>
          </div>

          <div className="about-visual">
            <img src="/assets/hero-illustration.svg" alt="Study materials illustration" />
          </div>
        </div>

        <div className="value-grid">
          <div className="value-card">
            <div className="stat-icon">⌕</div>
            <h3>Discover faster</h3>
            <p className="muted">
              A single place to search across 80,000+ academic resource collections from top Ethiopian
              universities.
            </p>
          </div>

          <div className="value-card">
            <div className="stat-icon">▤</div>
            <h3>Organized learning</h3>
            <p className="muted">
              Browse materials through structured subjects, exam groupings, and familiar resource types.
            </p>
          </div>

          <div className="value-card">
            <div className="stat-icon">➤</div>
            <h3>Telegram connected</h3>
            <p className="muted">
              Seamlessly bridge web search with 1-tap delivery straight to your Telegram via{" "}
              <strong>@studyhub_resource_bot</strong>.
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta">
          <div>
            <h2>Ready to find your next resource?</h2>
            <p>Start exploring the StudyHub resource library today.</p>
          </div>
          <Link className="btn" href="/explore">
            Explore resources&nbsp; →
          </Link>
        </div>
      </section>
    </main>
  );
}
