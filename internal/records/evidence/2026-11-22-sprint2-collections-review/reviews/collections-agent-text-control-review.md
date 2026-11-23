# Independent local review: controlled TextControl candidate and caret lifetime

Reviewer: `/root/collections`, not the implementation author. Mode: human-assisted / current-user. This is a bounded source/negative-control review, without implementation edits or whole-PR acceptance.

## Scope and exact sources

- Initial assigned change: `b1033a4851fd13e4509b22145ba4e7d0bdaf8596`, which extends candidate protection from selection-only observation to controlled input/change/compositionend callbacks and adds three-family synchronous/queued owner acceptance cases.
- Necessary follow-up: `14c47f2a22ad3629ae88a5e6cce99b4098732b0e`, which permanently retires the current candidate observation on a real canonical owner transition.
- Source binding: `collections-agent-text-control-review-source.json`. Seven relevant files were verified byte-for-byte against 14c47f2, rather than inferred from a possibly changing worktree HEAD.
- Draft `C-TEXT-CONTROL-0001` D/E/F/G and the selection boundary were read. The clarification does not promote the draft or change the stable controlled/uncontrolled mode.

## Conclusion

The initial fix preserves a distinct physical edit candidate while callbacks perform unchanged-owner synchronization, so the intermediate synchronization cannot truncate the accepted native caret. The final correction also preserves an explicitly changed owner's authority, including a transition back to an earlier string. No additional actionable defect was found in the assigned final source.

This conclusion requires **both** commits. The original b1033a4 candidate alone has a reproducible owner-transition defect; its failure is retained below.

## Reconciled owner-transition defect

The compiler reviewer independently reported that an owner changing A → B → A during one callback reactivated the original observation's protection in b1033a4. The implementation author added six discriminating single/multiline × input/change/compositionend cases and fixed the implementation in 14c47f2.

I separately reproduced the original behavior with the real TextControl implementation and Web host. Starting from canonical `1234` and physical candidate `56`, unchanged-owner synchronization correctly preserves candidate/caret. Synchronizing the new owner `90` immediately projects `90`. A second explicit synchronization back to `1234` incorrectly leaves the physical editor at `90`, although the canonical snapshot already says `1234`.

Expected: the explicit second owner transition projects `1234` within the same callback. Observed on b1033a4: physical `90` / canonical `1234`. This demonstrates an actual owner/host divergence, rather than merely checking the implementation's internal flag.

The historical implementation body was read directly from the b1033a4 Git object. Only its two relative dependency import paths were relocated to the unchanged real dependency modules so that it could be executed beside the current implementation. The failing assertion and exact source identity remain in `text-control-candidate-review-red.log`.

On 14c47f2, `sync` clears the observation before assigning an actually different canonical owner value. An unchanged canonical owner keeps the candidate protection; a changed owner retires it permanently. The identity-checked nested `finally` cannot restore the retired observation. All three event types now immediately project the second transition correctly.

## Independent execution and source review

`text-control-candidate-review-probe.mjs` executes the real module, CapsVault and Web TextControl host on a real Happy DOM input, with manually delivered portable host events. The final result is `text-control-candidate-review-probe.json`, **18/18** at 14c47f2, with the full transcript in `text-control-candidate-review-green.log`.

For each of input, change and compositionend, the checks cover:

- Unchanged-owner synchronization preserves the distinct physical candidate and its caret during the callback; the unaccepted value restores after the callback boundary.
- Explicit acceptance retains the candidate and caret.
- A new canonical owner value projects immediately.
- A new owner followed by the original string remains immediately authoritative at both transitions.
- A throwing authored callback releases the protection, allowing a later owner recovery to project normally.
- Detach/remount inside the callback retires the old event's lease; a replacement owner remains authoritative after queued work drains.

The source retains its existing composition protection, normalized input facts, callback-prelude handling and epoch checks. Candidate protection is observation-scoped; it does not accept an event payload as controlled state. The ordinary restoration re-enters the callback boundary so pending accepted owner props can drain before restoration. Explicit reset clears observation/prelude and changes the event generation. Lease replacement makes old callbacks and queued restoration inapplicable to the replacement editor.

The author-run logs were separately inspected, without relabeling them as my own executions:

- `intake/otp-controlled-caret-red.log`: six selected three-family × synchronous/queued owner cases fail with caret 1 instead of 2; the 18 nonselected cases are reported as filtered/skipped in that red probe, not as passing.
- `intake/otp-controlled-caret-final.log`: **4 files / 138 passed**, including the existing module, Web, selection and OTP checks.
- `intake/textcontrol-owner-revert-red.log`: all six selected owner-return cases fail; the 87 nonselected cases remain explicitly filtered/skipped in that probe.
- `intake/textcontrol-owner-revert-fixed.log`: **2 files / 117 passed** on the corrected implementation, without skipped cases in that green run.

## Limits

These checks distinguish value/caret/owner lifetime at the real module and Web-host boundary but use Happy DOM and portable/programmatic events. They do not establish trusted native browser typing, actual OS IME behavior, mobile editing, auxiliary input or accessibility outcomes. The corresponding native receipts remain outstanding and must be recorded at their actual final source. No assertion, implementation or native result was changed by the reviewer.

## Independent compiler-realization delta

The separate compiler implementation in `c5ebad5888cc0c517bf17fa1a21ccfff2d2284ce` and `a165c4058188aa802b475d1d50ce46ab0d574320` was also source-reviewed. The corresponding integration commits are d5ec2a8 and 8c882c6. This is an independent generated DOM helper, not a claim that module tests execute compiler output.

The generated helper establishes controlled candidate protection before invoking the authored callbacks, releases it by observation identity in `finally`, and permanently clears it on a real canonical owner transition. Existing generation/current-physical-target guards remain, as does deferred restoration of an unaccepted controlled value. Window-external same-value synchronization remains authoritative.

The new eight actual generated-consumer cases run four target frameworks × synchronous/queued owner acceptance. Each case checks input, change and compositionend caret retention, then immediate A → B → A physical projection and rejection restoration. Existing twelve selection/lease cases remain. I read the owner's original eight failing cases in `/tmp/s2-compiled-edit-caret-red.log` and final **20/20** run in `/tmp/s2-compiled-edit-caret-final.log`; these are owner-run executions, not a second reviewer-run matrix. No additional source defect was found. The earlier 3ea9e34 pinned build predates this delta and must not be labeled as evidence for this corrected helper; a current-source native consumer suite is tracked separately.
