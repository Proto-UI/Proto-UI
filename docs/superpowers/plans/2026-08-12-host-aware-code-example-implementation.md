# Host-Aware Code Example Implementation Plan

**For agentic workers:** Use subagent-driven development and test-driven development. Run focused RED/GREEN checks per task; run full repository verification once at the end.

**Goal:** Deliver issue #344 as a documentation-only, host-aware multi-file code display that reuses CodePanel and the site's canonical adapter preference.

**Architecture:** Centralize the existing adapter preference and Shiki transforms. Extract CodePanel's scoped DOM controller. Compose CodePanel in a new static CodeExample with nested accessible tabs. Migrate one bilingual stable Quick Start example; the original RC Trial target was removed by the later public-docs gate. Do not alter Proto UI specs or PrototypePreviewer public/runtime contracts.

**Tech stack:** Astro 5, TypeScript, Shiki, Starlight, happy-dom/Vitest.

---

### Task 1: Lock adapter and code-panel contracts with RED tests

**Files:**

- Create: `apps/www/src/components/code-example-client.test.ts`
- Create: `apps/www/src/components/PrototypePreviewer/code-panel-client.test.ts`

Cover canonical preference initialization/live sync, unsupported fallback, local override, per-host file memory, nested ARIA/keyboard behavior, idempotence, exact clipboard source, expansion state, visibility refresh, and replacement reset. Run only these two tests and confirm failures are caused by missing modules/behavior.

### Task 2: Centralize existing adapter preference

**Files:**

- Create: `apps/www/src/components/adapter-preference.ts`
- Modify: `apps/www/src/components/override/AdapterSelect.astro`
- Modify: `apps/www/src/components/PrototypePreviewer/AdapterPanelScript.astro`

Export the existing key/default/event/detail and runtime guard. Replace duplicate fixed IDs/global lookup with unique, root-scoped AdapterSelect initialization. Validate event details in consumers. Preserve storage and event behavior.

### Task 3: Extract CodePanel implementation without behavior drift

**Files:**

- Create: `apps/www/src/components/PrototypePreviewer/code-highlight.ts`
- Create: `apps/www/src/components/PrototypePreviewer/code-panel-client.ts`
- Modify: `apps/www/src/components/PrototypePreviewer/CodePanel.astro`
- Modify: `apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro`
- Modify: `apps/www/src/components/PrototypePreviewer/previewer-client.ts`

Use one server-side highlighter and one scoped client controller. Add optional CodePanel tabpanel attributes. Refresh directly after visibility/content changes. Remove the detail-less adapter event. Keep PrototypePreviewer's public props and runtime loading unchanged. Make focused CodePanel tests GREEN.

### Task 4: Implement nested CodeExample tabs

**Files:**

- Create: `apps/www/src/components/CodeExample.astro`
- Create: `apps/www/src/components/code-example-client.ts`

Validate input; render canonical hosts and all files server-side; wire exact tab/tablist/tabpanel relationships; implement one non-looping horizontal activation routine for both nesting levels; implement global-following/local-override host state and independent per-host file state; contain strip/code overflow locally. Make focused client tests GREEN.

### Task 5: Adopt on the real bilingual Quick Start page

**Files:**

- Modify: `apps/www/src/content/docs/en/start-here/quick-start.mdx`
- Modify: `apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx`

Replace the separate React-only add/import fences with one React/Web Components, two-file-per-host CodeExample in each locale. Preserve the stable `@latest` / `0.2.0` onboarding contract. Do not restore the removed RC Trial pages or change generated demo wrappers or `scan-mdx.ts`.

### Task 6: Verify end to end

Run focused tests, type checks, the apps-www production build, and full repository tests. Browser-smoke the migrated bilingual Quick Start routes at 320px and desktop for local overflow, keyboard tabs, preference sync/local override/reload, exact copy/expand, theme switching, and client navigation. Confirm no `spec/**` or `packages/prototypes/**` files changed.
