# Literal black focus-ring style support

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

At PR #887 baseline `9c448af9e3f3e0bb1b8a5aa61ed732e2a9026516`, the generic CLI style renderer emitted an Unsupported diagnostic for `ring-black`, including `data-[focus-visible]:ring-black`. A theme `ring-ring` substitution is not equivalent: the current Neo dark theme uses a pale ring.

The bounded repair recognizes only the literal `ring-black` and uses the existing ring-shadow composition. It adds no component dispatch, selector syntax, arbitrary CSS acceptance, Compiler/IR or Runtime code. Exact literal and inherited conditional output are tested in document and Shadow renderers. Theme `ring-ring`, `ring-ring/50` and unsupported arbitrary/malformed alternatives remain covered.

The new test failed before implementation (1 failed, 57 passed); after the one-line renderer branch, all 58 style-renderer tests passed. These are CSS-output observations, not real-browser paint. The dependent standalone Neo Input is a separate candidate; no publication or full upstream/native conformance is claimed here.
