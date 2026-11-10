# Tabula — Private In-Browser Data Workbench

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-tabula.app-0f766e.svg)](https://tabula.app/#demo)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-emerald.svg)](https://tabula.app/#privacy)

Tabula is a fast, local-first conversational workbench for exploring CSV and Excel workbooks. Drop in your files, ask questions in plain English, and get automated charts, business metrics, and executive summaries.

**The core promise:** Raw spreadsheet rows never leave your device. All calculations run strictly inside your web browser using DuckDB-WASM and Pyodide.

---

## Key Features

- **100% Client-Side Calculations:** Query millions of rows with sub-second response times directly on your CPU.
- **Natural Language Analysis:** Ask questions, compute growth trends, identify customer churn, and find statistical outliers.
- **Automatic Visualizations:** Generates comparative bar charts, distributions, and trend lines with one-click PNG export.
- **Word & Docs Ready:** 1-click copy formatted tables directly to Microsoft Word or Google Docs, or download executive PDF dossiers.
- **Interactive Studio Notes:** Built-in sticky notes board for pinning key findings, thoughts, and hypothesis tracking.
- **Offline Capable:** Works without an internet connection once loaded — perfect for flights and confidential business meetings.

---

## Privacy Guarantee

Your data security is guaranteed by design:
1. Spreadsheets are parsed into computer memory (RAM) via web workers.
2. Calculations run in DuckDB-WASM and client-side Python (Pyodide).
3. Only your question and a compact schema dictionary (column names and types) are sent to the AI model.
4. No numbers, customer names, or confidential rows are ever uploaded or saved to any cloud database.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Analytics Engine:** DuckDB-WASM, Pyodide (Python 3.11 in WebAssembly)
- **Visualizations:** Mermaid SVG diagrams and custom data canvas
- **Storage:** IndexedDB for durable local session caching and schema catalogs
- **Auth & Subscriptions:** Supabase Auth with email verification gate

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/tabula/tabula.git
cd tabula

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173` to explore the interactive demo or upload your own spreadsheets.

## Scripts

```bash
npm run dev      # Run local dev server with HMR
npm run test     # Run Vitest test suites
npm run build    # Typecheck and production bundle build
npm run preview  # Serve production build locally
```

## Architecture

- `src/core/` contains framework-free logic: persistence, parsing, analysis, agent tools, exports, diagnostics.
- `src/features/` contains React surfaces: shell, sidebar, header, chat, composer, figures, inspector, settings.
- `src/core/workers/` contains the spreadsheet conversion worker.
- `src/core/parsing/` turns assistant output into text, tables, diagrams, and structured chart blocks.
- `src/features/session/` contains workspace restore and persistence hooks.

Core code must not import from features.

## Privacy and deployment

- Uploaded files never leave the browser tab.
- The DeepSeek access key is stored only in this browser.
- Production builds add a Content Security Policy and a service worker that caches the app shell and analysis assets after first use.
- For a public multi-user deployment, proxy model calls through a backend instead of accepting user keys in the browser.

## CI

`.github/workflows/ci.yml` runs lint, tests, and a production build on pushes and pull requests.
