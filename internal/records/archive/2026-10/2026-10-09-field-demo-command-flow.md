# Field demo command flow candidate

<!-- prettier-ignore -->
Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and observed failure

This is a bounded demo-layout repair candidate, not a change to Field semantics or draft admission. Baseline: `342955e238e6a632dbc010b70aa59d1a373ce440`, tree `11effd22f7b28598e40a8fd0534879b3bebc3fd5`.

The [official Field job](https://github.com/Proto-UI/Proto-UI/actions/runs/37946760576/job/113874914244) ran 25 cases: 21 passed and four Liquid Glass cases failed. Its WC trace records:

- pointerdown reaches Cancel;
- native change starts a fresh validation and clears the prior invalid state;
- pointerup and click reach the surrounding preview, without Cancel in their paths;
- the original cancellation assertion sees `Unavailable`.

The trace proves that the completed command missed Cancel. It does not prove a canceled lease was overwritten. It lacks instantaneous target rectangles, so layout motion remains a causal hypothesis. The React/Vue/Vue 2 label-focus polling failures are separate and unresolved.

## Candidate and boundaries

Only the asynchronous demo puts its family Button after Description and before dynamic Error and Validity, inside its existing FieldRoot. The polite status remains after the root. Error detachment or a wrapping status can therefore change downstream content without preceding the command in the authored normal flow. No fixed-height feedback placeholder, clipping, hidden duplicate message, absolute positioning, CSS reordering, or family-wide Field behavior is introduced.

All five families retain their own real Field and Button prototypes. The Base demo uses natural-height grid flow; the styled Field roots use natural-height column flex. The change retains one editor, its label/help/error relations, passive Error semantics, and the existing polite status. Narrow/zoomed text may still wrap naturally; visual spacing and native hit geometry require fresh browser evidence.

Authority: draft `C-FIELD-0001-ASYNC`, `-CHANGE-ONLY`, `-PARTS`, and `-RELATIONS`. Pointerdown alone still does not cancel. Cancellation continues through the completed Button command; the root validation owner and accepted native change semantics are untouched.

## Evidence and remaining work

- Original two-family synthetic cancellation suite on unchanged baseline: 8/8 passed.
- Final source-order oracle on exact baseline demo: five family assertions failed; both placement negative controls per family were recognized in the five control cases.
- Candidate: 25 real-component WC synthetic cases, 10 source-order/actual installed Tailwind compiler cases, and 12 existing editor-ownership oracle cases passed (47 total).
- Synthetic cases cover all five families, pointerdown-only rejection, pending cancellation, fresh change after cancellation, already completed invalid results, stable command identity, and actual mounted label/help/error relations. These are not browser layout or OS assistive-technology evidence.
- The new CSS test compiles the installed default Tailwind theme and the actual family root utilities. It verifies their normal-flow mapping, not a native layout engine. Its initial source-relative path error was corrected; the failed fixture output remains in the local evidence packet.
- Browser diagnostics now record instantaneous Cancel rectangles, pointer coordinates, hit-test owner, and membership in the event path. They do not change any existing assertion, force-click behavior, or the original 1000 ms polling and 650 ms reply checks.

Local native Chromium execution is unavailable under the current environment restrictions. No sandbox bypass was attempted. The next official exact-head Field run must establish trusted down/up/click delivery and cancellation, plus fresh light/dark and narrow enlarged-text captures. This record does not turn the baseline red run green and does not close optical, native, AT, or GPUI debt.
