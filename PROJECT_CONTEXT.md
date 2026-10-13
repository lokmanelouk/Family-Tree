# Family Tree Project Context

This document is a handoff for continuing work in another ChatGPT/Codex account. It summarizes the conversation context available in this session and the repository state inspected on 2026-10-13. It is not a product specification: where a request was reverted, not completed, or only partly implemented, that is called out below.

## Conversation-history availability

The project-related messages visible in this conversation were reviewed. Two earlier user messages refer to text pasted from Windows attachment files, but the attachment contents themselves are not present in the accessible conversation context. Their titles indicate UI and tree-layout requests, but their detailed requirements cannot be recovered from here. No claims in this document rely on guessing what those files said.

## Project overview

Family Tree is a client-side genealogy tree application for building, exploring, and editing a family tree. The current app is a React + TypeScript + Vite SPA. It uses sample Morgan family data and in-memory reducer state; there is no backend, database, authentication, or cloud synchronization.

The current product direction is a focused, professional family-tree workspace: a spacious, pan-and-zoom canvas is the main screen, with compact person nodes, relationship lines, tree controls, and a details drawer. The dark charcoal theme is the default; blue-slate dark and soft-light themes are also present. English and Arabic are supported, with the document and app switching between LTR and RTL.

## Technologies and commands

Versions below are the dependency ranges recorded in `package.json` at the time of inspection:

- React / React DOM `^19.2.8`
- TypeScript `~6.0.2`
- Vite `^8.3.0`, `@vitejs/plugin-react` `^6.1.1`
- Tailwind CSS v4 `^4.3.3`, configured with the official `@tailwindcss/vite` plugin in `vite.config.ts`
- `lucide-react` `^1.55.0`
- ESLint `^10.10.0`
- No Dagre, ELK, Radix, Shadcn, or other tree-layout/UI dependency is currently listed.

Commands:

- `npm run dev` — local Vite development server
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — `eslint .`
- `npm test` — Node’s built-in test runner with `--experimental-strip-types`, currently targeting `src/lib/tree-logic.test.mjs`
- `npm run preview` — preview the production build

The last implementation turn reported successful build and lint. The automated test command was not run in that turn.

## Architecture and useful files

- `src/App.tsx` — wraps the dashboard and floating quick-links menu in `LanguageProvider`.
- `src/pages/DashboardPage.tsx` — app composition and UI state: theme, node mode, focus, branch colors, selection, collapsed branches, zoom, dialogs, import/export, and toolbar callbacks.
- `src/hooks/useFamilyTree.ts` — reducer-backed family member changes and undo/redo history. The tree itself is currently held in memory, starting from `src/data/family.ts`.
- `src/types/family.ts` — `FamilyMember` and `RelationshipKind`. `gender` currently has type `'male' | 'female'` but is optional to accommodate older imported data.
- `src/data/family.ts` — sample Morgan family, currently with gender values set for all six people.
- `src/data/avatar-presets.ts`, `src/components/family-tree/AvatarIllustration.tsx`, `FamilyAvatar.tsx` — locally rendered illustrated avatars/presets; no Unsplash portraits are used for family members.
- `src/components/family-tree/FamilyTreeCanvas.tsx` — viewport, pointer panning, zoomed tree world, connector SVG, tree node rendering, expand/collapse, select, drag proposals, center view, and Auto-organize action.
- `src/lib/tree-layout.ts` — custom relationship-derived generation layout, chronological sibling ordering, partner adjacency, connector path helpers, branch color generation, and connector bridge support. No third-party hierarchical graph engine is used.
- `src/lib/tree-logic.ts` — relationship checks and mutations, new-person construction, visibility/lineage helpers, deletion, and profile changes.
- `src/components/family-tree/PersonCard.tsx` — card/circle node presentation and contextual actions.
- `src/components/family-tree/TreeToolbar.tsx` — visible search, add person, zoom/fit, card/circle selection, branch visibility, undo/redo, export, and restore controls.
- `src/components/family-tree/AddFamilyMemberDialog.tsx` — add-person form, gender choice, relationship selection, parent selectors, profile photo/avatar picker, and duplicate warning.
- `src/components/family-tree/DatePicker.tsx` and `src/lib/birth-date.ts` — masked manual birth-date input, validation, and year/month/day popover.
- `src/components/family-tree/FamilyMemberPicker.tsx`, `RelationshipKindPicker.tsx`, `ProfileAvatarPicker.tsx` — reusable form controls.
- `src/components/family-tree/MemberDetailsPanel.tsx` — selected person’s details and linked relatives.
- `src/components/dialogs/RelationshipChangeDialog.tsx`, `ConfirmationDialog.tsx` — proposed relationship changes and confirmations.
- `src/components/layout/TreeSidebar.tsx` — sidebar navigation, quick stats/root branches, theme and language actions, and footer.
- `src/components/animata/fabs/flower-menu.tsx`, `flower-menu.css`, `FamilyQuickLinks.tsx` — locally implemented floating Flower Menu and links.
- `src/i18n/LanguageProvider.tsx`, `LanguageContext.ts`, `useLanguage.ts` — language choice, translation lookup, and persisted `family-tree-language` preference.
- `src/App.css`, `src/index.css` — application styling and global Tailwind v4 import/styles.
- `src/lib/tree-backup.ts` — version-1 JSON export/import validation.
- `src/lib/family-search.ts` — member search and duplicate-candidate checks.
- `src/lib/tree-history.ts` — undo/redo snapshots.
- `src/lib/tree-logic.test.mjs` — existing logic tests.

