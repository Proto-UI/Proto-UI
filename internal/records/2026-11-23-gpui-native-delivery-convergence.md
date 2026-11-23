# GPUI native callback delivery convergence

## Scope and authority

This bounded repair continues Proto-UI PR #1731 at `35a2769d718e7764c1654b88394f3e005d1e5315`. It reconciles three native host regressions covered by the separate PR #1730 at `5912f817581f89785e75c26e324a76c97257dc60`: initial hover delivery, outward events published before a callback throws, and default-profile text-selection notification.

The public MIT source at that fixed #1730 commit supplied the hover host mechanism, deferred native notification helper, and legacy selection-query regression. The port retains #1731's ControlLabel pointer cancellation, current-App routing, sequential focus, and post-slot scroll measurements. The authored event and editing semantics remain governed by `C-EVENT-TYPE-0003`, `C-EXPOSE-EVENT-0001`, and `C-TEXT-CONTROL-0001`. `T-COMPILER-GPUI-AUTHORED-INPUT-0001` maps the actual regression consumers; its lifecycle remains draft.

## Failure and repair

- GPUI can report its first hover before the deferred authored mount. The host now retains that physical observation, delivers after the current mount, and checks epoch, window, and hitbox before using a callback. A later frame reconciles against GPUI's current hit-test rather than an earlier cached boolean. Detach and terminal retirement discard the old observation.
- A Props watcher or either public method entry can publish an event and then throw `false` or `0`. The generated entry preserves that exact exception and schedules delivery of the already-published output. A separate pending-event fact prevents drawing or an undrained output queue from swallowing or repeating the notification. Terminal retirement marks its visual change dirty once while preserving output emitted before disposal.
- The default GPUI profile has no explicit text-selection notification method. A focused native editor now invalidates character coordinates and requests the host's next-frame input-handler query. The optional newer API retains its own `gpui-text-selection-notification` feature gate. Unfocused and retired editing leases cannot invalidate a different editor.

The hover port also keeps a still-current view usable when its mounted callback throws: the mount marker settles at the callback's error boundary, and the original exception is resumed unchanged. Synchronous detach or disposal continues to retire the marker.

## Discriminating native evidence

The red fixture compiles the #1731 production logic with added regression tests. Its archive is `native-regressions-red.tar.gz`, SHA-256 `acc416b3663fe26135d8cd20d55014732f64eadf4c88383d07d818fae161369d`.

The native executor reported these completed baseline results:

| Scope | Baseline result | Failing assertions |
| --- | --- | --- |
| Actual generated output consumer | 2 passed, 3 failed | Props, dynamic method, and typed method publish-then-throw failed to notify without another input |
| Generated SDK | 18 passed, 3 failed | Initial hover, two draws before deferred mount, and the focused legacy selection query |
| Cargo metadata | Exit 0 | No setup or dependency failure substituted for a behavioral red |

The output consumer calls actual generated component methods and observes GPUI Entity notifications. It does not call drive, force an unrelated redraw, or poll the event queue to repair missing delivery. The positive controls preserve backlogged output and output emitted before disposal. The SDK hover tests use GPUI hit-testing and draw scheduling; the selection test observes its native input handler's deferred query.

For a small native reproduction, generate an isolated consumer:

```sh
node --import tsx packages/compiler/test/fixtures/gpui-ordinary-values/produce-delivery.mjs /absolute/fresh/output
cargo +1.98.1 metadata --offline --format-version 1 --manifest-path /absolute/fresh/output/Cargo.toml
cargo +1.98.1 test --locked --manifest-path /absolute/fresh/output/Cargo.toml --test delivery -- --test-threads=1 --nocapture
cargo +1.98.1 test --locked --manifest-path /absolute/fresh/output/Cargo.toml -p proto-ui-gpui-native --features test-support --lib -- --test-threads=1 --nocapture
```

The producer writes the compiler's Rust and component manifest unchanged. Its separate native test composition records the actual generated package name, GPUI dependency, source digest, test digest, and artifact hashes. The ordinary consumer producer includes the same output-delivery tests, and the native CI workflow executes them with the existing ordinary suite.

## Evidence boundary at preparation

The three focused source suites passed **55/55**: authored inputs, shared SDK compatibility, and direct ControlLabel lowering. The changed test entity passed schema and contract-anchor validation. The focused producer emitted **18** artifacts from the candidate. Formatting and diff checks passed.

A first attempt to generate the complete ordinary fixture ended with exit 137 before completion; it is not a passing generation result. The focused producer was then used to isolate native execution from that resource-heavy preparation.

The final candidate's native green execution and the broader final-head compiler/type/consumer gates are separate execution receipts owned by the integration coordinator. Preparation and source-suite results do not replace them. GPUI TestAppContext results remain distinct from operating-system IME, accessibility, and physical input acceptance.
