# GPUI exact fc5 native CI reconciliation

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

Source fc5effc99779aca637acaa06789937cef1414cf1, CI 37530646662.

macOS Clippy passed. Of 35 style-map tests, 33 passed, including the new finite
zero-margin and prefixed-none controls. Two failed because #868's older test and
inventory still asserted that select-none was unimplemented. The current native
plain Text policy already satisfies none, and the frozen fixture emits only
that selection value. The exact current unknown-property count is 31, not 33.

The historical rejection test is retained as a synthetic text/all negative for
both properties. It no longer contradicts the none positive or the source
inventory. This does not implement selectable passive Text or native selection
ownership. No production mapper change accompanies this reconciliation.

Linux failed only formatting of a three-pair declaration array. This patch uses
the exact official rustfmt artifact 11443734141 (528-byte archive, SHA-256
5aeab984016a11b79ef2b40e334284fafc43f309652f7cdd1808b745f5e3f063), applied after
checking it against fc5. Real macOS AccessKit/pixel steps remained skipped after
the test failure; no screenshots are claimed. Repaired Rust tests and formatting
still await original-pin CI; no local toolchain was installed or executed.

The same exact-head rust-interop job 112498865465 passed every gated real Node/GPUI T0 section, including Label; exact-head workspace TypeScript also passed. This still does not execute the separately skipped real AccessKit window/pixel step.
