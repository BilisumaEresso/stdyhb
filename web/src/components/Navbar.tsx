"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("studyhub-theme") as "light" | "dark" | null;
    const initialTheme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = () => {
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

  return (
    <header className="topbar">
      <div className="container nav">
        <Link className="brand" href="/">
          <img src="/assets/logo.svg" alt="StudyHub Logo" />
          <span>
            Study<span>Hub</span>
          </span>
        </Link>

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
          <Link className={isActive("/about") ? "active" : ""} href="/about">
            About
          </Link>
        </nav>

        <div className="navactions">
          <a
            className="btn btn-primary"
            href="https://t.me/studyhub_resource_bot"
            target="_blank"
            rel="noreferrer"
          >
            ➤ &nbsp; Open Bot
          </a>
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button
            className="btn btn-ghost mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </div>

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
          className={isActive("/about") ? "active" : ""}
          href="/about"
          onClick={() => setMobileMenuOpen(false)}
        >
          About
        </Link>
        <a
          href="https://t.me/studyhub_resource_bot"
          target="_blank"
          rel="noreferrer"
          onClick={() => setMobileMenuOpen(false)}
        >
          Open Bot ↗
        </a>
      </nav>
    </header>
  );
}
