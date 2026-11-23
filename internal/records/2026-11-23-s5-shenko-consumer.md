# Sprint 5: frozen Shenko consumer and navigation paint evidence

This non-normative record completes the original five browser consumer journeys for the frozen compiler `f329d98d1d34fe426ff88db1f6175c72a92e4019` (tree `9a713e073590429a4f930f9ca6c9d7ffaa0e3eb4`) and Shenko application `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`. It does not certify a later Proto UI integration, current Shenko main, PR #389/#393, live backend/model operation, physical device input, or assistive technology.

## Original source and execution

The original preparation used the selected public-package closure and the application's ordinary producer, type check, and application tests. The retained raw preparation receipts and stdout/stderr identify each command and its actual outcome. The two application prototypes, transport-badge and message-bubble, used the build-time React DOM source profile; the browser bundle does not import the compiler. Nine application families use the public React adapter.

The original checked-in observer is `scripts/analysis/shenko-consumer-browser.mts`, SHA-256 `6cf516419c662ac04f7565a155f84ec5d13ca8e72bd426b6693be7dc38e208e7`. Its complete attempt 02 finished with five passed journeys and no page, websocket, or cleanup errors. The original receipt is retained byte-for-byte with SHA-256 `a1c5b3475160c68561b1ba2d3ac576c37920c1ba279b4f59528e62ed435df1a7`; its command records 246.271 seconds. The earlier incomplete checkout, preparation, and first browser-start failures remain separate raw evidence.

| Original journey | Actual result |
| --- | --- |
| Compiled badge and native React slot content | Passed |
| Native theme action preserves the compiled root node | Passed |
| Native thread selection replaces compiled bubbles and retains native children | Passed |
| Inspect navigation removes compiled roots and returning to conversation restores them | Passed |
| Explicit synthetic pagehide invokes actual application disposal | Passed |

The application ran its explicit demo-controller route. Its deterministic fixture content is not evidence of a live controller or model session.

## Additional navigation-paint investigation

An early returned-conversation screenshot was ambiguous about the selected tab's paint. Additional diagnostic 03 preserved the same source guards but failed before any browser case: its original 30-second Git operation timed out. Its zero-case failure remains in the archive and is not reclassified as an application failure or pass.

Diagnostic 04 is a separately labelled retained-artifact replay. It verifies the original successful receipt above; the exact build manifest SHA-256 `1a00e0a2e2fd7b910f508bf2fe22d11f05ecd00b6ff2387be3908dec4e79acc2`; all 12 declared asset byte hashes; and the original application index, independently obtained at pinned Git blob `f347cef0dc1e0575064730f42c16ecd3b35dc3c8`. It serves only those verified bytes from memory and checks their hashes again after the journeys. It does not substitute a new producer or claim to have revalidated the current source checkout.

Diagnostic 04 used Chrome 145.0.7632.6, the original native actions and 15,000 ms default action timeout, and the same five journeys. It exited 0 at 2026-11-23 14:42:22 UTC: five passed cases, no page errors, no websockets, and no cleanup errors. Its receipt SHA-256 is `ca1a48b7055f9b9542634b2e69aed1967b07ed513c0bfae52926bcccb13d9e37`; observer SHA-256 is `889cbf7ccf3c131a698b63bbc3f728a15ecb287643f3312b23ce1f331c80cea8`.

Six real animation-frame observations after returning to conversation all retained view `im`, exactly one `data-active` tab (对话), and exactly one `aria-pressed=true` tab (对话). Inspect remained inactive and pressed=false. The paint samples record the existing authored transition: conversation background alpha rises from 0.175823 to 0.992917 while Inspect falls from 0.824177 to 0.00708284 over the sampled 99.9 ms. The actual returned-conversation PNG was visually inspected and shows the conversation tab selected. This does not reproduce a persistent selection error. The old ambiguous screenshot is retained; the later observation is not relabelled as an earlier pass. No application CSS or controlled-value callback was changed.

## Retained evidence and boundaries

The archive contains the original preparation and execution files, both successful browser receipts, diagnostic 03's failure, diagnostic 04's complete observer/driver/report and PNGs, the original checked-in observer, and every exact retained application asset and index. The manifest records the SHA-256 and byte count of every archived payload; archive creation verifies every entry after writing.

- Archive: `evidence/2026-11-23-s5-shenko-consumer/source-and-browser-evidence.tar.gz`
- Archive bytes: 1347558
- Archive SHA-256: `af40daa2711c2aadee6f9a652e9c0acbdb820672c3bbc6c3bd4f8c0b3e16cbfc`
- Payload entries: 101

The original five-case source-bound result and the later artifact-only paint investigation have different scopes. Neither closes the current application's Inspector/resizable work, all Sprint acceptance, performance equivalence, platform publication, or independent review gates.
