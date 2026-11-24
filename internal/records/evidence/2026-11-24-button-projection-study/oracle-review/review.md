# Issue #749: independent pre-freeze oracle review

## Disposition

**Source adequate with explicit limits; browser calibration and freeze acceptance remain pending.** The reviewed observer is SHA-256 `5076ef9cfc3abb26a3b83963a9fc70cb03991419b939e026a495697c6b3dbc7d`. All three concrete source findings raised during this review have been corrected by the owner. This review is local, is not a GitHub APPROVE, and does not claim that any current comparison or calibration browser run has passed.

I did not author either production path, modify the oracle, or inspect any generative participant implementation. Generated output bytes were hashed for admission verification; their implementation semantics were not inspected.

## Prerequisites checked

The current [#749 source](https://github.com/Proto-UI/Proto-UI/issues/749) requires a real generated target and clean consumer, explicit supported boundaries, an independent oracle, common frozen inputs and retained failures. I read it directly through the GitHub connector and checked the retained copy (`3e532457782df205c135e026b73d72a53952734f7b14ac7297da9a419b0b022d`).

The real artifact admission is SHA-256 `9b110a11a07ef0d90b0924bc208a5befb2004a040eb685f7fcb47e695a94790d`. Its 28 direct object/evidence references match retained bytes; four production asset records also match their dist files. I independently recomputed the output inventory as `6705b19e96b27aa8dd1a5ff87e26241b655f7bb20c3980ac735ebd73472fb009`. Source and Compiler revisions are `d0eb81d3c61c3d3e93e46c4151e78031273d6116`. The target is React/React DOM 19.2.6, and the retained successful build/closure evidence supports this exact consumer with no internal Proto package in the reported closure. I did not reinstall or rebuild it.

The [actual published admission](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-7111867656) was read back through GitHub. It names the independent reviewer and the same artifact. Stale draft-publication wording remains within the historical JSON; the live comment establishes publication of the bounded review, not native platform approval. This prerequisite does not validate the new common oracle.

## Findings and corrections

| ID | Original gap | Correction reviewed | Status |
|---|---|---|---|
| ORACLE-01 | Preimage checks ran once; later responses were compared only with current disk. Changed disk/served pairs and unlisted scripts could escape the frozen inventory. | Observed JS/CSS must belong to the frozen inventory and match its hash. The final revision also compares both current HTML and its response to the frozen index hash. | Resolved in source; calibration pending. |
| ORACLE-02 | Reload and Enter shared an expected count of one without a separate zero check. A retained one and dead Enter could mask each other. | Separate `count(0)` and fresh-document checkpoint, plus gesture pre-count. | Resolved in source; calibration pending. |
| ORACLE-03 | Instantaneous expected counts did not establish a finite no-duplicate window; disabled keyboard could return before a late callback. | The observer starts before each gesture, includes 250ms after completion, verifies all observed count samples are monotonic and within the permitted interval, then checks the final value. | Resolved in source; calibration pending. |

The initial observer was `25fa94ff6aebd8eebe4d4f6719684de69bf4454a39977db23220258579d8afe5`. Revision `f6de5fc328ace2abba0676b6fdb4f0993c0cdf7e45ecfbb79df833a25bbc6267` fixed the counting/reset and JS/CSS paths; it still needed the final frozen HTML correction. The final revision above contains that correction. Earlier findings remain retained rather than being rewritten as original passes.

The eight existing asset-binding tests passed. They meaningfully reject mismatched bodies, unknown initial 304s, invalid ETags, changed production bytes, changed paths/URLs, failed response status and escaped origin. They test the binding helper, not the complete browser observer. `node --check` also passed for the final observer. An isolated helper-call demonstration confirmed the old caller needed its own frozen-inventory guard; this was not a browser exploit reproduction.

## Fairness and exact supported scope

Accepting one activation across a complete Space gesture on either keydown or keyup is fair for this scope. Preserve the observed edge as a diagnostic, without ranking one route as incorrect merely for its edge. The [W3C Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) supplies Enter/Space activation and role/name requirements; it does not impose one activation edge for this comparison.

Native `:disabled` and `aria-disabled=true` are both legitimate representations for the selected observable outcome. Native disabled controls have host click suppression in the [HTML standard](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#attr-fe-disabled), whereas [ARIA disabled state](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled) expresses inoperability and still needs actual behavioral evidence. The current oracle checks the attempted pointer behavior, and keyboard behavior when the disabled action accepts focus. A native disabled action rejecting focus must be reported as that legitimate branch; Enter/Space was not dispatched to it and must not be presented as an executed keyboard trial.

The admitted comparison is fixed text children (`Save preference`), outward onClick count, and one controlled disabled false-to-true-to-false cycle. It covers native driver pointer input, Tab focus, Enter, a complete Space gesture, attempted disabled input, re-enabled pointer activation, nonzero bounds, initial center hit target and named role/state lookup. The same trusted React shell, dependency lock, viewport and input sequence must be used for both treatments. The 250ms observation boundary is explicit.

The current tests do not establish arbitrary/dynamic children, event payload/currentTarget, callback replacement, focus restoration, cleanup, retained callbacks, native mixing, SSR, full lifecycle or another host. Outline/color/opacity recording is not visible-focus or contrast acceptance, and role lookup is not AT evidence. The functional count updater also does not challenge stale callback replacement. The trusted shell owns the output; this is not a sandbox against code deliberately rewriting the shell or observer globals.

## Calibration required before freeze acceptance

First establish passing controls for the exact admitted artifact, an independently authored native button with Space keyup/native disabled, and an independently authored ARIA button with Space keydown and a functioning disabled guard. Handwritten controls are calibration fixtures, never generative study samples.

Then retain targeted failures for: double Space activation; an 80ms duplicate callback; missing Space activation; ignored disabled pointer guard; disabled keyboard-only leakage; ignored controlled disabled updates; a button stuck disabled after re-enable; persisted count surviving fresh navigation; absent role/name; missing Tab focus; unlisted same-origin JavaScript; and changed HTML after preimage verification. Each mutation should fail at its expected first divergence. Keep raw failures and blocked/unexecuted cases; do not count later fail-fast cases as passes.

The final common prompt, authority/scope matrix, full environment and runner dependency hashes were not available for content-bound freeze acceptance in this review. Freeze them after actual calibration, retain browser version and traces, and request follow-up review of those results. This report establishes no browser result and no completed #749 criterion.
