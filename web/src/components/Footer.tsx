import Link from "next/link";
import { Send, ExternalLink } from "lucide-react";

export default function Footer() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot";

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" href="/">
              <img src="/assets/logo.svg" alt="StudyHub Mark" />
              <span>
                Study<span>Hub</span>
              </span>
            </Link>
            <p style={{ maxWidth: "320px", marginTop: "14px", lineHeight: "1.6" }}>
              Empowering Ethiopian university students with instant access to past exams, lecture notes,
              and academic resources indexed from university Telegram communities.
            </p>
          </div>

          <div>
            <h4>Discovery</h4>
            <div className="footer-links">
              <Link href="/explore">All Resources</Link>
              <Link href="/explore?filter=exam">Past Examinations</Link>
              <Link href="/subjects">Subject Directory</Link>
              <Link href="/explore?type=pdf">Curated PDF Bundles</Link>
            </div>
          </div>

          <div>
            <h4>Subjects</h4>
            <div className="footer-links">
              <Link href="/explore?q=Computer%20Science">Computer Science</Link>
              <Link href="/explore?q=Database%20Systems">Database Systems</Link>
              <Link href="/explore?q=Mathematics">Mathematics</Link>
              <Link href="/explore?q=Physics">General Physics</Link>
            </div>
          </div>

          <div>
            <h4>Platform</h4>
            <div className="footer-links">
              <Link href="/about">About StudyHub</Link>
              <Link href="/help">Help & FAQ</Link>
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span>Telegram Bot</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://t.me/studyhub_et"
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span>Official Channel (@studyhub_et)</span>
                <ExternalLink size={12} />
              </a>
              <Link href="/explore">Search Hub</Link>
            </div>
          </div>
        </div>

        <div className="copyright">
          <span>© {new Date().getFullYear()} StudyHub. Built for Ethiopian university students.</span>
          <span>Find what you need. Focus on learning.</span>
        </div>
      </div>
    </footer>
  );
}
