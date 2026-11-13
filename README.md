# Tabula — Private In-Browser Data Workbench

<img src="/background.png" width="120" alt="Tabula logo" />

[![Build Status](https://github.com/tabula/tabula/actions/workflows/build.yml/badge.svg)](https://github.com/tabula/tabula/actions/workflows/build.yml)
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

## Routes

The fragment is the URL. Every surface is a route, and the router lives in
`src/core/router/`.

| Route                           | Surface                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `#/landing`                     | The front page, with the hover menus                                                                                      |
| `#/app`                         | **Analyse** — the signed-in home: identity, activity, and (for administrators) the member list and the published insights |
| `#/workspace`                   | The chat workspace                                                                                                        |
| `#/insights`                    | The published insights index                                                                                              |
| `#/insights/:slug`              | One published insight                                                                                                     |
| `#/login` `#/signup` `#/verify` | The account screens                                                                                                       |
| `#/workspace?demo=1`            | The workspace in demo mode, without an account                                                                            |

## Sign-in providers

E-mail and password work out of the box. Google and GitHub are **off by
default** on a Supabase project, so the sign-in screen only shows the buttons
the project actually has enabled — a button that cannot work is never offered.

To turn them on:

**1. Redirect URLs** — Supabase Dashboard → Authentication → URL Configuration →
Redirect URLs, add:

```
http://localhost:5173/**
http://localhost:5173/#/app
https://your-domain.com/**
```

The fragment is the router, so the app asks for `#/app` after the round trip.
The authorisation code comes back on the query string, which leaves the hash
free for the router.

**2. Google**

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   Create Credentials → OAuth client ID → _Web application_.
2. **Authorized JavaScript origins**: `https://<project-ref>.supabase.co`
3. **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into Supabase → Authentication →
   Providers → Google, tick _Enable Google_, paste both, and Save.

**3. GitHub**

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. **Homepage URL**: `https://<project-ref>.supabase.co`
3. **Authorization callback URL**: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into Supabase → Authentication →
   Providers → GitHub, tick _Enable GitHub_, paste both, and Save.

`<project-ref>` is the first part of your project URL, for example
`iaxbixtmymalzhryhazz` in `https://iaxbixtmymalzhryhazz.supabase.co`.

The app reads the public settings endpoint to learn which providers are live,
so the buttons appear the moment you save — no rebuild.

## Scripts

```bash
npm run dev      # Run local dev server with HMR
npm run test     # Run Vitest test suites
npm run build    # Typecheck and production bundle build
npm run preview  # Serve production build locally
```

## Architecture

- `src/core/` contains framework-free logic: persistence, parsing, analysis, agent tools, exports, diagnostics.
- `src/core/router/` contains the hash router: the provider, the route table, the hooks and the path matching.
- `src/features/` contains React surfaces, one folder per product area.
- `src/core/workers/` contains the spreadsheet conversion worker.
- `src/core/parsing/` turns assistant output into text, tables, diagrams, and structured chart blocks.
- `src/features/session/` contains workspace restore and persistence hooks.
- `src/features/migration/` contains the database schema — one `.sql` file per feature (`accounts.sql`, `roles.sql`, `posts.sql`, `media.sql`, `admin.sql`, `api_keys.sql`) plus `queries.sql`, the requests the app makes. `tabula.sql` is the map of what to run and in what order.

Each feature folder keeps its files in sub-folders by role — `pages/`,
`components/`, `api/`, `lib/`, `styles/` — with single-purpose file names.

Core code must not import from features.

## Privacy and deployment

- Uploaded files never leave the browser tab.
- The DeepSeek access key is stored only in this browser.
- Production builds add a Content Security Policy and a service worker that caches the app shell and analysis assets after first use.
- For a public multi-user deployment, proxy model calls through a backend instead of accepting user keys in the browser.

## CI

`.github/workflows/ci.yml` runs lint, tests, and a production build on pushes and pull requests.
