# Sprint 3 contrast entry, paint witnesses and WC feedback retention — 2026-11-22

This is a bounded follow-up to Draft PR #1713. The inspected hosted failure used `f8f8b72f18e2f262b423f7328851dd3dc8b80cb9`; the candidate is prepared on published Whitepaper repair `0fd34f53b349e597ebfda7144a872a0b58e2fa24`. It preserves the five original contrast shards, finite journeys, native input, capture vector, timeouts and numeric thresholds. None of the failed hosted observations is relabeled as passing.

## Original hosted observations

[Contrast run 45057987692](https://github.com/Proto-UI/Proto-UI/actions/runs/45057987692) completed with binary and intent shards passing, and three other shards failing. Original artifacts remain bound to their original source:

| Shard | Artifact / ZIP SHA-256 | Observation |
| --- | --- | --- |
| Popup | `14767954646` / `3f3c9667e57d1b3ac095a9bb6adb899708cc38fb13093ca6460598132136e2ba` | Eight Dropdown cases checked current identity and AX before reaching the existing stable-paint prerequisite. The shortcut observation still had transformed/rounded clipping limits during authored entry. |
| Naming | `14769067614` / `11f69686d83e331ebc4ead8888b5d83a40068f608eea4cebdf5a87d6aa18168f` | Eight Accordion cases failed at rest. The representative frame matched all 50 authored instances and the current lease, but two already-open Content boxes crossed a 5px rounded clip and were classified unpainted. |
| Passive | `14769286878` / `bc8153979bd7f85857b2bb9376b50cc365d72fabce6525c24dec29451f02ef13` | Eight Scroll Area cases failed. The receipt classifier read an absent owner field on the scope. Separately, both WC horizontal Thumbs had a 175.8125 × 0 box and transparent fill, unlike the other host/axis observations. |

## Three separately reviewable repairs

**Dropdown entry ordering.** The actual caller now completes its existing `stableFingerprint` prerequisite before acquiring the physical row and running the unchanged identity, AX and after-AX retirement checks. The five new controlled tests execute that production caller and stop at native entry. They reject unsettled paint, invalid identity, invalid AX and retirement after AX. They do not claim native accessibility or a completed pointer gesture.

**Presence paint and scope identity.** Target/anatomy presence can retain an actual supported descendant paint witness when the sole whole-box limitation is rounded overflow clipping. The witness contains physical identity, complete measured boxes and its visibility classification; the original target limitation remains in `boxVisibility`. Empty or transparent content, boxes outside the safe clip, a mixture of safe and unsafe text boxes, unknown radii, filters, zoom, masks and hidden ancestors still reject. The raw frame collector retains whole-box/perimeter limits and does not gain numeric contrast acceptance. This repairs a presence observation; it is not pixel segmentation or general occlusion analysis.

The known-unsupported Scroll classifier now reads the actual producer's `data-projection-scope`, while surfaces retain their separate owner identity. Corrected fixtures no longer invent an extra owner field on the scope. Missing, foreign, alias-only and stale scopes reject even after hashes are resealed. This correction does not erase the separate WC zero-height Thumb failure.

**WC transport snapshot retention.** A controlled custom-element reaction sequence reproduces an Adapter defect: a disconnect snapshots and clears feedback, a queued connect sees the element disconnected and returns, then a second disconnect overwrites the pending snapshot with the cleared token set. A valid owned relocation subsequently skips a redundant controller update, exposing the lost style. Without that relocation control, a later update repairs the style; that non-failing preliminary attempt is retained separately.

The Adapter retains the pending snapshot across repeated physical disconnects. A real later style `apply`, including an explicit empty frame, supersedes it; transport `clear` does not. The private applier identity bounds the update to its current view, and terminal retirement retains its existing authority. `C-LIFECYCLE-0008` is **active** in the inspected tree; no entity lifecycle or public contract is changed. The test injects reaction delivery and does not prove that Chrome used this exact schedule in the original capture. The original production Scroll Area corner consumer now independently checks both Brutalist Thumbs for positive geometry and paint across its existing states.

## Executed evidence and limits

Node was `24.22.3`. Local checks reused existing linked dependency directories with the Vitest resolver confirmed to read this checkout's Proto sources. No new local frozen installation, complete production build, type-check result or native browser pass is claimed.

| Scope | Actual result |
| --- | --- |
| New actual Dropdown caller controls before repair | 0 passed / 5 failed |
| Correct producer-scope positive controls before repair | 0 passed / 2 failed |
| New rounded-paint positive and negative controls before repair | 9 passed / 1 failed |
| Complete audit-plan, probe-serialization and Scroll-receipt Node files after repair | 246 passed / 0 failed / 0 skipped |
| Controlled queued reconnect with actual owned relocation before repair | 1 failed; four other cases excluded by the explicit test-name selection |
| First-snapshot-only partial fix against later style replacement and explicit empty frame | 1 passed / 2 failed; four other cases excluded by the explicit selection |
| Final Adapter batch: new retention, owned-slot, portal relocation, feedback style/integration, view intent and disposal boundary | 39 passed / 0 failed / 0 skipped across seven complete files; eight cases in the new file |
| New native paint calibration and modified original Scroll corner consumer | TypeScript syntax transform passed; browser execution still pending |
| Original six-file inventory on this candidate, linked-dependency local attempt | Failed/incomplete: 216 passed, 105 failed, 381 named assertions pending; the 11 Tooltip usage cases were not collected |

The final Adapter JSON SHA-256 is `20b33233130cce9c2f01b8840a1f6bfc052e2dbc7650fccc6bdf0bdd09bf65d6`. The three-file Node log SHA-256 is `4471a6926dc0a0475ceb6280bd5f2f363454b21d069c851e5a80821faffb697f`. Review patches, before this record, are Dropdown `f3bd5a78afc927efc36999ab35e325f0e5bc48f3285675368e431c8c95e18696`, paint/scope `b56800663f52e8f390561346f901a842388f0a5662c360feaf1d32b9d7755038`, and WC lifetime `64114127f866a50f6aa66f30ecafde949f4c04c83205db18b47f3178f541c123`. Their sequential application to baseline-only files was checked and all ten resulting source files byte-match the candidate. The earlier remote Dropdown patch `8fd82d43dfe14b1888f9a1172115533ce1f96c0efea10bc70aec2b47dc4fa78b` had different test bodies; its review and 713-case result are not reassigned to this reconstructed candidate.

## Complete six-file attempt and independent source review

The original six paths were executed without a test-name filter, bail, raised timeout or assertion change. The process ended naturally with exit 1 after 581.09 seconds. The candidate's ten source-file hashes, HEAD and lock hash were identical before and after.

Four files completed all 25 cases. The 677-case identity file recorded 191 passed, 105 failed and 381 pending assertions. Of its failures, 104 were the original 5000ms timeout, exactly 52 React and 52 Vue 2 cases; one reported `Cannot find module 'react'` from the real installed-framework loader. The Tooltip usage file could not load `prompts`, so its 11 cases were not collected. The log also reports `Worker exited unexpectedly`; its cause is not established. The reporter's raw aggregate says 702 total / 216 passed / 105 failed / one pending, while its assertion entries contain 381 pending. Both raw output and per-file reconciliation are retained; the aggregate's pending field is not used to invent execution for the remaining cases.

Read-only resolution probes confirm missing framework/CLI dependencies at the relevant local package boundaries. The timeout correlation does not by itself prove every failure's cause, and no successful environment repair is claimed. The next complete run will use a fresh exact-head remote checkout and the original frozen installation. This local attempt remains failed and incomplete. Its JSON SHA-256 is `4d54e88c2f92ea6977ca9e3af3f95a99f3c61a7740520afe346fc756b83f1e79`; its log SHA-256 is `2cfed2bc1b816136dde0b29e83ab187c2c9f05f02cc381a4f84758ce7c6ab56d`.

The root agent independently read all three grouped patches plus the applier factories/connect/terminal paths and the paint collector call sites. It found no new source blocker for Draft publication, explicitly retaining the original native gates. The review is bound to the three patch hashes above. It is a local source review, **not a GitHub approval or merge admission**.

## Remaining acceptance

Run all original five contrast shards and their native calibration on the published candidate. Run the original 14-file / 364-case Sprint 3 native inventory, the original seven Drawer cases, and current complete six-file controls. Preserve the separate Diagram and packed-application acceptance obligations. The prior remote Drawer attempt ended at Chrome startup with SIGTRAP; the local native probe ended at the sandbox's `socket() failed: Operation not permitted` before any probes. Neither is a native pass or an assertion failure. No sandbox change, forced input, retry-based bypass, test skip or lowered threshold is introduced. Independent source review, actual CI and repository integration conditions remain separate gates.
