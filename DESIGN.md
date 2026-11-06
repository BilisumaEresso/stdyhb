# StudyHub Web — Master UI/UX Design Specification & Creative Brief

> **Role & Target Audience of this Document**: This document serves as a production-ready, self-contained Design Specification & Creative Prompt for UI/UX Designers, Design Systems Engineers, and AI UI Generators (v0, Figma, Stitch, Cursor). Treat this brief as the single source of truth for all visual identity, layout architecture, interaction models, and component hierarchies.

---

## 1. Executive Summary & Brand Identity

### 1.1 What is StudyHub?
**StudyHub** is Ethiopia’s largest decentralized academic repository and search engine. Having indexed over **80,000+ university resources** (past midterm & final exams, lecture slide decks, reference textbooks, lab manuals, and handwritten student notes) across major Ethiopian universities (AAU, ASTU, AASTU, Jimma, Hawassa, Bahir Dar, Haramaya, and more), StudyHub bridges the gap between fragmented Telegram channels and high-speed web learning.

### 1.2 Core Brand Pillars
* **Lightning Fast & Bandwidth-Conscious**: Designed for real Ethiopian university campus conditions (dorm Wi-Fi drops, 3G/4G Ethio Telecom/Safaricom data bundles). Zero unnecessary bloat, ultra-light initial paint, skeleton loaders, and intelligent chunking.
* **Academic Precision & Trust**: A clean, distraction-free environment that feels like a blend between **Perplexity AI**, **Notion**, and **Google Scholar**, built specifically for late-night exam cramming and semester-long study.
* **Seamless Telegram Synergy**: StudyHub does not replace Telegram; it elevates it. The design must feel natural whether opened as a standalone desktop website or as an embedded **Telegram Mini App (TMA)** on mobile with 1-tap "Send to Telegram" handoffs.

### 1.3 Design Tone & Mood
* **Keywords**: *Focused, Academic, Sleek, Trustworthy, Snappy, Intuitive.*
* **Atmosphere**: Deep midnight contrast with warm emerald and electric indigo accents. Crisp typography, ample breathing room, subtle micro-borders (1px subtle strokes), and zero visual clutter.

---

## 2. Design Tokens & Visual System

### 2.1 Color Palette

#### Dark Mode (Primary & Default Experience)
*Designed specifically for late-night study sessions in dorms without eye strain.*
* **Background Deep (Canvas)**: `#090D16` (Midnight Void)
* **Surface Card (Elevated 1)**: `#111827` (Card Charcoal)
* **Surface Card Hover (Elevated 2)**: `#1F2937` (Interactive Slate)
* **Border Subdued**: `rgba(255, 255, 255, 0.08)` / `#1E293B`
* **Border Focused**: `rgba(99, 102, 241, 0.4)` (Indigo Halo)

#### Light Mode (Clean Academic Paper)
* **Background Deep (Canvas)**: `#F8FAFC` (Cool Off-White)
* **Surface Card**: `#FFFFFF` (Pure White)
* **Surface Card Hover**: `#F1F5F9` (Muted Mist)
* **Border Subdued**: `#E2E8F0`

#### Accent & Semantic Tones
* **Brand Primary (Electric Indigo)**: `#6366F1` (Actions, primary buttons, active tabs)
* **Brand Secondary (Ethiopian Emerald)**: `#10B981` (Verified badge, exam solutions, active success)
* **Telegram Blue**: `#229ED9` (Telegram integration CTAs, bot handoff pills)
* **Amber Warning**: `#F59E0B` (Midterm/Exam tags, urgent notices)
* **Ruby Coral**: `#EF4444` (Report issue, unavailable status)

