# PR #800 final-source evidence

Clean source: 113cc69304f36219f79ee4e13ae77ea55be343c7
Tree: 265fffd43b0f7ff653d83ab29b596639207bea0a
Run: https://github.com/Proto-UI/Proto-UI/actions/runs/37125275942
Artifact: 11275545052
ZIP SHA256: 86d95d634c862bc468685faf707cc9edda9c2641e166efd38e44a920b416d121

Fresh capture from the actual public Switch demo; WC, light, checked, 960px viewport. Visually inspected. Pixels match the preceding source because intervening changes only repair tests. This file is nevertheless from this new exact-source recording, not copied evidence.

16 adapter/theme/viewport cases, 449 intermediate frames (at least 28 per case), all vertical-center errors zero and all thumb bounds inside track. RTL checked travel remains physical +20px, reduced-motion transition is none. Real custom DM Sans glyphs, 500/700 roles and intentional fallback verified. All five dedicated browser jobs passed. Both Linux and macOS Rust suites passed; repository-wide test job was pending when this evidence was published.

Evidence-only branch; never merge into implementation.

Co-author by OpenAI Dots
