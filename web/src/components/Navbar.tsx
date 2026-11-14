"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Menu, X, Send, Megaphone } from "lucide-react";
import { useTelegram } from "./TelegramProvider";

export default function Navbar() {
  const pathname = usePathname();
  const { isInsideTelegram, triggerHaptic } = useTelegram();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("studyhub-theme") as "light" | "dark" | null;
    const initialTheme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = () => {
    triggerHaptic?.("light");
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("studyhub-theme", nextTheme);
  };

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot";

  return (
    <header className="topbar">
      <div className="container nav">
        {/* Brand Lockup */}
        <Link className="brand" href="/">
          <img src="/assets/logo.svg" alt="StudyHub Mark" />
          <span>
            Study<span>Hub</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="navlinks">
          <Link className={isActive("/") ? "active" : ""} href="/">
            Home
          </Link>
          <Link className={isActive("/explore") ? "active" : ""} href="/explore">
            Explore
          </Link>
          <Link className={isActive("/subjects") ? "active" : ""} href="/subjects">
            Subjects
          </Link>
          <Link className={isActive("/help") ? "active" : ""} href="/help">
            Help
          </Link>
          <Link className={isActive("/about") ? "active" : ""} href="/about">
            About
          </Link>
        </nav>

        {/* Actions */}
        <div className="navactions">
          {!isInsideTelegram && (
            <div className="nav-community-group">
              <a
                className="nav-channel-pill"
                href="https://t.me/studyhub_et"
                target="_blank"
                rel="noreferrer"
                title="Official Telegram Broadcast Channel (@studyhub_et)"
              >
                <Megaphone size={13} />
                <span>Channel</span>
              </a>
              <a
                className="btn btn-primary nav-bot-cta"
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                title="Telegram Bot (@studyhub_resource_bot)"
              >
                <Send size={14} />
                <span>Open Bot</span>
              </a>
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted && theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            className="btn btn-ghost mobile-menu"
            onClick={() => {
              triggerHaptic?.("light");
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <nav className={`mobile-nav ${mobileMenuOpen ? "open" : ""}`}>
        <Link
          className={isActive("/") ? "active" : ""}
          href="/"
          onClick={() => setMobileMenuOpen(false)}
        >
          Home
        </Link>
        <Link
          className={isActive("/explore") ? "active" : ""}
          href="/explore"
          onClick={() => setMobileMenuOpen(false)}
        >
          Explore
        </Link>
        <Link
          className={isActive("/subjects") ? "active" : ""}
          href="/subjects"
          onClick={() => setMobileMenuOpen(false)}
        >
          Subjects
        </Link>
        <Link
          className={isActive("/help") ? "active" : ""}
          href="/help"
          onClick={() => setMobileMenuOpen(false)}
        >
          Help
        </Link>
        <Link
          className={isActive("/about") ? "active" : ""}
          href="/about"
          onClick={() => setMobileMenuOpen(false)}
        >
          About
        </Link>
        {!isInsideTelegram && (
          <div className="mobile-ecosystem-section">
            <span className="mobile-ecosystem-label">TELEGRAM COMMUNITY</span>
            <div className="mobile-ecosystem-grid">
              <a
                className="mobile-ecosystem-card bot"
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-ecosystem-icon bot">
                  <Send size={16} />
                </div>
                <div className="mobile-ecosystem-text">
                  <strong>Telegram Bot</strong>
                  <small>Instant file delivery &amp; search</small>
                </div>
              </a>
              <a
                className="mobile-ecosystem-card channel"
                href="https://t.me/studyhub_et"
                target="_blank"
                rel="noreferrer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="mobile-ecosystem-icon channel">
                  <Megaphone size={16} />
                </div>
                <div className="mobile-ecosystem-text">
                  <strong>Official Channel</strong>
                  <small>Exam alerts &amp; announcements</small>
                </div>
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