#### Typography Scale
* **Font Family (Headings & UI)**: Inter, Plus Jakarta Sans, or Geist Sans
* **Font Family (Monospace / Codes)**: JetBrains Mono or Fira Code (Used for Course Codes: `COE311`, `MATH101`, `CS204`)
* **Scale**:
  * Hero Display: `36px – 48px` / Bold (700)
  * Page Title: `24px – 30px` / Semi-Bold (600)
  * Section Heading: `18px – 20px` / Semi-Bold (600)
  * Body Text: `14px – 16px` / Regular (400)
  * Metadata / Badges / Captions: `12px – 13px` / Medium (500)

---

## 3. Global Information Architecture & Sitemap

```
├── 1. Home / Universal Search Hub (/)
│   ├── Instant Omnibar (Predictive search, keyboard shortcuts Cmd+K)
│   ├── Quick University & Freshman Badges
│   └── Trending Past Exams & Hot Course Topics
├── 2. Search Results & Discovery (/search?q=...)
│   ├── Faceted Filter Sidebar (University, Department, Year, Semester, Doc Type)
│   ├── Resource Result Cards (List & Grid layout toggle)
│   └── Quick Preview Modal / Drawer
├── 3. Exam Bank & Image Gallery (/exam/[groupId])
│   ├── Multi-page Exam Photo Lightbox (High-res zoom, swipeable carousel)
│   ├── Question-by-Question Navigation
│   └── Answer Key & Discussion Thread
├── 4. In-Browser Document Reader (/read/[resourceId])
│   ├── Streaming PDF Viewer (Dark mode toggle, table of contents, zoom)
│   ├── Top Action Bar (Download Original, Send to Telegram Bot, Share Link)
│   └── AI Assistant Drawer (Summarize, Key Formulas, Quiz Me)
├── 5. University & Department Directory (/universities/[slug])
│   └── Dedicated hubs for ASTU, AAU, AASTU, Jimma, etc., broken down by Faculty
└── 6. Telegram Mini App (TMA) Mobile Viewport
    └── Native bottom navigation bar, haptic feedback hooks, zero-scroll headers
```

---

## 4. Detailed Screen Specifications

---

### SCREEN 1: Universal Search & Landing Page (`/`)

#### Purpose
The central entry point. Must deliver instantaneous value within 3 seconds of page load. No marketing fluff—straight to search.

#### Key Sections & Components
1. **Minimalist Top Navigation**:
   * Brand Logo: Minimalist open book icon interlocking with a telegram paper airplane + text `StudyHub`.
   * University Selector Dropdown (e.g., "ASTU", "AAU", "All Universities").
   * Mode Toggle (Dark / Light).
   * "Telegram Bot" Quick-Connect button (Pill style with `@StudyHubBot` label).

2. **The Hero Search Omnibar**:
   * Centered, prominent floating input bar (similar to Raycast / Linear / Perplexity).
   * Placeholder: *"Search 80,000+ past exams, lecture slides, course codes (e.g. 'CS301 final', 'ASTU Calculus II')..."*
   * Leading Icon: Search magnifying glass.
   * Trailing Elements: Keyboard shortcut badge `⌘K` or `Ctrl+K`, voice search or clear icon.
   * **Predictive Dropdown (Auto-suggest)**:
     * Appears on focus. Displays *Recent Searches*, *Top Course Codes* (`MATH101`, `COE322`, `MGMT211`), and *Universities*.

3. **Curriculum Quick Jump Pills**:
   * Horizontal scrollable chips for fast 1-tap filtering:
     * 🎓 `Freshman Year Starter Pack`
     * 📝 `Past Final Exams`
     * ⚡ `ASTU Engineering`
     * 🏛️ `AAU Medical & Health`
     * 💻 `Computer Science & IT`
     * ⚖️ `Law & Social Sciences`

4. **Trending & Recently Uploaded Grid**:
   * Two columns: **"🔥 Trending Exams This Week"** and **"✨ Freshly Indexed Notes"**.
   * Compact card format showing university badge, course code, number of pages, and download counter.

---

### SCREEN 2: Search Results & Filter Catalog (`/search`)

