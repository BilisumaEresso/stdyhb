import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" href="/">
              <img src="/assets/logo.svg" alt="StudyHub logo" />
              <span>
                Study<span>Hub</span>
              </span>
            </Link>
            <p style={{ maxWidth: "290px", marginTop: "15px" }}>
              A simpler way for Ethiopian students to discover academic resources and keep learning.
            </p>
          </div>

          <div>
            <h4>Explore</h4>
            <div className="footer-links">
              <Link href="/explore">All resources</Link>
              <Link href="/subjects">Subjects</Link>
              <Link href="/explore?filter=exam">Past exams</Link>
            </div>
          </div>

          <div>
            <h4>StudyHub</h4>
            <div className="footer-links">
              <Link href="/about">About</Link>
              <a href="https://t.me/studyhub_resource_bot" target="_blank" rel="noreferrer">
                Telegram bot
              </a>
            </div>
          </div>

          <div>
            <h4>Resources</h4>
            <div className="footer-links">
              <Link href="/explore?type=pdf">Lecture notes</Link>
              <Link href="/explore?type=ppt">Presentations</Link>
              <Link href="/explore?type=doc">Documents</Link>
            </div>
          </div>
        </div>

        <div className="copyright">
          <span>© 2026 StudyHub. Built for curious minds.</span>
          <span>Learn smarter. Move forward.</span>
        </div>
      </div>
    </footer>
  );
}
