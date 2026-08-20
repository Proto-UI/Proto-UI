# Base admission revisions for PRs #337 and #338 — implementation plan

> Execution plan for the approved design in `docs/superpowers/specs/2026-07-29-base-prototype-admission-design.md`.

**Goal:** revise the two existing Brutalist split PRs so Base retains only the transferable Separator protocol, while Skeleton, Badge, and Card become direct Brutalist styled-only prototypes with honest P/T/source evidence.

**Architecture:** execute each PR on its own existing branch. PR #337 owns Separator/Skeleton and must complete before #338 is refreshed onto the resulting main. Do not merge the branches locally, combine their scopes, or modify maintainer-owned Image, Tooltip, or Scroll Area work.

**Workflow:** TDD for every behavioral or catalog boundary change. Run focused tests after each task and the full repository verification matrix once per PR, immediately before commit/push claims.

## Global constraints

- Work only in `/home/ezra/Documents/Proto-UI/.worktrees/brutalist-design-system`.
- Preserve PR #323 as draft incubation evidence.
- Do not edit immutable release evidence under older release directories.
- Do not add Base Skeleton, Badge, Card, Avatar, Image, Tooltip, or Scroll Area work outside the decisions below.
- Do not use `any`, `: any`, or `as any`.
- Keep `@proto.ui/prototypes-brutalist` private/non-release until repository main says otherwise.
- The current worktree starts on `split/brutalist-chatui`; stash or commit neither design artifact on that branch. Copy the approved design and plan onto the first execution branch before committing.
- Before changing branches, preserve the two untracked planning files outside Git or with a named patch; never lose them and never commit them to #341.
- Use exact current-main merge/rebase policy already established for each PR. Do not rewrite maintainer commits.

---

## Phase A — PR #337: Separator and Skeleton

### Task A1: prepare the #337 branch without polluting #341

**Branch:** `split/brutalist-separator-skeleton`

**Files:**

- Add: `docs/superpowers/specs/2026-07-29-base-prototype-admission-design.md`
- Add: `docs/superpowers/plans/2026-07-29-base-admission-pr337-pr338.md`

**Steps:**

1. Confirm the current ChatUI worktree is clean except for the two new design files.
2. Save those two files outside the worktree or as an explicit patch.
3. Switch to `split/brutalist-separator-skeleton` and confirm its head matches PR #337.
4. Restore the two approved files.
5. Confirm `git diff --name-only origin/main...HEAD` contains only #337 scope before editing.

**Verification:**

```bash
git branch --show-current
gh pr view 337 --repo Proto-UI/Proto-UI --json headRefName,headRefOid,baseRefName
git status --short
git diff --name-only origin/main...HEAD
```

### Task A2: write failing Base Separator contract tests

**Files:**

- Modify: `packages/prototypes/base/test/separator.test.ts`
- Modify as needed: `packages/adapters/web-component/test/contract/a11y.v0.contract.test.ts`
- Modify catalog test entity: `spec/tests/T-BASE-SEPARATOR-0001.yaml`

**Required cases:**

1. Semantic horizontal Separator projects role `separator`, horizontal orientation, and remains in the a11y tree.
2. Semantic vertical Separator projects role `separator` and vertical orientation.
3. Switching semantic to decorative removes separator role and semantic-only orientation from the resolved snapshot/adapter output.
4. Switching decorative back to semantic restores role and the current orientation.
5. Separator rejects or omits visible descendants according to the repository's contentless-prototype convention.
6. It creates no focusability, tab stop, activation, command, event, or mutable value surface.

Run the focused tests and confirm the new semantic-only orientation/contentless assertions fail for the expected reason before source changes.

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/separator.test.ts packages/adapters/web-component/test/contract/a11y.v0.contract.test.ts
```

### Task A3: tighten Base Separator implementation

**Files:**

- Modify: `packages/prototypes/base/src/separator/root.proto.ts`
- Modify if public types need clarification: `packages/prototypes/base/src/separator/types.ts`
- Modify: `spec/prototypes/P-BASE-SEPARATOR.yaml`

**Implementation requirements:**

1. Preserve `orientation: horizontal | vertical` and semantic/decorative author facts.
2. Semantic mode projects role, applicable orientation, and visible tree state.
3. Decorative mode removes semantic role and orientation output and hides/presents the node according to `C-A11Y-0001`.
4. Enforce contentlessness using the same executable mechanism used by existing contentless prototypes; do not rely only on comments.
5. Do not add focus, events, commands, activation, values, or visual props.
6. Keep length, thickness, layout, and color out of Base.
7. Update P criteria so every claim maps to source and the focused test entity.

**Verification:**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/separator.test.ts packages/adapters/web-component/test/contract/a11y.v0.contract.test.ts
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 check:prototype-catalog
```

