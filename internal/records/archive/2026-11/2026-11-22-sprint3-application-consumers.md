# Sprint 3 actual application consumer baselines

This record follows the user's clarification that **cyjin-yl/shenko** is an actual Harness application consumer and **OpenGreendam/verdant** is another actual consumer. It records executed application producers at their declared upstream pins. The [machine-readable receipt](../../2026-11-22-sprint3-application-consumers.json) retains source/tree identities, lock and artifact hashes, commands' log identities and the precise delivery boundaries.

Neither application was silently repinned to the Sprint 3 branch. These results establish existing consumer baselines; adoption of a later Proto-UI candidate requires its own upstream-pin change and consumer verification. A website fixture, an application build and a complete live application journey are different evidence domains.

## Shenko: actual React application and authored compiler inputs

The inspected and executed application is [Shenko main `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`](https://github.com/cyjin-yl/shenko/tree/f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42). Its `crates/shenko-ui/web/upstream-pin.json` selects Proto-UI [`f29738eb6a804ccfc58510cc5a5bd1692690716e`](https://github.com/Proto-UI/Proto-UI/tree/f29738eb6a804ccfc58510cc5a5bd1692690716e), the corresponding lockfile and package versions. A separate checkout of that exact upstream was used; no permissive pin override was added.

Executed, in order:

1. Install both declared dependency graphs with Node 24.22.3 and `pnpm@10.32.1`, frozen lockfiles and cached dependencies.
2. Run the real upstream public package builder for `@proto.ui/adapter-react`, `@proto.ui/prototypes-shadcn` and `@proto.ui/cli`. Its dependency closure builds **42 of 47 public packages**; this is not a claim that the other five were built.
3. Set `PROTO_UI_SOURCE` to the exact pinned checkout and run the application's unchanged `node build.mjs`.
4. Run `pnpm exec tsc --noEmit` and the application's unchanged `node --test tests/*.test.mjs`.

The corrected invocation completed the real application build, typecheck and **51/51 tests**, with no skipped tests. The producer generated **12 hashed browser assets**. It compiled Shenko's own `transport-badge` and `message-bubble` prototypes through the pinned canonical compiler's `react-dom-source-v1` profile. The compiler remains a build-time dependency; the application runtime does not import it.

The nine adopted official Shadcn families—Button, Textarea, Scroll Area, Collapsible, Drawer, Toggle Group, Input, Separator and Toggle—still use the actual React Adapter. The application's manifest preserves that distinction and its existing compiler blocker. The source inspected here does not adopt Tooltip, so the separate reproduction of the original Tooltip report is not counted as a successful live Shenko Tooltip journey.

The first invocation incorrectly treated the optional `PROTO_UI_BUILD_RECEIPT` **input** as a new output filename. It completed compilation/bundling but failed when reading that nonexistent input (`ENOENT`). That failed invocation is retained. The corrected invocation omitted the optional input, as supported by the unchanged producer; it does not claim a nonexistent upstream JSON build receipt. The actual upstream build log and its package selection remain bound separately.

Only the tracked generated `build-manifest.json` changed in the isolated application checkout; authored application source and pins were not edited. These frontend results do not complete live backend/Harness task acceptance, follow-tail/depart/resume ownership, physical IME or OS assistive-technology criteria. Those actual application journeys remain with the corresponding Harness workstream.

## Verdant: current main's actual GPUI compiler producer

The executed current application is [OpenGreendam/verdant main `91a775546ebd21a87d76d76568195a6513437719`](https://github.com/OpenGreendam/verdant/tree/91a775546ebd21a87d76d76568195a6513437719). Its `frontend/proto-ui/compiler.pin.json` selects Proto-UI [`e56b2d1a3d6b688a1cbc6930dab1d6757304d733`](https://github.com/Proto-UI/Proto-UI/tree/e56b2d1a3d6b688a1cbc6930dab1d6757304d733), `gpui-source-v1`, and the embedding workspace's GPUI dependency.

After installing the pinned upstream's frozen dependencies, the actual application producer was executed:

```sh
node frontend/proto-ui/tools/build-proto-ui.mjs \
  --upstream /absolute/path/to/the-exact-pinned-proto-ui-checkout --check
node frontend/proto-ui/tools/check-proto-ui-rules.mjs
```

Fresh canonical compilation of the real `pitch-gesture-surface.proto.ts` succeeded. **All 20 generated artifacts matched the retained application artifacts byte for byte**, including the workspace GPUI admission boundary. **Five admission-rule cases passed**, including rejection of a second or independently pinned GPUI dependency. The application checkout remained clean.

The observed [Verdant PR #5](https://github.com/OpenGreendam/verdant/pull/5), head `9f4afa430e0707ef7b683b74018e1d3e554762bf`, is a separate, unmerged upgrade source. Its upstream pin `2685caf7ce0bf8ed7cc5e0f2a9d119bbf616d0b5` belongs to [Proto-UI PR #1710](https://github.com/Proto-UI/Proto-UI/pull/1710), not the current Verdant main baseline. That source line's retained or earlier native evidence is not reassigned to main, and this run does not claim to have rerun its new knob or shared-owner interactions.

The new result is actual compiler-to-application artifact consumption, not a fresh native GPUI interaction or AT session. It cannot accept the independent Adapter route, the entire non-Web release matrix, or the Sprint 3 Web candidate. Those conditions remain explicit in the original Issues and subsequent non-Web workstream.

## Reproduction and retained observations

The machine receipt contains SHA-256 identities for the actual logs, pins, compiler closure and application outputs. Local workspace paths identify where this session retained each observation; they are not public download URLs. Public source links above remain immutable. Later uploaded receipts must keep these source pins and the failed first Shenko invocation rather than relabel the observations with a newer branch head.

No application branch, upstream pin, release version, package registry, deployed backend or production service was changed by this baseline verification.
