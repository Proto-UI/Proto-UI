# Pinned shadcn style source inspection

This is the first, source-only preparation slice for Finf v2. It is not a
runtime style implementation, a new behavior IR, a compiler backend, or a
claim that any component satisfies visual or behavioral parity.

## Provenance and license

- Upstream: https://github.com/shadcn-ui/ui
- Fixed revision: `3d98900e9b73c45f035f8109e9d41ba6a51685e7`
- Git source tree: `81a576ce4689c4a9f47314d29db1e104aabe2129`
- The 12 files under `upstream/` are unmodified text. Each is bound by its Git
  blob ID and SHA-256 in `manifest.json`. No upstream JavaScript/TSX is loaded,
  imported, evaluated, built, or executed by this tooling.
- `NOTICE.shadcn-MIT.txt` preserves the upstream MIT license and copyright.
  It applies to the copied upstream text and excerpts in generated inventory.
- Source freshness means **consistency with this pinned revision**, not a
  promise that the moving upstream `main` is still the same revision.

## Complete inventory, deliberately incomplete implementation

The snapshot contains all eight current style CSS files: Vega, Nova, Maia,
Lyra, Mira, Luma, Sera and Rhea. `inventory.json` preserves every parsed rule,
nested selector chain, source line, ordered `@apply` group, and raw token.
Every apply group also carries its source offset, line, and global sequence so
declarations interleaved across parent/child blocks remain reconstructible.
Comments are not rules. Final semicolons may be omitted before a closing brace.
No CSS selector is evaluated and no Tailwind token is presumed supported by
Proto merely because it can be inventoried as text.
The inventory explicitly reports `protoRulesMapped: 0`. Inventoried is not
semantically classified, mapped, implemented, or accepted. Unknown/dynamic
selector chains are rejected at the fixture normalization boundary.

The complete non-truncated Git tree at the pinned revision contains 249 UI TSX
paths in the inspected roots: `bases/base/ui` (64), `bases/aria/ui` (61),
`bases/radix/ui` (63), and `new-york-v4/ui` (61). The manifest records their
Git blob IDs, not copies of those component implementations. Those paths all
remain `not-projected`. This inventory does not include blocks, examples,
hooks, documentation, or a claim of an eight-by-three implementation matrix.
The three upstream bases are provenance dimensions, **not Proto Adapter IDs**.

New York remains a separate `new-york-v4` legacy baseline and must not be
deleted or silently reclassified as Nova. The checker rejects its removal.
No existing New York consumer or source is changed by this slice.

Two tiny fixtures inspect the real Nova and Rhea default-button rules. Their
three allowlisted utility spellings yield inspection keys only, not Proto
tokens or runtime instructions. Every other token is rejected by this
normalizer. Full style mappings, semantic-state analysis, variant compatibility,
interaction coverage, host closure, consumer migration, and screenshots are
explicitly future work, not green evidence from this check.

## Authority and next slices

Authority was inspected at Proto-UI main
`b928a56c6909835771fc2131503b4a7139db738c`. The relevant cataloged direction is
currently **draft**, not a stable project guarantee:

- `spec/contracts/C-CONTEXT-0001.yaml`: inter-component information must use
  the defined Context channel. A future inherited style choice must not invent
  a second inter-component mechanism.
- `spec/contracts/C-RULE-INTENT-FEEDBACK-STYLE-0001.yaml`: Rule contributions
  retain declaration ordering, semantic merging and withdrawal semantics.
- `spec/contracts/C-FEEDBACK-STYLE-0003.yaml`: author-side visual-intent tokens
  are not equivalent to final host classes or arbitrary upstream utilities.
- `spec/contracts/C-PROTOTYPE-STYLE-CLOSURE-0001.yaml`: prototype-governed
  presentation must close through defined Adapter style translation while
  preserving consumer ownership, environmental inputs and cascade boundaries.

This inspection neither edits those definitions nor adds a public style-switch
API. The next independent slice must bind actual style projection and inherited
selection to the existing definitions and their lifecycle, then verify real
consumers. Compiler/IR ownership remains with its existing workstream. Existing
PR #926 is not a dependency and is not modified. Coordination belongs under
Finf v2 #890 and coverage trackers #870/#911. Source-inspection acceptance does
not close those broader tracking goals.

## Reproduce

Use Node.js 24 and no installed dependencies. From the repository root:

The dedicated `Shadcn style source inspection` workflow runs these same two
commands for changes in this slice; it neither installs nor executes upstream
source and does not replace repository-wide CI.

    node scripts/prototypes/check-shadcn-style-source.mjs
    node --test scripts/prototypes/shadcn-style-source.test.mjs

To regenerate the two deterministic outputs after an explicitly reviewed
source/manifest update:

    node scripts/prototypes/check-shadcn-style-source.mjs --write

The source checker fails on changed source bytes, missing membership, missing
New York, malformed syntax, unsupported at-rules/declarations, or stale generated
outputs. Unknown semantic utility mappings reject instead of silently passing
through. An upstream revision change requires re-reviewing catalog membership,
license, source hashes, inventory digest, grammar and fixtures; do not use
`--write` to pretend a moving upstream source has been accepted.

Validation is source-inspection evidence only. Repository-wide tests, UI
screenshots, native/AT behavior, implementation parity and independent acceptance
have not been established by this fixture.

### Static source storage

`path` remains the exact upstream Git path. `storagePath` is the checked-in text location beneath `upstream/`. TypeScript/TSX source is stored with a trailing `.txt` to prevent repository tools from compiling third-party snapshots; content bytes and both original hashes remain unchanged. The checker validates this deterministic mapping and rejects drift. No TypeScript project exclusion or upstream runtime dependency is added.
