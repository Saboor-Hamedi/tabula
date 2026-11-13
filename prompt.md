Act as a senior product designer specializing in quiet, high-craft, editorial interfaces (NotebookLM / Linear aesthetic) and refactor the **Tabula Workspace** (`/:username/workspace` or `Workspace` component) to match the refined floating 3-pane layout while preserving all existing DuckDB-WASM, Supabase Auth, token tracking, and AI chat functionality.

Please inspect the workspace component and apply these exact design and responsive layout rules:

1. **Floating 3-Pane Shell with `5px` Border Radius**
   - Wrap the entire workspace in a `h-[100dvh] w-full overflow-hidden flex flex-col` outer shell (`bg-[#F1F0EC]` in light mode, `bg-[#131315]` in dark mode) so mobile browser bars on iPhone, Xiaomi, and Android never clip the bottom composer.
   - Render the **Left Sources Sidebar**, **Center Chat Canvas**, and **Right Studio Panel** as floating cards separated by `gap-2 lg:gap-2.5` with **`rounded-[5px]`** on all four corners and `1px` hairline borders (`border-[#E2E1DC] dark:border-[#29292E]`, surface `bg-[#FFFFFF] dark:bg-[#1B1B1E]`).
   - Support collapsible desktop side rails (`lg:w-11`) for both the left and right panels.

2. **Unified Top App Bar**
   - Keep a single slim top header (`h-12 px-2.5 sm:px-3.5`) containing:
     - **Left:** Tabula brand mark (`rounded-[5px]`), active workspace/file title, and a subtle `Local Workspace` badge.
     - **Right:** `New analysis` button (`rounded-[5px]`), `Export` button, Light/Dark theme toggle, `TRIAL` (or subscription tier) badge, and user avatar.

3. **Left Sidebar: Selectable Sources + Compact Trial Meter**
   - Add a `+ Sources` and `+ Note` 2-column action row (`rounded-[5px]`), a live file filter input, and a `Select all sources` toggle with individual file checkboxes so users can control which loaded spreadsheets are included in the active query context.
   - Pin a clean, minimal trial/token progress footer at the bottom of the left card (`tabular-nums`, `2px` progress bar, and an `Upgrade` link) without heavy gradients or clutter.

4. **Center Research Memo Canvas & Untouched Composer**
   - **Editorial Memo Flow:** Render user questions as clean headings (`text-[15.5px] sm:text-[16.5px] font-semibold`) above a `max-w-[660px]` centered column rather than chat bubbles.
   - **Connected Progress Stepper & Diagnostic Strip:** Display a clean step-by-step progress/diagnostic strip (`grid-cols-1 sm:grid-cols-3 gap-2`) with subtle `rounded-[5px]` surface cards (`bg-[#FAF9F6] dark:bg-[#222226]`) and restrained left-border highlights for key insights.
   - **Margin Actions:** Include subtle `Copy` and `Save to Studio` actions below each AI response (visible on touchscreens, hover-revealed on desktop).
   - **Adaptive Follow-Up Prompts:** Display the 4 suggested follow-up prompts as a horizontally swipeable strip on narrow phones (`flex overflow-x-auto snap-x sm:grid sm:grid-cols-2`) so the chat area stays spacious when the mobile keyboard opens.
   - **DO NOT change the bottom textarea design:** Keep the exact rounded composer box (`rounded-2xl bg-[#F4F4F5] dark:bg-[#242428]`) with `"Ask questions, analyze trends, or request a summary..."`, `"Enter to send · Shift+Enter for a new line"` on the bottom left, and the `w-8 h-8 rounded-lg` `↑` send button on the bottom right—with **no file chips or extra badges inside the textarea**.

5. **Right Studio Panel (`Data` | `Notes` | `Results` | `Activity`)**
   - Use a flush 4-tab switcher (`Data`, `Notes`, `Results`, `Activity`) with a clean active underline/pill indicator.
   - Include a 2-column **Quick Studio** grid (`Executive Summary`, `Data Table`, `Trend Breakdown`, `Cohort Comparison`, `Outlier Audit`, `Study Guide`) that generates pinned cards into a **Saved Outputs** list below it, alongside full views for the live DuckDB data table preview, manual Studio notes, pinned result tables, and local execution audit logs (`0 bytes uploaded`).

6. **Mobile & Tablet Navigation (`< 1024px`)**
   - On viewports below `lg` (`< 1024px` — iPhone, Xiaomi, Android, iPad portrait), display one active panel at a time (`Sources`, `Chat`, or `Studio`) controlled by a clean `rounded-[5px]` 3-segment bottom navigation bar (`lg:hidden`) so nothing ever squashes horizontally.

Show a brief summary of the files modified and verify there are no TypeScript errors or layout overflow issues on mobile viewports.