### Task A4: remove Base Skeleton and rewrite Brutalist Skeleton tests first

**Files:**

- Modify: `packages/prototypes/brutalist/test/skeleton.test.ts`
- Modify: `spec/tests/T-BRUTALIST-SKELETON-0001.yaml`
- Delete later: `packages/prototypes/base/test/skeleton.test.ts`
- Delete later: `spec/tests/T-BASE-SKELETON-0001.yaml`

**Required Brutalist cases:**

1. The prototype materializes directly without a Base Skeleton hook.
2. It is contentless and excluded from the accessibility tree.
3. The consumer owns width and height; no hard-coded geometry overrides consumer styles.
4. Brutalist border, fill, and hard-shadow grammar is present.
5. It owns no loading prop/state, busy state, announcement, focus, event, command, or replacement timing.
6. If animated feedback remains, reduced-motion behavior is explicitly verified; otherwise omit the motion claim.

Change the tests so they fail while the implementation still imports/invokes `asSkeletonRoot()`.

### Task A5: make Skeleton Brutalist-only and remove the Base surface

**Delete:**

- `packages/prototypes/base/src/skeleton/index.ts`
- `packages/prototypes/base/src/skeleton/root.proto.ts`
- `packages/prototypes/base/src/skeleton/types.ts`
- `packages/prototypes/base/test/skeleton.test.ts`
- `spec/prototypes/P-BASE-SKELETON.yaml`
- `spec/tests/T-BASE-SKELETON-0001.yaml`

**Modify:**

- `packages/prototypes/base/src/index.ts`
- `packages/prototypes/base/package.json`
- `packages/prototypes/brutalist/src/skeleton/root.proto.ts`
- `packages/prototypes/brutalist/src/skeleton/types.ts`
- `packages/prototypes/brutalist/src/skeleton/index.ts`
- `packages/prototypes/brutalist/package.json`
- `packages/prototypes/brutalist/README.md`
- `spec/prototypes/P-BRUTALIST-SKELETON.yaml`
- `packages/cli/src/registry/components.ts`
- Any generated/catalog projection files required by repository checks

**Implementation requirements:**

1. Remove all public Base `/skeleton` exports, CLI registrations, imports, and catalog references.
2. Define Brutalist Skeleton directly with `definePrototype`; do not import or call `asSkeletonRoot()`.
3. Define its contentless and a11y-hidden boundary in its own source.
4. Preserve consumer-owned dimensions and current Brutalist visual grammar.
5. Keep loading and async-region responsibilities explicitly absent.
6. Retain only substantive Brutalist P criteria and matching T evidence.

