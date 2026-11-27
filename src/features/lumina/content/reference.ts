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

export const SHORTCUTS_DOC: LuminaDocPageDef = {
  slug: 'shortcuts',
  path: '/lumina/shortcuts',
  section: 'Reference',
  title: 'Keyboard Shortcuts',
  navLabel: 'Keyboard Shortcuts',
  subtitle: 'Default keyboard shortcuts for Windows, macOS, and Linux.',
  summary: 'Reference table of all keyboard shortcuts in Lumina.',
  sortOrder: 40,
  isStaticBaseline: true,
  content: `## Default Keybindings

| Shortcut | Action |
| --- | --- |
${LUMINA_SHORTCUTS.map((s) => `| \`${s.shortcut}\` | ${s.action} |`).join('\n')}

> [!TIP]
> On **macOS**, use \`Cmd\` in place of \`Ctrl\` for standard editor and tab shortcuts.`,
}
