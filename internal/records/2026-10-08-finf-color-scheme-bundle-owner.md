# Finf exact WC color-scheme provider ownership

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Exact ownership change

The public WC `src/index.ts` exports `adapt.ts`; `adapt.ts` imports `createRebindableColorSchemeSource` from `./color-scheme-source`, creates it for its default Meta getter and forwards document adoption. That helper only combines the already owned Base color-scheme provider with listener deduplication and document rebinding. This change adds exactly `packages/adapters/web-component/src/color-scheme-source.ts` to the reviewed site-control Adapter module set. It does not admit a directory, material program, unreviewed adjacent module, foreign caller or opt-in installation.

The original source hashes are SHA-256:

- WC index: `e39105e61c4765a105ad3a3b165d3fd33f80bb4f6fa251bb9faf981e6b2b8397`
- WC adapt: `39dea4927816139be8bf53105e417ecf349b98721fd1b9f11b305ec0d7f61047`
- Color-scheme provider: `dfefd972179ce2e8713c462bbd0ddf21a6adafb9abd9014cd6f130679abe39df`

## Evidence and source attribution

The production guard tests add a transitive Adapter→provider control for all five Website owners, reject an adjacent unreviewed provider and exercise owner/bridge/renderer static and dynamic foreign-call bypasses for this exact module. Against the original guard: 392 pass / 35 fail, with the new cases failing their initial legitimate-owner precondition. After the exact addition: 427/427 pass; the injected bypass and adjacent-module controls remain rejected.

An initial local build used shared dependency directories with workspace links pointing to another checkout. It is not used as final source evidence. Rebuilt this worktree's dependencies from the unchanged lockfile with pnpm 10.32.1, `--offline --frozen-lockfile --ignore-scripts` and the existing dependency store; all 359 inspected `@proto.ui` workspace links point within this worktree. The fresh production graph has no foreign-checkout module IDs, and all 4,135 `packages/` module input paths resolve to this worktree. Third-party dependencies remain ordinary package-store content.

After rebuilding the isolated dependencies: Node 24.19.0, the production website build completes 345 pages, the combined workflow/guard Node selection passes 461/461, the seven Props/portal renderer suites pass 19/19, and workspace TypeScript passes. Fresh graph SHA-256: `55e7357223134fcfd9a2e260badf0b2802cf62e2ef5aea2ca20aaf6a177950ac`.

## Remaining production failures, not hidden by this patch

Main CI `37724536947`, job `113140723235`, binds PR head `d0a09844744469637e2c63dc8a26a886fe403f05` and merge checkout `56192a5f51f51c292e37e742e0f269c5a4232d97`. The full failure is 20 forbidden static-shell closure diagnostics plus 25 unowned-importer diagnostics, not just the latter 25. The original guard on the fresh local graph reproduces the canonical 45-diagnostic set exactly.

This one-module correction does not make the real graph pass: 45 diagnostics remain, and the reported origin for the 25 importer paths advances from `color-scheme-source.ts` to `keyed-meta-sources.ts`. The guard stores one origin per importer; that first origin is not a complete inventory of unowned modules.

The remaining closed set includes ordinary WC portal/Shadow/provider helpers and the optional Base material shader/program/source family. The current Website manual chunk groups all Base/WC modules into `site-shadcn-controls`, physically bringing the optional material family into ordinary shell closures. These cases need separate ownership and chunk-boundary review. The existing prohibition on shader/compiler assets and opt-in installation in ordinary shells remains unchanged. No broader whitelist, graph suppression, test waiver or claim of completed main CI is made here.
