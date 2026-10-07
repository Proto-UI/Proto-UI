# Public SVG inventory repair

Date: 2026-10-03. Scope: PR #563, based on tree `725f368b132e6db48217e6fafd8e509df3a06639` (remote head `307bf7ec4afc3130804b62a00410a8a909fe22a3`).

## Finding and bounded correction

The Website matrix scanner omitted public `.svg` files from both its interactive inventory and raw-resource candidates. Independent fixtures containing SVG `script href`, an `onload` handler and inline script all passed untracked. The matrix's source bindings and M0 inventory/consumer-wall rules require visibility; its enforcement plan explicitly leaves active-document SVG admission unresolved.

The dedicated SVG text scan now records recognized script, event, foreign-content, animation and resource syntax as unverified, including SVG `href` and legacy/prefix-qualified `xlink:href`. Source bindings accept public SVG paths and bind their fingerprints, but even a correct manually supplied binding cannot admit that active-document behavior. Unknown resource encodings, unsupported document encodings and internal entity declarations fail closed within the modeled forms. Parent source review additionally identified external SYSTEM/PUBLIC document types: arbitrary targets remain unverified while the exact conventional SVG 1.1 PUBLIC declaration already used by retained whitepaper art remains unchanged; no DTD is fetched or certified. SVG never enters the JavaScript/HTML module parser as a substitute for XML resource semantics.

Existing public whitepaper SVGs, static geometry, local paint/use fragments, ordinary CSS, embedded image/font data and the image-preview serializer remain unchanged. Static image acceptance does not establish a positive active-document execution profile. The lexical scan is deliberately not a general XML/CSS parser or sanitizer. Astro frontmatter behavior is outside this repair.

## Evidence

- Initial discriminating controls: 25 active/resource SVG cases failed their rejection assertions on the unchanged implementation, while the static-image control passed.
- Additional namespace/encoding, CSS-resource and external-DTD controls first failed before their respective narrow corrections.
- Focused SVG controls cover both missing ownership and manually bound non-admission, comments/CDATA/escaped examples, and ordinary static image resources.
- Final proportional validation results are reported with the exact candidate tree; the required command is `corepack pnpm@10.32.1 check:coverage-matrices` on Node 24. No browser rendering or new screenshot is claimed for this internal scanner change.

Independent review rejected the first candidate for XML comment removal crossing CDATA, CSS comment removal crossing quoted strings, and omitted image-set string resources. Five external probes reproduced ten accepted bound/unbound observations. The repair uses one XML lexical pass, respects CSS quoted strings/escapes, and classifies image-set as unverified; retained controls cover those failures and inert delimiter examples. A subsequent review probe found that a comment opener inside an XML processing instruction could still conceal a following script. Processing instructions now form opaque lexical tokens, with explicit XML declaration and xml-stylesheet target handling; controls cover real active content after the instruction and inert markup inside it. Independent source review must challenge the revised exact final boundary before publication. No open SVG execution ruling or PR review is resolved by this record.

Co-author by OpenAI Dots
