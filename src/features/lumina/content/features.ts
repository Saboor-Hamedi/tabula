import type { LuminaDocPageDef } from './types'

export const FEATURES_DOCS: LuminaDocPageDef[] = [
  {
    slug: 'features',
    path: '/lumina/features',
    section: 'Features',
    title: 'Core Features & Capabilities',
    navLabel: 'All Features Overview',
    subtitle:
      'Complete documentation for all 8 subsystems inside Lumina: Markdown Editor, Infinite Canvas, 2D/3D Graph, AI Copilot, Native Terminal, 50 Export Themes, Workspace Tools, and Google Sync.',
    summary: 'Detailed documentation of every core feature in Lumina.',
    sortOrder: 30,
    content: `## 1. Local-First Markdown Editor (CodeMirror 6)

Lumina’s editor is built on **CodeMirror 6** and tailored for fast, distraction-free technical and academic writing:

- **Plain-Text \`.md\` Storage:** Files live directly in your local folder with YAML frontmatter, wikilinks (\`[[note]]\`), automatic backlinks, tags (\`#tag\`), slash commands (\`/\`), and Markdown tables.
- **Rich Technical Blocks:** Render inline and display **LaTeX math (KaTeX)**, interactive **Mermaid diagrams**, syntax-highlighted fenced code blocks, and voice input dictation.
- **Multi-Pane Split Views:** Split your workspace horizontally (\`Ctrl + \\\`) or vertically (\`Ctrl + Alt + \\\`) with drag-and-drop tabs and persistent workspace layouts.
- **Zen Mode (\`Ctrl + .\`):** Hides sidebars, toolbars, and window chrome so you can focus purely on writing while keeping running background terminal sessions alive.
- **Immutable Creation Timestamps:** Preserves every note's original creation timestamp (\`createdAt\`) in YAML frontmatter independently of file-system modification dates.

## 2. Spatial Infinite Canvas (\`.canvas\`)

Design architectures, mind maps, and research boards on an infinite 2D plane:

- **Open \`.canvas\` JSON Format:** Saved directly on disk as standard, human-readable \`.canvas\` JSON files.
- **Rich Node Types:** Create Markdown cards, frameless resizable text labels, and geometric shapes.
- **Smart Connectors:** Magnetic connection ports with orthogonal edge routing, directional arrows, and labeled edges.
- **Viewport Controls:** Snap-to-grid toggle, smooth zoom/pan canvas navigation, and reusable canvas templates.

## 3. 2D & 3D Knowledge Graph

Visualize how your ideas connect across your entire vault:

- **Dual Rendering Engines:** Switch seamlessly between a high-DPI **2D Force-Directed Canvas** (\`react-force-graph-2d\`) and an interactive **3D WebGL Graph** (\`react-force-graph-3d\` + \`Three.js\`).
- **Automatic Relationship Indexing:** Computed in sub-milliseconds by \`crates/lumina_core\` from wikilinks (\`[[note]]\`), tags, and folder hierarchies.
- **Cluster Physics & Persistence:** Interactive node dragging, cluster gravity, and persistent node positions across sessions.

## 4. AI Copilot & Local Semantic Memory

Lumina gives you full control over where your AI runs—100% offline or connected to frontier cloud models:

- **Local Offline AI:** Connect to local **Ollama** models paired with on-device semantic embeddings (\`@xenova/transformers\`) stored in local IndexedDB (Dexie).
- **Cloud Providers:** Bring your own API key for **DeepSeek**, **OpenAI**, or **Anthropic Claude**.
- **3 Specialized Modes:**
  1. *Planning & Strategy* — architecture design, outlining, and structured breakdowns.
  2. *Execution & Action* — direct drafting, refactoring, and note transformations.
  3. *Research & Analysis* — synthesis across vault notes and semantic retrieval.
- **Safety & Diff Controls:** Trigger inline AI editing (\`Ctrl + K\`) or Global Spotlight (\`Ctrl + Space\`). Every proposed file modification renders as an inline **Approve / Reject diff card** with **multi-file Undo**.

## 5. Integrated Native Terminal (\`Ctrl + J\`)

Run compilers, Git workflows, Python scripts, and SSH sessions without leaving your notes:

- **True OS Pseudoterminal:** Powered by Rust \`portable-pty\` (**ConPTY** on Windows, **POSIX PTY** on macOS and Linux) and rendered via **WebGL-accelerated \`xterm.js\`**.
- **Full Shell Compatibility:** Supports PowerShell, CMD, Git Bash, Zsh, Bash, interactive TUI apps (\`vim\`, \`htop\`, \`ssh\`, \`python\`), \`Tab\` completion, \`Ctrl + C\` signal handling, and live pane resizing.

## 6. Theme-Accurate Exports (50 Curated Themes)

Publish or share your work in any format with exact visual fidelity:

- **6 Export Targets:** Self-contained **HTML**, clean **Markdown (\`.md\`)**, **Plain Text (\`.txt\`)**, print-ready **PDF** (with auto-generated Table of Contents), **Microsoft Word (\`.doc\`)**, and bulk **ZIP** archives.
- **50 Curated Themes:** Every export preserves typography, code highlighting, KaTeX formulas, and Mermaid diagrams across 50 built-in themes.

## 7. Workspace Tools

- **Global Spotlight (\`Ctrl + Space\`) & Command Palette (\`Ctrl + P\`):** Sub-millisecond fuzzy search across filenames, headings, tags, and workspace commands.
- **Daily Notes & Calendar:** Integrated calendar view with one-click daily note creation and customizable templates.
- **Inspector, Outline & Roadmap:** Live document TOC outline, backlink inspector, frontmatter metadata editor, breadcrumb bar, media/image viewer, and project roadmap board.

## 8. Optional Google Integrations (OAuth 2.0 Loopback)

- **Google Drive Backup:** Push a single note, synchronize a bulk folder mirror, or upload a compressed ZIP workspace backup directly to your Google Drive.
- **Gmail Integration:** Read, organize, and send emails directly inside Lumina at your explicit direction.
- **Zero-Server Architecture:** Uses desktop OAuth 2.0 loopback directly between your computer and Google's official HTTPS endpoints. No intermediate Lumina server ever sees your credentials or data.`,
  },
  {
    slug: 'features-editor',
    path: '/lumina/features/editor',
    section: 'Features',
    title: 'Markdown Editor & Split Panes',
    navLabel: 'Markdown Editor & Split Panes',
    subtitle:
      'CodeMirror 6 editor with YAML frontmatter, wikilinks, KaTeX, Mermaid, multi-pane splits, and Zen Mode.',
    summary:
      'Deep dive into Lumina’s CodeMirror 6 Markdown editor, split views, and Zen Mode.',
    sortOrder: 31,
    content: `## CodeMirror 6 Local-First Editor

Lumina's Markdown editor reads and writes standard UTF-8 \`.md\` files directly on your local file system.

### Supported Syntax & Blocks

- **YAML Frontmatter:** Preserves \`createdAt\`, \`tags\`, \`aliases\`, and custom properties at the top of every note.
- **Bidirectional Wikilinks:** Type \`[[note-name]]\` to link notes with live autocomplete and instant backlink tracking.
- **Slash Commands (\`/\`):** Insert tables, callouts, math blocks, Mermaid diagrams, task lists, and timestamps with a single keystroke.
- **LaTeX Math & Mermaid:** Native KaTeX math rendering (\`$...$\` and \`$$...$$\`) and live Mermaid diagram previews.
- **Voice Input:** Dictate notes hands-free directly into the active cursor position.

## Multi-Pane Split Views & Zen Mode

- **Split Editor Right:** Press \`Ctrl + \\\` to open a side-by-side horizontal split.
- **Split Editor Down:** Press \`Ctrl + Alt + \\\` to stack panes vertically.
- **Drag-and-Drop Tabs:** Rearrange tabs across split panes; Lumina persists your exact layout across restarts.
- **Zen Mode (\`Ctrl + .\`):** Strips away sidebars and status bars for focused writing while keeping background ConPTY/PTY terminal processes alive.`,
  },
  {
    slug: 'features-canvas',
    path: '/lumina/features/canvas',
    section: 'Features',
    title: 'Spatial Infinite Canvas (.canvas)',
    navLabel: 'Infinite Canvas (.canvas)',
    subtitle:
      'Freeform 2D spatial whiteboard stored as local .canvas JSON files with orthogonal edge routing.',
    summary:
      'Create visual whiteboards, architecture diagrams, and spatial note maps with Lumina’s .canvas engine.',
    sortOrder: 32,
    content: `## Open \`.canvas\` JSON Architecture

Every canvas in Lumina is stored as a plain-text \`.canvas\` JSON file inside your vault, ensuring your spatial boards are portable, Git-friendly, and future-proof.

## Canvas Capabilities

- **Rich Cards & Shapes:** Place Markdown note cards, frameless resizable text labels, rectangles, diamonds, and callout nodes anywhere on the infinite 2D plane.
- **Magnetic Ports & Orthogonal Routing:** Connect nodes via magnetic anchor ports with clean orthogonal or curved routing.
- **Precision Layout Tools:** Toggle snap-to-grid alignment, multi-select bounding boxes, smooth zoom-to-fit viewport controls, and starter architecture templates.`,
  },
  {
    slug: 'features-graph',
    path: '/lumina/features/graph',
    section: 'Features',
    title: '2D & 3D Knowledge Graph',
    navLabel: '2D & 3D Knowledge Graph',
    subtitle:
      'Interactive 2D Canvas and 3D WebGL (Three.js) force-directed graph views computed by Rust.',
    summary:
      'Explore note relationships in 2D Canvas or 3D WebGL with cluster physics and persistent node positions.',
    sortOrder: 33,
    content: `## Real-Time Graph Indexing in Rust

Whenever you create or update a wikilink (\`[[note]]\`), \`crates/lumina_core\` updates the adjacency graph in sub-milliseconds using Rayon multithreading.

## 2D Canvas & 3D WebGL Modes

- **2D Force Graph (\`react-force-graph-2d\`):** Fast HTML5 Canvas rendering ideal for inspecting local neighborhoods, orphan notes, and hub nodes.
- **3D WebGL Graph (\`react-force-graph-3d\` + \`Three.js\`):** Immersive 3D spatial cluster exploration with camera orbit controls, directional link particles, and node glow highlights.
- **Persistent Node Coordinates:** Pin or drag nodes to organize clusters—positions are saved so your mental map stays consistent.`,
  },
  {
    slug: 'features-ai',
    path: '/lumina/features/ai-copilot',
    section: 'Features',
    title: 'AI Copilot & Local Semantic Memory',
    navLabel: 'AI Copilot & Local Models',
    subtitle:
      'Offline Ollama + @xenova/transformers local embeddings, or DeepSeek, OpenAI, and Claude with diff approval.',
    summary:
      'Use Lumina’s AI Copilot offline with Ollama and local embeddings or with cloud providers, complete with Approve/Reject diff cards.',
    sortOrder: 34,
    content: `## Offline-First or Cloud AI

Lumina never forces your notes through a proprietary middleman server:

- **100% Offline Local Mode:** Pair **Ollama** (Llama 3, Qwen, Mistral, DeepSeek-R1) with on-device vector embeddings powered by \`@xenova/transformers\` and stored locally in IndexedDB via **Dexie**.
- **Direct Cloud API Mode:** Connect your own API keys for **DeepSeek**, **OpenAI**, or **Anthropic Claude** directly from your desktop.

## 3 Focused Copilot Modes

1. **Planning & Strategy:** Brainstorm project roadmaps, system architecture, and structured outlines.
2. **Execution & Action:** Refactor notes, generate tables, translate text, and apply multi-section edits.
3. **Research & Analysis:** Query across your entire local vault using semantic vector similarity.

## Safety Controls: Diff Cards & Multi-File Undo

- **Inline AI Prompt (\`Ctrl + K\`):** Highlight any selection in the editor and press \`Ctrl + K\` to transform or expand it in place.
- **Approve / Reject Diff Cards:** AI edits are never applied blindly—review line-by-line additions and deletions and click **Approve** or **Reject**.
- **Multi-File Undo:** Roll back batch AI operations across multiple vault files in one click.`,
  },
  {
    slug: 'features-terminal',
    path: '/lumina/features/terminal',
    section: 'Features',
    title: 'Integrated Native Terminal (ConPTY / PTY)',
    navLabel: 'Integrated Terminal (ConPTY/PTY)',
    subtitle:
      'Real OS pseudoterminal powered by Rust portable-pty and WebGL-accelerated xterm.js (Ctrl + J).',
    summary:
      'Run PowerShell, Bash, Zsh, vim, ssh, and Python inside Lumina’s native ConPTY/PTY terminal.',
    sortOrder: 35,
    content: `## Native Rust \`portable-pty\` Engine

Press \`Ctrl + J\` anywhere in Lumina to toggle the integrated terminal drawer. Unlike simulated command runners, Lumina spawns a real OS pseudoterminal:

- **Windows:** Native **Windows ConPTY** supporting PowerShell, Command Prompt (\`cmd.exe\`), WSL, and Git Bash.
- **macOS & Linux:** Native **POSIX PTY** supporting Zsh, Bash, Fish, and custom login shells.

## WebGL-Accelerated \`xterm.js\`

- Full ANSI color and TrueColor support with GPU-accelerated glyph rendering.
- Runs interactive full-screen TUI applications including \`vim\`, \`neovim\`, \`ssh\`, \`python\` REPL, \`git log\`, and \`htop\`.
- Supports \`Tab\` autocompletion, \`Ctrl + C\` interrupt signals, and live terminal grid resizing—even while Zen Mode (\`Ctrl + .\`) is active.`,
  },
  {
    slug: 'features-exports',
    path: '/lumina/features/exports',
    section: 'Features',
    title: 'Theme-Accurate Exports & 50 Themes',
    navLabel: 'Exports & 50 Themes',
    subtitle:
      'Export notes to HTML, PDF (with auto-TOC), Word (.doc), Markdown, Plain Text, or ZIP across 50 curated themes.',
    summary:
      'Export single notes or entire vaults across 50 visual themes into HTML, PDF, Word, Markdown, Plain Text, or ZIP.',
    sortOrder: 36,
    content: `## 50 Curated Workspace & Export Themes

Lumina ships with **50 curated color and typography themes** spanning minimal light, high-contrast academic, warm editorial sepia, and deep developer dark palettes.

## Supported Export Formats

- **Print-Ready PDF:** Includes an automatically generated Table of Contents, page headers, rendered KaTeX equations, and Mermaid diagrams.
- **Self-Contained HTML:** Single-file HTML bundle with embedded theme CSS and vector diagrams ready to host or share.
- **Word (\`.doc\`):** Formatted document compatible with Microsoft Word, Google Docs, and LibreOffice Writer.
- **Markdown (\`.md\`) & Plain Text (\`.txt\`):** Clean portable text exports.
- **ZIP Archive:** Package an entire folder or vault snapshot into a portable compressed archive.`,
  },
  {
    slug: 'features-google',
    path: '/lumina/features/google-sync',
    section: 'Features',
    title: 'Google Drive & Gmail Integration',
    navLabel: 'Google Drive & Gmail Sync',
    subtitle:
      'Optional OAuth 2.0 loopback integration for direct Google Drive vault backups and Gmail workflows.',
    summary:
      'Back up notes or vaults directly to Google Drive and manage Gmail inside Lumina via local OAuth 2.0 loopback.',
    sortOrder: 37,
    content: `## Zero-Middleman OAuth 2.0 Loopback

Lumina’s Google integration is completely optional and executes **100% locally on your desktop**:

1. When you click **Connect Google Account** in Lumina Settings, Lumina starts a temporary local loopback listener on \`127.0.0.1\`.
2. You sign in directly with Google in your system browser and grant only the scopes you choose.
3. OAuth 2.0 tokens are stored locally on your machine and communicate directly with \`googleapis.com\` over HTTPS.

## Google Drive Backup Modes

- **Single Note Push:** Send an individual Markdown note or exported document to your Drive.
- **Bulk Folder Mirror:** Mirror your local vault structure to a designated Google Drive backup directory.
- **Compressed ZIP Backup:** Upload a timestamped \`.zip\` archive of your entire workspace for disaster recovery.

## Gmail Integration

- Read, search, organize, and send emails directly from the Lumina interface at your explicit direction—ideal for turning research threads or action items into local Markdown notes.`,
  },
]
