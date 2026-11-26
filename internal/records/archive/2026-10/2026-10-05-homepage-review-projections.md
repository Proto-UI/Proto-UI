# Homepage review projection follow-up (2026-10-05)

This bounded follow-up addresses existing #777 source review `5412143225`, threads `4178824690` and `4178824693`, on base `c2866b712098d6075377feacf15b2f8ffd5bc5f7`. The current user authorized improving the reported issues. No authored Chinese/English MDX or hero copy is edited.

## Configured hero decoration

Both homepage frontmatters retain `icon: external` on the existing Demo CTA. `HomeActions.astro` previously consumed only the separate social `siteIcon` field; the configured decoration was absent in SSR and every enhanced runtime. The native link still owned its text and destination.

The application now maps the supported configured `external` value to inert website-owned SVG artwork in SSR and in the existing public family Surface/Text composition. The decorative artwork is `aria-hidden`, not focusable, and adds no protocol/interaction owner. Social icon-only mapping and its four entries remain separate. Unknown values remain unrendered; this is not a new arbitrary SVG or generic icon-loading API. The same bounded artwork source is used in both paths, with a 0.5rem inline gap. No third-party source is introduced.

Eight red-first cases across WC/React/Vue/Vue2 and Shadcn/Brutalist failed on the missing actual glyph. The repaired real-renderer cases preserve CTA text, native href/focus, one anchor, one inert glyph and live feedback. Existing social and homepage contracts plus mapping negatives pass 57/57. The existing browser journey now checks the configured glyph through all four runtime/two family transitions and in no-JavaScript SSR without adding or weakening inventory cases. Those new browser assertions and source-bound screenshots still require exact-head CI; local DOM harness evidence is not a paint claim.

## Image-preview ownership prose

`DocumentationImagePreview.md` still named removed private Content/Mask prototypes and a removed `.proto.css` asset. The prose now follows the current imports and composition: public Base Button/Dialog semantics; public family Surface/Text paint; `documentation-image-zoom.css` for website-measured geometry. The passive scrim does not own pointer interaction; public Base Dialog keeps dismissal, focus restoration and presence. This only reconciles the existing source description, without changing runtime behavior or the media admission boundary.

## Integration boundary

The separately reviewed passive-shell theme transaction fix is another existing thread in the same parent PR. Preserve all source history and independent failures. These changes must first land on #777's source branch under a fresh head/permission check, then propagate by normal history-preserving integration to dependent #815/#816. Child-PR-only fixes would leave the reviewed parent wrong. Formal GitHub thread/comment updates remain subject to the repository collaboration CLI and its authentication; local independent review is not a platform approval.

## Actual schema-boundary correction

The first published source `11a9da80f43f63fd64e6610059e4aa516f97d675` failed the two newly added native-browser assertions in Homepage run `37297308865`, job `111721481113`: both SSR and enhanced queries found zero configured hero icons. The other seven native-link cases passed. This is a real application boundary omission, not a timing flake or a reason to weaken the assertions.

The installed Starlight 0.35.3 schema normalizes named frontmatter icons to `{ type: 'icon', name: 'external' }` before `Hero.astro` passes them to `HomeActions`. The original mapper handled only the raw string, while its synthetic renderer fixtures bypassed schema normalization. A new test reads both unchanged actual homepage MDX frontmatters through the installed public `docsSchema` and reproduces this missing mapping. The bounded mapper now accepts this named external object as well as the original string; raw HTML icons, unknown names and malformed objects remain excluded. No authored content, browser expectation or public Prototype API changes.
