import type { LuminaDocPageDef } from './types'

export const LUMINA_SHORTCUTS: Array<{ shortcut: string; action: string }> = [
  { shortcut: 'Ctrl + Space', action: 'Global Spotlight (Search notes & AI command palette)' },
  { shortcut: 'Ctrl + P', action: 'Quick note & command search palette' },
  { shortcut: 'Ctrl + N', action: 'Create new note' },
  { shortcut: 'Ctrl + J', action: 'Toggle integrated ConPTY / PTY terminal' },
  { shortcut: 'Ctrl + .', action: 'Toggle Zen Mode' },
  { shortcut: 'Ctrl + B', action: 'Toggle Left Sidebar' },
  { shortcut: 'Ctrl + \\', action: 'Split editor right' },
  { shortcut: 'Ctrl + Alt + \\', action: 'Split editor down' },
  { shortcut: 'Ctrl + K', action: 'Inline AI edit / prompt inside editor' },
  { shortcut: 'F2 / Ctrl + R', action: 'Rename active note or folder' },
  { shortcut: 'Ctrl + W', action: 'Close active tab' },
  { shortcut: 'Double-click Tab', action: 'Rename note from tab bar' },
]

export const REFERENCE_DOCS: LuminaDocPageDef[] = [
  {
    slug: 'shortcuts',
    path: '/lumina/shortcuts',
    section: 'Reference',
    title: 'Keyboard Shortcuts Reference',
    navLabel: 'Keyboard Shortcuts',
    subtitle:
      'Complete keyboard shortcut reference for navigating Lumina, splitting editor panes, and running AI or terminal commands.',
    summary: 'Reference table of all keyboard shortcuts in Lumina.',
    sortOrder: 40,
    content: `## Keyboard-First Workflow

Lumina is designed so every core action—from fuzzy note search and AI inline editing to split panes and ConPTY terminal toggling—is accessible without lifting your hands from the keyboard.

| Shortcut | Action |
| --- | --- |
| \`Ctrl + Space\` | Global Spotlight (Search notes & AI command palette) |
| \`Ctrl + P\` | Quick note & command search palette |
| \`Ctrl + N\` | Create new note |
| \`Ctrl + J\` | Toggle integrated ConPTY / PTY terminal |
| \`Ctrl + .\` | Toggle Zen Mode |
| \`Ctrl + B\` | Toggle Left Sidebar |
| \`Ctrl + \\\` | Split editor right |
| \`Ctrl + Alt + \\\` | Split editor down |
| \`Ctrl + K\` | Inline AI edit / prompt inside editor |
| \`F2\` / \`Ctrl + R\` | Rename active note or folder |
| \`Ctrl + W\` | Close active tab |
| \`Double-click Tab\` | Rename note from tab bar |

> [!TIP]
> On **macOS**, use \`Cmd\` in place of \`Ctrl\` for standard editor and tab shortcuts.`,
  },
  {
    slug: 'architecture',
    path: '/lumina/architecture',
    section: 'Reference',
    title: 'Architecture & Tech Stack',
    navLabel: 'Architecture & Tech Stack',
    subtitle:
      'Inside Lumina’s Tauri 2.0 runtime, Rust crates/lumina_core engine, and React 19 + CodeMirror 6 frontend.',
    summary:
      'Architectural overview of Lumina’s Rust core, Tauri 2.0 runtime, and React 19 frontend.',
    sortOrder: 50,
    content: `## High-Level Architecture

Lumina combines a native **Rust** backend (\`src-tauri\` + \`crates/lumina_core\`) with a modern **React 19 + TypeScript** frontend running inside the operating system's native WebView.

## Technology Stack Breakdown

### Desktop Runtime (\`src-tauri\`)
- **Framework:** Tauri 2.0 + Rust
- **Native WebViews:** Microsoft Edge WebView2 on Windows, WebKit on macOS and Linux
- **Pseudoterminal:** \`portable-pty\` (ConPTY on Windows, POSIX PTY on macOS/Linux)
- **OAuth Loopback & File I/O:** Direct native Rust commands over Tauri IPC

### Native Core (\`crates/lumina_core\`)
- **Parallel Disk Scanner:** Rust + **Rayon** work-stealing thread pool for scanning vaults of 10,000+ Markdown and \`.canvas\` files
- **Fuzzy Search Engine:** Sub-millisecond trigram and subsequence scoring
- **Graph Builder:** Parses YAML frontmatter, \`[[wikilinks]]\`, and tags into an in-memory directed graph

### Frontend Application
- **Core UI:** React 19, TypeScript, Vite 7, Zustand state management, Tailwind CSS
- **Markdown Editor:** CodeMirror 6 with custom extensions for wikilinks, slash commands, KaTeX, and Mermaid
- **Knowledge Graph:** \`react-force-graph-2d\` (HTML5 Canvas) and \`react-force-graph-3d\` (\`Three.js\` WebGL)
- **Terminal Emulator:** \`xterm.js\` with WebGL renderer addon
- **Local Semantic Memory:** \`@xenova/transformers\` running in-browser ONNX embeddings persisted in **Dexie (IndexedDB)**`,
  },
  {
    slug: 'build',
    path: '/lumina/build',
    section: 'Reference',
    title: 'Build from Source',
    navLabel: 'Build from Source',
    subtitle:
      'Clone the open-source MIT repository and compile native Lumina installers for Windows, macOS, and Linux.',
    summary:
      'Instructions for building Lumina from source using Rust, Cargo, Node.js, and Tauri 2.0.',
    sortOrder: 60,
    content: `## 1. Prerequisites

Before building Lumina from source, ensure you have the following installed:

- **Git**
- **Node.js** 20 LTS or newer (\`node -v\`)
- **Rust** stable toolchain via [rustup.rs](https://rustup.rs) (\`rustc -V\` and \`cargo -V\`)
- **Platform Native Dependencies:**
  - **Windows:** Microsoft Visual Studio C++ Build Tools & WebView2 Runtime
  - **macOS:** Xcode Command Line Tools (\`xcode-select --install\`)
  - **Linux (Debian/Ubuntu):**
    \`\`\`bash
    sudo apt update
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    \`\`\`

## 2. Clone & Install Dependencies

\`\`\`bash
git clone https://github.com/Saboor-Hamedi/lumina.git
cd lumina
npm install
\`\`\`

## 3. Run in Development Mode

Launch the Vite frontend with hot-module replacement attached to the Tauri Rust desktop shell:

\`\`\`bash
npm run tauri dev
\`\`\`

## 4. Compile Release Installers

Build optimized native release binaries and platform installers (\`.exe\`, \`.msi\`, \`.dmg\`, \`.deb\`, \`.AppImage\`):

\`\`\`bash
npm run tauri build
\`\`\`

The compiled installers will be generated inside \`src-tauri/target/release/bundle/\`.`,
  },
]
