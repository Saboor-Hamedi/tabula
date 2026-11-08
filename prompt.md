Here's the updated prompt with the new requirements folded in. Feed this whole block to your agent.

---

# Updated Prompt (feed to agent)

> Build a React + TypeScript + Vite single-page app called **data-agent**. It runs fully in the browser; no backend, no Docker, no Python, no Vercel cloud services.
>
> **Core behavior**
> - User uploads a `.csv` or `.xlsx` file. The file is ingested into DuckDB-WASM in the browser. Each Excel sheet becomes a table; a CSV becomes one table.
> - No DuckDB persistence to IndexedDB. Session data lives only in React state and in-memory DuckDB. **Exception:** the DeepSeek API key and the selected model are stored in `localStorage` (see below).
> - A chat UI lets the user converse with a DeepSeek-powered agent. The agent has tools: `inspect_schema` (column names, types, per-column profile: null count, distinct count, min/max, sample values) and `run_sql` (executes DuckDB SQL, caps returned rows, returns rows as JSON plus a row-count summary).
> - The agent must always call `inspect_schema` before writing SQL. It must never invent column names.
> - A "Delete session" button unmounts the workspace, calls `db.close()`, clears all state, and aborts in-flight requests via `AbortController`.
> - A collapsible in-memory "trace" panel shows every tool call (name, arguments, result summary). Exportable as JSON before deletion. Never persisted.
>
> **Agent intelligence requirements (critical)**
> - The system prompt must instruct the agent to **dig deep**: before answering, inspect the schema, then run multiple exploratory SQL queries (distributions, cardinality, null patterns, group-by summaries, time trends if a date column exists), and only then answer.
> - For visualizations, the agent must produce **well-designed Mermaid diagrams with thoughtful layout** — appropriate chart type for the question (`xychart-beta` for trends, `pie` for composition, `flowchart` for relationships, `mindmap` for hierarchy), sensible axis labels, units, and titles. Never emit a bare or lazy chart.
> - When the user asks for "full details" or "everything," the agent must combine a narrative answer + one or more Mermaid charts + one or more data tables, not just prose.
> - The system prompt should include examples of good vs bad agent behavior (good: inspect → explore → visualize → explain; bad: guess a column, return a single number with no context).
>
> **DeepSeek key & model selection**
> - A settings panel/modal where the user enters their DeepSeek API key. On save, it's written to `localStorage` under `data-agent:deepseek-key`. On load, the app reads it and uses it; if absent, the chat is disabled with a prompt to open settings.
> - A model toggle in the UI (near the composer or in the header) to switch between **DeepSeek V4 Flash** (latest, faster, cheaper — default) and **DeepSeek V4 Pro** (deeper reasoning). The selection is stored in `localStorage` under `data-agent:model` and passed to the AI SDK on every turn.
> - Changing the key or model mid-session takes effect on the next agent turn, without destroying the session.
>
> **Layout & UX (must look great, not prototype-grade)**
> - **Sidebar (left):** lists uploaded files as **sessions/cards** — filename, table name, row count, column count, upload time. The active session is highlighted. The user can switch between uploaded files; each file retains its own tables in DuckDB. A "Delete session" action sits on each card (with confirm) and in the header.
> - **Main pane:** chat conversation. Message bubbles must be visually polished — proper spacing, readable typography (system font stack or Inter), subtle borders, distinct user vs assistant styling, monospace for SQL, smooth scroll-to-bottom on new messages.
> - **Composer:** a rich chat composer at the bottom — auto-growing textarea, keyboard shortcut (Enter to send, Shift+Enter for newline), disabled while the agent is streaming, a subtle "thinking…" indicator during tool calls, and a send button that matches the design system. Above the composer, show the current file name and selected model as small chips.
> - **Trace panel:** right-side collapsible drawer (not a modal), showing the tool-call timeline for the active session.
> - **Upload zone:** a drag-and-drop card inside the main pane when no session exists; after upload it collapses into the sidebar.
> - **Design system:** use CSS variables in `src/styles/theme.css` for colors, spacing, radii. Light and dark mode via `prefers-color-scheme`. No CSS framework required — plain CSS modules or a single `styles/app.css` is fine. The result must look intentional, not default Vite.
>
> **Folder structure (strict)**
> - `src/core/` — all `.ts` files. No JSX, no React. Pure logic: DuckDB init/teardown, ingestion, schema profiling, tool definitions and implementations, DeepSeek client wiring, prompt strings, Mermaid/table block extraction, types, localStorage helpers.
> - `src/features/` — all `.tsx` files. React components only. May import from `src/core/`, never the reverse.
>
> **Additional files to include in `core/`**
> - `core/storage/settings.ts` — read/write DeepSeek key and model to `localStorage` (keys: `data-agent:deepseek-key`, `data-agent:model`).
> - `core/storage/sessions.ts` — in-memory session registry (filename, tables, timestamps); not persisted.
> - `core/agent/modelOptions.ts` — the list of selectable models (V4 Flash, V4 Pro) with labels and descriptions.
>
> **Additional files to include in `features/`**
> - `features/settings/SettingsModal.tsx` — key input + save, with validation and a "clear key" button.
> - `features/settings/ModelToggle.tsx` — segmented control for V4 Flash / V4 Pro.
> - `features/sidebar/Sidebar.tsx` — session cards list, active highlight, delete.
> - `features/sidebar/SessionCard.tsx` — one session card.
> - `features/composer/Composer.tsx` — the polished composer described above.
>
> **Constraints**
> - TypeScript everywhere. No `any` in exported signatures.
> - DuckDB via `@duckdb/duckdb-wasm`. CSV via `read_csv_auto`; Excel via `xlsx` npm parser, then inserted into DuckDB as a table.
> - DeepSeek via `@ai-sdk/deepseek` using `streamText` with tools and a multi-step loop.
> - Mermaid loaded via `React.lazy` inside `MermaidBlock.tsx` — not in the main bundle, not in a Web Worker.
> - `useMemo` for schema profile computation and table row rendering. Async queries via `useEffect` + state.
> - No `localStorage` for data or chat — only for the API key and the model choice.
>
> Produce every file explicitly with its full path. Every component and every core module gets its own file. Do not collapse unrelated logic into a single file.

