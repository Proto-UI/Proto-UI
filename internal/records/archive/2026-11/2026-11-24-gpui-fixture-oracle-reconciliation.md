# GPUI source snapshots and palette oracles

This repairs stale generated evidence and three stale assertions observed in the exact-fde [governance job](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253/job/138421814984). It does not establish native painting support or promote experimental families into the 0.3 release. The candidate starts from `8d2f4a8c5065ac0e22906a8e5cea78d7c247dda6`.

## Exact source-owned changes

Both generators remain unchanged. Running `generate-style-fixture.mts` records seven newly authored tokens and removes two no longer authored tokens: the total moves from 917 to 922 and compiled declarations from 912 to 917. Existing common token declarations and their relative order are identical. The four no-declaration markers and one unsupported-selector entry are unchanged.

The additions are Liquid Accordion's container, minimum width, centered layout and container-relative width tokens; Bootstrap Checkbox's 2px corner token; and Bootstrap Switch's width token. The retired `left-[0.125rem]` and `right-[0.125rem]` tokens have no current authored occurrence. The independent review in the evidence archive lists every exact source owner. This records CSS declarations, including native gaps; it does not claim those declarations can all be painted by GPUI.

Running `generate-session-fixtures.mts` through the real GPUI peer adds exactly nine `required: false` fields to the Base Checkbox recording. They are the existing root/checked/mixed exposed State snapshots and corresponding accessibility states. `checkbox/root.proto.ts` already defines the false default, exposes the State and binds the accessibility State. No existing message, value, action, timing or order is changed; the other four recordings stay byte-identical.

## Stale assertions

The current family sources already define 28 Bootstrap and 25 Liquid palette variables after the shared renderer's radius expansion. The finite expected key sets now include their existing accent, larger radius, navbar and destructive keys. The original every-key omission and unknown/double-prefix rejection loops remain unchanged.

Bootstrap's current source has a separate dark page palette. The obsolete light-equals-dark assertion is replaced by explicit light/dark background and navbar values, while retaining the common primary value and all finite-key checks. The gradient assertion now targets the currently authored complete background recipe and checks all four declarations: fallback colour, image, position and repeat. Its flat recipe counterpart likewise checks all four declarations. This does not change the native gradient diagnostic.

All test names, stale/missing fixture checks, malformed palette controls, Spinner/currentColor, grid, shadow, blur and pseudo-element gap assertions remain. There is no production renderer, Prototype, parser, allowlist, release-scope or timeout change.

## Actual validation and environment boundary

| Execution | Result |
| --- | --- |
| Original package commands for the two checks, and the two complete test files | Could not execute their child `tsx` CLI: local IPC listen returned `EPERM`; retained as failures, not snapshot acceptance |
| Same unchanged generator entrypoints via `node --import tsx`, before regeneration | Both exited 1 for actual stale snapshots |
| Official generator source via the import loader, write then check | Both write and check commands exited 0 |
| Original three palette/recipe assertions against the same regenerated fixtures | Three selected cases failed; no other cases executed |
| Corrected same three case names | 3/3 passed; no other cases executed |
| Prettier check and `git diff --check` | Exit 0 |
| Independent source/JSON review | No blocking finding within these three files; no execution by reviewer |

Using the import loader avoids the unavailable CLI IPC wrapper; it does not replace a module, alter a generator, or claim that the original package command ran successfully. The complete original GPUI script suite and native Rust matrix still require their actual supported-environment receipts. In particular, the separate two-colour parser repair still leaves the four-edge border-colour/native-property question open.

## Evidence

The original local errors, before/write/after generator outputs, original and corrected selected-case outputs, commands, unchanged original test source, candidate diff and independent review are retained in [the evidence archive](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-gpui-fixture-reconciliation/validation.tar.gz). Its manifest hashes each member.

The reviewed source bindings are `27316eae2f01aa30e22fb7a07db6ef7128f8bb22f28c486cf015a8ebd723be43` for the style snapshot, `def2b0ffccf4b45073a98742b1f9a80384ac4d789b3988626ba3ff6a0ed05bb7` for the Checkbox snapshot, and `8d303cb2f16248a5c8a3f67b4be635d24ee723021c4d4aceb696f3c955e9a339` for the test file. The independent review SHA-256 is `7b001915dd6956aad33a32285d2691bf2f3e2e397804c01e72addde7a6e70883`.