#### Purpose
High-density, structured browsing interface where students find exact exam years, professors' slides, and lab worksheets.

#### Layout
* **Desktop**: 2-Column layout. Left Sidebar (Filters, 280px fixed width), Right Main Content (Results stream).
* **Mobile / TMA**: Sticky top search bar with a horizontal pill slider for quick filters, plus a floating "Filter & Sort" bottom-sheet trigger.

#### Component Breakdown
1. **Faceted Filter Sidebar**:
   * **University**: Checkbox list (ASTU, AAU, AASTU, Jimma, Hawassa, Bahir Dar, etc.) with item counts.
   * **Resource Type**: Pill group with custom icons:
     * 📄 `PDF / Textbooks`
     * 📊 `PowerPoint Slides`
     * 📷 `Exam Photo Sets` (Grouped multi-page photos)
     * 📝 `Word Documents`
   * **Academic Level**: Freshman (1st Year), 2nd Year, 3rd Year, 4th/5th Year.
   * **Exam Category**: Toggle for `Only Past Exams` (Midterms, Finals, Quizzes).
   * **Sort By**: Relevance, Most Downloaded, Newest Date, Year.

2. **Resource Card Specification (Crucial Component)**:
   * **Card Header**:
     * File Type Icon badge (e.g., Red for PDF, Orange for PPT, Blue for Image Set).
     * Course Code pill (`[SE3201]`) in monospace font.
     * University Badge (`ASTU` in emerald tag).
     * Exam Year tag (`2023 Final`).
   * **Card Title**: Truncated 2-line title derived from file name or cleaned caption.
   * **Card Metadata**: File size (`14.2 MB`), Date indexed, Download count (`1,420 downloads`).
   * **Multi-Page Photo Indicator**: If `groupId` exists and contains multiple photos, display a badge: `📷 4-Page Exam Album`.
   * **Dual Action Buttons**:
     * **Primary Button**: `👁️ Read / Preview` (Opens instant streaming viewer).
     * **Secondary Action**: `📥 Download` (Direct HTTP range download).
     * **Telegram Handoff Icon Button**: Telegram paper airplane icon with tooltip *"Send file to my Telegram"*.

---

### SCREEN 3: The Exam Bank & Image Gallery Lightbox (`/exam/[groupId]`)

#### Purpose
A large percentage of Ethiopian university past exams are shared as photos of printed paper taken by students. This screen transforms messy Telegram photo albums into a clean digital testing paper.

#### Layout & Interactions
1. **Header Bar**:
   * Exam Title: e.g., *"Addis Ababa University — Computer Organization Midterm Exam (2022/2023)"*.
   * Page indicator: `Page 2 of 5`.
   * Actions: `Download Full Album as PDF`, `Rotate 90°`, `High-Contrast Enhancement` (filters out dark shadows from camera snapshots).

2. **Main Canvas (Lightbox)**:
   * Smooth pan-and-zoom controls (mouse wheel or pinch-to-zoom on mobile).
   * High-definition image preview with fast progressive rendering.
   * Side navigation arrows (Left / Right) with keyboard navigation support (`ArrowLeft`, `ArrowRight`).

3. **Bottom Thumbnail Strip**:
   * Horizontal strip of miniature thumbnails of each page in the exam set for fast jumping.

4. **Right-Hand Solution & Discussion Drawer (Collapsible)**:
   * Community solutions and answers submitted by top students.
   * Markdown formatted math formulas (rendered via KaTeX).
   * "Submit Answer Key / Correction" button.

---

### SCREEN 4: In-Browser Document Reader (`/read/[resourceId]`)

#### Purpose
Students shouldn't have to download a 50 MB textbook just to verify if it has the chapter they need. This screen provides instant, zero-wait reading.

