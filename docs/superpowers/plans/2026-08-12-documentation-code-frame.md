# Documentation Code Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Markdown code blocks and `PrototypePreviewer` code panels use one compact, accessible documentation code-frame grammar.

**Architecture:** Correct the cascade-layer integration at the Starlight head boundary so Expressive Code retains its own layout behavior, then use Starlight's supported `expressiveCode.styleOverrides` API for shared frame tokens. Keep renderer-specific behavior intact and align only the copy-control presentation in `CodePanel.astro` and `markdown.css`.

**Tech Stack:** Astro 5, Starlight 0.35, Expressive Code 0.41, Tailwind CSS 4, Shiki 3, Chromium.

---

### Task 1: Restore Starlight component precedence

**Files:**

- Modify: `apps/www/astro.config.mjs:38-67`

- [ ] **Step 1: Capture the failing browser geometry**

On the deployed Transition page, record that a plain Markdown `<pre>` has a `0px` border, `1px` radius, and no block padding while its copy target is `40 × 40px`. This is the RED reproduction for the presentation defect.

- [ ] **Step 2: Predeclare the cascade order before bundled styles**

Add the first Starlight `head` entry:

```js
{
  tag: 'style',
  content: '@layer base, starlight, components, utilities;',
},
```

This must precede stylesheet links so Tailwind `base` is lower priority than Starlight's nested component layers, while local `components` and `utilities` remain higher.

- [ ] **Step 3: Configure Expressive Code through Starlight**

Add this sibling option to the Starlight configuration:

```js
expressiveCode: {
  styleOverrides: {
    borderRadius: 'calc(0.75rem - 1px)',
    borderColor: 'var(--color-border)',
    codeFontSize: '0.8125rem',
    codeLineHeight: '1.5rem',
    codeBackground: 'var(--color-muted)',
    frames: {
      editorBackground: 'var(--color-muted)',
      terminalBackground: 'var(--color-muted)',
    },
  },
},
```

The radius subtracts the 1px Expressive Code border so the physical outer radius is 12px.

### Task 2: Align copy controls

**Files:**

- Modify: `apps/www/src/styles/markdown.css:1-220`
- Modify: `apps/www/src/components/PrototypePreviewer/CodePanel.astro:33-94`

- [ ] **Step 1: Make the Markdown copy target compact and keyboard-visible**

Inside the existing `@layer components`, add scoped rules for `main[data-pagefind-body] .expressive-code .copy button`: fixed `2rem` width/height, 6px radius, an 18px masked icon, and a 2px `focus-visible` ring using `--color-ring`. Do not alter Expressive Code markup or JavaScript.

- [ ] **Step 2: Match the previewer copy target**

Replace the previewer copy button's padding-driven dimensions with `size-8`, center its existing 18px icon, and use `border-border`, `bg-background/90`, `rounded-md`, hover, and `focus-visible:ring-2` classes. Keep its hidden/collapsed and copy-success behavior unchanged.

### Task 3: Verify the documentation behavior

**Files:**

- Verify: `apps/www/src/content/docs/zh-cn/ui-libraries/base/transition.mdx`
- Verify: `apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx`

- [ ] **Step 1: Run static checks and production build**

Run:

```sh
corepack pnpm@10.32.1 --filter apps-www check
corepack pnpm@10.32.1 --filter apps-www build
```

Expected: Astro reports zero errors; the site and Pagefind complete successfully.

- [ ] **Step 2: Exercise desktop light and dark modes**

Serve the production build and inspect `/zh-cn/ui-libraries/base/transition/` at 1440 × 1000. Verify Markdown outer border/radius/background/font geometry, 32px copy button, visible keyboard focus, copy feedback, previewer expansion/copy, and compatible previewer frame styling in both themes.

- [ ] **Step 3: Exercise narrow layout and long code overflow**

Inspect the same route at 390 × 844. Verify `document.documentElement.scrollWidth === document.documentElement.clientWidth`, while a long Markdown `<pre>` keeps `scrollWidth > clientWidth` and scrolls internally.

- [ ] **Step 4: Smoke-check terminal frames and Astro navigation**

Open `/zh-cn/start-here/quick-start/`, confirm the terminal frame keeps its header, border, padding, radius, copy control, and horizontal containment, then navigate away and back and confirm copy controls still respond.

- [ ] **Step 5: Commit, push, and open the PR**

Commit the approved design, implementation, and verification-ready source changes with:

```sh
git commit -m "fix(www): unify documentation code frames"
```

Push `codex/fix-doc-code-frames` and open a PR that closes #369, includes before/after evidence, exact verification commands, browser matrix, and documentation-only scope.
