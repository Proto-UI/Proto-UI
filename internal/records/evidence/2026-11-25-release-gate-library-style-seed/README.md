# Library server style ownership handoff

On clean `124e329cfc3cd710c1f1d267d640f1b97ef2f4c9`, the original isolated Liquid elevation suite passed four cases and failed its two optical cases. A separate read-only native observation found all four actual Surface hosts stuck at `final-style-host-commit-pending`. A temporary diagnostic inside the original guard attributed the mismatch precisely: the current frame requested `transition-colors`, while the host also retained the server's `transition-none`. The frame identity was still current. These diagnostics changed neither the expected tokens nor the host's presentation.

The Web Component Adapter correctly preserves tokens it did not acquire. The Library had serialized its server contribution without transferring ownership, so that old contribution was treated as external throughout later Rule updates. The fix belongs to the Library's server/client bridge. Its Astro renderer now serializes the exact seed token list, and the ordinary and optical Library aliases share one private connection wrapper. Before the first physical view, the wrapper withdraws only the explicitly declared server contribution. The real Adapter then owns its current output. It preserves external tokens, classes, inline layout, native children, and link behavior.

The seed is consumed once. Reconnection and synchronous reentry do not withdraw live Adapter output. On a synchronous failure, the wrapper restores only its removed contribution while retaining newly added external tokens, provided the seed has not been replaced. Missing or malformed ownership metadata never authorizes deletion. This is private consumer bookkeeping; it introduces no general Adapter hydration API and does not change the material admission guard.

## Evidence

- The new actual Surface hover regression first failed because the server's `bg-background` remained beside the current `bg-muted`; 25 other tests were deliberately filtered in that one-case baseline, not counted as passing.
- The four existing Library suites then passed 48/48. Adding the focused seed ownership, failure, invalid-input, reconnect, and reentry controls produced 60/60 across five files, with no skipped or pending tests.
- On the same remote baseline with exactly the four application source overlays, all four original 45px/64px, none/raised Surface subjects reached `self-optical` with reason `rendered` and zero page errors. The temporary sink diagnostic was removed first, and the sink was checked byte-for-byte against the committed source. This is a dirty-tree diagnostic, not the clean suite.
- A separate agent reviewed the six source/test paths and found no blocker. Formal independent release acceptance is separate.

`native-diagnostics.tar.gz` preserves the original clean-suite failure and all three diagnostic observations, including actual source hashes. Its SHA-256 is `c2a453a76a867a2e0ec1fb8cfa6806e52a39581cddd978a06cb299232b6e0393`. The full original six-case elevation suite and 18-case Card producer suite still require execution on the committed clean candidate. No source-cleanliness check or native assertion has been removed to run these diagnostics.