---

# Updated Installation

```bash
npm create vite@latest data-agent -- --template react-ts
cd data-agent

npm install @duckdb/duckdb-wasm apache-arrow
npm install ai @ai-sdk/deepseek
npm install xlsx
npm install mermaid
npm install react-markdown remark-gfm

npm install -D typescript @types/react @types/react-dom

npm run dev
```

No `.env` needed anymore — the DeepSeek key lives in `localStorage` and is entered via the Settings modal on first run.

---

# Updated Project Structure

```
data-agent/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── styles/
    │   ├── theme.css                  # CSS variables, light/dark
    │   └── app.css                    # Global layout styles
    │
    ├── core/                          # ALL .ts — pure logic, no React
    │   ├── types.ts
    │   ├── constants.ts
    │   │
    │   ├── duckdb/
    │   │   ├── initDuckDB.ts
    │   │   ├── closeDuckDB.ts
    │   │   ├── ingestCSV.ts
    │   │   ├── ingestExcel.ts
    │   │   ├── listTables.ts
    │   │   └── runSQL.ts
    │   │
    │   ├── profiling/
    │   │   ├── profileTable.ts
    │   │   └── sampleRows.ts
    │   │
    │   ├── agent/
    │   │   ├── systemPrompt.ts        # Includes "dig deep" + Mermaid layout guidance + good/bad examples
    │   │   ├── tools.ts
    │   │   ├── executeTool.ts
    │   │   ├── runAgentTurn.ts
    │   │   ├── trace.ts
    │   │   └── modelOptions.ts        # V4 Flash, V4 Pro
    │   │
    │   ├── deepseek/
    │   │   └── client.ts              # Reads key from localStorage via settings.ts
    │   │
    │   ├── storage/
    │   │   ├── settings.ts            # get/set DeepSeek key + model
    │   │   └── sessions.ts            # In-memory session registry
    │   │
    │   └── parsing/
    │       ├── extractMermaidBlocks.ts
    │       └── extractTableBlocks.ts
    │
    └── features/                      # ALL .tsx — React components only
        ├── AppShell.tsx               # Sidebar + main pane + trace drawer
        ├── SessionProvider.tsx        # Context: db, sessions, messages, trace, activeSession
        │
        ├── sidebar/
        │   ├── Sidebar.tsx
        │   └── SessionCard.tsx
        │
        ├── upload/
        │   ├── UploadZone.tsx
        │   └── UploadStatus.tsx
        │
        ├── chat/
        │   ├── ChatPanel.tsx
        │   ├── MessageBubble.tsx
        │   ├── MessageRenderer.tsx
        │   └── ChatInput.tsx
        │
        ├── composer/
        │   └── Composer.tsx           # Auto-grow textarea, chips, send button, streaming state
        │
        ├── settings/
        │   ├── SettingsModal.tsx
        │   └── ModelToggle.tsx
        │
        ├── render/
        │   ├── MermaidBlock.tsx       # lazy-loaded
        │   ├── MermaidFallback.tsx
        │   ├── DataTable.tsx
        │   └── MarkdownText.tsx
        │
        ├── trace/
        │   ├── TracePanel.tsx
        │   └── TraceEntry.tsx
        │
        └── session/
            ├── DeleteSessionButton.tsx
            └── SessionInfo.tsx
```

Feed this to your agent and see what it produces. The two riskiest parts to watch: (1) the system prompt actually producing good Mermaid layouts rather than trivial charts, and (2) the AI SDK tool loop calling DeepSeek cleanly with model switching mid-session. Everything else is straightforward React wiring.
