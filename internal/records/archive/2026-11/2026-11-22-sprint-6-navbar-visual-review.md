# Sprint 6 Navbar — independent native screenshot review

## Evidence identity

Real GitHub Actions run `45014679306`, attempt 1, Chrome `157.0.8103.78`, Node `v24.22.3`.

| Receipt | Source | Result retained by runner | Manifest SHA-256 |
| --- | --- | --- | --- |
| Historical before capture | measured `dc3b184ba10b0de53e40359c52d012b204b2cd01`; capture script `647ee7ad7e3e343cf18fc488b10a9a8fb877a389` | captured: 12 WC cases, 36 images, no page errors | `f8df69b37cb0b4bc06a6dea6c9cdb019591604099c3d48c16b9e82d9d7c580b8` |
| Candidate | `647ee7ad7e3e343cf18fc488b10a9a8fb877a389` | passed: 38 cells, 12 top-level tests, 98 observations, 208 images, no page errors | `deae895ab2712612fab95672d902f0701ccc01b48b9c8a1e32f740c3f2be5201` |

The baseline script SHA-256 is `d260c02bd204d9b2e5ed83fcfe5d7a79ac399c7417fdb481f1a4fd139fcb5d2f`. Baseline captured does not mean the baseline meets the new contract. Candidate passed describes the automated assertions that ran; it does not supersede independent visual findings.

## Visual findings

The reviewer actually opened the seven images listed below, rather than relying on the runner's status.

The light 1440 px homepage visibly improves from a tall 72 px toolbar of largely equivalent raised controls to a compact continuous navbar. The candidate has a 40 px row plus its border, a larger light-weight brand, text navigation, compact form controls, and passive theme/menu actions. Menu hover is a local darker surface; expansion is anchored below the menu without moving the surrounding bar. These observations support the narrow density/hierarchy change. The blue palette, dark mode and mobile targets are explicit Proto UI adaptations, not a pixel-identical upstream Bootstrap claim.

**A real visual defect remains in the candidate documentation header.** In both the dark 390 px expanded view and the light 1440 px closed view, the Theme action displays a pale/white glyph on a light raised button surface. The historical dark mobile image has a dark, readily distinguishable glyph. The candidate also shows the documentation Search control as a Shadcn-like rounded pill rather than the compact Bootstrap homepage treatment. These are visible despite the 38-cell automated pass. Both were reported to the Bootstrap implementer and integrator. The implementer independently confirmed a Theme SSR/runtime context mismatch and a hardcoded documentation Search family selection; fixes and stronger actual-paint oracles are pending.

No numeric contrast ratio is inferred from a screenshot. A final screenshot/paint receipt on the corrected exact head is required before accepting these documentation controls.

## Images actually inspected

Paths are relative to `/workspace/scratch/cd1b397ad8e7/bootstrap-workflow/`.

| Image | SHA-256 |
| --- | --- |
| `bootstrap-navbar-before-45014679306/before-home-wc-light-1440-closed.png` | `e83c9997f93b6c65fa46b4c747b16f1cd969e5bc661c7367d438e4b2f71c2bbf` |
| `bootstrap-navbar-45014679306/home-wc-light-1440-closed.png` | `e2c84e1a46b663d48f007fd5eacb4e47858ccbfa4294bbbbda70cae785a9bbb8` |
| `bootstrap-navbar-45014679306/home-wc-light-1440-hover.png` | `08000e4522c5bba99fa1a92c6c651c83c46ca8de80dd8666b8837f9bbc646229` |
| `bootstrap-navbar-45014679306/home-wc-light-1440-expanded.png` | `fd7f83f8747ab39feea059666f6de1ef091897816a3f74a18a9ff8b1c85c1757` |
| `bootstrap-navbar-before-45014679306/before-docs-wc-dark-390-expanded.png` | `5486dfce02e99f313077180964fcfa77ddc813bcb1a5db91a5dc961b9095c270` |
| `bootstrap-navbar-45014679306/docs-dark-390-expanded.png` | `b3b85d8257ce8c6dc2772a72656d29789962ce4148e9db1f81e0337c8d0a6720` |
| `bootstrap-navbar-45014679306/docs-light-1440-closed.png` | `cdc7a03810e06fde3c188e15d031423d16d42e90798951d39ceac66d7f94f3b1` |

The exact-reference Bootstrap 2.3.2 screenshots and pinned Less source remain a qualitative structural reference. This record does not close per-part motion, all variants, input/lifecycle, installation, Compiler/non-Web or full design-family acceptance.

## Follow-up source review before the next native run

The nine-file repair patch `bootstrap-workflow/bootstrap-docs-consumer.patch` has SHA-256 `64d9c7a4d4e06035ae11b408833ba49a3b667b7a012e4cc6194839a7114f522f`. All nine integrated files were independently compared with the frozen implementation candidate and were byte-identical.

The Theme command now retains its authored icon purpose separately from Bootstrap's normalized public `size=default`; runtime initialization no longer interprets the normalized size as a new ordinary-button purpose. Documentation Search requires the actual declared whole-site family. During source review, the reviewer also found that dynamic Retry/More and legacy Search commands still supplied other families' unsupported Bootstrap `variant`/`size` names. The repaired website composition explicitly uses Bootstrap `default`, and `small` for the relevant legacy commands, without changing Adapter enum behavior.

The retained red controls independently show the Theme lacking transparent paint, Search selecting Shadcn, an actual Bootstrap Retry receiving raw `surface`, and legacy commands receiving `ghost`/`secondary`/`sm`. The final targeted run has **14 passed / 84 deselected**, not 98 passed. It exercises actual Bootstrap preparation failure, disabled Retry, recovery, a 23-result More sequence and closure; a separate materializer-props test checks exact legal legacy values. The full integrated related run remains the integrator's next validation step.

The strengthened native Navbar oracle inspects real Theme fill/image/foreground/glyph and opacity/target size, requires at least 3:1 against both actual computed blue-gradient endpoints, and verifies Search's actual family, 4 px corner and gradient paint. It also checks theme restoration on the same page. The complete 38-cell/12-test inventory now rejects unknown or duplicate cells, page errors and cleanup failures. Failure capture, fixture disposal and context closure are independently attempted; final context/browser/server cleanup precedes the terminal result.

The old Vue retry test had waited for the generation controller commit, while `composition.activate` starts a separate asynchronous `setChildren` publication. A bounded wait for the current generation's actual Retry ref now precedes the unchanged disabled, paint, close and late-recovery assertions. This fixes that observation premise; it does not move a performance clock or establish the separate 1000 ms Search-ready criterion. HappyDOM's unretained `var()` dimensions are observed through the exact target element's real style projection call; native resolved 40/44 px evidence remains required.

Source review found no remaining blocker in this nine-file repair. **The visual defects remain awaiting fresh final-head native screenshots and paint results.** The original `647ee7a` images and failures above remain the historical evidence.
