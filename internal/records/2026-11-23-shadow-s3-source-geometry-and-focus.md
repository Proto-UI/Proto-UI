# S3 source geometry and focused split projection

Date: 2026-11-23. Non-normative engineering record. This record does not expand Shadow profile admission, replace the original browser acceptance, or represent Apple, 120 Hz, assistive-technology, or forced-colors acceptance.

## Original failure and source authority

The original integrated source `d0392fb31513b12f55b9e99b1fcf26a6338569c9` failed all four S3 cases in Actions run `45146424504`, job `137596891846`: Chinese and English, each with the original L1 and keepMounted view policies. The first failure was `geometry.switch.width`, actual `32`, expected `44`. This was a size assertion, not a missing fixture count or a 44 px input-target requirement. The approved S3 objective is recorded in `2026-09-13-shadow-s3-approved-goal.zh-CN.md` and does not prescribe a 44 px Switch target.

The old 44 by 24 px expectation came from the previous `w-11` / `h-6` recipe. The accepted default New York change is retained in the original body of `2026-10-14-finf-followup-source-debt.json`, including source commit `f29e33c919db78bfea654f355f14c81bbecd6047`. The current public Switch README pins `shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7`, `apps/v4/registry/new-york-v4/ui/switch.tsx`. Its actual pinned bytes were retrieved again; the Git blob and SHA-256 receipt are in `evidence/2026-11-23-s3-switch-recipe/upstream-source.json`.

At the fixture's 16 px root font, that fixed recipe is a 32 px wide, 18.4 px high track, a 16 px thumb, a 1 px border, and thumb origins of 1 px unchecked and 15 px checked. The existing public prototype tests already require `w-8` / `h-[1.15rem]` and explicitly reject `w-11` / `h-6` / `px-0.5`. The new expectation is derived from those fixed source facts, never from the computed CSS of the implementation under test.

Commit `ffaa950627e3726f0471ec97e5ac7ecafd079120` pins the fixture's Switch profile to `new-york-v4` and its size to `default`, checks host and surface geometry against the fixed recipe, and adds one actual wrong-size control per locale. Each control sets all three profiles' host and inner surface widths to 44 px, proves the mutation took effect and that inter-profile parity still holds, requires the independent source-width assertion to reject it, then restores the exact previous inline width declarations and verifies recovery. The original four complete interaction journeys, selectors, time budgets, view policies, actual AX tree checks, and lifecycle assertions remain.

## Real focus regression exposed by the repaired oracle

The first public-package replay passed both locale size controls and then exposed a later failure in the unchanged interaction journey: `split/trigger-b/no duplicate host outline`, actual `auto`, expected `none`. Three complete-journey cells reached that failure. The other cell timed out at its original 150 second budget and its trace export reported `ENOSPC`; that timeout is not counted as the same asserted focus failure.

The current Tabs recipe removed its compatibility `outline-none` while focus-visible because the CLI emitted the transparent outline shorthand after `outline-1`, resetting the intended 1 px line to 2 px. In split mode, removing that explicit token also removed the admitted host UA suppression. The visible surface retained its authored focus treatment while the logical focus boundary acquired a second native outline.

Commit `9e0c46c3799da2f3f9c3ecddd114baa81ea0aa31` keeps the explicitly authored compatibility token during focus and emits explicit outline longhands after the transparent shorthand. It does not infer suppression from `ring-*` or another outline token. This preserves the exact authority boundary from `2026-09-13-shadow-s3-focus-outline-repair.zh-CN.md` and `C-HOST-SURFACE-PROJECTION-0001` C/D/E. The original host-identity and single-surface checks remain, and the journey additionally requires the source's solid 1 px surface outline and 3 px ring.

Before the product repair, the new outline-composition and retained-token regressions failed (2 failed, 17 passed). Afterward, the CLI split/style and Shadcn Tabs suites passed 100/100 tests. The original public package builder rebuilt the required closure, and the actual CLI generator produced the document stylesheet and Shadow companion from 1,456 package and website tokens. No generated stylesheet was edited by hand.

## Native replay qualification

