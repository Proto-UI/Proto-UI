# Mobile navigation and source reading increment

This website-consumer change is based on `ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31` and is independently reviewable above the frozen homepage branch. The user requested a usable compact navigation panel and a readable expanded code view, while retaining real public Prototype projections and existing Adapter ownership.

## Implementation boundary

- The shared Header disclosure keeps the native navigation subtree and existing non-modal ownership. Compact placement uses the complete Header bottom and the remaining visual viewport, with an 8px gutter. Desktop placement keeps its existing trigger anchor.
- A public family Button closes the panel and returns focus to the original trigger. The fixed title/Close row and separately scrollable content distinguish navigation, runtime/library choices, and preferences/community. Navigation, Escape, nested Select ownership and runtime replacement remain existing owners; browser Back/Forward and restored pages dismiss the disclosure without adding history entries.
- Surface remains the existing passive public atom: Shadcn and Brutalist call `asSurfaceRoot`, and no new family or homepage-specific Prototype is introduced. Site layout and the close glyph are consumer-owned.
- Expanded native code is bounded by `min(36rem, 65svh)` rather than 9rem. The `pre` alone scrolls; the actual Copy command and metadata remain outside that scrolling viewport. Keyboard expansion transfers focus from its hidden Button to the native source viewport.
- Search behavior and its production one-second threshold are unchanged.

## Evidence

Focused local disclosure, layout, homepage command-channel and code-panel tests pass. Workspace/docs type checking passes with only the three pre-existing Astro hints. Public-document tests, prototype catalog checks and source-provenance probe contracts pass. The wider general suite is running separately; no full-suite success is claimed here.

Local Chromium could not create its process sockets in this sandbox, and the escalated launcher failed before browser startup. These failures produced no visual evidence. The existing Homepage visual workflow gains an independent read-only job using the same candidate-owned probe against clean exact checkouts of the pinned pre-change revision and candidate SHA.

The primary captures are 390 and 430 CSS pixels at normal text size, both locales and both color schemes. They are mobile simulations, not a physical OnePlus 13T. A separate 320px/200% text stress case exercises actual menu scrolling with its Close row kept reachable. The probe retains real before/after navigation and expanded/scrolled code screenshots, exact source metadata, failures, native keyboard/pointer interactions, all four runtime menu replacements, nested Escape, navigation/Back and exact clipboard payload checks.

Hosted execution, screenshot inspection, final aggregate checks and independent acceptance remain pending. Existing homepage comparison, isolated source/copy tests and production Search evidence remain required; the new job does not replace them.

## Visual correction after actual user review

The first candidate's screenshots exposed two visible regressions that its functional tests did not reject: the original Header toggle already turns into Close, while the added panel Button duplicated it; forcing the panel and projection chain to the entire available height left roughly 190px of unused area below short content. The corrected direction keeps only the existing Header toggle, removes the redundant panel heading/Button and its projection, uses natural content height with the existing viewport max-height ceiling, and retains the original independently scrolling native slot. Normal-size screenshots must be inspected for a single Close and no forced blank footer; text-enlargement stress must still prove the Header close remains reachable while content scrolls. Earlier frames and probe failures remain historical evidence, not final visual acceptance.
