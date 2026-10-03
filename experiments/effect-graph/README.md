# Typed effect graph modeling probe

Run `node --test experiments/effect-graph/model.test.mjs`.

This inspection-only experiment asks whether two pinned real pipelines fit explicit pass/resource/source/binding data without raw host objects or anonymous shader source. It copies no upstream kernel or demo asset, installs nothing and renders nothing. Every result remains `not-admitted`, even when graph structure is valid.

See [the draft ADR](../../internal/records/2026-10-03-typed-effect-graph-adr.md) for source links, exact commits, license gates, unmodeled extensions and compiler/host limits. The single-surface private resolver in #804 is reusable lifetime research, not a permanent limit on graph expressiveness.
