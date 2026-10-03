# PR #800 source-bound evidence

Clean source: fc9827a8a6fc597a407a37ac2d2c24d56203ea3e
Tree: 60685a754e8198de1f1f7d9a72ae6f1eb107bbe5
Run: https://github.com/Proto-UI/Proto-UI/actions/runs/37127141559
Artifact: 11275227542
ZIP SHA256: fac78e820632fa53d2fda63e681fcc950cb2739ade04824e994f227da6f50a24

Fresh public WC light checked Switch capture at 960px, visually inspected. 16 adapter/theme/viewport cases, 448 intermediate frames, all vertical center errors zero and all thumb bounds inside track. Each case has 28 sampled frames. Physical RTL checked travel stays +20px and reduced-motion disables transition. Font measurements use the same source SHA.

All five dedicated jobs passed, including the newly added 7 composed-style-isolation and projection-scope tests. Exact-source Linux/macOS Rust, native interop, TypeScript and consumer checks passed. Repository-wide test completion is recorded separately on PR #800.

Evidence-only branch; never merge into implementation.

Co-author by OpenAI Dots