## Current implemented behavior

### Tree layout and interaction

- Node coordinates are derived from relationship data, not saved as relationship data. The custom layout creates generation rows from parent links, groups children by common parent IDs, orders siblings by birth date where available, and puts spouses adjacent in a row.
- Parent-child connector paths are generated from parent pair midpoints through a shared branch to their child row. The most recent canvas cleanup removed sibling connector rendering, which had produced unwanted sideways dotted lines. Existing sibling IDs can still be present for compatibility/layout fallback, but are not drawn as sibling strokes on the canvas.
- Partner connectors use dashed amber/gold styling. Parent-child lines use dynamically selected couple/branch colors; root branch colors are on by default. A blended color is derived for people with multiple root lineages. Unrelated relationship lines dim when a person is hovered/selected; crossing routes may receive bridge styling.
- Rectangle cards and circular nodes are supported. Selection is highlighted and opens the person details panel. Branches can be individually collapsed/expanded or controlled in bulk.
- Canvas supports zoom, center/fit, pointer panning, search-result navigation, drag-and-drop proposals, and relationship confirmation before a proposed drag relationship is applied.
- “Auto-organize” is adjacent to the canvas “Center tree” control. It expands collapsed branches, clears focus mode, computes a zoom fit for the selected node mode, and recenters. Since positions are derived automatically from the relationship graph, this action does not persist or alter relationships.
- The layout algorithm is custom. It is not a Dagre/ELK implementation and complex multi-marriage/crossing behavior should be reviewed against realistic larger data before claiming globally optimal crossing reduction.

### Creating and editing people

- The add-person dialog requires an explicit Male/Female selection for newly created people.
- A person added as a descendant or sibling in a non-empty tree must be linked to one existing male Father and one existing female Mother. The dialog offers two gender-filtered member pickers. It can prefill parents from the chosen person’s own parents (sibling flow), or from the chosen person and an existing spouse (child flow); the user can change either parent.
- Newly created children and siblings get both selected parent IDs. Their card role is Son or Daughter based on selected gender. A created spouse is linked directly to the selected partner and is created without parent links.
- Creating a parent attaches the new person to the existing person’s parent IDs and rejects adding a second parent of the same known gender.
- The card badge renderer hides “Sibling” and maps a legacy “Child” badge to Son/Daughter if gender is known; legacy Child with unknown gender has no badge. Other explicit relationship labels remain.
- Profile avatars support the app’s illustrated presets and local image uploads. A details-panel avatar can also be changed.
- Potential duplicate people are surfaced by name/date and are not automatically merged.
- Family relationships can be proposed by dragging a person onto another person; confirmation/cancel happens through a dialog. Existing relationship checks cover self-links, duplicate links, cycles, and invalid partner ancestry/sibling cases.

### Dates

