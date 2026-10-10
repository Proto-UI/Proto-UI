# FormField inherited invalid feedback: bounded source repair

<!-- prettier-ignore -->
Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Baseline: `ce9b96d0f18e9635552efb3a075753bc38486d2c`, tree `a6493298eaa6330dbf91ffacb2fedd7dd195fc1b`. Work performed 2026-10-10 UTC. This is implementation progress, not native color acceptance or a Finf completion.

## Authority and precise scope

`C-FIELD-0001` and the family Field prototypes remain **draft**. The Field contract supplies the single validation owner, controlled-owner acceptance and error relationship boundaries; it does not prescribe red Labels and explicitly excludes Form/submission. No Form contract is introduced or inferred here. The `T-BASE-FIELD-0001` addition maps only the existing Field owner/relationship assertions exercised within the current Form composition. Submission/reset are drivers in these tests, not newly admitted Field guarantees.

The independently inspected source recipe is Shadcn base-nova Field, SHA256 `d8a8444942021d020de9b5358a0a3d4f3a5ea572ceabaa38c318a9916903a5f8`, and Neo Field at `3306a802724874a85f93079702b2795370a279d4`, SHA256 `633b39696aac48faeda3e102fa29001295858757ab2c3d7bdb12f13ace03e001`. Both Field roots use invalid-dependent inherited error ink. See the source URLs and licensing in `2026-10-10-finf-form-upstream-paint.md`. Neo's separate React Hook Form `FormLabel` wrapper only sets heading weight; it is not the source of a red-Label requirement here.

The project already selected that Field recipe for Shadcn/Neo FieldRoot. The current real Form demo uses FormField with the same Field Label/Control/Error children. FormField calls Base `asFormField`, which captures `asFieldRoot`; it does not call the styled FieldRoot and does not inherit its style recipe. Applying the already selected Field recipe to this composition is the bounded project choice for this repair, not an upstream Form API claim. Bootstrap and Liquid keep their current choices; no red-Label policy is transferred to them.

## Changes

- Add the public `FormFieldAsHookContract` type describing the already captured `as-field-root` handle. The Base executable setup and state ownership do not change.
- Shadcn/Neo FormField borrow that typed handle and use only its existing `invalid` state in a family feedback rule. The existing Label inherits the family error ink; its editor retains its own foreground. No state, event listener, validation owner, DOM branch, Compiler/CLI behavior, or manually authored selector CSS is added.
- Add six real WebComponent cases: four-family validation/error/focus/correction/reset observations and two controlled-owner acceptance checks. Positive and negative compile-only consumers cover typed nested access, absent flattened/invented states, boolean domains, exact Base/family public surface parity, and read-only public exposes. Borrowed author-side handles retain the existing Core API; this change does not claim that API is read-only.
- Extend only `formJourney` in the existing official browser receipt suite. It clicks the actual submit button, observes required invalidity, visible linked error and first-editor focus, checks inherited Label color for Shadcn/Neo, then corrects and submits successfully. The earlier edit/reset and checkbox assertions remain. Fourteen mocked negative-control tests validate the journey's assertions; they are not browser or paint evidence.

## Evidence and failures retained

The pre-fix test was four failed/two passed. Both Shadcn and Neo had real invalid events, `aria-invalid`, error text/IDREF and Control focus before failing solely on absent invalid text feedback, including controlled-owner acceptance. The minimal repair passes all six. Focused runtime/receipt-source/negative-control suites pass 72 tests across three files; the final clean related subset passes 111 tests across nine files, separately from the retained eight generated-selector failures. The targeted TypeScript check passes, including the new positive/negative fixture. `check:styles:preset` passes without changing generated manifests.

The full workspace TypeScript check initially stopped on two missing generated website Shadow style modules. After running the normal `apps-www generate:proto-ui-style` generator, the same workspace check passes. The generated website CSS still lacks both runtime invalid-text selectors. The prototype catalog check fails with the same 554 baseline errors on exact `ce9b96d0`; an archived-base rerun and candidate comparison are identical. These are not claimed as clean aggregate gates.

Spec workspace loading and lifecycle authoring against the baseline pass after materializing three unchanged tracked GPUI test files omitted by the sparse checkout. The initial missing-path failures and the tsx CLI IPC restriction are retained; the successful check uses the existing in-process Node tsx loader. No native code was changed or executed.

The normal public-package builder passes the 16-package dependency closure for Base, Shadcn and Neo. Its first attempt exposed stale cross-worktree dependency links; isolated local workspace links were corrected without downloads or copied dependency trees before the successful rerun. No package build or source change closes the separate conditional-selector gap.

Eight related Form test files report **50 passed / 8 failed**. All eight failures are the existing generated conditional-selector assertions in `form-actions-quality.test.ts`. Those failures are retained, not relabeled as successful or repaired in this slice.

Most importantly, runtime token projection is not physical CSS closure. A read-only source/compiled comparison of Shadcn/Neo `field/root.proto.ts` and `form/field.proto.ts` finds that the static CLI collector emits plain `text-destructive` / `text-destructive-ink`, but omits the actual runtime token `data-[invalid]:text-destructive` / `data-[invalid]:text-destructive-ink`. Feeding that exact token directly to the CSS renderer produces its selector, proving renderer support but **not** source-collector closure. The existing direct FieldRoot rule has the same gap; preset freshness does not close it. The WebComponent feedback path only writes `data-pui-style`; it does not inject missing CSS.

The required shared capability is source-derived resolution of imported/nested asHook identity and borrowed state ownership to the actual declared/exposed state, with runtime-equivalent conditional selectors. Do not flatten states, add new owners, hardcode component names, or add handwritten variant CSS to work around the collector. Compiler/CLI repair belongs to its existing owner and is not performed here. Actual Label color therefore remains unaccepted even though the family rule and state projection are repaired.

The official browser suite was attempted locally and rejected execution by its GitHub Actions-only guard: 12 cases did not run, no browser launched, no screenshots were produced. No environment identity was forged and no sandbox restriction was bypassed. Its blocked receipts carry the base HEAD and must not be represented as current-candidate visual proof.

## Exact-source screenshot continuation

After independent review and authorized publication, run the existing official `Finf representative feature screenshots` workflow against the actual candidate SHA. The `forms` group retains all 12 existing cases. For each family Form case it now records:

1. `rest`: real editor and Label computed paint.
2. `invalid-submit-first-focus`: empty required field submitted through the real button; linked visible error, first-editor focus, Field/Label/editor/error computed colors.
3. `corrected-submit`: nonempty accepted value, cleared invalid/error relation, Label restored to its original color, and the real demo's submitted value report.
4. Existing `reset` and `edited` captures and checks.

Keep SHA/tree, browser, viewport, fonts, light theme, screenshot hashes, failed captures and the preset result from the suite. Inspect the actual images; a source, token or mocked-journey pass cannot replace them. The new native assertions deliberately remain capable of exposing the unresolved collector/color failure. Full Form semantics, cross-runtime native parity, AT, GPUI and same-state upstream visual comparison remain outside this bounded acceptance.
