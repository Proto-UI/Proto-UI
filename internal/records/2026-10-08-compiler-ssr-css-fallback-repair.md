# SSR consumer CSS fallback and closed-subset review repair

Date: 2026-10-08. Reviewed candidate: `40573de01f51f451d0058543d19dfeae6117852d` (kept unchanged).

Independent review found two blocking problems in that candidate:

- The dependency regex treated every `var()` reference as mandatory. The actual canonical `font-sans` recipe has a complete font-stack fallback and previously compiled without a theme, but the new check rejected it. A transitive `var(--optional-radius, 0.5rem)` was incorrectly rejected too.
- The raw external-resource regex missed escaped `@import` and `url` identifiers and `image-set("https://..." 1x)`, which need not contain `url()` spelling. These were static probes; no external resource was fetched.

## Bounded repair

The replacement lexer distinguishes strings/comments, contiguous function syntax, nested parentheses and the first top-level `var()` comma. Dependency resolution uses an available primary, otherwise its fallback, without making an unused fallback mandatory. Empty and nested fallbacks and comma-separated font stacks remain intact. CSS custom-property cycles include fallback edges and are found as strongly connected components; a fallback inside a cyclic value does not dissolve the cycle. An outer consuming fallback can handle a guaranteed-invalid value. These semantics follow [CSS Custom Properties, cycles](https://www.w3.org/TR/css-variables-1/#cycles) and [variable substitution](https://www.w3.org/TR/css-variables-1/#using-variables). This is dependency analysis, not a selector/cascade or property-value validator; conditional duplicate definitions are checked conservatively.

The closed consumer stylesheet contract is narrowed explicitly instead of claiming a universal sanitizer: unescaped ASCII identifiers, custom-property declarations, `@layer`/`@media`, and a finite list of pure math/color/`var()` and canonical selector functions. Escapes, resource functions such as `image-set`, ordinary declarations, and other at-rules/functions are rejected as unsupported. Canonical Shadcn theme bytes and consumer font/color values still pass. The Compiler does not silently choose a theme, admit remote CSS or drop required variable validation.

## Evidence

Twenty new tests cover the real `font-sans` source-to-generated-server path without environment, transitive/nested/empty/comma fallbacks, ignored unused fallbacks, real missing values, quoted text/comments, cyclic fallback edges, outer cycle recovery, canonical theme syntax, escaped resources, image-set, unsupported rules and malformed `var()` syntax. The reviewed baseline produced 13 failures / 7 passes on the expanded tests; that count includes newly added syntax/API-shape checks and is not a count of distinct product defects. During repair a lexer iteration misclassified whitespace-separated `@media (` as a function, causing a canonical-theme failure; function-token adjacency fixed it.

Final local evidence: all 104 tests across eight files pass (67 source/server/ CSS-boundary controls plus 37 existing WC/Context/style/target/output checks), and workspace TypeScript passes. The workflow explicitly runs the added test file and requires all 67 source cases. The native suite remains the same 21 cases, previously collected and still unrun locally. Its original native radius assertion is unchanged. No local browser, socket workaround, remote write, website rollout or public SSR readiness change is included.

The reviewer's self-consistent reduced evidence-inventory observation is retained as a nonblocking defensive gap for later scoped work. This repair does not change the exporter contract or claim that observation was fixed. The real selected ten-file artifact reconstruction continues to pass.

Fresh independent review and the next official exact-head native run remain pending. No older failed run is reclassified as a pass.
