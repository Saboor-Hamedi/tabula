Act as a senior frontend engineer and premium mobile UI/UX specialist.

I want you to audit and improve three existing mobile interfaces:

1. Article / Post Detail Page
2. Workspace / Sources Page
3. Posts Listing Page

These interfaces already work. This is a UI refinement task, not a complete redesign or architectural rewrite.

### 1. Design Direction

Establish one consistent visual language across all three screens.

Design characteristics:

- Premium dark interface.
- Near-black and dark charcoal backgrounds.
- Existing turquoise/teal accent color.
- Subtle borders and restrained surface contrast.
- Clean typography and consistent spacing.
- Professional, minimal, modern appearance.
- Excellent mobile responsiveness.

Avoid:

- Excessive rounded cards.
- Unnecessary gradients.
- Excessive shadows and glowing effects.
- Oversized headings.
- Excessive empty space.
- Unnecessary dashboard widgets.
- Excessive animations.
- Making everything look like a generic AI-generated dashboard.

Preserve the existing brand identity, logo, colors and established design language.

### 2. Article / Post Detail Page

Improve the article reading experience.

Requirements:

- Redesign the top action toolbar for mobile.
- Prevent "All posts" and other navigation labels from wrapping awkwardly.
- Move secondary actions such as Unpublish and Delete into a contextual menu.
- Keep Share and Copy Link accessible.
- Improve article title sizing and typography.
- Establish consistent spacing between headings, paragraphs and sections.
- Improve rendering of Markdown elements, including tables, code blocks, lists, quotes and images.
- Make the reading area comfortable on narrow screens.
- Improve author metadata and reading statistics.
- Implement a contextual back-to-top button.

The article should feel like a premium publishing platform, not an ordinary social media post.

### 3. Workspace / Sources Page

Improve the workspace layout without changing its functionality.

Requirements:

- Reduce unnecessary vertical spacing.
- Make the workspace header compact.
- Improve the Export Analysis component.
- Refine the Sources section hierarchy.
- Redesign Add Source with a clean dashed-outline treatment.
- Improve source cards, including file icons, filenames, file types, row counts and action buttons.
- Ensure multiple sources can be displayed efficiently.
- Make the account/profile section more compact.
- Keep Sources, Chat and Studio navigation accessible at the bottom.
- Ensure the layout adapts properly to different phone dimensions.

Do not introduce unnecessary statistics or widgets simply to occupy empty space.

The workspace should feel like a focused professional productivity application.

### 4. Posts Listing Page

Improve the mobile browsing experience.

Requirements:

- Fix the search header so it never overlaps post content.
- Correct sticky header positioning and content offsets.
- Improve post card proportions and spacing.
- Make visualization previews responsive.
- Prevent enormous empty image placeholders.
- Preserve actual chart, diagram and image previews whenever available.
- Improve title and description hierarchy.
- Make author information, publication date, views and reading time visually consistent.
- Reduce unnecessary vertical space between cards.
- Improve floating back-to-top button positioning and visibility.
- Ensure the final content does not become obscured by fixed interface elements.

### 5. Responsive Engineering

Test all three screens at different mobile widths.

Pay particular attention to:

- 320px
- 360px
- 375px
- 390px
- 412px
- 430px

Requirements:

- No horizontal overflow.
- No overlapping elements.
- No text clipping.
- No awkward button wrapping.
- No content hidden behind sticky headers or bottom navigation.
- Proper handling of long titles and filenames.
- Consistent safe-area handling on Android and iOS.

### 6. Component Architecture

Do not duplicate components or introduce unnecessary abstractions.

First inspect the existing project architecture.

Identify shared elements that should be reused, such as:

- Mobile header.
- Action toolbar.
- Author metadata.
- Post card.
- Source card.
- Empty states.
- Floating action buttons.
- Bottom navigation.

Keep screen-specific components separate where appropriate.

Respect the existing framework, styling conventions and component architecture.

### 7. Implementation and Validation

Before making changes:

1. Inspect the three existing screens.
2. Identify their actual components and styles.
3. Understand existing responsive behavior.
4. Identify shared components and potential regressions.

Then implement the improvements.

After implementation:

- Test all three screens.
- Verify scrolling behavior.
- Verify sticky headers and bottom navigation.
- Check long content and large visualizations.
- Ensure existing functionality remains intact.
- Check desktop layouts for regressions.
- Run the existing build and relevant tests.

Do not modify unrelated screens or functionality.

The final result should be cohesive, polished, lightweight and production-ready.
