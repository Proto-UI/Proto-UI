# 2026-11-16 Search browser geometry typing

## Observed failure

The complete `check:types` run at `11fbc20a238c99caefebd043a3fa52e417d52842` completed the workspace phase, then failed the website Astro phase with one error across 1,233 files. The Search reveal evidence callback read `offsetHeight` from Playwright's `HTMLElement | SVGElement` parameter. `SVGElement` does not provide that HTML layout property. All 13,190 tracked source files remained unchanged during the run.

This is a typing omission in browser evidence, rather than a new Scroll or compiler semantic requirement. The callback's current-owner `list` comes from the Shadcn or Brutalist Command Content HTML host. The existing geometry checks already depend on that physical HTML viewport.

## Bounded correction

The property read now states its existing HTML assumption explicitly: `(node as HTMLElement).offsetHeight`. It adds no fallback, geometry clamp, selector, polling delay or change to the original acceptance predicate.

TypeScript 5.9.3 emitted identical 160,239-byte JavaScript before and after the change, with SHA-256 `1a2985ed7877d0d144c6f4efd060be79f8b02aecfe13ef91652eb43ee360a947`. Independent source review confirmed the HTML host ownership and the single assertion change. This establishes that the browser oracle's runtime behavior is unchanged; it does not claim that the complete type gate has subsequently passed.

## Verification boundaries

Two disposable selected-type configurations did not reproduce the application's checking scope correctly. The root-only configuration lacked the imported MJS module declaration; inheriting Astro's options then checked transitive package sources under the website's `verbatimModuleSyntax` and narrower aliases. Their actual failures remain retained. No repository compiler configuration or unrelated package imports were changed to make those probes pass.

The repaired integrated candidate must pass the real complete `check:types` command. Original native Search failures remain separately recorded and need implementation repair and native verification. This evidence-only correction does not require a second version bump within the same `0.3.0-alpha.2` candidate.
