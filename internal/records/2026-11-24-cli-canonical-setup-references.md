# CLI canonical setup references and current Rule inventory

Date: 2026-11-24 UTC. Mode: `human-assisted` / `current-user`.

This is a bounded release-repair record, not a change to the Core contracts or
an acceptance receipt for the whole CLI. The final source-inventory assertion
still fails after this repair: **1,081 → 1,037 unresolved occurrences**.

## Source and authority

The investigated source was integration `19f6d530d7f5df6c57a21e76c5cf45573ea0988e`
plus the exact two-file addition from main
`9c8b8b07070dad92f19f3242a812414200ea2c03` (#1784). Both whole-inventory runs used
that combination. The new `registersRule` / `rule-helper-replay` APIs have no
source caller at this snapshot and are not authored or wired by this repair.
Local merge `c699df74b03934de2b1c64f9d5a7244a26a3aa22` preserves those parents and
the exact staged additions. Its partial-object receipt is retained in evidence;
unrelated unavailable historical blobs were not removed from the tree.

`C-CORE-SYNTAX-0001`, `C-AS-HOOK-0003`, and `C-RULE-0001` remain **draft**.
`C-PROPS-0001` remains **active**. The existing source summary already recognizes
the `setup` member of a canonical Core configuration and already has an
all-references proof for that setup. Reusing this classification does not give a
borrowed setup a fresh Runtime, remove validators, or promote a draft guarantee.

## Defect and bounded change

The source inventory correctly retained the Rule body of a local configured
setup, but its second pass also labeled every `setup: localFunction` value as an
opaque helper escape. For example, Base Accordion Content's one Rule body was
followed by two synthetic `unverified helper value: setupAccordionContent`
observations for its `defineAsHook` and `definePrototype` registrations.

`isClosedAuthoredSetupReference` now reuses `isAuthoredSetup` and the existing
`hasOnlyAuthoredSetupReferences` proof. It also requires the resolved function
to belong to the exact local SourceFile. The inventory omits the synthetic
escape marker only for a function whose every reference is a canonical setup
registration. All real Rule observations remain assessed as before.

| Reference or body | Result |
| --- | --- |
| Genuine Core factories, including aliases and namespace imports | Closed when all function references are registrations |
| Shorthand `setup` configuration | Same closure proof |
| Opaque callback, foreign configuration, ordinary call, or function export | Still unclosed |
| Imported setup function | Outside this local proof; still unclosed |
| Local factory that merely has the Core factory's name | Still unclosed |
| Closed registration whose actual Rule State cannot be proved | Actual Rule remains unresolved |

In particular, Base Dialog Content also calls its setup as an ordinary
function. That case remains unresolved and has a negative regression control.
There are no component/path allowlists, prototype edits, fresh-Root capability
changes, removed assertions, or threshold changes in this repair.

## Actual validation

Node was `v24.22.3`; package commands used `pnpm@10.32.1`.

| Check | Actual result |
| --- | --- |
| New regression fixture against old classifier | 14 selected: 6 failed, 8 passed |
| New regression fixture against repair | 14/14 passed |
| Existing Props initialization / validator / reentry controls | 20/20 passed |
| Existing Rule API isolation, site inventory, authored setup rows, helper invocation and registration context controls | 57/57 passed across 5 files |
| Focused TypeScript check of two changed sources, new fixture, and dependency closure | Exit 0; 1,024 MiB Node heap cap |
| Original whole-inventory assertion before repair | Exit 1; 1,081 unresolved; 204.19 s selected test |
| Same original whole-inventory assertion after repair | Exit 1; 1,037 unresolved; 169.61 s selected test |

Each whole run selected only the original final case, leaving 203 other cases
name-filtered and unrun. The existing 240-second test timeout was unchanged.
Both used a 768 MiB Node heap cap; the candidate's peak child RSS was 877,628
KiB. Neither hit the independent 360-second outer safety bound. The candidate
ran from 12:39:05.345388Z to 12:41:58.920274Z. Its 7,726 selected package
source/config input hashes were identical before and after execution.

A read-only wrapper retained the scanner result and returned the original
object unchanged. It did not modify the original test assertions. Both runs
used the canonical extractor's source-file enumeration.

The three changed files were independently source-reviewed at the hashes below
with no blocking finding. That reviewer did not run Vitest or the whole
inventory. The newly authored test was formatted after its first execution;
the two product-source files remained byte-identical through the validations.
This record does not claim a new full `check:types`, whole CLI suite, browser,
native, packed-consumer, registry, or release pass.

## Full inventory difference

The before/after input lists and all **5,000 source hashes are identical**.
Multiset comparison of the complete retained rows found precisely 44 removed
synthetic opaque-reference markers and zero added rows. All other rows,
including their source positions, call paths, usages, unresolved reads and
provenance, were identical.

| Measure | Before | After |
| --- | ---: | ---: |
| Observations | 3,704 | 3,660 |
| Evaluated observations | 3,217 | 3,173 |
| Evaluated zero-outcome rows | 1,392 | 1,392 |
| Recognized hook usages | 1,366 | 1,366 |
| Unresolved occurrences | 1,081 | 1,037 |
| Unique source/read shapes | 511 | 467 |
| Base unresolved | 61 | 17 |
| Shadcn unresolved | 836 | 836 |
| Brutalist unresolved | 36 | 36 |
| Bootstrap 2.3.2 unresolved | 82 | 82 |
| Liquid Glass unresolved | 66 | 66 |

Zero-outcome rows are retained observations, not proof that a site is covered.
An empty result for Shadcn Tabs is not evidence that all 27 syntactic Rule sites
are lowerable. The actual source probe and invalid earlier sparse-checkout
probe are separately labeled in evidence; the latter is not a product failure.

## Remaining work

The existing strict gate remains open. Base/Shadcn/Brutalist account for **889**
remaining occurrences and the two experimental families for **148**. Removing
experimental families would not close the shared gate.

The remaining reasons are 663 subjects, 186 intents, 108 comparisons, 79
conditions and one Rule spec. Representative clusters include the ordinary
summary's unproved style-selection helper State (414 `style` subjects), indexed
profile recipes, loop-bound profile comparisons and conditional builder shapes.
These are classifications, not proof that every occurrence has one cause.

Base's remaining 17 consist of 12 configured setups that also have ordinary
invocations and five Drawer Handle State reads reached through a helper. Any
further closure needs a call-specific proof that preserves unknown callers;
the mere existence of one known invocation is insufficient. Imported finite
tables and helper returns likewise require value-flow proof rather than
component-name exceptions. Existing fresh-Root style-resource projection cannot
be substituted for the general summary or borrowed-setup execution.

## Evidence binding and reproduction

The complete raw results, source hashes, retained observations, classification,
comparison recipe, wrapper, focused type configuration and independent review
are in
[`source-inventory-evidence.tar.gz`](evidence/2026-11-24-cli-setup-references/source-inventory-evidence.tar.gz).
The archive contains 43 files, is 2,244,884 bytes, and has SHA-256
`7150cf3af81ddfacb41bf04a770df0d0aede4f5e34741de8f3a1ca1b70dacb8c`.

| Candidate file | SHA-256 |
| --- | --- |
| `packages/cli/src/services/hook-source-summary.ts` | `388cabc83fadd675ecb56c2980654ea8ffaa7e81b9270fba7f8be79a358dd7c5` |
| `packages/cli/src/services/lowered-hook-coverage.ts` | `6d3f0310c259c9c0e6079d7b2f2682d848e806bb81caa065b7983043ed808cc0` |
| `packages/cli/test/lowered-canonical-setup-registration.test.ts` | `caa2157739759217d1b0177d6a7dcfd4db010a9149d22a9ecedf795653f9bedf` |

The independent review report hash is
`f9ef4472094c8b8629fc36c9940101f3b736422aecec1bfc1ddc06ef5f8f23ec`.
The original retained inventory hash is
`a4df5f5c048e86fc2d99dc5055ce7c6d7aa578a071bb8b0d6a3796826481298d`;
the candidate inventory hash is
`43c601dcf6a8aa4affde381e87a344976c89534a55873a42bfd2f4e62530d18d`.

The uninstrumented original assertion can be reproduced with:

```sh
NODE_OPTIONS=--max-old-space-size=768 corepack pnpm@10.32.1 exec vitest run \
  --no-cache --maxWorkers=1 --no-file-parallelism \
  packages/cli/test/lowered-hook-coverage.test.ts \
  --testNamePattern 'resolves every hook state a shipped rule condition reads'
```

This command is expected to fail at the preserved unresolved-read assertion on
this candidate. The archived wrapper/config preserve every result row for
diagnosis, and `compare-inventory.py` checks the bounded observation difference.
