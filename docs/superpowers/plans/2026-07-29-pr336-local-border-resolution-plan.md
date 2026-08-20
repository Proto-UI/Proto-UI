# PR #336 Local Border Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close PR #336's final shared-Core blocker by restoring semantic-merge v0 and expressing Dialog directional border colors locally.

**Architecture:** Keep `mergeTwTokensV0` identical to its pre-PR behavior. Header/Footer combine their existing directional width utilities with legal projection-local Proto UI color tokens, which remain independent under v0 fallback grouping. The CLI renderer explicitly compiles those two official tokens so the generated Brutalist preset stays closed.

**Tech Stack:** TypeScript, Vitest, Proto UI style-token renderer/scanner, YAML prototype catalog, pnpm 10.32.1.

---

### Task 1: Prove the CLI Renderer Gap

**Files:**

- Modify: `packages/cli/test/proto-style-css.test.ts`
- Test: `packages/cli/test/proto-style-css.test.ts`

- [ ] **Step 1: Add the failing renderer test**

Add this test after the solid-black-surface test:

```ts
it('renders projection-local directional border colors', () => {
  const css = renderProtoStyleTokenCss([
    'brutalist-border-bottom-black',
    'brutalist-border-top-black',
  ]);

  expect(css).toContain('border-bottom-color: #000;');
  expect(css).toContain('border-top-color: #000;');
  expect(css).not.toContain('Unsupported Proto UI style tokens');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run packages/cli/test/proto-style-css.test.ts
```

Expected: FAIL because both projection-local tokens are reported as unsupported and the requested declarations are absent.

- [ ] **Step 3: Keep the failing test for Task 2**

Do not modify production code in this task.

### Task 2: Compile the Two Official Local Color Tokens

**Files:**

- Modify: `packages/cli/src/services/proto-style-css.ts:160-170`
- Test: `packages/cli/test/proto-style-css.test.ts`

- [ ] **Step 1: Add the minimal static utilities**

Add only these entries to `staticUtilities` near the directional border utilities:

```ts
'brutalist-border-bottom-black': ['border-bottom-color: #000;'],
'brutalist-border-top-black': ['border-top-color: #000;'],
```

- [ ] **Step 2: Run the renderer test and verify GREEN**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run packages/cli/test/proto-style-css.test.ts
```

Expected: all tests in the file pass and no unsupported-token diagnostic appears.

- [ ] **Step 3: Keep the author-token language narrow**

The renderer remains an allowlisted compiler. Do not add a generic arbitrary-property evaluator or widen the v0 token grammar; `:` remains forbidden by `C-FEEDBACK-STYLE-0004`.

### Task 3: Prove the Dialog Projection Boundary

**Files:**

- Modify: `packages/prototypes/brutalist/test/dialog.test.ts:355-388`
- Test: `packages/prototypes/brutalist/test/dialog.test.ts`

- [ ] **Step 1: Change Header expectations to the local color token**

Replace the Header token list with:

```ts
for (const token of [
  'grid',
  'gap-1',
  'border-b-2',
  'brutalist-border-bottom-black',
  'pb-3',
  'text-left',
]) {
```

After the loop add:

```ts
expect(styleContains(header, 'border-black')).toBe(false);
```

- [ ] **Step 2: Change Footer expectations to the local color token**

Replace `border-black` in the Footer list with:

```ts
'brutalist-border-top-black',
```

After the loop add:

```ts
expect(styleContains(footer, 'border-black')).toBe(false);
```

- [ ] **Step 3: Run the Dialog test and verify RED**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/brutalist/test/dialog.test.ts
```

Expected: CASE-9/CASE-10 test fails because Header/Footer still contain `border-black` and do not contain the local directional color tokens.

### Task 4: Implement the Projection-Local Tokens and Catalog Truth

**Files:**

- Modify: `packages/prototypes/brutalist/src/dialog/header.proto.ts:10-11`
- Modify: `packages/prototypes/brutalist/src/dialog/footer.proto.ts:10-13`
- Modify: `spec/prototypes/P-BRUTALIST-DIALOG-HEADER.yaml:29-35`
- Modify: `spec/prototypes/P-BRUTALIST-DIALOG-FOOTER.yaml:29-35`
- Test: `packages/prototypes/brutalist/test/dialog.test.ts`

- [ ] **Step 1: Update Header source**

Use:

```ts
// P-BRUTALIST-DIALOG-HEADER-VISUAL-GRAMMAR: grid gap with a projection-local 2px black bottom rule.
def.feedback.style.use(tw('grid gap-1 border-b-2 brutalist-border-bottom-black pb-3 text-left'));
```

- [ ] **Step 2: Update Footer source**

Use:

```ts
// P-BRUTALIST-DIALOG-FOOTER-VISUAL-GRAMMAR: flex-col-reverse gap with a projection-local 2px black top rule.
def.feedback.style.use(
  tw('flex flex-col-reverse gap-2 border-t-2 brutalist-border-top-black pt-3 justify-end')
);
```

- [ ] **Step 3: Update exact P criteria token grammar**

In `P-BRUTALIST-DIALOG-HEADER-VISUAL-GRAMMAR`, replace the exact token sequence with:

```text
grid gap-1 border-b-2 brutalist-border-bottom-black pb-3 text-left
```

In `P-BRUTALIST-DIALOG-FOOTER-VISUAL-GRAMMAR`, replace the exact token sequence with:

```text
flex flex-col-reverse gap-2 border-t-2 brutalist-border-top-black pt-3 justify-end
```

Keep the existing behavioral meaning: a square 2px black directional border, no owned interaction.

- [ ] **Step 4: Run Dialog and catalog checks and verify GREEN**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/brutalist/test/dialog.test.ts
corepack pnpm@10.32.1 -s check:prototype-catalog
```

Expected: Dialog tests pass and prototype catalog reports OK.

### Task 5: Restore Shared Core v0

**Files:**

- Modify: `packages/core/src/spec/feedback/semantic-merge.ts:75-78`
- Modify: `packages/core/test/feedback/semantic-merge.test.ts:43-48`
- Test: `packages/core/test/feedback/semantic-merge.test.ts`

- [ ] **Step 1: Remove the directional-border grouping addition**

Delete:

```ts
const directionalBorderWidth = token.match(/^border-([trblxy])(?:-(?:0|2|4|8|\[[^\]]+\]))?$/);
if (directionalBorderWidth) {
  return `border-${directionalBorderWidth[1]}-width`;
}
```

- [ ] **Step 2: Remove the withdrawn Core regression test**

Delete the test named `keeps directional border width with border color`, including its T case comment.

- [ ] **Step 3: Verify Core is byte-equivalent to the PR base for these files**

Run:

```bash
git diff 7f85c861 -- packages/core/src/spec/feedback/semantic-merge.ts packages/core/test/feedback/semantic-merge.test.ts
```

Expected: no diff for these two files.

- [ ] **Step 4: Run the Core baseline test**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run packages/core/test/feedback/semantic-merge.test.ts
```

