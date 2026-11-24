# Owned-scene second slice: independent local review

**Result: no remaining reproduced blocker in the bounded local review at commit `27b5429b46fdc31ae94d1f6a1bd37fb1c6a8323c`. All 48 independent controls have their expected outcomes.**

This is a bounded, local review requested by the current Sprint 4 coordinator. It is not a GitHub review disposition, a stable release decision or browser/GPU acceptance. The implementer worktree was only read. Probe sources, selected copied source snapshots, original failed reports and corrected reports are retained in this directory.

The review base is `4009346439913420769db1fa777354c6479f4846`. Early findings were recorded while the second slice was uncommitted; their original SHA-256 identities and reports remain unchanged. The final runs require the exact stable commit and a clean worktree. All 13 selected source hashes match before and after the final run; the final worktree remains clean. `stable-source-snapshot.json` and `stable-review-result.json` bind this result. Later commits are not implicitly covered.

## Final execution and its limits

| Control group | Result | Actual execution boundary |
| --- | --- | --- |
| Controller ownership, source exceptions/reentry, scope withdrawal and color conversion | 11/11 | Actual scene controller and ordinal validator; physical presenter recorded by a stub; Happy DOM |
| Move outside scope, then restore the same source and scope | 2/2 | Light DOM and ShadowRoot; actual controller; physical presenter stub |
| Runtime/native factory acquisition, release, disposal and reentry | 9/9 | Actual Runtime sink and emitted native owner, actual Core snapshot/ordinal validation; physical presenter stub |
| Held decode publication guard | 8/8 | Actual scene and physical publication/retirement code; only GPU resource construction and decode completion controlled |
| Scene acquisition reentered with a newer pixel-source frame | 2/2 | Actual Runtime sink and Core/ordinal validation; physical paint recorded |
| Source-kind switch, cleanup reentry/failure and invalid/stale control | 4/4 | Actual Runtime sink; recorded separate publisher capabilities |
| Four native output profiles and factory-name collisions | 12/12 | Actual Compiler entry and actual emitted-code syntax validation: four valid outputs and eight expected refusals |

These are 48 local controls, not 48 browser journeys. The new source-kind-switch controls exercise the lower-level sink interface; they do not assert that a live Prototype can replace its setup-frozen declaration. Runtime host configuration and native `createComponent` configuration remain separate from portable Prototype props.

## Findings and disposition at the current reviewed snapshots

### S4-SCENE-001 — Shadow scope withdrawal was not observed

Severity: high. Confidence: high. Original source: `shader-scene-host.ts`, SHA-256 `56c7a1f18782de683a22a7d147271e56202654406c124ee37eab89b19d51c12a`.

The controller admitted a composed-tree root within an application scope, but observed only the Document. Moving the root between two ShadowRoots, from scope A to scope B, left the old source publication active. The corresponding light-DOM movement retired it. This violated the declared scope/view ownership and retirement boundary in `C-FEEDBACK-SHADER-PRESENTATION-0001` and the proposed owned-scene capability.

The independent controller probe initially reported 10 passed and 1 failed. The exact source and result are preserved as `shader-scene-host-initial.snapshot.ts` and `controller-probe-initial.json`. The implementer added observation of the relevant composed ancestry trees and slot changes. The same independent probe passed 11/11 on intermediate scene SHA-256 `663d9761ced83d17eeae0971ef7d2c8d5a5489b8cf56d8bf806015d910b131f9` and again 11/11 at the final commit.

### S4-SCENE-002 — Reentrant host factory acquisition lacked a current-owner check

Severity: high. Confidence: high. Detected by direct inspection of the Runtime sink and generated native shader owner, then acknowledged and repaired by the implementer. The initial observation was a static finding, not an executed red test.

The code assigned `scene ??= host?.createScenePresenter(...)` and continued without checking whether the factory had synchronously released/disposed the owner or installed a newer acquisition. Runtime could commit after release; native could read a declaration cleared by disposal and retain an unretired returned capability. The implementer added turn/view/terminal/declaration guards and disposal of stale returned capabilities.

Independent tests of the actual Runtime sink and actual emitted native owner now pass 9/9: unused and owned-pixel paths do not read the host factory; synchronous release/dispose/detach/reentrant refresh retires only the stale acquisition; remount acquires afresh; factory throws of `undefined` and `false` produce fallback. The report records exact Runtime, emitter and emitted-owner hashes. The physical presenter is stubbed in these acquisition tests.

### S4-SCENE-003 — New native factory exports collided with accepted output names

Severity: medium. Confidence: high. Original source hashes for all four emitters are recorded in `factory-names-probe-initial.json`.

Actual `compilePrototype` calls with `componentName` set to `createComponent` or `createShaderHost` returned success for all four native Web profiles. Independent syntax validation rejected each emitted module for duplicate exports/declarations. Four `MyScene` controls compiled and parsed successfully. The implementer added conditional reserved names for the scene-capable output.

The same independent probe now observes four valid outputs and eight expected compiler refusals. These are entrypoint results, not a text-only check. The initial WC probe used the wrong TSX parser mode; that harness error was corrected to TS, and its original result is retained separately as `factory-names-probe-loader-mismatch.json` rather than counted as a product failure.

### S4-SCENE-004 — Restoring the same composed scope did not resume the source

Severity: medium. Confidence: high. This issue was first found by the implementer while adding the browser journey, then independently reproduced against the already preserved scene SHA-256 `663d9761ced83d17eeae0971ef7d2c8d5a5489b8cf56d8bf806015d910b131f9`.

After moving the root outside its source scope and receiving fallback, returning it to the exact same root/Document/tree with the same immutable source frame left it in fallback. The observer's unchanged-root condition did not retry the now valid source. Separate light-DOM and ShadowRoot controls both fail on that frozen source (`scope-recovery-probe-before-fix.json`, 0/2). The implementer added a source-availability state for the restoration path. The same independent controls pass 2/2 at the final commit; the original failed result and source are preserved.

