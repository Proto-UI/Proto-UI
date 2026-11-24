# Sprint 5: generated GPUI composed Scroll consumer

This is a bounded implementation and execution record for #1056 and the native consumer portion of #1144. It does not close their complete operation, platform, native mixing, source closure or cost criteria. No lifecycle or public profile is promoted by this record.

## Frozen source and actual execution

The implementation was rebased onto public source `12af03bcdcdfc1f319c77e51950ae1a71abf6d25`, preserving the sibling external-Scroll paint ordering and the existing ControlLabel physical receipt implementation. The native-tested staged tree is `14480b8f35bcadc55893bdebaf0b81d2aefd66cd`; its patch SHA-256 is `7e2cf7aa7539bc7ce5f2e51866c271e4975edc69156baad52a284c30cb2ae0ec`. This record and the README explanation are subsequent documentation only.

The ordinary producer generated 39 actual modules from source. Cargo resolved the new local `proto-ui-gpui-consumer-composed-scroll` package; every external name, version, source and checksum remained unchanged. The checked-in fixture lock is that actual Cargo result, SHA-256 `669b054d552e586faf84b34377a862a55cb964a5d22e4addda9c1133729fc96b`. No emitted Rust was edited.

The native run used Rust/Cargo 1.98.1 and the published GPUI revision `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8` inside the Linux `doescontainer/agent-proto-dev` environment. It ran in the observable auxiliary tmux pane `s5-composed-r2-f7b2:0.0`, with one Cargo build job and disabled debug symbols. The runtime process was a native consumer, not a second model seat.

| Evidence | Actual result | Scope |
| --- | --- | --- |
| `gpui-composed-scroll`, `gpui-sdk-compatibility`, `scroll-axis-sync` source tests | 36 passed | Current compiler/runtime sources, including the retained original Viewport refusal |
| Fresh ordinary source producer | 39 modules | Source, checked IR and emitted native artifacts; not 39 runtime passes |
| Full locked Cargo graph | Passed | All features, unfiltered targets, one pinned GPUI and shared SDK |
| Default published SDK `cargo check --locked --lib` | Passed | The actual emitted default SDK and native component crate |
| `cargo test --locked --features test-support --test composed_scroll -- --test-threads=1 --nocapture` | 4 passed, 0 failed, 0 ignored, 0 filtered; 0.24 s test execution | Native layout, paint, real platform-event entry and retained view leases |
| CI scheduling and composed evidence controls | 32 passed | Required execution, no swallowed/skipped/filtered result and source-bound oracle |
| New evidence parser against the actual native output | 4 cases accepted | Raw native log, producer hash, original test oracle and complete locked graph |

Source tests precede the final change from the invalid Rust test spelling `InputEvent` to the pinned SDK's `PlatformInput`, the actual Cargo lock update, and CI-only additions. Their compiler/runtime inputs are identical. The final producer, native execution and CI controls cover those later files directly.

## Implemented host boundary

The existing `scroll.bindComposedChrome` operation uses its declared Context provider, actual static Anatomy family identity, part roles and orientation Expose. A repeated identical binding is idempotent; a different binding is refused. This is generic lowering, without component or source-name dispatch.

Actual retained native element state owns each physical receipt. Logical owners hold weak references. Controls bind the source, track and Thumb's current owner epoch, window, physical receipt generation and retained Scroll binding. Cached duplicate views revoke the control; removing a duplicate cannot upgrade an old gesture or detach the surviving view. Removing the last physical view detaches its view epoch and retires its Move lease. Deferred callbacks hold weak current receipts rather than borrowed Window/App state.

Geometry is read from the retained native ScrollHandle and actual track bounds, padding and borders. Thumb size, translation and paint masking do not request authored rendering. A press retains its Thumb-local offset and subsequent Move samples remeasure the current geometry. A request goes to that same native Scroll engine with a normalized coordinate; no optimistic independent offset is introduced. Unavailable axes, missing extents or no travel hide paint and prevent dragging. Target or surface retirement releases the input lease.

The four independent native cases are:

1. `composed_chrome_uses_native_geometry_without_jump_or_authored_render`.
2. `drag_remeasures_track_resize_and_cancels_at_target_replacement`.
3. `unavailable_axes_and_no_overflow_hide_paint_and_detach_releases_input`.
4. `cached_duplicate_views_revoke_control_without_false_unmount_or_aba_revival`.

The parts are ordinary native peers using the emitted declaration's actual identity. This does not make distinct independently compiled Context or Anatomy declarations equivalent by name. The source fixture intentionally uses renamed roles and no original component-name dispatch.

## Preserved failures and remaining criteria

The first offline attempt stopped before Rust compilation because the cache lacked `android_system_properties` for the full unfiltered dependency graph. A second auxiliary invocation mistakenly retained the same offline flag; it is also retained as a preparation failure. Normal dependency resolution then completed the unchanged full graph gate, without `--no-deps` or a target filter.

The first actual consumer compile on tree `959fa157a7c060be118161a529c7caf1355d057e` failed at three test-harness uses of `InputEvent`, which is a trait in the pinned GPUI SDK. The SDK itself had passed. The source test fixture was corrected to the existing `PlatformInput` API and freshly regenerated. All assertions remained in the final successful run.

The unchanged official Base ScrollArea Viewport still refuses the semantic handle array at its original source boundary with `PUI1006`. That source was not rewritten and the profile was not narrowed to make this evidence pass. Its shared parser admission boundary remains separate work. This result also does not cover every admitted operation, physical input, OS accessibility, macOS, original full-family acceptance, or optimized linked/initialization cost.

The immutable raw archive for the native compile failure and successful run is `composed-14480b8f-native.tar.gz`, 254430 bytes, SHA-256 `073115f53145f223d8be5d7d3a0d6015ea84d6cb48213684a304e5f2708665f5`. It contains original command exits, default SDK and consumer output, Cargo graph receipts, before/after locks, candidate input hashes and producer receipts. The large raw Cargo metadata remains alongside those receipts in `/tmp/s5-composed-12af-f7b2-online/run-14480b8f-r2` on the stated native container.

Public `ea60064882924eb455e1dfc3ff7de55a32de4558` adds ControlLabel test assertions after the parent source used here; it changes neither this native runtime nor the composed fixture. Its independent results still belong to its own source. Integration and published dual-OS execution must retain the exact source of each subsequent result.
