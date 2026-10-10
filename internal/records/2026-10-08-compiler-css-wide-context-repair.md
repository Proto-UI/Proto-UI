# SSR CSS-wide context boundary repair

Date: 2026-10-08. Base: `305ced3afb6b6e3127dee8c0f16859ee8661615b`.

The bounded dependency analyzer certified consumed custom-property declarations with `inherit`, `unset`, `revert`, or `revert-layer` as closed values. These definitions depend on inherited or cascade state which this analyzer intentionally does not model. The same gap exists at official `8e8c4ca21801378c11ea055f8f39796f86eeeda6`; it is not repaired by the template-projection changes in this local base.

The repair rejects these four whole, unquoted, ASCII case-insensitive declaration values when dependency traversal consumes them. It does not claim the values are always guaranteed-invalid. In particular, a consuming `var()` fallback cannot make an unknown inherited or reverted value closed. `initial` retains its distinct guaranteed-invalid behavior and can use an outer fallback. Unconsumed definitions, unused fallback branches, quoted strings, multi-token values, and keyword tokens in ordinary `var()` fallback position remain outside this declaration-specific rejection. This is not property grammar validation or a CSS cascade engine.

Authority: [CSS Variables defining custom properties](https://www.w3.org/TR/css-variables-1/#defining-variables) and [CSS Cascade defaulting](https://www.w3.org/TR/css-cascade-5/#defaulting). Existing internal experimental SSR closure scope remains unchanged.

The new source controls failed four cases and passed twenty-one before repair. They cover environment and local definitions, whitespace, comments, uppercase, `!important`, consuming fallback, quoted/multi-token controls, unused branches, `initial`, and the actual `font-sans` compiler rejection path. After repair the CSS-boundary suite passes 25/25. A first accompanying server-suite run passed 7/8; generated closure typechecking failed because this new worktree lacked the existing workspace's nested `@floating-ui/dom` dependency links. This is retained as an environment failure, not hidden as a product pass. Existing dependency links were then supplied and the identical tests rerun: both files passed, 33/33 tests, including generated closure typechecking.

No browser, full build, remote write, public SSR admission or integration is included. Independent source review and final combined checks remain required.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Independent review: conditional cycle candidates

The first repair `0d232643749a52b75c0852a02649c8e6c1c8176a` still accepted a consumed name with both a cycle-producing declaration and a context-dependent alternative, including an `@media` alternative. The union graph marked the name cyclic before the new keyword check, so an outer fallback concealed the unknown cascade branch. Four additional actual-compiler negative controls failed while the prior twenty-five cases passed. The same issue can occur through another member of a multi-name strongly connected component.

The follow-up retains SCC membership and validates context-dependent candidates of the consumed name and its SCC before treating the cycle as guaranteed-invalid. It does not walk outgoing unused fallback branches or globally reject unconsumed definitions. A guaranteed-invalid self-cycle with an outgoing unused context-dependent fallback remains accepted via its outer fallback. After this correction the CSS-boundary suite passes 30/30 and the generated server suite 8/8, total 38/38. The first candidate's false-green boundary is retained here; fresh independent re-review remains required.

## Independent review: alias candidates and bounded local choices

The second candidate `880df54c7f5ba98794bc546a28a2ff57a74300f6` still concealed an inherited value when a noncyclic alternative reached it through an alias or selected fallback. For example, a name declared both as a self-reference and as `var(--bad)` with `--bad:inherit` was accepted through its outer fallback. Its 38 passing tests did not cover this path. Expanded controls produced four failures and thirty-two passes: three actual compiler false-green cases and one over-rejection where a root remained definitely self-cyclic despite an unused member's context-dependent alternative.

The resolver now analyzes local declaration choices only when a consumed union SCC has multiple candidates. For each choice it rebuilds dependency cycles and applies ordinary primary/fallback resolution. This conservatively considers all finite declaration choices; it neither implements selector/cascade evaluation nor claims that every combination can occur in a browser. A fixed single-candidate cycle remains guaranteed-invalid without examining its unused fallback. Acyclic candidates retain their existing conservative validation. Local renderer ownership still removes shadowed environment declarations before analysis.

Additional candidate analysis has a shared limit of 256 choices and 100,000 traversal-input work units (definition names, declarations and reference nodes counted from the original graph). Both resources are reserved before enumeration. Exceeding either produces an explicit unsupported/invalid result that an outer fallback cannot swallow. The same SCC's candidate resolvers are cached across repeated references and references to its other members. Unconsumed SCCs are never enumerated. These are algorithm-resource bounds, not package-size exemptions or wall-clock performance claims.

Final focused evidence: 43 CSS-boundary cases and eight generated-server cases pass, 51/51. Coverage includes alias and selected fallback negatives, known-primary/unused-fallback positives, independent and cross-linked SCCs, repeated related references, the exact 256-choice boundary and 512-choice rejection, cumulative choices across SCCs, below/above the traversal bound, a large unconsumed SCC, and local declaration overrides. A focused strict TypeScript program for the analyzer returns zero diagnostics. This is still source/server evidence; fresh independent source review and later combined checks remain required.

## Dedicated workflow count synchronization

After the finite resolver review was accepted, the dedicated workflow still required the old source-report total of 68. Its exact existing command was run against `e94c612a45b624edd2562cf95fe39379025ef264`, using Node 24 and pnpm 10.32.1, and its JSON reported 91 total / 91 passed / 0 failed / 0 pending / success true: Button lowering 40, generated server 8, CSS boundary 43. The total was measured, not inferred from source text. The command remains:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/button-ssr.test.ts \
  packages/compiler/test/button-ssr-server.test.ts \
  packages/compiler/src/web-component-ssr-style.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json \
  --outputFile="$RUNNER_TEMP/compiler-button-ssr/source-vitest.json" \
  2>&1 | tee "$RUNNER_TEMP/compiler-button-ssr/source.log"
```

Only the two strict source total/passed assertions change from 68 to 91. Failed/pending/success checks, all three source inputs and their options, and the exact 21-case native browser gate are unchanged. An independent workflow-gate test reads the actual YAML step and executes its exact Node assertion body. Before synchronization it failed two controls (rejecting the measured 91 and accepting the obsolete 68); afterward all eight controls pass, including rejection of 68, 90, 92, reduced passed count, nonzero failure/pending, and false success. This extra test is intentionally outside the dedicated three-file invocation, so it does not recursively change the measured total.

After editing the workflow, its unchanged complete source command was rerun: 91/91 passed and the updated exact gate accepted the real JSON. The standalone gate controls passed 8/8. These are local source/server and validator results; no native browser, full workspace, hosted CI or release acceptance is claimed.
