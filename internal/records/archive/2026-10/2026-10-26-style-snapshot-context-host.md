# Style snapshot Context host — 2026-10-26

This is a non-normative C preview observation, not a new public SSR guarantee.

The exact `fd2619710adae8e5235fabbe6a60a211fa376ed1` preview build `40280940214` failed during canonical Astro static-route generation at `/en/test/liquid-library-card/`. The actual Shadcn Card setup reported missing `Context` instance-token capability. No complete static ZIP was produced.

The finite style snapshotter supplied Feedback and optional detached command capabilities but no Context host identity. The current Card legitimately provides style-scope and density Context values during setup. The repair registers the existing detached identity as a per-snapshot Context token, with an explicit null parent. It does not infer DOM ancestry, modify Card semantics, change Compiler/IR, or claim nested SSR Context composition.

The real Card snapshot tests now run in Node without a DOM. With the original host they produced four passes and three missing-capability failures. The same test bytes pass after the host registration. Concurrent New York/Rhea roots, a following default root and a rejected size/style combination retain distinct results; actual Context provider diagnostics return to their preceding state after both successful and failed projections. Existing Astro-frontmatter and scoped-CSS assertions remain intact.

The old `fd261971` native C combination remains a separate complete negative: 14 files, 297 test cases, 283 passed and 14 failed. This host repair requires its own exact-head combination and canonical full-site build. Archive admission and real preview remain pending until that complete build exists; no page, resource, Context diagnostic or archive-size limit is removed to obtain one.