- The birth-date field takes digits and formats them as `YYYY-MM-DD`. Four-digit years are retained for approximate historical dates.
- Backspace/Delete at a separator removes the neighboring digit and restores a usable caret position.
- Month/day validity and future-date checks are surfaced as errors; invalid/incomplete/future birth dates disable the add-person submit button. Future year/month/day cells are disabled in the calendar.
- The calendar opens directly at the year grid. It drills down Year → Month → Day; selecting a day commits and closes it. Year-range/century/decade navigation supports historical jumps. The prior “Select year only” footer action was removed; enter a four-digit year in the text field instead.

### Navigation, preferences, and backup

- Sidebar includes navigation, quick statistics, root branches, theme and language controls, and a footer/help area.
- Themes: charcoal dark (default), blue-slate dark, and soft-light. Theme preference is persisted in `localStorage` as `family-tree-theme`.
- English/Arabic choice is persisted as `family-tree-language`; `<html>` and the app receive the matching language/direction. User-entered names are not translated.
- Toolbar search is visible and has a Ctrl/Cmd+K shortcut. Search results navigate to and reveal the selected person.
- JSON backup/export supports the full tree and a selected branch; restore validates the backup and asks for confirmation. This is the interim portability mechanism; people are otherwise held in memory, so refresh persistence/cloud sync is not implemented.
- Undo/redo applies to supported reducer changes.

### Floating Flower Menu

- The fixed bottom-right Flower Menu is mounted outside the dashboard layout through `FamilyQuickLinks`.
- It has nine entries: GitHub (`https://github.com/lokmanelouk`), YouTube, Instagram, Facebook, Twitter/X, LinkedIn, Discord, Report Issue, and Ko-fi (`https://ko-fi.com/lbostani`).
- GitHub and Ko-fi links are known; the other social/report links are `#` placeholders because the user did not provide actual URLs. Do not invent replacement links.
- The custom Ko-fi SVG and social SVG marks are in `FamilyQuickLinks.tsx`. `flower-menu.css` supports reduced motion. The container should remain viewport-fixed with enough edge spacing so petals are not clipped.

## Design decisions and user preferences

The visual direction changed during the conversation. Early requests favored a playful, warm, pastel illustrated family-tree product. Later and more specific requests redirected the current interface toward a clean, polished dark professional workspace; the latest direction takes precedence. Retain the illustrated family avatars, but use the current restrained charcoal/blue-slate/soft-light themes instead of rebuilding the whole application around the early pastel concept.

The user’s repeatedly stated design preferences:

- Make the tree itself the focus; prioritize relationship clarity, sensible generation layout, readable connectors, sibling grouping, and parent-pair midpoint routing over decorative dashboard sections.
- Use a charcoal or blue-slate dark palette by default, with a comfortable soft-light option, subtle borders/accents, clear text contrast, rounded corners, and restrained gradients. Keep blur, shadows, and animation modest and performance-conscious.
- Use a consistent Lucide icon style for app controls, with tooltips/accessible labels for icon-only actions.
- Keep visible search and “Add person” in the main toolbar; group canvas actions logically. Theme/language live in the sidebar. Keep navigation distinct from floating action menus.
- Support responsive desktop/tablet/mobile layouts, Arabic RTL, and reduced-motion preferences.
- Use consistent locally rendered cartoon/illustrated avatars rather than realistic stock portraits or external portrait URLs.
- Selected person and connected lineage should be visually clear. Branch colors are optional as a visual aid, but enabled by default and never substitute for relationship data.
- No extra dashboard filler (family activity feed, stories, “up next”) was wanted in the redesigned tree-focused screen.

Animata discussion:

- The user asked to inspect specific Animata examples and use only components that improve the app. Speed Dial was preferred for contextual add actions; Flower Menu was later explicitly requested and added for social links. Do not add a redundant second floating menu.
- Stacked Sections and Shooting Stars were explicitly rejected for the interactive tree canvas. Orbiting Items was optional only and must never replace the actual tree layout. Card Comment/Status Button/Get Started Button were conditional ideas, not requirements to add without relevant real features.
- Do not invent imports from an Animata package. Existing menu code is local React/CSS.

## Conversation decisions and corrections to preserve

