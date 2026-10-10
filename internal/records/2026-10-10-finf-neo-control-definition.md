# Finf Neo Checkbox and Textarea draft source reconciliation

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

This independently reviewable definition slice replaces stale component-specific presentation criteria before implementation. Base ownership, contracts, public anatomy/props, Compiler, CLI semantics and draft status remain unchanged. No full upstream or Full delivery acceptance is claimed.

## Exact source facts

Both sources are from the static MIT archive at Neo commit `3306a802724874a85f93079702b2795370a279d4`; attribution remains in the package's `THIRD_PARTY_NOTICES.md`.

- [Checkbox source](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/checkbox.tsx), SHA256 `2b864431334ef4bcc47742deb03d5b8d0b8710d3c8d17cf5174ea73ad9cc0259`: flex size-4, outline-2 outline-border, no initial main fill, checked/mixed bg-main, Check size-4 text-main-foreground. [Lucide Check](https://lucide.dev/icons/check) independently documents the 2px default stroke; the existing path is retained with rounded endpoints/joins.
- [Textarea source](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/textarea.tsx), SHA256 `6734f7c84352fb50bbdf1ececcfb3f8f8e21cdcc16b3f463e8a5d1808e3720c9`: flex min-h-[80px], px-3 py-2, text-sm font-base, border-border and static main-palette selection. The prior 112px minimum, 12px all-side padding and explicit 24px line height do not match this source.

## Preserved extensions and gaps

Checkbox keeps its separate passive Indicator anatomy, distinguishable mixed dash, theme-aware focus ring and disabled pointer suppression. Those are explicit Proto UI differences; it does not add validation state or aria-invalid styles. No second state/activation/focus owner is introduced. Textarea retains one contentless host-owned editor and host/consumer resize ownership; the local font-sans/font-medium mapping retains the existing family font realization. Placeholder and invalid styles remain outside current syntax/semantic bounds. The source was read, not executed.

Historical source, CSS and browser evidence predates this definition and is marked planned where presentation changes. Export/type-only checks remain unchanged. New tests must reject the superseded dimensions/paint and verify current runtime/CSS, while actual browser pixels remain a distinct outstanding gate.

## Independent pre-implementation review

The coordinating independent reviewer checked the three Prototype and two Test deltas against both pinned TSX sources. The Root's paired text-main-foreground differs from upstream Root text-white, while the upstream Check itself uses text-main-foreground; retaining a coherent theme pair is an explicit Proto UI choice. Mixed dash and theme-aware ring remain existing accessibility extensions. The external outline, focus perimeter, 16px glyph clipping and long-label composition require actual layout/pixel verification; no happy-dom test substitutes for those pending checks.
