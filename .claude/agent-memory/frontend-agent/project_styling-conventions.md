---
name: styling-conventions
description: tenant-response styling — lavender/ink design tokens in globals.css (authoritative), CSS Modules vs Tailwind split, modal chrome pattern
metadata:
  type: project
---

**Design tokens live in `app/globals.css` `:root` and are the single source of truth for color — always read globals.css for current values, never hardcode hex/rgba.** As of the "feat: new colors" commit (git 0e9277d), the palette is a **lavender/ink** scheme, NOT the older blue one:
- Core: `--color-ink` #2a225c (primary text + primary buttons/accents/dark surfaces), `--color-ink-hover` #3b3180, `--color-accent`/lavender-400 #7371fc, `--color-on-ink`/`--color-btn-text` = lavender-50 #f5efff.
- Backgrounds: `--color-bg-base` / `--color-bg-surface` = lavender-50 #f5efff, `--color-bg-sunken` = lavender-100 (hover/sunken/badges).
- Text: `--color-text-primary` (=ink), `--color-text-secondary` #5c5294, `--color-text-muted` #8277b6.
- Borders: `--color-border`, `--color-border-subtle`, `--color-border-strong`. Inputs: `--color-input-bg`, `--color-input-border`, `--color-input-border-focus` (=lavender-400).
- Semantic: `--color-danger` #d64545 + `--color-danger-bg`; `--color-success` #1e9e6c + `--color-success-bg`; `--color-warning` #b7791f + `--color-warning-bg`. Escalation/failure = danger (red); partial-failure/attention = warning; all-clear = success.
- Overlays (modal scrims): `--color-overlay` rgba(42,34,92,0.5), `--color-overlay-subtle`.
- Shadows: `--shadow-hairline/card/card-hover/drawer/modal/button/button-hover/focus`. **`--shadow-modal` NOW EXISTS** (0 20px 60px rgba(42,34,92,0.26)) — earlier memory said it didn't; use it for modal panels.
- Radius: `--radius-sm/md/lg/xl/bubble/pill`.
- Fonts: body uses `var(--font-nunito)`. (Layout may also expose geist vars.)

**Two coexisting styling approaches:**
- **CSS Modules** (`*.module.css`) for layout shells and everything under `components/conversations/*` + the properties section. These reference the token vars directly (`var(--color-…)`).
- **Tailwind v4 utility classes** for newer dashboard/data-display components (overview, maintenance, settings, dashboard charts). Newer Tailwind work references CSS vars via arbitrary properties — `[color:var(--color-text-primary)]`, `[background:var(--color-ink)]`, `shadow-[var(--shadow-modal)]`, `rounded-[var(--radius-xl)]`. `components/maintenance/TicketList.tsx` is the canonical Tailwind example.

**Which one for a NEW component?** Follow the closest precedent by directory. `components/conversations/*` → CSS Module (even for new modals — I built the mass-text feature as a CSS Module). `components/maintenance/*` and `components/dashboard/*` → Tailwind arbitrary-var. Reserve module.css for chrome/layout + conversation/property components.

**Modal chrome pattern (reusable):** the maintenance `TicketModal`/`NewTicketModal` (Tailwind) is the reference — `fixed inset-0 z-50` overlay with `var(--color-overlay)`, click-outside via `e.target === e.currentTarget`, Escape-to-close, **bottom-sheet on mobile / centered card on desktop** (`items-end` + `rounded-t-[var(--radius-xl)]` → `md:items-center` + `md:rounded-[var(--radius-xl)]`), header (title + X) / scrollable body (`max-h-[calc(92vh-160px)] md:max-h-[70vh] overflow-y-auto`) / footer buttons. `EditContactPanel` is the side-drawer variant. For conversations I replicated this bottom-sheet behavior in a CSS Module (`MassTextModal.module.css`) via a `@media (min-width: 768px)` block rather than Tailwind — same visual result, keeps the directory cohesive.

**Anti-zoom input rule:** text inputs/textareas use `font-size: 1rem` (not smaller) — a deliberate fix (commit 9b726ef "fixed text input zoom") so iOS Safari doesn't zoom on focus. Keep new inputs at ≥1rem.

**Grouped-checkbox / indeterminate UI:** native checkboxes have no JSX `indeterminate` prop — set it imperatively via a ref + `useLayoutEffect` (`el.indeterminate = selectedCount > 0 && selectedCount < total`), with `checked={allSelected}` as the controlled prop. `EditContactPanel`'s per-property `<optgroup>` is the precedent for property/unit grouping/labeling. Unassigned/no-property bucket convention = key `'__unassigned__'`, label "Unassigned".

**Escalation is RED app-wide** (`--color-danger`): escalated-conversation badges + the conversation-list escalated dot. **Maintenance is a Kanban board** (`components/maintenance/TicketList.tsx`, default export `TicketBoard`): 4 columns New/In Progress/In Review/Resolved (resolved+closed→Resolved), priority dot-badge from severity, deterministic assignee-avatar color.
