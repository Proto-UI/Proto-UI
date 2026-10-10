# Finf definition-first prototype work

Date: 2026-10-10. This record preserves the owner's engineering direction and its immediate work boundary; it is not a substitute for the project definitions.

The owner required prototypes and the compiler to be implemented independently from the same public Proto definitions, and then checked together. Compiler changes must not encode component logic or test-specific exceptions. The owner subsequently assigned this workstream to prototype-side review and implementation only, because another owner is responsible for the compiler. `AGENTS.md` now carries this engineering principle without changing the existing authority or lifecycle rules.

## Immediate scope

- Keep the uncommitted Compiler/IR candidates isolated and out of this prototype delivery. No compiler candidate was committed or integrated by this workstream.
- Review Progress, then Meter, against the applicable definitions. First establish a coherent prototype definition for roles, inputs, outputs, ownership, lifecycle, host boundaries, and meaningful T acceptance cases; review its lifecycle and unresolved decisions before claiming conformance. Do not invent a component-specific language or rewrite legitimate setup code just to satisfy the current compiler subset.
- Preserve the existing behavior while reviewing it. Real finite-value, indeterminate, context, accessibility, state, and expose defects remain prototype-side implementation work with negative and regression tests.
- Report prototype-definition conformance, compiler input coverage, and actual host evidence separately. The independent probe's 112 frontend rejections across 28 Base roots and four compiler targets describe the tested compiler coverage. They do not, by themselves, prove that every rejected prototype violates Proto syntax.
- The reviewed 28 newly implemented component families still need coherent prototype and test catalog coverage. The catalog is intentionally incomplete; missing P entities must not be reported as absence of all behavior, and source records, demos, and progress matrices cannot replace definitions.

## Boundaries retained

The existing spec lifecycle and authority rules still apply. In particular, draft prototype-independence direction remains draft, legal setup functions remain legal, and the legacy prose layer cannot override newer cataloged contracts. This record changes no acceptance score or matrix state, does not imply compiler or non-Web completion, and does not supersede pending source-bound reviews.

Next: prototype owners submit bounded definition and test slices with actual behavior evidence; independent review classifies any mismatch by its real authority and implementation owner. Compiler composition failures are handed to the existing compiler owner rather than patched around in this workstream.

## Verification

The independent definition reviewer read the two changed documents and found no blocking factual or lifecycle issue in this scoped rule change. The repository's agent-operations structure checker and contributor-skill checker both passed (42 skills, 40 lazy leaves). The Agent understanding projection check did not pass: the existing spec workspace references three absent GPUI test files (`available_space.rs`, `composition.rs`, and `tabs_t0.rs`). This rule change does not add, delete, or relabel those implementation claims. The full agent-operations test command was also started; its completion must be reported separately rather than inferred from its passing structural checks.
