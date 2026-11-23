# Independent local review: source-pinned compiler and ordinary CLI consumers

Reviewer: `/root/collections`; no implementation changes to this slice. Review mode: human-assisted / current-user. This is a source and executable-artifact review, not a GitHub approval or whole-PR final-head acceptance.

## Source and artifact binding

- Primary changes: `a3b245ac1b8a284123eff3ea238b38ee59b9bbcb` (supported pinned builder, identity, bilingual guide and F13 test) and `12de6f461c45fbcb14677f776ff8c572672a34f4` (ordinary family replay).
- The relevant strict-build and source-map corrections in `f618a760cfcdeee9d237474af1b7345eb60bd6c9` were already independently reviewed with the compiler semantics slice.
- Actual built compiler: `3ea9e34545615ce4a981e2e19c3c3fcc9de3b0bb`; Node 24.22.3, TypeScript 5.9.3, esbuild 0.25.12. Artifact directories: `/tmp/proto-ui-s2-pinned-3ea9e34` and `/tmp/proto-ui-s2-pinned-3ea9e34-repeat`.
- New CLI journey script reviewed at `d53d9cb41b90258c467b5614bcf4dd318786f256`. The executed script is byte-identical to that commit. The ordinary-family runner and runtime are unchanged from the earlier reviewed commits. The ordinary build program used for the results is byte-identical between the original 3ea9e34 runner and d53d9cb.
- Current reviewed source hashes: `collections-agent-pinned-cli-review-source.json`. Executed tool snapshots: `compiler-consumers/executed-tools.json`; independently verified in `compiler-pinned-tool-snapshot-readback.json`.

## Conclusion

No actionable defect was found in the assigned pinned builder, declaration/ownership documentation, ordinary-family replay, or CLI journey source. The retained results substantiate the bounded source-pinned Node delivery and ordinary target-consumer claims below. They do not establish a registry publication, stable declaration-file release, native-browser/AT behavior, or all original compiler Issue criteria.

The actual artifact is bound to 3ea9e34, rather than the later integrated branch SHA. Final integration source binding and final CI remain the integration owner's responsibility.

## Builder, identity and dependency closure

The builder requires a clean checkout at the full specified HEAD SHA before and after collecting/bundling inputs, a Node 24 runtime, and installed TypeScript/esbuild versions matching the frozen source lock. Every bundled source input must be tracked. The output uses a fixed virtual bundle location, standard maps with embedded source text, an exact profile digest and source-lock digest, and a fresh destination through the existing create-only writer. The only non-Node external compiler import is TypeScript.

The delivered package and npm lock declare the exact TypeScript version and the source lock's registry integrity. The compiler build identity is inserted into the normal compilation provenance. Unbundled development execution deliberately leaves that identity absent. The private experimental status and lack of a declaration-file release are explicit; no publication or SSR scope is inferred from this delivery.

Independent byte verification (`compiler-pinned-artifact-readback.json`) confirmed:

- All **148** recorded input files equal the exact Git blobs at 3ea9e34, including their byte counts and SHA-256 values.
- All **nine** delivered files are byte-identical between the two builds. The manifest's eight non-self file hashes also match the delivered bytes.
- The profile digest and source-lock digest match their actual files; the map embeds **142** sources with nonempty mappings.
- The delivered package declares only TypeScript 5.9.3; the installed artifact contains that version. External imports are TypeScript plus `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:url` and `node:util`.

The implementation owner's actual `npm ci --ignore-scripts` log records one installed package. This establishes the **compiler's** clean install. It must not be conflated with target-framework installation: the target-consumer runs below copied exact installed physical package payloads and recorded their inventories, rather than fetching those packages from a registry.

## Independent executable checks

I imported the delivered `index.js` in plain Node and invoked its `cli.js --build-info`, without tsx. The API and CLI report the same pinned identity. A newly compiled small React source consumer includes that identity in its provenance.

Using that actual artifact, I independently verified the writer/diff boundaries (`compiler-pinned-api-probe.json`):

- Missing output parent returns PUI3003 and creates no ancestor directory.
- After the caller creates the parent, the same compilation publishes successfully.
- Reusing the destination is rejected.
- A consumer edit is identified by read-only diff, and the edit remains intact.
- The original compiler provenance and historical source map remain byte-identical.

