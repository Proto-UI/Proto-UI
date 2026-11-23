# Sprint 5 finite-output provenance reconciliation

## Existing definition and reproduced regression

This correction implements the existing draft `C-COMPILER-SCALAR-INPUT-0001-READONLY`: a structural type view cannot hide actual non-JSON fields when its backing value reaches an outward Expose event. Source parsing and independently supplied serialized IR must enforce the same boundary. The related `C-LIFECYCLE-OWNER-INITIALIZATION-0001-B/C` finite-data and trust conditions remain distinct: this compiler proof neither authenticates a carrier nor changes the application's trusted channel or domain schema.

The baseline is the Sprint 5 integration candidate after the narrow capture-spread correction, `ea7e37fc54`. The [preceding comparison](2026-11-24-sprint5-capture-spread-integration.md) retained **15 failures in the original 28-case `json-boundary-provenance.test.ts`**: thirteen source negatives and two independent cold-IR substitution negatives. The source negatives wrongly admitted hidden undefined through structural views, aliases, helper parameters/results, nested wrappers, spread/assignment and later writes.

The tests and definition survived integration, but the data-output analysis introduced in `475454e540ce4e16c9e8750f7756beab6e10d644`, with the optional-overlay correction in `373ef808183b03de61e03faa49689468aa382872`, did not. `callableEffectIssue` still ran from both parser and independent IR validation, but its merged implementation only retained callable provenance. Ordinary source records were reduced to their visible static data shape before reaching the event sink.

## Repair and retained boundaries

The existing analysis now retains actual ordinary record fields, array elements and structured mutable-cell identities when a graph publishes non-void JSON events. A narrowed record remains a view of the original record; aliases and helper calls carry that same backing value, and later writes update its retained store. At `expose.emit`, the analysis checks the complete retained value recursively. The source parser and cold-IR validator both reconstruct that proof from the actual IR rather than trusting a new annotation.

A missing own property remains distinct from an own property whose value is undefined. Optional spread/assignment keeps the preceding property on the absent branch. Explicit fresh scalar copies stay legal, and known nullish spread contributes no own fields. Opaque fields remain opaque instead of obtaining a finite-data proof from a narrower output type.

The repair preserves the current getter-aware analysis instead of replacing the file with its older implementation. Copying still invokes real getter bodies in integer-key/creation order and preserves their throw/phase behavior. A getter returning an unsafe backing record cannot hide that record; a getter returning an independently selected safe scalar can produce ordinary finite copied data. Unknown and open dictionaries remain unproved. No profile is promoted, no capability is reclassified as data, and the unrelated copied capture-getter `PUI1007` failures are not addressed by this increment; no successful successor is claimed for them.

## Verification and actual consumers

The unchanged original JSON suite passed **28/28** on the first repaired run. Its original assertions, including the two cold-IR substitutions, were retained.

Three additional source controls cover a copied getter returning an unsafe backing record, the same boundary through `Object.assign`, and a safe known-nullish spread. The final source/IR suite passed **31/31** without skips:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/json-boundary-provenance.test.ts \
  --maxWorkers=1 --minWorkers=1
```

The first extended five-file run reported **104 passes and one fixture failure**. The new `Object.assign` negative initially returned a readonly object from its getter and was correctly refused by the existing direct finite-record operand rule, before the intended provenance check. Its fixture now uses the already admitted ordinary record return while retaining the hidden undefined backing field and the same required provenance diagnostic. The production repair was unchanged. The final 31-case rerun includes that corrected negative.

The other four files from that extended run passed on the unchanged final production source:

| Suite | Passed | Scope |
| --- | --: | --- |
| `json-boundary-getter-consumer.test.ts` | 4 | Actual emitted React, Vue 3, Vue 2 and WC source, mounted through the native-framework consumer helper in happy-dom |
| `record-getters.test.ts` | 34 | Existing source/cold-IR getter permission, evaluation and target boundaries |
| `record-getter-consumer.test.ts` | 4 | Existing four-target executing getter/owner/disposal behavior |
| `gpui-authored-inputs.test.ts` | 32 | Existing readonly JSON, authority rejection, scalar and authored-input source controls |

The new actual consumer retains an unsafe `{value, hidden: undefined}` backing object locally and explicitly selects its safe scalar field through getters. It copies those getters with spread and `Object.assign`, publishes the real generated Expose event twice, and independently observes the delivered event object. Assertions check the exact three output fields, integer-key getter order, three reads per copy, repeated publication and terminal refusal of the retained method. The event is observed through each framework's actual event surface; no payload, lifecycle or generated output is substituted. These are source-shaped happy-dom consumers, not physical browser, GPUI or application trust receipts.

The exact original complete ControlLabel producer was also rerun on this repair, using a fresh output directory. It again generated Button, Label, full Input and full Input delegate successfully with `generatedRustEdited: false`. This verifies that restoring data tracking did not undo the preceding complete-input source repair; native compilation and execution remain separate.

A strict TypeScript program including the changed analysis, the final source suite and the new generated-consumer suite resolved **468 source files with zero diagnostics**. The lifecycle authoring check against `ea7e37fc54` passed for the one changed catalog input. Formatting and `git diff --check` passed. The draft test catalog adds the narrow generated-Web witness as `needs-review`; existing native implementation statuses and all definition lifecycles remain unchanged.

Raw receipts retained in the integration handoff are `json-provenance-restored-first.log`, `json-provenance-cross-target.log`, `json-provenance-final.log` and `json-provenance-control-label.log`. The middle receipt deliberately retains its fixture error. The prior 15 product failures remain preserved in `capture-spread-baseline.log` and `capture-spread-green.log`.

## Acceptance disposition

The 15 known outward-JSON provenance failures now have successful source and cold-IR successors. This is a bounded compiler finite-data prerequisite for Sprint 5 and does not complete #895/#896. Their draft definition acceptance, complete per-target initialization, source/compiler/helper/request compatibility, application-controlled Props authority, Context reconstruction and physical browser replacement evidence remain separately required. Carrier compatibility still does not imply authentication, and canonical SSR profiles remain unsupported.
