# Final independent Button oracle calibration review

## Disposition

**Adequate for the declared common support scope.** This final addendum supersedes the changes-required disposition in `focus-branch-addendum.json`. ORACLE-01 through ORACLE-04 are resolved for this bounded oracle. The reviewed oracle may be frozen for this scope. This is acceptance of the oracle prerequisite, not completion of #749, a generative comparison result or a GitHub APPROVE.

Exact observer SHA-256: `91d6604b33732c7596e33a36af6c0996ac0dc8cb27c00b27d3e91bd9db615937`.

Raw calibration archive SHA-256: `6f5831aa14bc2446504e4d36594a3347e1378c2d4b6e130320fad1e422b53a36`.

`button-common-03/results.json` SHA-256: `07c6ea8d62b26016db380268852625b8a3859a5bb16cc6f6bdde15630575e273`.

## Independent readback

I compared all **420 regular archive files** with the extracted tree; there were no mismatches or nonregular archive entries. I read the corrected source, handwritten control generator and runner, then reconciled all 13 command receipts with their raw browser results. The local and archived observer hashes agree, and the runner asserts that exact observer hash before execution.

The final calibration contains **3 passing positive controls and 10 correctly rejected negative controls**, all in Chromium **145.0.7632.6**, with Playwright **1.58.2** recorded in the traces. No final-round cell was classified from the outer 70-second process timeout or a browser/server launch failure.

All **39 frozen production file hashes** and **48 observer response-body bindings** match their manifests and retained bytes. I additionally rehashed **48 retained HTML/CSS response bodies directly from traces**, with no mismatch. The exact generated control uses the already admitted artifact's unchanged consumer manifest and production bytes. All **85 named checkpoint PNGs** exist with valid PNG signatures; all **13 trace ZIPs** pass CRC checks and contain actual snapshots and screencast records.

**Response-body limit:** these Playwright traces do not retain JavaScript response bodies (`size: -1`, no body resource). The 24 declared JS network records therefore rely on the actual, reviewed observer's response-body SHA-256 receipts, checked against the frozen files. Two further JS records belong to intentionally unlisted `extra.js`. This review does not claim to rehash those JS responses directly out of the ZIPs. This limits duplicate raw-body evidence, not the source-bound observer's actual body-hash check.

## Results and first divergence

| Control | Outcome | Recorded first divergence or positive observation |
|---|---|---|
| generated-existing | Pass | Space keydown; disabled branch recorded |
| legal-native | Pass | Space keyup-or-later; disabled branch recorded |
| legal-aria | Pass | Space keydown; disabled branch recorded |
| late-duplicate | Expected rejection | pointer: count escaped allowed interval |
| disabled-ignored | Expected rejection | disabled-pointer: count escaped allowed interval |
| reset-leak | Expected rejection | page.waitForFunction: Timeout 30000ms exceeded. |
| missing-role | Expected rejection | locator.waitFor: Timeout 30000ms exceeded. |
| unlisted-asset | Expected rejection | Native preflight reported runtime/network failures |
| space-double | Expected rejection | space: count escaped allowed interval |
| space-missing | Expected rejection | space: final count differs |
| tab-unreachable | Expected rejection | Tab did not reach the generated action |
| disabled-keyboard-leak | Expected rejection | disabled-enter: count escaped allowed interval |
| reenable-stuck | Expected rejection | reenabled-pointer: final count differs |

The negative controls are purposeful independent mutations, not generative study samples. Their source changes match their failure modes. Later cases after a fail-fast rejection remain not reached.

### Reset and missing-role failures are genuine criteria failures

For `reset-leak`, the trace records output 0 initially, pointer increment to 1, and output 1 again after the second navigation. The failed `waitForFunction` explicitly expects zero. Its 30-second condition timeout occurs with successful document/asset loads and before the outer 70-second deadline. It establishes the intended reset defect, not a broken harness.

For `missing-role`, the frozen source and live snapshot contain a visible `DIV#action`, `tabindex=0`, `aria-disabled=false` and the correct label, but no button role. The failed locator is exactly the named button-role criterion after the page and assets load. Its 30-second locator timeout is the expected role failure.

### Disabled focus fairness is corrected

The generated positive records `nativeDisabled=false`, `ariaDisabled=true`, `tabIndex=-1`, `focusRetained=false`, and **no dispatched keyboard attempts**. The native positive records native disabled and the same no-dispatch branch. The legal ARIA positive retains focus and records actual disabled Enter and Space attempts with unchanged count. The disabled-keyboard-leak mutation still fails on actual Enter delivery. Thus accepting focus retirement has not erased the keyboard guard check for controls that receive keyboard input.

Complete gesture records include the finite 250ms post-gesture window. The delayed duplicate shows 0 → 1 → 2 → 2, and double Space shows 1 → 2 → 3 → 3; both are rejected by the intended count-interval assertion. Native Space keyup and ARIA/generated keydown remain admitted diagnostic differences.

## Earlier failures remain evidence

`button-common-01` retains the generated artifact's false rejection at the old native-only disabled assertion. It is an oracle defect, not a product failure. `button-common-02/run.log` retains an address-in-use failure while binding the HTTP server, before any browser result exists. It is an environment/setup failure and must stay outside the product correctness denominator. Neither history has been rewritten as a successful run.

## Scope and limits

Acceptance covers the exact fixed-text children, outward callback counts, one controlled disabled false-to-true-to-false cycle, fresh-page reset, driver pointer/Tab/Enter/complete Space, nonzero geometry, initial hit target, named role/state lookup and finite 250ms observations. No event payload, callback replacement, arbitrary/dynamic children, full lifecycle, native mixing, SSR, AT, physical input, other-host or visible-focus/contrast guarantee follows.

I independently read back actual retained execution; I did not rerun a browser in this review. The ten negative controls do not separately reproduce a changed-HTML-after-preimage race; that guard was source reviewed and successful frozen HTML response bodies were directly checked. The final shared task/prompt/environment freeze and later generative runs remain owner work. Keep this exact oracle and the same declared inputs for both treatments, preserve every outcome, and report untested, blocked and not-reached rows separately.
