# Compiler consumer follow-up after the A4 checks

The real candidate `7172b5182f584849157a22b1abbde6ed3a2c03e9` exposed two further Compiler defects. This record preserves those failures and distinguishes the bounded repairs from final consumer acceptance.

## Callback identity inside a native module configuration

The actual Shenko production App failed to mount in sandboxed Chromium. Its first page-error stack entered `CollectionItem.configure`'s `getMeta` callback and threw `[Compiler] unreachable authored callable invoked`. The four existing reading journeys consequently reached no reading assertions. The earlier borrowed-State provenance error was absent from this attempt.

The retained ToggleGroupItem IR8 contained a real `record` with nominal type `module-config`; its `getMeta` field held an authored function. The operation contract already declared that field as a possible host callback. Callable-flow analysis discarded the configuration's fields before that contract could register the callback, because the nominal container was not treated as carrying callable identity.

The repair retains the actual fields of this checked configuration container. The operation's existing callback rules then determine reachability and invocation effects. It does not emit every function, erase opaque-source diagnostics, remove the unreachable-callable guard, change readonly permissions, or alter the reading algorithms.

Bounded verification on the repaired working source:

- The actual ToggleGroupItem IR was serialized through JSON and independently validated, then analyzed and emitted through the public native React emitter. `getMeta` was reachable, the flow was not opaque, and the emitted component no longer contained its previous unreachable placeholder.
- The single-entry generated graph passed strict TypeScript checking.
- The five original control-label context, mutable-callable provenance, closure-demand and structural-authority files passed **117/117** cases with no skips. Their inputs and assertions were unchanged; no new case was added.

These checks do not constitute a successful Shenko browser journey. The final pinned producer and the original browser actions still need their own new receipts.

The combined follow-up also passed the same scoped Compiler strict TypeScript configuration used before these repairs, with Node 24.22.1 and TypeScript 5.9.3. All 7,503 tracked inputs remained unchanged during that check. The official prototype coverage `--check` passed without refreshing or relabeling the existing candidate source inventory.

## Fresh mutable fields after a closed scalar call

The [A4 native-consumer CI](https://github.com/Proto-UI/Proto-UI/actions/runs/45089823134) passed the two existing Rust-data files, **24/24** cases, on both Linux and macOS. Its later unchanged GPUI ordinary-values producer then rejected `value.count = value.count + 1` with `PUI1006`.

The original fixture, producer and Rust consumer were byte-identical to main `2479acecddf8f9801cdbee0c538ca08d7e79c9d4`. The main compiler accepted the same input; A4 rejected it. A closed call `makeCounter(0)` had specialized an explicitly declared `number` parameter to literal `0`, then incorrectly restricted a newly allocated mutable object's `count` field to that literal as well.

The repair keeps the exact closed-call parameter and capture proof. Only a copied scalar in a fresh field without an explicit contextual constraint recovers the author's declared scalar storage domain, expressed with the existing independently checked IR operation. Constant aliases retain that origin. Ordinary member-write, readonly, capability and independent-IR checks are unchanged.

Bounded verification on the repaired working source:

- The original GPUI producer completed source parsing, IR8 validation and native emission for all **29 modules**.
- The four original ordinary-flow, helper-capture, finite-string-membership and source-values files passed **89/89** cases. Their inputs and assertions were unchanged; no new case was added.
- The IR still contains the literal parameter proof, while the fresh mutable field has the declared number domain.

This generation result is not a Cargo execution result. The existing `ordinary_source_aliases_captures_defaults_exceptions_and_public_values` Rust test remains the relevant end-to-end check: it verifies increment/read values, alias mutation, and separate-owner isolation. The original locked GPUI dependency graph and consumer tests must run on the eventual committed source; they must not be replaced by a generated-output inspection.

## Existing evidence boundaries

A4's full official `check:types` chain completed on Node 24.22.3 and pnpm 10.32.1: Astro reported 1,261 files, zero errors, zero warnings and 32 hints. All 47 public packages built. The unchanged strict budget gate still failed for Runtime/React/Vue/Web Component by 63/247/281/232 gzip bytes respectively. These actual results remain bound to A4 and are not relabeled as results for the follow-up commit.

Shenko's A4 producer, independent strict checking and all 51 existing frontend tests passed. Its subsequent independent build failed when the consumer's directory publisher tried to rename into a parent directory absent from a fresh checkout. That consumer build fix is separate from these two upstream Compiler repairs. The failed integration and failed browser receipts remain failures; neither is promoted by this record.