**Focused verification:**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/brutalist/test/skeleton.test.ts packages/prototypes/base/test/separator.test.ts
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:styles:preset
```

### Task A6: align #337 docs, demos, release notes, and generated projections

**Modify:**

- `apps/www/src/content/docs/en/ui-libraries/brutalist/components/separator.mdx`
- `apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/separator.mdx`
- `apps/www/src/content/docs/en/ui-libraries/brutalist/components/skeleton.mdx`
- `apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/components/skeleton.mdx`
- `apps/www/src/content/docs/en/ui-libraries/brutalist/index.mdx`
- `apps/www/src/content/docs/zh-cn/ui-libraries/brutalist/index.mdx`
- `internal/releases/<current-active-release>/release-notes.md`
- `internal/releases/<current-active-release>/release-notes.zh-CN.md`
- `internal/agent/PROJECT-UNDERSTANDING.zh-CN.md` via the official generator only
- Generated Brutalist style-token manifest via the official generator only

**Documentation requirements:**

- Describe Base Separator's semantic/decorative contract and non-interactive boundary.
- Describe Skeleton as a Brutalist-owned feedback-only prototype, not a Base projection.
- State that the parent loading region owns busy state, replacement, announcements, and focus continuity.
- Do not claim a future loading protocol exists.
- Preserve bilingual scope parity.

**Verification:**

```bash
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-docs
corepack pnpm@10.32.1 styles:preset:generate
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 --dir apps/www build
```

### Task A7: verify, commit, push, and update PR #337

Run fresh full evidence before any completion claim:

```bash
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:agent-docs
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:release-version
corepack pnpm@10.32.1 release:assets:check
corepack pnpm@10.32.1 check:package-manifests
corepack pnpm@10.32.1 --dir apps/www build
git diff --check
git status --short
```

Then:

1. Review the exact `origin/main...HEAD` file list and ensure no Tooltip, Scroll Area, Image, Avatar, Input, Textarea, Native Control, Composer, or immutable old release evidence appears.
2. Commit with a focused message such as `refactor(base): keep only Separator protocol in atom split`.
3. Push the existing #337 branch.
4. Update the PR title/body to say Base Separator plus Brutalist Separator/Skeleton; remove every Base Skeleton claim.
5. Reply in the maintainer review thread or add a concise top-level response if it was a top-level review, summarizing the architectural change and fresh evidence.
6. Watch CI to terminal state before claiming #337 green.

---

## Phase B — PR #338: Badge and Card

### Task B1: refresh #338 only after #337/main dependency is available

**Branch:** `split/brutalist-avatar-badge-card`

1. Fetch current main and the #338 branch.
2. Confirm whether #337 has merged. If not merged, do not merge #337 into #338 merely for convenience; either wait or use the repository-approved stacking base and state it explicitly.
3. Refresh #338 onto the correct base while preserving only Badge/Card scope.
4. Confirm Avatar remains absent from the PR delta.
5. Restore the approved design/plan files only if they are not already on main after #337.

**Verification:**

```bash
git branch --show-current
gh pr view 338 --repo Proto-UI/Proto-UI --json headRefName,headRefOid,baseRefName
git diff --name-only origin/main...HEAD
git status --short
```

### Task B2: write failing direct Brutalist Badge tests

**Files:**

- Modify: `packages/prototypes/brutalist/test/badge.test.ts`
- Modify: `spec/tests/T-BRUTALIST-BADGE-0001.yaml`

**Required cases:**

1. Badge materializes directly without Base Badge inheritance.
2. It is passive, non-focusable, and has no implicit role.
3. It exposes a Brutalist-native tone vocabulary with paired foreground/background tokens.
4. `outline` is absent as a variant axis because outline is structural grammar for every Badge.
5. Prop removal returns to the documented default tone.
6. It exposes no activation, pressed, selected, status announcement, command, or event channel.

Select the exact tone names from existing Brutalist semantic tokens. Prefer a small stable set such as neutral/accent/danger only if those names match the repository's design-language vocabulary; do not invent additional axes without evidence.

Run the focused test and confirm it fails against the Base-inheriting Shadcn-style variant implementation.

### Task B3: remove Base Badge and implement direct Brutalist Badge

**Delete:**

- `packages/prototypes/base/src/badge/index.ts`
- `packages/prototypes/base/src/badge/root.proto.ts`
- `packages/prototypes/base/src/badge/types.ts`
- `spec/prototypes/P-BASE-BADGE.yaml`
- Any Base Badge-specific tests or catalog fixtures

**Modify:**

- `packages/prototypes/base/src/index.ts`
- `packages/prototypes/base/package.json`
- `packages/prototypes/brutalist/src/badge/root.proto.ts`
- `packages/prototypes/brutalist/src/badge/types.ts`
- `packages/prototypes/brutalist/src/badge/index.ts`
- `spec/prototypes/P-BRUTALIST-BADGE.yaml`
- Related package/CLI/generated projection files

**Implementation requirements:**

- Remove Base `/badge` and all `asBadgeRoot()` usage.
- Define tone/default handling directly in Brutalist Badge.
- Pair foreground and background tokens inside each tone.
- Keep structural border/shadow grammar common to all tones.
- Keep the root passive, roleless, and non-focusable.

**Focused verification:**

```bash
corepack pnpm@10.32.1 exec vitest run packages/prototypes/brutalist/test/badge.test.ts
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:styles:preset
```

### Task B4: write failing minimal Brutalist Card anatomy tests

**Files:**

- Modify: `packages/prototypes/brutalist/test/card.test.ts`
- Modify: `spec/tests/T-BRUTALIST-CARD-0001.yaml`

**Required cases:**

1. Card parts materialize without Base Card inheritance.
2. Retain only Root and the smallest visually justified Header/Content/Footer subset.
3. Title, Description, and Action are not formal Card prototype parts.
4. Root is passive, roleless, and non-focusable.
5. No `interactive`, `clickable`, or `selectable` mode exists.
6. Visual grammar covers Root and retained parts, including borders that can be expressed without changing `style.merge.semantic.v0`.
7. Button or Link can be composed as ordinary Card content without Card claiming their activation behavior.

Run the focused test and confirm it fails against the seven-part Base-inheriting implementation.

### Task B5: remove Base Card and implement the reduced Brutalist Card

**Delete Base family:**

- `packages/prototypes/base/src/card/**`
- `spec/prototypes/P-BASE-CARD*.yaml`
- Any Base Card-specific tests/catalog fixtures

**Delete unjustified Brutalist parts:**

- `packages/prototypes/brutalist/src/card/title.proto.ts`
- `packages/prototypes/brutalist/src/card/description.proto.ts`
- `packages/prototypes/brutalist/src/card/action.proto.ts`
- Corresponding `P-BRUTALIST-CARD-*` entities

**Modify:**

- `packages/prototypes/base/src/index.ts`
- `packages/prototypes/base/package.json`
- `packages/prototypes/brutalist/src/card/root.proto.ts`
- `packages/prototypes/brutalist/src/card/header.proto.ts`
- `packages/prototypes/brutalist/src/card/content.proto.ts`
- `packages/prototypes/brutalist/src/card/footer.proto.ts`
- `packages/prototypes/brutalist/src/card/shared.ts`
- `packages/prototypes/brutalist/src/card/types.ts`
- `packages/prototypes/brutalist/src/card/index.ts`
- Retained `P-BRUTALIST-CARD*` entities
- Related package/CLI/generated projection files

**Implementation requirements:**

- No Base Card imports or `asCard*()` hooks.
- Anatomy family, if retained, belongs directly to Brutalist Card.
- Every retained part must have a concrete visual/content responsibility.
- Ordinary text supplies title/description content.
- Ordinary Button/Link composition supplies action semantics.
- No implicit role, focus, activation, selection, or nested trigger routing.

### Task B6: remove the semantic-merge v0 contract change

**Restore to main unless independently required by approved Card implementation:**

- `packages/core/src/spec/feedback/semantic-merge.ts`
- `packages/core/test/feedback/semantic-merge.test.ts`

**Requirements:**

1. #338 must not redefine directional border-width grouping in `style.merge.semantic.v0`.
2. Express Card Header/Footer borders using tokens already supported by the current contract, or simplify the visual implementation.
3. If the desired directional merge cannot be expressed honestly, defer it to a dedicated versioned contract proposal; do not create that proposal in #338.

**Verification:**

```bash
git diff origin/main -- packages/core/src/spec/feedback/semantic-merge.ts packages/core/test/feedback/semantic-merge.test.ts
corepack pnpm@10.32.1 exec vitest run packages/core/test/feedback/semantic-merge.test.ts packages/prototypes/brutalist/test/card.test.ts
```

The first command should show no #338-relative core semantic-merge change.

### Task B7: align #338 docs, demos, package surfaces, and catalog

**Modify:**

- EN/ZH Brutalist Badge docs and demo
- EN/ZH Brutalist Card docs and demo
- EN/ZH Brutalist overview
- `apps/www/src/components/PrototypePreviewer/prototype-modules.ts`
- `apps/www/astro.config.mjs`
- `packages/prototypes/brutalist/README.md`
- Current active release notes only
- Generated style-token and Agent projections through official generators

**Documentation requirements:**

- Badge is a passive styled-only label with tone vocabulary.
- Badge interaction/status examples compose their actual owners and do not imply Badge modes.
- Card is a passive styled-only surface with reduced anatomy.
- Card action examples use Button/Link as children; selection/disclosure are described as separate protocols, not implemented Card variants.
- Avatar remains absent and deferred behind Image.
- Do not mention Base Badge or Base Card as released surfaces.

**Focused verification:**

```bash
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-docs
corepack pnpm@10.32.1 styles:preset:generate
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 --dir apps/www build
```

### Task B8: verify, commit, push, and update PR #338

Run fresh full evidence before any completion claim:

```bash
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:agent-docs
corepack pnpm@10.32.1 check:styles:preset
corepack pnpm@10.32.1 check:component-presets
corepack pnpm@10.32.1 check:release-version
corepack pnpm@10.32.1 release:assets:check
corepack pnpm@10.32.1 check:package-manifests
corepack pnpm@10.32.1 --dir apps/www build
git diff --check
git status --short
```

Then:

1. Audit `origin/main...HEAD` for exact Badge/Card scope.
2. Confirm no Base Badge/Card exports or catalog entities remain.
3. Confirm no Avatar/Image, Tooltip, Scroll Area, Input, Textarea, Native Control, Composer, old release-evidence, or core semantic-merge delta remains.
4. Commit with a focused message such as `refactor(brutalist): own Badge and Card visual prototypes`.
5. Push the existing #338 branch.
6. Update title/body and maintainer review response with the architectural changes and fresh evidence.
7. Watch CI to terminal state before claiming #338 green.

---

## Final acceptance criteria

- Base exposes Separator and no Skeleton, Badge, Card, or Avatar family from these PRs.
- Base Separator has executable semantic/decorative, orientation, contentless, and non-focusable evidence.
- Brutalist Skeleton, Badge, and Card are direct formal prototypes with substantive P/T/source mappings.
- Badge uses a Brutalist-native tone model with paired contrast and no fake outline variant.
- Card uses reduced visual anatomy and no generic interaction mode.
- `style.merge.semantic.v0` is unchanged by #338.
- Avatar is documented only as deferred behind future Image capability.
- Tooltip and Scroll Area remain untouched after maintainer handoff.
- Both PRs have fresh local verification and terminal green CI before success is reported.