- The user repeatedly emphasized “inspect first,” implement in the actual existing codebase, preserve the React/Vite setup and useful work, keep files modular, and avoid replacing the project/framework.
- A request for auth and family sharing (share link, invite/view/edit, user profile menu) was explicitly followed by “Revert the last changes you made.” Current tree sharing/auth should therefore be treated as not implemented and not silently restored. Before revisiting, honor that the prior UI changes were reverted. Shared cloud access would require a separate, explicit new scope; private family data must not be exposed through public links without authorization.
- JSON backup/export was requested as the interim sharing/portability direction before real shared cloud storage exists.
- The user prefers implementation over repeated audits/plans. When a feature is requested, inspect enough to avoid regressions, then implement and report actual results. Do not claim unimplemented behavior works.
- Do not remove existing features to simplify implementation, do not place the entire app in one file, and do not introduce dependencies or frameworks without need.
- The user sometimes explicitly asks for build, lint, or tests. Follow the latest request; do not claim tests passed unless they were actually run.

## Pending work and known limitations

These items are not implemented or should be validated before presenting them as complete:

1. **Shared trees/authentication:** No sign-in, invitation, permission model, server, realtime sync, or secure share links exist. Share-related UI files (`ShareDialog.tsx`, `AccountMenu.tsx`, `SharedTreePage.tsx`) were deleted/reverted in the current working tree. The current app is local-only apart from browser preference storage and manual JSON backup.
2. **Social URLs:** YouTube/Instagram/Facebook/Twitter/X/LinkedIn/Discord and Report Issue currently point to `#`. Ask for actual URLs if those links should work.
3. **Persistence:** Family edits are reducer state only and will not survive reload unless the user exports a backup. No database/local tree persistence was implemented.
4. **Gender compatibility:** `FamilyMember.gender` remains optional for old backups. Newly created records require a gender in the add dialog and creation logic. Legacy/imported records without gender may not receive Son/Daughter badges and will not appear in the gender-filtered parent pickers until their gender can be edited/backfilled. A migration/editor for legacy gender values is not implemented.
5. **Relationship validation beyond creation:** New descendant creation requires male/female parents, but review `validateRelationship` and relationship-change/drop flows before claiming they enforce all gender-specific father/mother limits for later relationship edits. The general graph validation is separate from the creation form.
6. **Layout edge cases:** Layout is hand-written rather than Dagre/ELK. Multi-partner families, multiple marriages, cross-branch children, missing parent records, identical names/dates, large trees, and canvas crossing quality deserve continued validation. Auto-organize currently recomputes the derived layout/zoom and recenters; it does not save manual coordinates (none exist) or modify relationship records.
7. **Tests:** `npm test` exists and the tests cover tree logic/layout; it was not run in the latest gender/parent-flow implementation turn. Run it when the user requests verification or before a substantial follow-up to logic behavior.
8. **RTL/localization:** There is a large Arabic dictionary in `LanguageProvider.tsx`; inspect its actual rendered encoding before broad localization changes. PowerShell output in this session displayed many pre-existing Arabic entries as mojibake, while recent new strings were added as Unicode. Verify in browser before rewriting translations.
9. **Uncommitted work:** The inspected Git working tree has many modified files and some deletions, including the share/account/shared-page deletions noted above. Check `git status` and preserve the user’s current changes before making edits; do not assume the working tree is clean.

## Working preferences for the next Codex session

- Work in `C:\Users\Lokmane\Documents\Familie Tree\Family Tree`; inspect relevant files before edits.
- Preserve current architecture and user data; changes should be incremental and modular, with tree algorithms/dialogs/styles in appropriate files.
- Keep communications concise and concrete. Report what changed, why, verification performed, and any real limitation. Avoid stopping at an audit when implementation has been requested.
- Do not add a backend, database, authentication, Electron, or a new framework unless the user explicitly reopens that scope.
- Do not infer relationships based on node positions. Relationship records are authoritative; coordinates are a presentation derived from those records.
- Treat the most recent request as steering the current goal while retaining earlier constraints. Explicit reversions and corrections remain important.
- Current workspace permission in the prior account was limited to this repository. This document was requested as the only file to create for this handoff.
