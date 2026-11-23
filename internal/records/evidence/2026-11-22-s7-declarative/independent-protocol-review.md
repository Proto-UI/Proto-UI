# Independent pre-execution review of #757

Reviewer: `/root/experiments`; implementer: `/root`. Reviewed protocol, declarative fixture, pinned A2UI basic schema and the WAI-ARIA APG Tabs pattern before any results were supplied. This is local independent expectation review, not a GitHub approval or stable-conformance admission.

Sources: A2UI commit `5ff1b05f02d39f969b52a942e78e864ef3ac01fa`; `https://www.w3.org/WAI/ARIA/apg/patterns/tabs/` read 2026-11-22; `P-BASE-TABS-LIST` and related draft parts at Proto-UI `dc3b184`.

## Findings to settle before freezing

1. **P1 — distinguish an unsupported experimental mapping from a missing Proto capability.** `dynamic-title` is a valid negative for this deliberately literal-only renderer, but current Proto text/props can update strings. Rejection cannot establish that data-bound titles are intrinsically unrepresentable through Proto. Keep this case and explicitly describe the missing data-model resolver as catalog glue outside this measured subset. Add one inspected external concept with no direct primitive mapping (for example function RPC/agent action invocation), with an honest rejection/report at the mapping boundary. Do not count either rejection as a Proto behavioral win.
2. **P2 — bind every expected behavior to the right authority.** Preserving exact trigger DOM identity on `updateComponents` is an application/catalog policy for this experiment, not an APG requirement. Both manual and automatic activation are permitted by APG; `loop: true`, the initial selection, optional Home/End and retained identity must be declared shared catalog policy. Score disagreements by layer instead of automatically treating the current Proto definition as universal ground truth.
3. **P2 — the declared loop policy has no actual wrap checkpoint.** Add Left from General to Notifications and Right back to General, reasserting selection according to activation mode and one roving focus stop. Otherwise the implementation can ignore the declared loop policy and still pass this vector.
4. **P2 — confirm keyboard exit and host continuation.** The literal Text panels have no focusable content, so APG's panel entry/Tab exit guidance applies. Observe native Tab reaching the visible panel and then an ordinary after-surface action; after deletion verify that action still works and no tab parts recreate. DOM emptiness after a stale event alone is weaker than continued host usability.

## Valid scope decisions

Same schema input, one React/browser version and a mature Radix implementation make a fair common supported comparison. The missing-label mutation is an appropriate distinction between structural validity and behavioral sufficiency. A wrapper swallowing a real ArrowRight is a valid host/catalog defect if both paths use the identical injected boundary and native input. A tie with Radix must remain a null result, and three replay measurements of deterministic catalogs must not be labelled three independent AI generations. Other hosts and assistive technology remain unmeasured.

Disposition: protocol is suitable for bounded execution after these expectation/interpretation fixes and an updated frozen digest. No product changes or test outcomes were assumed by this review.

## Reconciliation before execution

Reread revised `protocol.json` with SHA-256 `eac2b8e691278f93bc6655c8f705960cbe5659089f6638b1b54ba501305db09a` on 2026-11-22. All four findings above are addressed at the protocol level: shared policy authority, explicit wrap/panel-exit/host continuation, data-resolver limitation, and separate function-RPC rejection. This revision is suitable to freeze for the bounded comparison. Runner fidelity, raw outcomes and final interpretation remain to review after execution.

## Initial-tabstop correction: contemporaneous semantic review

After attempt 1 and before attempt 2, `/root/experiments` reviewed the implementer's description of the correction in this work session. The preserved reply was:

> 同意 #757 observer修正：初始tablist可作顺序焦点入口（Tabs尚未取得焦点时各trigger -1并不单独证明不可键盘进入）；initial保留唯一selection/关系/可见panel，实际native Tab进入后再断言到selected和1个roving trigger tabstop，后续全部维持。旧运行runtime ENOSPC与roving两类终态保留，不能计为一条producer胜负。

This was a review of the described semantic change, not a read of the final modified file bytes. The chat interface did not supply an exact timestamp for that message. This record therefore does not backdate a digest approval or invent a review time.

## Final bytes and result review after collection

At `2026-11-22T11:29:32Z`, `/root/experiments` independently reread the actual files: protocol SHA-256 `a3d8c6fa2866b8ca61833ca4dbc5461c4b1e323b75279809352a05e5c50282f2`, runner SHA-256 `f3754a4c3a16d74c02a3109f6742403cf3dfe7e48d57172202bbbbe6c368ee46`. Initial/recreated states omit the premature roving assertion; native Tab immediately must focus General and establish the single trigger tabstop. Later Arrow/Home/End/Space/pointer/update assertions remain. This post-collection byte review confirms fidelity to the earlier semantic decision; it is not a pre-collection digest approval.

The separate `/root/harness` reviewer read both raw attempts, the final report, protocol/runner/README and source reconstruction. It independently verified all 36 then-listed evidence files, all 404 build inputs, and the separately documented Verdant source plus 20 artifact hashes. It viewed the ordinary and Proto manual updated-state screenshots (two screenshots, not all four), found no P0/P1, and requested this clarification of review timing. Its exact reviewed-file hashes and scope are retained in `independent-final-review.json`. No browser rerun, native platform certification or GitHub APPROVED review is implied.