Expected: all remaining semantic-merge v0 tests pass.

### Task 6: Regenerate and Verify the Preset Closure

**Files:**

- Modify generated: `packages/cli/src/generated/brutalist-style-tokens.ts`
- Test: `packages/cli/test/prototype-style-tokens.test.ts`
- Test: `packages/cli/test/proto-style-css.test.ts`

- [ ] **Step 1: Regenerate the official manifest**

Run:

```bash
corepack pnpm@10.32.1 -s styles:preset:generate
```

Expected: generated Brutalist token manifest replaces Header/Footer `border-black` contributions only where token-set deduplication permits and includes both arbitrary directional color tokens.

- [ ] **Step 2: Run focused CLI gates**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run packages/cli/test/proto-style-css.test.ts packages/cli/test/prototype-style-tokens.test.ts
corepack pnpm@10.32.1 -s check:styles:preset
corepack pnpm@10.32.1 -s check:component-presets
```

Expected: focused tests and both preset gates pass.

### Task 7: Full Verification, Review, and PR Response

**Files:**

- Review all files changed since `988a49fd`

- [ ] **Step 1: Run focused affected tests**

Run:

```bash
corepack pnpm@10.32.1 exec vitest run \
  packages/prototypes/brutalist/test/dialog.test.ts \
  packages/cli/test/proto-style-css.test.ts \
  packages/cli/test/prototype-style-tokens.test.ts \
  packages/core/test/feedback/semantic-merge.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run project gates**

Run:

```bash
corepack pnpm@10.32.1 -s check:types
corepack pnpm@10.32.1 -s check:prototype-catalog
corepack pnpm@10.32.1 -s check:agent-doc
corepack pnpm@10.32.1 -s release:assets:check
corepack pnpm@10.32.1 -s check:release-version
corepack pnpm@10.32.1 test
```

Expected: every command exits zero with no failing tests.

- [ ] **Step 3: Run formatting and diff checks**

Run:

```bash
corepack pnpm@10.32.1 exec prettier --check \
  docs/superpowers/specs/2026-07-29-pr336-local-border-resolution-design.md \
  docs/superpowers/plans/2026-07-29-pr336-local-border-resolution-plan.md \
  packages/cli/src/services/proto-style-css.ts \
  packages/cli/test/proto-style-css.test.ts \
  packages/prototypes/brutalist/src/dialog/header.proto.ts \
  packages/prototypes/brutalist/src/dialog/footer.proto.ts \
  packages/prototypes/brutalist/test/dialog.test.ts \
  spec/prototypes/P-BRUTALIST-DIALOG-HEADER.yaml \
  spec/prototypes/P-BRUTALIST-DIALOG-FOOTER.yaml
git diff --check
```

Expected: formatter and diff checks pass.

- [ ] **Step 4: Request an independent read-only review**

Review requirements:

- shared Core files have no diff against `7f85c861`;
- the projection-local tokens obey `C-FEEDBACK-STYLE-0004` and remain independent under v0 fallback grouping;
- Header/Footer P criteria match source and executable assertions;
- CLI renderer emits both declarations and no unsupported-token diagnostics;
- no release/BOM/package boundary changes were introduced.

Fix every Critical or Important issue before proceeding.

- [ ] **Step 5: Commit, push, and reply**

Commit message:

```text
fix(brutalist): localize dialog border color intent
```

Push `split/brutalist-stable-projections`, confirm current-head CI, then reply to comment `5111916747` with the Core withdrawal, local projection token evidence, focused/full gate results, and a request for the final manual interaction pass.