### S4-SCENE-005 — Cost optimization stopped invalidating scene acquisition on a newer pixel-source frame

Severity: high. Confidence: high. Independently found in the cost-reduction diff and reproduced at Runtime sink SHA-256 `901744c3e300f165afbc65f9c87263671680dc6bd786b2f0865fe0e35e1d2365`.

Moving ordinal/turn bookkeeping inside the scene-only branch allowed a host factory to synchronously submit a newer `owned-pixels` frame without changing the outer scene acquisition's turn. The superseded capability was then committed, rather than disposed. Both an increased view and an increased revision within the same view reproduce it: the newer pixel frame is delivered, but the old capability records one commit and zero disposals. Expected values are zero commits and one disposal. This is an actual Runtime sink control using the actual Core declaration snapshot and physical ordinal validator, with only physical paint recorded by a stub. It does not claim visible browser paint.

The two original failed controls and exact sink source are retained in `mixed-source-factory-before-fix.json` and `mixed-source-factory-before-fix.sink.snapshot.ts`. Restoring a shared acceptance boundary passed the same controls 2/2 at intermediate sink SHA-256 `5858e0ccaaff5733f6839a6481dc350a0532715d8e4dd6a42722bea960ab9fa3`; its report and source are retained as `mixed-source-factory-after-boundary-fix.json` and the corresponding `.sink.snapshot.ts`. The same two controls pass again at the final sink SHA-256 `fd2b2b31aa2cb6f19451b9666d176a91e40fb6c418f4527c593da1b6140d1024`.

### S4-SCENE-006 — An accepted source-kind switch retained the previous publisher

Severity: high within the sink interface. Confidence: high. Independently found while reviewing the adjacent source-kind boundary. The ordinary Feedback declaration is frozen during setup; this finding is specifically about accepted lower-level sink frames and does not invent a live Prototype switching journey.

At the intermediate sink SHA-256 `5858e0ccaaff5733f6839a6481dc350a0532715d8e4dd6a42722bea960ab9fa3`, accepting a pixel-source frame kept an existing scene publisher alive. The reverse direction also left the pixel presenter active. Three retirement controls fail on that preserved source; the stale/invalid refusal control passes (`source-switch-before-fix.json`, 1/4). The implementer now detaches the previous publisher before calling cleanup, retires it, and checks the shared turn before continuing. Cleanup can install a newer publisher or throw without reviving the retired one.

The independent controls pass 4/4 at the final commit: scene → pixels → scene within one view reacquires a fresh scene capability; cleanup reentry preserves the newer scene; cleanup throwing `undefined` is diagnosed while the new pixel frame commits; invalid/stale alternate-kind frames leave the accepted scene intact.

## Same-turn publication fence

`publication-guard-probe.mjs` retains the actual scene controller and physical presenter publication/retirement functions. Only the GPU device constructor and image decode completion boundary are controlled. Happy DOM supplies actual style storage and MutationObserver behavior.

Eight cases pass. Every old decode callable is invoked while the observer delivery counter is still zero:

- An unchanged source publishes the image in the positive control.
- Light-DOM and ShadowRoot moves outside the source scope retain opaque fallback.
- Cross-Document adoption, with the new `ownerDocument` explicitly asserted, retains fallback.
- Source loss, source revision replacement and source `current()` throwing `undefined` retain fallback.
- A source `current()` callback that moves the root during the guard is checked against the latest scope and retains fallback.

The first 8/8 result used physical presenter SHA-256 `233d586b9b34b47541a48b546c8a95726e0b14226da6d6ec9c65b59cc347cf76` and scene SHA-256 `663d9761ced83d17eeae0971ef7d2c8d5a5489b8cf56d8bf806015d910b131f9`. That report and its exact source copies remain under `pre-final/`.

Cost work changed the actual GPU-construction entry to private `createWebShaderResources`. The final probe intercepts that constructor and retains the real ordinal validation, publication checks and retirement logic. All eight unchanged publication oracles pass again at final physical SHA-256 `df6a869ee639e5aa94899c83c00ed8854d1ed0f5a7629a7b21db312868ba6496` and scene SHA-256 `ddd4bf1e5b49e7fae03768f0c009fbcff67011ff637ef24cc0158adc8d82945b`.

This proves the synchronous publication guard in the controlled local environment, not browser scheduling or physical GPU paint. Cross-Document adoption rejects through the physical root/Document check; its device is retained until the observer/terminal retirement step, rather than being described as immediately released by the early-return callback.

## Other bounded observations

- Opaque source bytes `[128, 64, 255, 255]` are independently expected to become linear RGBA8 `[55, 13, 255, 255]`; the controller copies them and passes this control.
- Source `current`/`subscribe` exceptions, synchronous invalidation/replacement, late callbacks, stale held guards and bounded repeated reentrancy are exercised.
- The controller unsubscribes its consumer and does not call the application lease's `draw`, `revoke` or `dispose` methods.
- Inherited and accessor-based slot bindings are refused without invoking their getter.
- Runtime configuration enters Adapter options and the shader capability. Native configuration is captured by the generated `createComponent` factory and passed separately to owner construction. Portable Prototype props remain derived from the original source. This path was inspected; a real mount for each framework is not claimed by this local review.

## Acceptance outside this local review

The stable-commit binding and affected-control reruns are complete. Actual four-host Runtime/native browser source consumption, physical GPU allocation/readback, real held-decode/browser timing and import-cost results are separate execution evidence. This review does not replace those receipts. No source/definition lifecycle activation, complete Sprint 4 acceptance or issue closure follows from these local probes.
