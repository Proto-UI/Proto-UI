# Positioned popup transition isolation, 2026-11-06

This is a non-normative, AI-assisted engineering record for the bounded [claim in #1161](https://github.com/Proto-UI/Proto-UI/issues/1161#issuecomment-6677283372). It does not close that Issue or promote any draft definition.

## Request and ownership

Agent's sanitized paraphrase of the current user's request: repair the first-open overlay flying in from the left and the black rectangle morphing into the menu outline, including other overlays with the same problem. Preserve intended motion.

The delivered source slice covers Shadcn Dropdown Menu, Context Menu and Menubar through `setupMenuSurface`, plus Popover (default and navigation) and Hover Card. It does not take over #685's placement-motion design, Select/Header work in #1290, the other obligations of historical #908, or the other prototypes in #1161. The two public open PRs #1290 and #1285 had no overlapping changed path when the claim was posted. Hidden worktrees and Project ownership were not established.

## Authority and diagnosis

- `spec/prototypes/P-BASE-DROPDOWN-MENU-CONTENT.yaml`, draft criterion `P-BASE-DROPDOWN-MENU-CONTENT-PRESENCE`, separates perceptual motion from positioning-geometry interpolation.
- The existing style renderer intentionally lowers `duration-*` into both `transition-duration` and `--pui-animation-duration`. Changing that global meaning would affect unrelated consumers, so this patch does not change it.
- Earlier public-homepage observation of a WC/Shadcn Rhea menu found `transition-property: all` with `100ms` on the same surface that receives asynchronous positioning and paint. This is a concrete interpolation hazard. The deployed source SHA and black-rectangle trajectory were not established.
- The source fix adds `transition-none` to the three shared popup surface owners. Existing fade/zoom/slide keyframes, animation duration, presence policy, positioning, collision handling and reduced-motion policy remain unchanged.

This removes incidental property interpolation from those surfaces. It is not native proof that either reported visual symptom is fully resolved.

## Exact source and method

Base: `9e58834d167618216ed9b39278eb8dded2f2f596`. Initial candidate: `e95bb77412fa57be5a7feed296f3f60c8f2666b9`. The later commit formats only the new test and adds this record and its results. The three product-file bytes are unchanged from the initial candidate. Formatting was verified to preserve the test's entire non-whitespace character sequence.

The [machine-readable results](2026-11-06-popup-transition-isolation.results.json) bind the four final code files by SHA-256 and Git blob, preserve commands, every selected case, failures, process exit codes and raw-output hashes. Records were authored after execution; this is a code-byte binding, not a claim that a later documentation-containing commit was itself executed.

Fixed toolchain: Node 24.22.1, Vitest 2.1.9, TypeScript 5.9.3, Prettier 3.8.1, Happy DOM 15.11.7, and 105 previously captured official registry packages. The lockfile SHA-256 is `3ac437fda5666f744c02587d9c90b47a927a6e2521973f6a18b47cc3c7cbe422`. No dependencies were installed or lockfile entries changed.

Execution used a temporary isolated filesystem with read-only source and fixed dependencies, a cleared environment, no account directories, private PID namespace, dropped capabilities and inherited socket/network denial. The actual preflight verified source writes failed and socket creation returned EPERM. Execution was serial under a shared nonblocking lock, one Vitest worker, bounded time and memory. All source and dependency hashes were verified before and after. The two initial preflight assertions rejected only bwrap's added `PWD`; a third probe verified its fixed value and passed, without expanding permissions.

The Vitest wrapper imports the unmodified repository config. It supplies only targeted file filters, one worker, JSON reporting and disabled result caching. Baseline controls mount the original base versions of exactly the three changed product files while retaining the identical new test. They are not a different test or a weakened expectation.

## Results and retained failures

- [x] **Final candidate: 180/180 targeted cases passed**, zero skipped/todo, process exit 0 for each suite invocation: 46 new and 134 existing.
- [x] Baseline: the same 134 existing cases passed. The identical 46 new cases produced 45 failures at the missing `transition-none` assertion and one pass for New York Hover Card, which already had the guard. The process exited 1.
- [x] New suite covers five popup types across all nine style profiles, plus navigation Popover profile switching. It checks actual WC source-host tokens and generated document, Shadow and split host/surface CSS, while retaining entry keyframes and duration tokens. It does not animate frames in a browser.
- [x] Strict **scoped** TypeScript check of the new test and its import graph: exit 0. This is not the full workspace type check.
- [x] Final four-code-file Prettier check: exit 0.

The seven existing suites and their unchanged baseline/candidate counts are:

- `packages/cli/test/proto-style-css.test.ts`: 75.
- `packages/cli/test/shadow-split-style.test.ts`: 14.
- `packages/prototypes/shadcn/test/dropdown.test.ts`: 3.
- `packages/prototypes/shadcn/test/hover-card.test.ts`: 2.
- `packages/prototypes/shadcn/test/menubar-style-projection.test.ts`: 5.
- `packages/prototypes/shadcn/test/popover-motion-gap.test.ts`: 11.
- `packages/prototypes/shadcn/test/popover-navigation.test.ts`: 24.

Earlier failures remain recorded:

1. The first candidate invocation passed all 46 assertions, but Vitest's result cache attempted to create the absent read-only-source `node_modules` path and reported ENOENT. The process exited 1 even though its JSON said `success: true`. This invocation is not a successful test run. Disabling only the result cache produced exit 0; source permissions and assertions were not relaxed.
2. The first Prettier check failed on the new test only. Formatting that test changed whitespace only; both candidate and baseline red/green runs were repeated against the final bytes.
3. An early baseline receipt's `sourceManifestSHA256` described the checkout, not its three overlaid baseline files. A retrospective supplement preserved that limitation, and final paired phases directly hash effective inputs. The final effective candidate manifest is `c8358e5d8c306d26d288e04faa607a0f215e803f7c30e45ad041aed541dba938`; the final baseline-with-identical-test manifest is `b249082dc7092e4a013f388046e69ec705d789b2d262650f5745a275b6957679`.
4. Existing ES2024 esbuild warnings occur in both variants and are retained.

Independent read-only source/data review found no definite new code defect and checked the counts, raw hashes and effective source manifests. This is limited local review, not published independent acceptance or an APPROVE disposition.

## Agent evidence: partial

- [ ] **Native first-open comparison and commit-bound captures remain pending.** No new screenshot or video is attached, and no older capture is used as a candidate result. Next: run the real affected components in a safe native browser, capture the initial/open/result frames and inspect the actual pixels.
- [ ] Diagnose any remaining black rectangle, first-position readiness and collision-resolved direction/origin independently. Do not infer their repair from CSS/token tests.
- [ ] Exercise WC, React, Vue and Vue 2, light/dark, applicable reduced-motion, reopen, interruption and collision cases. Native input/AT are not established.
- [ ] Full workspace checks, exact published-head native DCO/CI and independent acceptance remain outstanding. Targeted local results do not substitute.
- [ ] Keep #1161 and its mixed umbrella criteria open until their actual scope is satisfied. No ready-for-review, merge, release or deployment is claimed.

**Change: a shared source-level transition guard now has actual paired regression evidence; native first-frame and black-outline acceptance remain unfinished.**
