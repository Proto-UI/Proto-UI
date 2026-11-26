# GPUI Adapter readOnly accessibility projection

Date: 2026-11-23. Scope: the bounded Adapter regression observed in PR [#1738](https://github.com/Proto-UI/Proto-UI/pull/1738).

## Observed failure and ownership

The official Adapter job at public head db747e1b81cbbfaf2b37dd8af3de48108f036a04, [run 45228171867 / job 137880234047](https://github.com/Proto-UI/Proto-UI/actions/runs/45228171867/job/137880234047), passed the generated-fixture freshness check and then failed the_recorded_checkbox_is_a_checkbox_unchecked_checked_or_mixed. Its actual result was **13 passed / 1 failed**. The residual fact was exactly:

```text
root: [State { name: "readOnly", value: Bool(false) }]
```

The refreshed official Checkbox fixture was correct. Base Checkbox already declares a Boolean readOnly, defaults it to false, and publishes it through accessible.state. Its existing value-request path owns the read-only activation policy. The Rust Adapter's finite accessibility mapper had no entry for that fact.

The same original 14 tests were run locally on the isolated, clean parent e18a30d4065111a5794a2aea524564e31678b911, with Rust 1.98.1 and locked dependencies. They reproduced the identical 13/1 failure. The three relevant Rust files at that parent are byte-identical to the public db747 source. Before/after hashes and the full original output are archived.

## Definition and implementation boundary

C-A11Y-0001, M-A11Y-0001, HC-A11Y-0001, and P-BASE-CHECKBOX remain **draft**. Their existing direction separates semantic facts from host projection and leaves focus, checked/mixed state, and activation policy with their original owners. This repair does not promote a lifecycle or require identical native capabilities across all Adapters.

The pinned GPUI revision is 62e5991dd0f0c8a3af8d5e7e9c4652490d468db8. Its locked AccessKit 0.24.1 already exposes set_read_only, clear_read_only, and is_read_only. The independent compiler-native A11y projection already uses that same set/clear boundary. The missing implementation was in the Runtime Adapter.

The repair is confined to three source files:

- native/gpui/crates/proto-ui-gpui/src/a11y.rs maps only the exact readOnly key with a JSON Boolean into Option<bool>. Absence remains None. Unsupported types, keys, roles, actions, and relations retain diagnostics.
- native/gpui/crates/proto-ui-gpui/src/host.rs extends the existing disabled wrapper to carry the two declared accessibility flags. It delegates the original element's layout, painting, identity, synthetic children, role, and input. Some(true) sets the real Node flag; Some(false) clears it; None leaves other contributions untouched. It does not remove activation or invent focus/input behavior.
- native/gpui/crates/proto-ui-gpui/tests/a11y_projection.rs retains all original 14 tests and their assertions, adds the expected default read-only fact to the Checkbox control, and adds three finite controls.

The official Checkbox fixture, both lockfiles, manifests, portable Checkbox implementation, and existing Checkbox T0 tests were not changed.

## Source-bound observations

| Input or condition | Actual observation |
| --- | --- |
| Original official Checkbox snapshot with readOnly false | Original mapper emits the exact residual issue above. |
| Boolean false or true with unchecked, checked, or mixed | Candidate projection preserves the role, toggle state, disabled fact and activation, with Some(false) or Some(true). |
| Null, numbers, strings, array, or object as readOnly | Each remains an exact A11yIssue::State; no coercion or silent omission. |
| Valid readOnly beside lowercase readonly, unknown action, or unsupported relation | Only the valid Boolean fact is mapped; all other residual issues remain. |
| Actual production render_surface with false, starting from a Node whose read-only bit is true | Element::write_a11y_info clears the bit and retains label, toggle and Click action. |
| Actual production renderer with true, initially unset Node bit | The same Element path sets the bit. |
| Absent read-only declaration on the existing disabled path | Existing Node read-only value is unchanged; disabled and Click remain. |
| Existing Checkbox T0 consumers | All six original cases execute through the real Node peer and GPUI test-support layout/input path and pass. |

The direct Node tests construct input snapshots and Node initial state deliberately. They observe the production renderer and real AccessKit API, not a mock Node. Their twelve Boolean/checked/disabled combinations are inside one Rust test and are not reported as twelve independently collected tests. The T0 cases use GPUI's headless native harness and simulated input; they are not physical assistive-technology or macOS platform evidence.

## Executed validation

All commands used one Cargo build worker, a private target directory and a private writable TMPDIR. The JS peer uses Node 24.22.3 and pnpm 10.32.1 from a successful frozen install.

| Check | Result |
| --- | --- |
| Original a11y_projection | 13 passed / 1 failed, intended readOnly residual |
| Candidate a11y_projection | 17 passed / 0 failed / 0 ignored / 0 filtered |
| Candidate lib host::a11y_state_tests | 2 passed / 0 failed / 0 ignored; five other unit tests filtered by this focused command |
| Candidate default Cargo workspace | Exit 0; 263 passed / 0 failed / 45 existing ignored / 0 filtered |
| Candidate existing checkbox_t0 with --ignored and one test thread | 6 passed / 0 failed / 0 ignored / 0 filtered |
| Rustfmt on the three changed Rust files | Passed; no formatting-only diff from the reviewed candidate |
| git diff --check | Passed |
| Frozen pnpm install | Passed; both lockfiles unchanged |
| Source and protected-file hashes | Stable across the respective completed checks |

The focused 17 and 2 are also present in the 263 workspace passes and must not be added again. The six Checkbox T0 cases are distinct from the default workspace passes. The default command's 45 ignored cases remain recorded as ignored in that receipt. Six were subsequently run explicitly; the other 39 Node-peer T0 cases were not executed in this bounded local repair. No macOS accessibility feature or physical AT acceptance is claimed.

The actual commands, timestamps, platform/compiler versions, full output, source hashes and per-binary workspace counts are in the [evidence manifest](evidence/2026-11-23-gpui-adapter-readonly-projection/manifest.json).

## Preserved non-product failures

The first local launcher failed before tests because its requested TMPDIR was under a directory that this user could not write. That PermissionError and launcher are retained. The corrected launcher uses a writable, owned private directory; it does not change the product or its assertions.

After the candidate workspace command returned exit 0, the first result collector incorrectly required every workspace test to run by default. It therefore failed on the repository's existing ignored Node-peer tests. That original collector report remains intact. A separate final report derives the correct 263/0/45 totals from the same raw successful output and verifies unchanged source hashes. No product test was rerun or recategorized to hide this reporting error.

The first patch submission had a partial-line hunk context and was rejected atomically; readback confirmed all three original file hashes unchanged. The corrected patch matched the reviewed candidate byte-for-byte.

## Review and remaining acceptance

The parent agent independently read the complete candidate diff, the Base Checkbox declarations and the independent native A11y set/clear path. It then read both final reports and all three current source hashes. It found no blocking source issue. That technical review is not a GitHub APPROVED review or a merge authorization.

This record establishes the local bounded repair and its executed evidence. It does not change the failed historical run, claim the combined PR head is green, close the browser cleanup failure, or imply release readiness. The combined published head still needs its own formal readback. PR #1738 remains Draft while its separate known product blockers are being repaired.
