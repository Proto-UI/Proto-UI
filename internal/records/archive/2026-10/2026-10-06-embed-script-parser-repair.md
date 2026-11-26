# Unify comment and script masking in the existing embed profile

Date: 2026-10-06. Baseline: PR #563 `bc0c7acbfce43f249d386ac5431c5f0966cb6998`.

A bounded adjacent read-only check reproduced the same declared-profile defect with quoted script markers: a real iframe between data-open="<script>" and data-close="</script>" was removed by the remaining script-text regex. A parse5 observation contained a native iframe while the production Website helper reported zero embeds, in both HTML and Astro. This is not a request for another runtime API or dependency language.

The baseline fails ten of 21 new paired fixtures while eleven controls pass. The repair unifies comment and native-script masking for the HTML/Astro embed entry: only parser-proven actual comment/script element ranges become whitespace. The existing single-pass Astro UTF-8-to-code-unit conversion is reused. This path does not apply the old script regex after parser masking, so quoted marker values remain data. Actual script examples remain inert for embed classification; resource/compilation checks still inspect their original source independently. The Harness import-map predicate retains its separate comments-only input and is not hidden by embed-specific script masking.

Other markup/JSX fallback formats are not widened or reinterpreted. Astro frontmatter remains a separate source region, leading-capital Script components do not inherit a native script-body exemption, and the exact style-isolation embed boundary remains unchanged. No Range or CSS Modules/ICSS implementation is added; #854 retains that explicitly separate future profile work.

Focused controls cover quoted open/close pairs, mixed spellings, actual script strings, Unicode prefixes/bodies and active suffixes, Astro frontmatter, component children, and the separate Harness import-map gate. Production-helper exact-output assertions cover actual comment/script masks and preserved quoted data. Full coverage/source checks and independent acceptance bind the final candidate before publication; remote CI is separately required for that exact head.

This is checker logic with source-bound executable evidence. Earlier successful CI remains valid evidence for its own head, never a substitute claim for this new increment. Existing human review, the cancelled resolution target and Vercel's separate limit are not bypassed.
