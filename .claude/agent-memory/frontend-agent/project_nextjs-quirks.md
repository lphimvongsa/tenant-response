---
name: nextjs-quirks
description: Next.js 16 + React 19 lint/build quirks in tenant-response — purity rule on Date.now, tolerated img warning, App Router conventions
metadata:
  type: project
---

Next.js 16.2.4 with React 19.2.4. App Router. Standard async server components, `usePathname` from `next/navigation`, Tailwind v4 via `@import "tailwindcss"` (no config file).

**The `react-hooks/purity` ESLint rule errors on impure calls in a component render body.** `new Date(Date.now() ...)` inline in a server component render is an *error*, not a warning.
- **Why:** React 19's compiler-aligned lint rules treat render bodies as pure.
- **How to apply:** When a server/client component needs the current time during render, wrap the `Date.now()` call in a module-level helper function and call that helper. The lint rule does not flag calls made through a named helper.

**The `@next/next/no-img-element` warning (using `<img>` instead of `next/image`) is a tolerated, pre-existing convention.** The original `components/sidebar/SidebarTabs.tsx` uses `<img>` and emits this warning. New sidebar/brand-logo code using `<img>` is consistent with the codebase — it is a warning, not an error, and does not need to be "fixed."

**`@typescript-eslint/no-unused-vars` uses the default `after-used` behavior — eslint.config.mjs adds NO `argsIgnorePattern`, so a `_`-prefix does NOT silence it.** A `useActionState` server action typed `(prevState, formData)` where you only read `formData` is clean because the rule ignores unused args *before* a used one (this is why `_prev` in AuthForms + most Settings actions is fine). But an action that reads NEITHER param (e.g. a regenerate/rotate action) flags BOTH.
- **How to apply:** For a useActionState action that uses no params, drop the params entirely — `regenerateJoinCodeAction(): Promise<State>`. A function with fewer params is still assignable to the `(state, payload) => ...` action type, and useActionState still calls it with args that are simply ignored. Cleaner than an eslint-disable.

Verify changes with `npx tsc --noEmit` and `npx eslint <files>`. Scripts: `dev`, `build`, `lint` (bare `eslint`), `start`.
