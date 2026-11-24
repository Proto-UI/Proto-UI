# Place image-preview entry focus inside Dialog Content

## Scope and observed failure

This record continues the buttonless image presentation in [#1808](https://github.com/Proto-UI/Proto-UI/pull/1808) and the user's renewed [#796](https://github.com/Proto-UI/Proto-UI/issues/796) request. It records a consumer of the draft Dialog Content policy, not a lifecycle promotion, screen-reader certification or new image gesture.

The native image-preview run [45421734697](https://github.com/Proto-UI/Proto-UI/actions/runs/45421734697) executed head `f4a3766c57085985790ec6f7b9b65b0a71b309d1`: **27 passed and 7 failed out of 34**. All seven failures were the same repeated-pointer assertion: the keyboard Close control had computed `clip-path: none` instead of `inset(50%)`. They covered the six actual English/Chinese whitepaper cases at 320, 390 and 1280 px and the existing reduced-motion case. The six whitepaper opening-motion assertions passed in this run. The prior motion failure and its input-origin observation correction remain historical results; the 220 ms geometry oracle was not relaxed.

The downloaded raw artifact is retained at `/tmp/proto-ui-image-evidence-b91f/f4a/`. Its `github-job.log` has SHA-256 `d5a01e380aead3ffd79c0d71cdca3c6b54072d3f4eca6d56914bfb35ca759a1c`. The local read-only aggregation, `.tmp/image-zoom/f4a-repeat-focus-analysis.json`, has SHA-256 `c0878a8e6c957e2b85237cf454f73b65445fc9245ec27200b80e1660b8fa5a97` and binds the original initial/returned/repeated sidecars and job log. These local paths identify retained development evidence; the linked hosted run is the published execution source.

All seven focus timelines show the following boundaries:

1. After the first Escape and return, the Close Button and its DialogClose wrapper both report `focused=false` and `focusVisible=false`, have no corresponding projection attributes, and do not match native `:focus-visible`. The original thumbnail is the active element and has visible focus.
2. The next trusted pointer activation leaves that same thumbnail active with native focus visibility until focus transfers into the preview. The sampled Close facts remain false before this transfer. There is no intervening keyboard input.
3. On the next Close `focusin`, the inner Button is the native active element, matches `:focus-visible`, and publishes true focused/visibility facts. Its wrapper remains false. The computed Close clip is then `none`, consistent with those facts.

This rules out retained Close facts after Escape as the cause of this failure. It also occurs with normal and zero-duration presentation, so a reduced-motion-only detach explanation does not fit the observations. Automatic entry chooses the first eligible control, which is the keyboard Close action in this composition. The native focus-visible result is real; the consumer must not hide it by overriding CSS or changing a reported fact. The artifact does not expose every internal focus request or readiness callback, so it does not establish a particular private callback ordering.

The draft native-visibility criterion in `C-AS-FOCUSABLE-0001` requires preserving supported native true as well as false results, including repeated pointer requests. The existing same-target contract tests remain the owner of that requirement. No Focus module rule is weakened by this repair.

## Public policy and consumer change

Selecting `focusEntry: 'manual'` alone was considered and rejected for this consumer: it suppresses automatic entry but would leave initial focus on the background thumbnail. Retaining the scope's later Tab trapping is not the same as putting initial focus inside the modal.

The draft `P-BASE-DIALOG-CONTENT-CONTENT-ENTRY` criterion adds `focusEntry: 'content'`. For an accepted actual activation, Content activates its existing scope without automatic child entry and requests native focus on its own dialog surface with scroll preservation. The surface is programmatically focusable and excluded from sequential Tab navigation. Forward and reverse Tab enter and loop through eligible descendants. The existing scope still owns trapping, dismissal and exact previous-owner restoration. Accepted close, observed owner replacement and terminal disposal cancel the activation's pending self-focus; rejected controlled requests must not fabricate or retire an accepted activation. Default `auto` and existing `manual` retain their behavior.

The image consumer changes one production call in `documentation-image-preview.ts` to pass `{ focusEntry: 'content' }` when creating its public Base Dialog Content. It adds no private Prototype, native focus call, keyboard listener, retry timer or visibility override. Source selection, asynchronous decode, request guards, contain geometry, reverse animation, image admission and the original page media remain unchanged. No image CSS changes are included in this follow-up.

No new public Content focus-state exposes are consumed. Consumer checks observe native `document.activeElement === content` and `tabIndex === -1`. The existing Close Button's declared facts and computed presentation are checked separately. Captures also retain Content's native `:focus-visible` result and computed outline for actual visual review; this record does not assume the new focus target has no visible outline.

## Consumer red and green evidence

Two new DOM-model cases exercise Shadcn and Brutalist with the same image composition. Before the production change, both failed on actual Close focus versus expected Content focus; the seven older cases were filtered out in that red run. The retained `.tmp/image-zoom/content-focus-consumer-red.log` has SHA-256 `2ca2c8fd2f6c35a3cad7e0e282d7550d6ed3279ea2c6bbc1000b950668b8dacb`. The failure occurred after successful startup, not during imports or browser launch.

After the public implementation and consumer option were connected, this command passed **9/9 with no skips**, including all seven original cases:

```sh
corepack pnpm@10.32.1 exec vitest run apps/www/src/components/documentation-image-zoom.test.ts --maxWorkers=1 --minWorkers=1
```

The cases check actual DOM focus on Content during initial and repeated entry, `tabindex=-1`, unfocused Close facts, keyboard movement to Close, reverse Tab looping, Enter dismissal, Escape dismissal and restoration to the same thumbnail. Existing source/geometry, interrupted reopen and terminal cleanup cases remain. These are DOM harness results with synthetic input; they do not establish native Chromium input, clipping or rendered appearance.

The green log `.tmp/image-zoom/content-focus-consumer-green.log` has SHA-256 `22338135459b005588e51ff1e0fdee32ff58435c49006564ead063d0510be9d6`; the adjacent JSON records the command, timing and before/after source hashes. HEAD was still `f4a3766c57085985790ec6f7b9b65b0a71b309d1` during the authorized merge of main `bdfc01f3ebdb15c72312c66af46880c1144c09a9`; this is a source-bound worktree result, not a claim that either old commit contains the repair. The six bound files were unchanged during execution. The production identities were:

| Source | SHA-256 |
| --- | --- |
| `packages/prototypes/base/src/dialog/content.proto.ts` | `f6223253fa03810eec75d1f8ff0e63c5e3cdfc0c54811a21e3ddea96c3e22c15` |
| `packages/prototypes/base/src/dialog/types.ts` | `34cd30a00f04eefdfd704c4cb59fadf27570a0dc53d78df7796c2f6e676d8481` |
| `apps/www/src/components/documentation-image-preview.ts` | `db2b6220c94e084eef8eea789f947ae43dd4baba98f84ae908de0353bd82181b` |

The browser test keeps its 34-case matrix. It adds actual initial/repeated Content focus and strict Close clipping, forward and reverse Tab entry/looping, and Content outline observations. It retains keyboard Close activation, background and Escape dismissal, restoration, source fidelity, reduced motion and no-JavaScript checks. All 220 prior `expect` calls remain among 234 calls, and `expectLinearImageMotion` is byte-identical, with SHA-256 `47d1b4125834f315f7783addf8b440b621553fadde0b3888d13bdba21f3a8c96`. The local preservation receipt is `.tmp/image-zoom/content-focus-consumer-preservation.json`.

## Remaining acceptance

The new joint candidate still needs its own hosted native browser run, whitepaper captures and independent rendered review. In particular, the native active element must be Content on entry, Close must stay clipped until keyboard navigation selects it, both Tab directions must remain within the modal, and the actual content focus outline must be inspected. The prior 7-failure native run is retained unchanged and is not relabeled as passing by the DOM results.

Screen-reader output and complete assistive-technology acceptance have not been measured here. Contain remains a whole-figure presentation and does not inherit the withdrawn reading mode's label-size or pan acceptance. Subsequent exact-head publication and CI records must bind their own source revision and observations.
