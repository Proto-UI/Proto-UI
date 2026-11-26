# Sprint 3 inset-paint calibration and Drawer type imports — 2026-11-22

This is a bounded follow-up to Draft PR #1713, prepared on `4cfe2e8cdd476ceaf463a52b134dd1091c045cc1`. It changes four source files plus this record. The reviewed four-file patch SHA-256 is `e44b46f566b14e93f00476d3538d9164db65fc42caadcf6037a2dd3e043ffa03`. The separate native-consumer fixture and producer repairs remain follow-up candidates; they are not included or declared complete here.

## Observed failures

[The original five-shard contrast run](https://github.com/Proto-UI/Proto-UI/actions/runs/45066966800) used the exact base revision. Four shards passed. The passive/editors shard rejected eight Scroll Area `wheel-both-axes` frames, covering four Web runtimes and Light/Dark. The original native wheel reached the end of both axes, moving the short text out of view. The retained viewport still painted a hard inset focus ring, but the presence classifier had no supported shadow witness for this rounded-ancestor case. The whole-box rounded-clipping limitation was valid and remains a limitation of numeric measurement.

The failed passive artifact is `14772259198`, ZIP SHA-256 `d3807fefa741d70c8b5bb0e17a6b726d177cca54145e770db5997c276bfda73b`. The original frame journal and PNGs remain attached to their original source and failed outcome.

[The full CI run on the same base](https://github.com/Proto-UI/Proto-UI/actions/runs/45069218364) also found two Drawer source imports using an application-only `@/` alias while participating in the repository type graph. The relative imports now resolve the same canonical `demo-types` definitions from both roots. These are type-only imports; the change does not alter Drawer behavior.

## Bounded presence evidence

The new witness recognizes a single HTML layout box with a nontransparent, positive-spread, zero-offset, zero-blur inset shadow. It proves small positive-area patches inside the hard band. Own rounded corners, imprecise client clipping geometry, `overflow:clip`, unsupported rounded-clip geometry, transforms, filters and paint containment continue to reject this proof. The clipping check applies to every ancestor, including an inner square clip nested under an outer rounded clip. `contain:content`, `contain:strict` and `content-visibility:auto` now receive the existing conservative paint-containment rejection.

The presence fallback is available only when the prior whole-box result is visible but unsupported solely because of rounded overflow clipping. It retains the original `boxVisibility` and limitations. Both optional helper switches default to `false`; the raw numeric collector does not opt into this presence witness. Positive calibration cases continue to withhold whole-box perimeter and contrast measurements. This is bounded source-model paint evidence, not general pixel segmentation or occlusion analysis. The containment correction makes some unsupported domains more conservative; it does not expand numeric acceptance.

The helper uses the HTML namespace after the existing `Element` guard. It does not require the extra `HTMLElement` constructor absent from the original serialized Node VM fixture. SVG and MathML remain outside the inset-shadow proof domain. The original Node fixture is unchanged and is not a substitute for native layout evidence.

## Executed calibration and retained red controls

Execution used Node `24.22.3`, pnpm `10.32.1`, Chrome for Testing `145.0.7632.6`, the original browser sandbox setting, and a fresh owned remote checkout with a real `install --frozen-lockfile --ignore-scripts`. It did not link another checkout's `node_modules`. The lock SHA-256 was `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8` before and after.

| Execution | Actual result |
| --- | --- |
| Original base probe against the new positive witness case | Expected failure: 1 failed, 55 cases excluded by the explicit diagnostic selection |
| First witness candidate against six independently identified geometry/containment counterexamples | Expected failures: 6 failed, 50 cases excluded by the explicit selection |
| Corrected v4 witness against the seven new native cases | 7 passed, 49 cases excluded by the explicit selection |
| v4 against the complete original Node serialization file | 137 passed / 15 failed / 0 skipped; all 15 failures referenced the missing `HTMLElement` constructor; the full native file was not then started |
| Final v6 against the unchanged complete original Node serialization file | **152 passed / 0 failed / 0 skipped** |
| Final v6 against the complete native calibration file | **56 passed / 0 failed / 0 skipped**: all original 49 plus seven new cases, without a name filter |

The final Node log SHA-256 is `e0371c666dcdb8787eb45469bab5efc8c9426b1abf7f61230409dc08a1193080`. The final native log SHA-256 is `03982c4594a60ff6faad7876b3c1850bd6587972d7185f4cdbef4334754a0175`; its Vitest JSON SHA-256 is `89e7c1c5972fe67d864a8481ae5f7a40e757985871a49c17795f8232c73faf66`. All four source hashes and the lock remained unchanged during that execution.

An independent read-only review reconstructed the v4/v6 patches, checked unchanged original test names and source, and reconciled 101 artifacts, six logs, PNG/bundle bindings and source bindings. It closed the constructor finding and the three prior geometric findings within the reviewed scope. The review JSON SHA-256 is `be0fd446beb88ec189f031d65bc6c57a856a94a8d3259252d20decc39cf4f3ba`. This source/evidence review is not a GitHub approval or merge admission.

## Type-check boundary

A focused strict TypeScript check of the two actual Drawer entrypoints, using TypeScript `5.9.3` and the repository compiler options, changed from five diagnostics to zero. That result is limited to those entrypoints.

The complete original `corepack pnpm@10.32.1 -s check:types` command was also attempted on the final four-file candidate. It reached the original 900-second job resource limit at `2026-11-22T22:11:26Z` and was terminated with exit `-15` while still in actual website style-token generation. It had not reached the workspace or documentation type checks. Its log SHA-256 is `9f9a2bf7ef8dc094c2028b6c90b3d53e05d6f5c75e41ba745b44699894b2ad88`. Source, index and lock matched before and after. This attempt is failed/incomplete, not a full type-check pass; its cause is not established by the timing alone. The resource limit was not extended.

## Remaining acceptance

Run the original five contrast shards against the published follow-up and verify the eight actual production wheel frames. Obtain the complete type-check and required full-CI results on that exact head. Preserve the original failed six native-consumer cases for separate diagnosis and repair: the original 14-file run on the base recorded 358 passed / 6 failed / 0 pending. Its other passed cases, the original 713-case pure batch, and the seven Drawer native cases are historical base-revision evidence and are not reassigned as complete validation of this follow-up.

No original journey, input sample, assertion threshold, case timeout, sandbox setting or required platform/review gate is waived by this record. The PR remains a Draft until its remaining evidence and normal integration requirements are satisfied.
