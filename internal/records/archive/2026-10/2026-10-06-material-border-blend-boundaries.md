# Finite material border and blend corrections

Reproduction baseline: #809 `fe21e41862aceebd1ae1f903421e8e7ccfdf502c`. Its ten observed workflows passed, including the precise TOC retry after a local stylesheet transport ECONNRESET. That does not constitute independent approval.

Before publication, a fresh read found #809 already merged as `6896bc7e3f2104f376c658043438eca675c149a0`. This six-file follow-up was moved without conflicts onto main `405112ed2cbae56cff6e178d9cb4d5d93b930fe5`; the affected material source was identical. The closed PR branch was not advanced.

## Governing scope

`C-FEEDBACK-MATERIAL-0001` remains draft. Its accepted finite geometry/safety direction guides this experiment, but it does not grant stable material admission or prove arbitrary external CSS. New review comments 4193773031 and 4194028920 were checked as bounded existing box/compositing defects rather than permission to implement a general renderer.

## Border geometry

Source uses host border-box bounds but an absolute `100%` canvas fills the padding box. Nonzero borders therefore scaled the buffer/frame into a smaller actual surface and used the wrong inner clip. The minimal repair keeps provider `[x,y,width,height]` semantics, derives canvas dimensions by subtracting borders only, maps the source extent inward without mutation, and derives inner radii from the once-clamped outer style radius. It does not paint an enlarged canvas over the original border.

One scalar shader radius can represent equal circular corners or square corners. Uniform borders and asymmetric square interiors are supported; genuinely unequal/elliptical derived corners use the existing geometry fallback. Border widths are in both observation snapshots, including fixed border-box size and asymmetric swaps. Snapshot comparison retains the original provider tuple, not the inset frame tuple, so a valid frame does not cause an animation-frame repaint loop.

Fourteen host-unit controls use injected CSS/bounds/WebGL and the actual emitted frame-validation ABI. The exact original sink produced 13 expected assertion failures and one normal borderless/padding pass; two failures concern earlier raw-bounds validation boundaries, not newly discovered original acceptance bugs. Invalid original bounds must remain invalid before crop, including a slightly negative origin that cropping could otherwise hide; early rejection uses the existing catch/GPU cleanup. The tests are not native layout or pixel evidence.

Independent review found one additional numerical edge: independently rounded inset origins and scaled extents could sum to `1.0000000000000002` for a valid right/bottom edge. The repair derives near/far endpoints before subtracting the extent, while preserving exact raw extents on borderless axes. Both 192-pixel, five-pixel near-border regressions passed after failing the first candidate. The final border suite has 16 controls.

## Compositing boundary

Four mix-blend-mode host/light/shadow/slot negative controls reproduced unsupported admission. Non-normal blending can invalidate the local contrast result, so it joins the existing conservative compositing rejection and observation. The implementation centralizes only the finite opacity/filter/mix-blend/transform/rotate/scale/translate list, replacing positional indexing so acquisition, classification and observation cannot diverge. Foreground and border/corner geometry remain their own style-derived inputs. This does not reject arbitrary unrelated ancestor properties or claim to understand unlisted CSS.

## Evidence and remaining gates

The README now states the supported/unsupported finite assumptions together. Source/emitted browser tests inspect actual canvas/backing size, GL sampling bounds, preserved border color, same-outer-size border changes, representable asymmetric corners, fallback/recovery and blend withdrawal. The known local browser socket restriction is respected; exact-head CI must execute these controls before rendered completion is claimed. Validation before the main transition: 841 tests passed across 170 files, with 34 existing todos; type checking covered 446 files with zero errors and warnings. The 37-package dependency build and both source/emitted fixture builds passed. Independent source review passed 82 focused tests and 7,800 bounded arithmetic controls through the real frame validator, with no remaining blocker in this scope. It did not execute native browser layout or establish optical correctness.

All nine measured caps passed: Runtime 67,834/69,200; React 88,504/91,000; Vue 88,238/90,800; Web Component 97,274/104,500 bytes. Of eleven measured artifact hashes, only the Web Component entry and its two consumer fixtures changed relative to the baseline. Shared Runtime/React/Vue artifacts remained identical. After moving the same repair onto main `405112ed2`, affected validation passed again: 843 tests across 171 files, 34 existing todos, 447-file type checking with zero errors/warnings, and all nine budgets. Native source/emitted browser results remain pending exact-head CI.

No common Feedback/Runtime source, cap, measurement algorithm, public author syntax or catalog lifecycle changes here. Final union verification remains separate. The follow-up requires its own exact-head CI and independent review before normal integration. Earlier #809 and #824 acceptance checkpoints are historical, not claimed as approval of this later change.
