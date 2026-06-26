---
name: styling-conventions
description: tenant-response styling — design tokens in globals.css, CSS modules for layout shells vs Tailwind utilities for newer pages
metadata:
  type: project
---

Two coexisting styling approaches:
- **CSS Modules** (`*.module.css`) for layout shells and the conversation/property components (e.g. `dashboard.module.css`, `ConversationList.module.css`, `IconSidebar.module.css`). These reference design-token CSS variables.
- **Tailwind v4 utility classes** for newer dashboard pages (overview, conversations split-pane, maintenance). Arbitrary-value utilities like `text-[#344767]` and `shadow-[0_4px_24px_rgba(52,71,103,0.10)]` map to the token palette.

**Design tokens live in `app/globals.css` `:root`.** Key values to reuse:
- Brand: `--color-brand` #1976d2, `--color-brand-dark` #1565c0 (primary accent for active states/buttons)
- Backgrounds: `--color-bg-base` #f0f4f8 (page canvas), `--color-bg-surface` #ffffff (cards), `--color-bg-elevated` #e8f0fe (active highlight), `--color-bg-hover` #f5f8ff
- Text: `--color-text-primary` #344767, `--color-text-secondary` #7b809a, `--color-text-muted` #b0b7c3
- Card shadow: `0 4px 24px rgba(52,71,103,0.10)`; radius scale `--radius-sm/md/lg`

**Dashboard chrome:** the icon sidebar (`components/sidebar/IconSidebar.tsx`) is a dark rail (#1e293b, ~64px) with white icons and `--color-brand-dark` active state. Brand logo asset is `/tenatimmy_solo.png`. Sidebar nav routes: `/dashboard` (Overview, exact match), `/dashboard/conversations`, `/dashboard/properties`, `/dashboard/maintenance` (latter three match by prefix for active state).

Severity badge color convention (maintenance tickets): mild=yellow (`bg-[#fef9c3] text-[#854d0e]`), moderate=orange (`bg-[#ffedd5] text-[#9a3412]`), severe=red (`bg-[#fee2e2] text-[#b91c1c]`).
