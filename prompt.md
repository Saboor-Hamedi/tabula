Act as a senior product designer specializing in subtle, high-craft dark-mode interfaces (Linear / Raycast aesthetic) and refine the mobile responsiveness, typography, contrast, and visual hierarchy of the **Tabula** landing page (`LandingPage` / `/landing` route).

Please inspect the landing page components and apply the following exact UI/UX improvements without breaking existing functionality or desktop layouts:

1. **Primary CTA Button Contrast & Hero Polish**
   - Change the text and icon color on all solid mint primary buttons (`Open Workspace →`, `Search`) from white to deep obsidian (`text-[#090D16] font-semibold`) so they achieve crisp AAA contrast against the `#2DD4BF` / teal background.
   - Give the hero section slightly more top breathing room on mobile (`pt-14 pb-10`) and tighten the main headline (`leading-[1.12] tracking-tight`).
   - Fix the 2×2 stats card (`100%`, `0 Bytes`, `Instant`, `Safe`) by replacing any uneven vertical divider lines with a clean symmetrical 2-column CSS grid using subtle hairline borders (`divide-x divide-y divide-white/[0.06]`) and centered alignment inside each quadrant.

2. **Interactive Demo Section (`How It Works`)**
   - **Mobile Scenario Switcher:** On mobile viewports (`< 640px`), convert the 3 stacked scenario selector cards (`Customer Retention & Churn`, `Medical Research Trials`, `Quarterly Sales & Expenses`) into a horizontal scrollable row of compact pills (`flex overflow-x-auto snap-x gap-2.5 no-scrollbar`) so users can see the scenario tabs and the live preview window on the same screen without excessive scrolling. Keep the 3-column desktop layout intact (`sm:grid sm:grid-cols-3`).
   - **Terminal Header Alignment:** Inside the simulated browser/terminal header, prevent `"Customer_Activity.xlsx • 1,248,500 rows"` from wrapping awkwardly next to the `"Processed in 0.04s"` pill. Display the filename on the top line (`text-xs font-medium text-slate-200 truncate`) and the row count directly underneath (`text-[11px] text-slate-400`), while keeping the green `"0.04s"` badge `whitespace-nowrap shrink-0`.
   - **Flatten Nested Card Borders:** Eliminate heavy "box-inside-a-box" borders inside the demo output panel. Replace the outer borders on `YOUR QUESTION`, `Automated Local Calculation`, `INSTANT VISUAL BREAKDOWN`, and `EXECUTIVE SUMMARY` with subtle surface elevation (`bg-white/[0.025]`) and soft `1px` dividers (`border-white/[0.06]`).

3. **Published Posts Section**
   - Unify the search bar by placing the **Search** button cleanly inside the right side of the rounded input container (`flex items-center p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]`) rather than floating outside it.
   - If no posts exist in the database yet (`posts.length === 0`), hide this entire section on the public landing page instead of rendering a `"No posts published yet"` empty state box, so first-time visitors don't see an empty placeholder.

4. **Privacy Comparison Cards (`Your Data Stays With You`)**
   - In the **Total Local Privacy** card, replace the misaligned 2-column label/description layout with a clean stacked layout matching the **How Traditional Software Works** card above it: green checkmark + bold white title on the first line (e.g., `0 bytes uploaded`), and muted gray explanation (`text-slate-400 text-sm`) indented cleanly underneath.
   - Give **The Tabula Guarantee** card a subtle top radial emerald glow (`bg-gradient-to-b from-emerald-500/[0.08] to-transparent border-emerald-500/25`) so it visually stands out as the clear winner over the muted red comparison card.

5. **FAQ Accordion & Footer Cleanup**
   - Replace the 6 heavy bordered FAQ boxes with a cleaner, lighter full-width hairline accordion (`divide-y divide-white/[0.08]`) with generous vertical padding (`py-5`) and smooth chevron rotation.
   - In the footer, remove the accidental underline on the `Tabula` brand link (`no-underline`) and remove the redundant `Dark` theme toggle button at the very bottom (since the theme toggle already lives in the top navbar).

Show me a summary of the files updated and verify there are no TypeScript or Tailwind class issues.