#### Layout
1. **Top Floating App Bar**:
   * Back arrow to search results.
   * Document Title & Page Count (`Page 42 of 310`).
   * Zoom controls (`-`, `100%`, `+`, `Fit to Width`).
   * Night / Sepia / Day reading background toggles.
   * Direct CTAs:
     * `📥 Download PDF`
     * `✈️ Send to Telegram`
     * `🤖 AI Study Notes`

2. **Center Reading Viewport**:
   * Powered by PDF.js with virtualized continuous scrolling.
   * Supports text highlighting and instant copy.

3. **Right Collapsible AI Companion Panel**:
   * **Tab 1: Chapter Summary**: Bulleted breakdown of core concepts.
   * **Tab 2: Formula Sheet**: Extracted formulas and definitions.
   * **Tab 3: Quick Quiz**: 5 practice questions to test retention.

---

### SCREEN 5: Telegram Mini App (TMA) Viewport Adaptations

#### Purpose
When opened directly inside Telegram via the bot's WebApp button, the website must automatically adapt to feel like a native mobile app.

#### Mobile/TMA Specific Rules
* **No Header Redundancy**: Suppress standard browser headers; adhere to Telegram's native top bar (`Telegram.WebApp.headerColor`).
* **Haptic Feedback**: Trigger light haptics on button taps, filter selection, and download triggers (`Telegram.WebApp.HapticFeedback.impactOccurred('light')`).
* **Bottom Sheet Filter**: Filter sidebar transforms into a modern draggable bottom sheet (Vaul drawer).
* **Main CTA**: Sticky bottom action bar for `📥 Direct Download` and `📤 Forward to Saved Messages`.

---

## 5. Micro-Interactions & State Design

1. **Skeleton Loading States**:
   * Never show full-screen blank spinners. Use shimmering wave skeletons matching the exact card aspect ratios while search queries fetch.
2. **Empty States**:
   * If a search returns 0 results:
     * Display a friendly graphic: *"No exact matches found for 'XYZ' in ASTU"*.
     * Suggest: *"Try removing the course code"*, *"Search across all universities"*, or *"Request this document from campus reps"*.
     * CTA: *"Ask in Telegram Community"*.
3. **Download Progress Indicator**:
   * When clicking download on large files, replace the button label with an inline circular progress bar: `Streaming from Telegram... 45%`.

---

## 6. Accessibility, SEO & Performance Benchmarks

* **Performance Budget**:
  * First Contentful Paint (FCP) < **1.2s** on 3G simulated network.
  * Total Bundle Size: < **150 KB** initial JS.
* **SEO Metadata for Academic Indexing**:
  * Every university and course code gets an auto-generated semantic landing page for Google Search (e.g., `studyhub.et/astu/electrical-engineering/past-exams`).
  * Dynamic OpenGraph image preview generation displaying course title, university emblem, and page count.
* **Accessibility**:
  * Full keyboard accessibility (Tab, Enter, Arrow keys for gallery, Esc for modals).
  * High contrast ratios (WCAG AAA compliant) for night reading.

---

## 7. Designer Prompt Hand-Off (Copy & Paste this to AI/Design Tools)

> **Prompt for v0 / Figma / Frontend Designers**:
> *"Design a modern, high-speed academic search engine and document portal called 'StudyHub' for Ethiopian university students. The design aesthetic should be a sleek, high-contrast dark mode inspired by Perplexity AI, Linear, and Notion (Canvas #090D16, Card #111827, Accent Electric Indigo #6366F1, Emerald #10B981, Telegram Blue #229ED9). Include a prominent command-bar style search omnibar with predictive university and course code chips (ASTU, AAU, AASTU). Design rich academic resource cards featuring file type badges, course codes (e.g. [COE311]), multi-page exam album indicators, and dual actions: 'Read / Preview' and 'Send to Telegram'. Provide an in-browser streaming PDF reader view and a swipeable multi-page exam photo lightbox with high-resolution zoom and community solutions drawer. Ensure the layout is responsive, mobile-first, and ready to function as an embedded Telegram Mini App."*
