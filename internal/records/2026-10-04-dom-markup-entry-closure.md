# Bounded DOM markup and authored-script entry closure

Date: 2026-10-04 (UTC). Base: PR #563 at `6a0932c156ddd008f85bd0b625402272b952e04f`. This record describes source-checker evidence, not a new protocol guarantee, lifecycle promotion, production vulnerability finding or runtime sanitization proof.

## Findings and causal evidence

The six review targets are [r4179209979](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4179209979), [r4179209980](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4179209980), [r4179209983](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4179209983), [r4179209984](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4179209984), [r4179209985](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4179209985), and [r4179209990](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4179209990).

The exact base checker misses 12 consumer-entry assertions across Website/Harness and Markdown/MDX. Twelve paired controls pass on that same base. The failing assertions inspect the relevant consumer-wall diagnostic, not a thrown harness setup error or an unrelated inventory failure. In particular, the Harness imperative `onerror` example was already blocked by the separate ownership gate; its missing consumer-resource diagnostic was still reproduced. The Website variant had no such separate rejection. The `data-type` fixture is an actual native script without a `type` attribute; the suffix matched by the old helper incorrectly made it inert. The Markdown/MDX inline script fixture is selected by a real parse-only authored-content AST, not TypeScript JSX text.

The repair shares the existing receiver, CSS, native-handler-name and parser boundaries:

- Proven DOM `innerHTML`/`outerHTML` literal and local-constant writes inspect structured HTML; normal static markup/SVG icons and empty cleanup remain controls. Compound HTML writes cannot certify the completed string from an isolated fragment.
- Proven DOM-created style bodies inspect static CSS imports. Browser-relative/local imports, opaque bodies and concatenating mutation methods remain unverified. Ordinary static CSS, business objects and the existing style-isolation baseline are preserved.
- Imperative native content-handler attributes use complete static names and existing DOM provenance; IDL string assignments, data attributes, non-null namespaces and business receivers are distinct.
- Complete opening-tag attribute tokens prevent suffix and quoted-value collisions, while preserving HTML first-duplicate semantics and opaque template-attribute rejection.
- Native classic-worker `importScripts.call`/`apply` forms expose target arguments and respect lexical shadows; unknown invocation/list forms remain unverified.
- Markdown/MDX executable script bodies, ESM and expressions use parse-only structure. Data-script literal text and true code nodes remain inert. Expressions under data-script elements still enter the executable-source scan.

No candidate source, CSS, HTML, Markdown/MDX expression or configuration was executed. No dependency, production component, source binding fingerprint, matrix state, repository protection or production bundle graph implementation was changed.

## Opaque markup remains research