The native replay uses the actual public package exports, the generated CLI artifacts, and the same S3 journey imported by the official demo-matrix browser tests. Its bundle manifest rejects `packages/**/src` aliases and binds all 451 bundle inputs. It exercises standalone Chinese and English pages; the official Astro page acceptance remains a separate integration check. Every case uses a fresh context, the original case deadline, and unfiltered page errors. Browser 145.0.7632.6 is Linux headless Chromium; no claim about a different browser, physical platform, input hardware, or performance follows from these observations.

Raw records retain the initial asserted failures and environmental failures. Attempt 02 did not execute any test cell: both browser launches terminated with SIGTRAP after TMPDIR was moved to a long project path. A subsequent direct AF_UNIX bind probe rejected its 113 byte path. A private short symlink to the same project-backed temporary directory produced a 35 byte socket path that bound successfully; attempt 03 uses that path. Browser flags, product code, measurement intervals, and acceptance thresholds were not changed to recover the environment.

Native attempt 03 finished with both fixed-width controls passed and all four complete journeys failed at the added source-focus assertion after switching to vertical orientation: split trigger A retained a 2 px outline instead of the required 1 px. These are actual failures, not passing evidence.

## Vertical intrinsic recipe repair and remaining native gate

A separate failure-only diagnostic replay kept the original journey and inspected the failed instance afterward. `focused` and `focusVisible` were true, including native `:focus-visible`, but explicit style refresh rejected `flex-1` with `intrinsic operands`. The vertical Tabs source adds static `w-full`; the existing nowrap recipe rejected any width operand, so an entire otherwise valid projection update retained its previous horizontal paint.

The bounded repair retains the existing nowrap prerequisite and adds a separate `intrinsic-full-width: v1` receipt for exactly one unconditional `w-full` alongside `inline-flex flex-1 whitespace-nowrap`. Older companions, conditional widths, min/max widths, size operands and combined dimensions still reject before either target changes. The CLI declares that additional receipt; the physical flex shell is unchanged. No focus-state logic or prototype-specific Adapter exception is introduced.

The original physical matrix now includes intrinsic and full-width modes, each in row and column flow at 40, 180 and 600 px with short and long text. All **24 comparisons passed** in Chromium 145.0.7632.6. Each comparison uses exact equality for host width/height, surface width/height and flex basis. The remote transport uses frozen CSS from the exact local CLI source with the same browser driver logic; its complete observations, transport driver, CSS and source hashes are in `evidence/2026-11-23-s3-intrinsic-full-width/`. It proves physical recipe geometry; Adapter admission is tested separately.

The focused admission and CLI run passed **3 files / 39 tests**. This also retains nine newer Switch profile/drag `translate calc` tokens as explicitly unresolved. Their fixed inventory and nine atomic-rejection controls prevent the passing default-state Switch case from being mistaken for all-profile admission. No transform roles were expanded.

A newly built clean-source replay of the original six S3 cells is still required after this bounded repair. Until that result is retained, the complete S3 browser acceptance remains unpassed. The separate S4 replay observed all 24 original 380 ms close paths detach correctly, but failed its unchanged minimum-five-actual-paint-frames criterion; that gate also remains unpassed.

## Review correction: keep complete Switch admission visibly unpassed

Review of `a223be14a81bde0a819a96326ca25c59694193e9` found that its changed unresolved-token inventory expectation could turn the original complete-prototype gate green while nine current Switch tokens remain unsupported. The formal unresolved rejection rule (`D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` B/C/K, as retained by the S2 approved-goal and H1 decision records) authorizes rejecting those active tokens. It does **not** authorize replacing the complete inventory's zero-unresolved condition with nine accepted exceptions.

This follow-up restores the original zero-unresolved inventory gate. It keeps the nine exact atomic-rejection controls, the bounded full-width intrinsic product repair and its independent 24-comparison geometry evidence. The earlier 39-test run remains a historical observation of the intermediate test source; it does not satisfy complete current Switch admission. Full-profile admission remains failed until the unsupported current branches receive a governed implementation and their original interaction/geometry acceptance.

The clean `a223be14` standalone six-cell S3 replay subsequently completed with five passed cells and one failed cell: both locale size controls and three full journeys passed; English `keepMounted=true` reached the final 320 px viewport step but exceeded the original 150,000 ms case budget. This result is partial, not full acceptance, and does not cover later marker-ownership changes. Source-bound raw data and timing analysis are retained separately; the original official Astro-page acceptance and all S4 paint-frame requirements remain open.
