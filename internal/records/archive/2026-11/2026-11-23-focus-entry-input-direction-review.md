# Focus Entry review: automatic direction depends on the current value

Independent review of `a9f9c07aa2b19f85d4be60f47ccc6a13e6788936` identified a correctness gap in its new native-input filter: `:dir` was incorrectly classified as independent of input state. The earlier 94 passing controls did not cover this case and do not establish that the original candidate was correct here.

The [HTML automatic directionality algorithm](https://html.spec.whatwg.org/multipage/dom.html#the-dir-attribute) determines direction for relevant `input` controls and `textarea` from their current value when `dir="auto"`. [Selectors Level 4's `:dir()` definition](https://drafts.csswg.org/selectors/#the-dir-pseudo) uses that document-language directionality. Changing a value from Latin text to Hebrew can therefore change an external `body:has(input:dir(rtl))` dependency without changing an attribute, DOM tree or focus. These primary definitions were read on 2026-11-23; Selectors Level 4 remains an editor's draft.

The correction removes `dir` from the independent predicate list. It follows the existing conservative input-state path; it does not invent a direction parser, alter the public Focus policy or relax the original preview retirement requirement.

## Red, green and remaining browser evidence

The same 18 source controls ran against the original candidate: **16 passed and the two new `input`/`textarea` direction controls failed**, with zero skipped. Both failures were the missing self fallback in the same modeled input dispatch. The corrected four-file selection passed **96/96**, with zero failed or skipped: 18 input-origin, eight motion-origin, 55 observer and 15 coalescing controls. The strict TypeScript closure including the new browser controls contained **685 source files and zero diagnostics** under TypeScript 5.9.3.

The new real-browser controls in `shadow-closeout.browser.test.ts` use the actual WC Adapter, native `:dir`/`:has` styling, `dir="auto"` and trusted browser text input. They capture fallback, computed direction and visibility in the native input dispatch after Adapter capture listeners, before a later microtask could conceal a missed event. Both directions and both control types are included. **Those two browser controls have not yet executed in this record.** They are separate from the canonical production Compiler/Worker journey, which also remains required at the integrated source.

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-focus-entry-input-direction-review/manifest.json) binds the exact source, original failing candidate, final controls, complete source-test reports and strict-type reports. Earlier records and failed attempts remain intact. The fix preserves unknown-selector/opaque-sheet handling, external radio/form logic, current Portal/slot ownership, the unchanged 250 ms deadline and real iframe retirement acknowledgement.
