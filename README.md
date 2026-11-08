# Tabula

Tabula is a local-first workspace for asking questions about CSV and Excel files. Upload a workbook, inspect the detected columns, and chat with an agent that explores the data and answers with findings, tables, and charts.

Files and results stay in the browser. Only the question, a compact column summary, and the results needed for an answer are sent to DeepSeek.

## Stack

- React 19 + TypeScript + Vite
- DuckDB-WASM for in-browser analysis
- DeepSeek through the AI SDK
- Mermaid plus custom SVG figures for charts
- IndexedDB for durable sessions and localStorage for instant startup/layout state

## Development

```bash
npm install
npm run dev
```

Open the local URL, add a DeepSeek access key from **Settings**, then upload a CSV/XLSX file or choose **Try a sample dataset**.

## Scripts

```bash
npm run dev      # local development
npm run lint     # static checks
npm run test     # core unit tests
npm run build    # typecheck + production build
npm run preview  # serve the production build
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
