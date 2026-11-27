import type { LuminaDocPageDef } from './types'

export const PROLOGUE_DOCS: LuminaDocPageDef[] = [
  {
    slug: 'overview',
    path: '/lumina',
    section: 'Prologue',
    title: 'Lumina Desktop Knowledge Workspace',
    navLabel: 'Overview',
    subtitle:
      'A local-first desktop knowledge workspace that combines a Markdown editor, spatial infinite canvas, 2D/3D knowledge graph, AI copilot, and native terminal in one application.',
    summary:
      'Overview of Lumina: local-first Markdown notes, .canvas spatial whiteboards, 2D/3D knowledge graph, offline/cloud AI copilot, and native ConPTY/PTY terminal.',
    sortOrder: 10,
    content: `## What is Lumina?

**Lumina** (MIT License, by **Saboor Hamedi**) is a local-first desktop knowledge workspace that combines a **CodeMirror 6 Markdown editor**, **spatial infinite canvas (\`.canvas\`)**, **2D/3D knowledge graph**, **AI copilot**, and **native terminal** in one unified desktop application.

> [!NOTE]
> **100% Local-First Storage Model:** All notes are stored as plain-text \`.md\` files (with YAML frontmatter preserving \`createdAt\`) and \`.canvas\` JSON files stored directly on your disk. Zero proprietary cloud lock-in and no tracking servers.

## Technical Foundation

- **Desktop Runtime:** Tauri 2.0 + Rust (\`src-tauri\`) using native OS WebViews (WebView2 on Windows, WebKit on macOS and Linux).
- **Native Core (\`crates/lumina_core\`):** Rust + Rayon multithreaded disk scanner, sub-millisecond fuzzy search, and bidirectional knowledge graph builder.
- **Frontend Stack:** React 19, TypeScript, Vite 7, Zustand, Tailwind CSS, CodeMirror 6, \`xterm.js\` (\`portable-pty\` / ConPTY), \`react-force-graph-2d\`, \`react-force-graph-3d\` (Three.js), Mermaid, KaTeX, \`@xenova/transformers\` (local embeddings), and Dexie (IndexedDB).
- **Cross-Platform Installers:** Native desktop packages for **Windows** (\`.exe\` / \`.msi\`), **macOS Universal** Apple Silicon + Intel (\`.dmg\`), and **Linux** (\`.deb\` / \`.AppImage\`).

## Core Capabilities at a Glance

### 1. Local-First Markdown Editor (CodeMirror 6)
Plain-text \`.md\` files with YAML frontmatter, wikilinks (\`[[note]]\`), backlinks, tags, slash commands (\`/\`), tables, LaTeX math (KaTeX), Mermaid diagrams, syntax-highlighted code blocks, voice input, multi-pane split views (\`Ctrl + \\\`), and Zen Mode (\`Ctrl + .\`).

### 2. Spatial Infinite Canvas (\`.canvas\`)
Freeform 2D whiteboard saved as \`.canvas\` JSON files supporting cards, frameless resizable text labels, shapes, magnetic connection ports, orthogonal edge routing, snap-to-grid toggle, zoom/pan viewport, and templates.

### 3. 2D & 3D Knowledge Graph
Interactive force-directed 2D Canvas and 3D WebGL (\`Three.js\`) graph views built from wikilinks and note relationships, with cluster physics and persistent node positions.

### 4. AI Copilot & Local Semantic Memory
Works offline with **Ollama** and local on-device embeddings (\`@xenova/transformers\`), or with cloud providers (**DeepSeek**, **OpenAI**, **Claude**) across 3 modes (*Planning & Strategy*, *Execution & Action*, *Research & Analysis*) with inline **Approve / Reject** diff cards and **multi-file Undo**.

### 5. Integrated Native Terminal (\`Ctrl + J\`)
Real pseudoterminal powered by Rust \`portable-pty\` (ConPTY on Windows, PTY on macOS/Linux) and \`xterm.js\` with WebGL acceleration.

### 6. Theme-Accurate Exports (50 Curated Themes)
Export notes to self-contained **HTML**, **Markdown**, **Plain Text**, print-ready **PDF** (with auto-generated Table of Contents), **Word (\`.doc\`)**, or **ZIP** archives across 50 themes.

### 7. Optional Google Integrations (OAuth 2.0 Loopback)
Push single notes, folder mirrors, or compressed ZIP backups directly to **Google Drive**, and read, organize, or send emails via **Gmail** using direct local HTTPS calls to Google APIs.`,
  },
  {
    slug: 'installation',
    path: '/lumina/installation',
    section: 'Prologue',
    title: 'Download & Installation',
    navLabel: 'Download & Installation',
    subtitle:
      'Download native Lumina installers for Windows (.exe / .msi), macOS Universal (.dmg), and Linux (.deb / .AppImage) directly from GitHub Releases.',
    summary:
      'Download and install Lumina on Windows, macOS (Apple Silicon & Intel), and Linux.',
    sortOrder: 20,
    content: `## Choose Your Platform Installer

Use the live installer cards above to download the latest release directly from GitHub for **Windows**, **macOS**, or **Linux**.

> [!TIP]
> **Live GitHub Release Sync:** Installer links and release tags on this page are fetched dynamically from [github.com/Saboor-Hamedi/lumina/releases/latest](https://github.com/Saboor-Hamedi/lumina/releases/latest) with multi-tier caching so downloads remain fast under high traffic.

## Windows Installation (\`.exe\` / \`.msi\`)

1. Download either the **NSIS Setup Installer (\`.exe\`)** or the **Windows Installer Package (\`.msi\`)**.
2. Double-click the downloaded installer. Windows 10 and Windows 11 include the required **Microsoft Edge WebView2** runtime out of the box.
3. If Windows Defender SmartScreen prompts on a freshly published release binary, click **More info → Run anyway**.
4. Open **Lumina** from your Start Menu or Desktop shortcut and choose any local folder as your workspace vault.

## macOS Installation (\`.dmg\` Universal)

1. Download the **macOS Universal (\`.dmg\`)** disk image (supports both Apple Silicon M1/M2/M3/M4 and Intel Macs).
2. Double-click the \`.dmg\` file and drag **Lumina.app** into your **Applications** folder.
3. If macOS Gatekeeper shows an unverified developer prompt on first launch, right-click **Lumina.app** and click **Open**, or clear the quarantine attribute in Terminal:

\`\`\`bash
xattr -cr /Applications/Lumina.app
\`\`\`

## Linux Installation (\`.deb\` / \`.AppImage\`)

### Debian / Ubuntu (\`.deb\`)

\`\`\`bash
sudo dpkg -i Lumina_*.deb
sudo apt-get install -f
\`\`\`

### Universal Linux (\`.AppImage\`)

\`\`\`bash
chmod +x Lumina_*.AppImage
./Lumina_*.AppImage
\`\`\`

> [!NOTE]
> On Ubuntu 22.04+ and 24.04+, if \`.AppImage\` requires FUSE 2, install \`libfuse2\` via \`sudo apt install libfuse2\`.`,
  },
]