These checks exercise the delivered implementation, rather than a mock of the builder or writer. Existing symlink, concurrent publication and rollback protections remain in the unchanged common writer; this review did not rerun its complete historical suite.

## Ordinary family consumers

I read the actual result set at `/tmp/proto-release-families-0GfifX`, inspected the replay source, and independently checked the retained hashes, diagnostics, map contents and runtime traces. The summary is in `compiler-pinned-consumer-readback.json`.

| Profile | Authored families | Exact target dependencies | Result |
| --- | --- | --- | --- |
| React DOM source | Base / Shadcn / Brutalist Button | React 19.2.6, React DOM 19.2.6 | 3/3 |
| Vue 3 source | Same three Button sources | Vue 3.5.31 | 3/3 |
| Vue 2 source | Same three Button sources | Vue 2.6.14 | 3/3 |
| Web Component source | Same three Button sources | None | 3/3 |

All **12** authored source-closure files match their exact Git blobs at 3ea9e34. Every ordinary build has zero TypeScript errors and retains its executable maps and source text. The map counts are 18 / 17 / 18 / 18 respectively. JavaScript component bodies in the Vue 2 lane remain explicitly outside `checkJs`; that boundary is not erased by the successful TypeScript/helper result.

The runtime really imports each generated component into its target framework, supplies a native child/default slot, activates an enabled Button exactly once, refuses activation after the controlled disabled update, preserves Root identity, and rejects the retired expose handle after disposal. Every result trace contains three completed families and no recorded runtime error. The target manifests contain neither Proto-UI runtime packages nor accidental Floating UI dependencies for these Buttons.

These are real framework executions on **Happy DOM with programmatic events**. They do not prove native pointer/focus/layout/paint, trusted input, accessibility-tree behavior, Adapter differential parity, or arbitrary other family sources. An aggregate bundle in a downstream application is not substituted for a direct authored consumer.

## CLI ownership, edit/rebuild and watch

The new `pinned-cli-smoke.mjs` script is source-reviewed and its result directory `/tmp/proto-pinned-cli-qe7c7c` was independently read back. It invokes the actual pinned CLI through plain Node with cleared NODE_OPTIONS/NODE_PATH, retains per-command stdout/stderr and exit status, and does not edit the compiler artifact.

All ten command statuses match the stated outcomes: missing parent fails; caller-created parent and fresh output succeed; unchanged diff succeeds; collision fails; ordinary original build/runtime succeed; modified diff reports a consumer modification with exit 1; edited build/runtime succeed.

The consumer edit changes the rendered native element from section to article. The ordinary rebuilt React consumer imports the actual public `CompiledComponent` named export and observes the changed element. The executable map embeds the edited generated source; the original compiler map embeds the authored input and remains historical. The original failing rehearsal used an incorrect default import in the **new test script**, and its separate result directory is retained; the passing result uses the public named export without a product workaround.

The watch trace contains four attempts: initial success, a dependency-file update published to a new immutable generation, invalid source with diagnostics and the previous successful directory retained, and successful recovery into a further generation. I independently verified the hashes of every accepted watch artifact and that the successful update and recovery contain the same current source while the original generation differs and stays intact. The separately consumer-edited output remains unchanged. SIGTERM exits with status 143 and no signal-level termination recorded by the child process wrapper.

The runner's source-map exception is limited to emitted files containing only an empty export marker (or no executable statement) after a successful strict target/helper check. A file with executable statements still requires mappings; every map must embed its exact input source. This preserves the meaningful source-map gate while allowing genuinely erased type-only support files.

## Retained limits

- Original #732/#733 complete differential, native focus/AT/paint, mixed owner/context transport and remaining source/profile matrices stay open unless separately accepted.
- Original #1055 full helper/target cost and production measurements are not proved by these ordinary-family replay results. The new cost script was not part of this scoped source review.
- The actual Shenko app replay and its additional safety guard were not reviewed here. Its frozen source snapshot is recorded separately; the source difference must not be hidden under the pinned CLI result.
- The website and collections native matrices are separate lanes. Remote execution has an external quota stop, and inaccessible in-flight results cannot be counted as passes.
- This reviewer did not alter the reviewed implementation, submit a platform review, or claim final whole-PR readiness.