[#834](https://github.com/Proto-UI/Proto-UI/issues/834), under #420, tracks four existing producer/consumer paths:

- `PrototypePreviewer/previewer-client.ts` and `projected-previewer-client.ts`: selected strings from `JSON.parse(root.dataset.codeHighlights)` originate in the observed `PrototypePreviewer.astro` -> `highlightCode`/Shiki -> `safeRaw` path. This is not accepted end-to-end provenance. Their destructured options receivers are outside the current DOM proof.
- `PrototypePreviewer/code-panel-client.ts`: the recognized receiver restores a prior same-element `innerHTML` snapshot. This now produces an opaque sentinel, not a trusted-source allowance.
- `InstallCommandCard.astro`: the similar snapshot's collection-callback receiver remains outside the current proof.

The ordinary bounded source check does not equate an opaque value with a demonstrated external load or with verified safety. The sentinel cannot be interpreted as a resource/module URL; promotion closure explicitly rejects a recognized opaque sink. Paired fixtures show both normal bounded-source treatment and rejection of the same source during evidence promotion, without depending on another ownership failure. No file-hash, directory, helper-name, variable-name or snapshot exemption was added.

Related code-panel/copy/expand/install/runtime-control rows remain `blocked`. Demo/build `infrastructure-exempt` rows do not authorize surrounding controls or prove these dynamic flows. Receiver forms outside the bounded proof and general generated-markup data flow remain research; this change does not claim their closure.

## Verification and negative evidence

- Node `v24.19.0`, pnpm `10.32.1`.
- Exact-base focused reproduction: 24 tests, 12 expected missing-entry failures and 12 passing controls.
- First local candidate focused command: `node --test --test-name-pattern='DOM entry closure|ignores inert JSON|Website native embeds cover' scripts/coverage-matrices/test/check-coverage-matrices.test.mjs`: 168/168, no skips.
- First local candidate complete fixture command: `node --test --test-concurrency=1 scripts/coverage-matrices/test/*.test.mjs`: 1211/1211, no skips. The prior 1045 tests remain; 166 tests were added.
- An intermediate complete run registered 1069 tests and reported 1067 passes plus two pre-existing malformed MDX data-script controls. Native JSON braces in raw HTML are invalid MDX expression syntax. The original acceptance assertions were retained and the MDX payloads were changed to valid string expressions. Explicit parse-success/failure oracles, a valid `.md` raw-JSON counterpart and a malformed-MDX rejection control preserve the real format distinction instead of loosening assertions.
- A promotion-boundary follow-through reproduced six additional false admissions for DOM-authored local CSS/media resources, alongside three passing resource-free controls. The existing CSS URL lexer now retains an unverified-resource sentinel for these strings rather than pretending their browser-relative base is the JavaScript module directory; promotion rejects it. Source executable-entry inspection and rendered-resource closure remain distinct.
- A bounded direct collector pass over 469 non-test Website source/resource/config candidates (177 JavaScript/TypeScript/Astro/Vue/Svelte candidates) was recorded before and after the repair. The sole result change was the opaque sentinel for `code-panel-client.ts`; no new static entry finding appeared in the existing source set. This direct pass does not traverse the complete external-package graph or replace actual matrix validation.
- Syntax, formatting and whitespace checks accompany the candidate. Exact-head independent review, real source-matrix validation and the production Rollup graph gate remain required. The full real matrix was deliberately not rerun in this memory-limited executor after prior out-of-memory evidence. No standalone build or earlier-head result is relabeled as a pass for those gates.

These are internal logic changes. Executable fixtures and the source-bound causal observations above are the applicable evidence; no old screenshot is presented as a new UI capture. The production audit remains a Rollup module/import graph check, not an emitted-HTML or chunk-code byte gate.

## Independent-review follow-through

Independent review of the frozen 1211-test candidate found three related omissions: document parsing discarded table fragments and their handlers/resources; the script-body exclusion incorrectly covered `outerHTML` element replacement; and unknown properties/spreads in already-modeled DOM mutation forms did not retain opaque promotion evidence. These are actual source/promotion omissions, not additional passing-gate claims. The style-replacement counterpart and resource-free static controls already passed and remain controls.

The local repair first reproduced 33 failing assertions alongside 21 passing controls. It now inspects the union of a default template-fragment parse and a document parse, retaining both table nodes and document-wrapper attributes. The actual insertion context is not inferred; a parser oracle contrasts table, raw-text and SVG cases, and no complete context equivalence is claimed. Script `outerHTML` now uses the replacement rule while script `innerHTML` keeps its body rule. Unknown `Object.assign`, `Reflect.set` and direct computed DOM writes retain the opaque sentinel; local-constant keys are interpreted only within the existing lexical resolver. Business objects remain outside DOM proof. Unsupported SVG-created style bodies are explicitly outside the HTML/XHTML profile rather than silently admitted by a new guarantee.

A separate confirmed false positive came from lowercasing `setAttributeNS` names. The [DOM Standard](https://dom.spec.whatwg.org/#dom-element-setattributens) preserves the extracted local name for this API, unlike HTML `setAttribute` ASCII folding; [HTML event-handler synchronization](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-content-attributes) uses exact native local names and a null namespace. Paired uppercase/mixed/lowercase and foreign-namespace controls now preserve that distinction. No browser execution oracle is claimed; this correction uses the normative algorithms and source fixtures.

This follow-through adds 66 tests without removing the prior 1211. A final real-source check caught an additional false positive in the proposed unknown-write path: the older DOM-type heuristic matched `HTMLElement` nested inside the `Record<string, HTMLElement>` refs map in `demo-renderer.ts`. The new body, handler and unknown-write checks now distinguish element objects from containers, without changing that older shared ownership classifier. Three container fixtures first reproduced the false positive; array/generic-container and real element/intersection/alias controls preserve the boundary. No production map was reclassified as a DOM sink. Final focused and complete-suite results are bound to the follow-through candidate in the PR evidence packet. The full actual matrix and production graph gate remain CI work. No production component, matrix state or source fingerprint is changed by this follow-through.

A newly added parser-oracle test initially contained an unmatched parenthesis; that syntax/setup failure was corrected and retained separately from semantic red/green evidence. It is not counted among the 33 reproduced independent-review failures.

The same strict receiver check was then applied consistently to all newly modeled generic DOM body/handler paths, including literal/compound body writes. Four additional business-mapping/body/method controls first reproduced these false positives; the correction keeps the earlier 1273-test result as intermediate evidence and adds those four controls rather than narrowing the acceptance assertions.

One final direct-collector pass was inadvertently overlapped with the complete fixture run. The collector process was killed and the fixture file ended early with `test failed`, without a semantic assertion report. Those incomplete results were not counted as validation. The collector and fixture suite were then scheduled strictly sequentially; final outcomes and the earlier abort logs are retained separately in the evidence packet. This does not change the decision to leave actual matrix/production graph validation to exact-head CI.
