# Homepage Header Select sizing consumer repair

Observed on 2026-11-06. This is an additive engineering record, not a change to the catalog's draft lifecycle or an acceptance waiver. Related work: #1159 and #856. The prospective claim is [issue comment 6677049862](https://github.com/Proto-UI/Proto-UI/issues/1159#issuecomment-6677049862).

## Request and ownership

Agent's sanitized paraphrase: make the homepage Header Select Trigger and inheriting Items match in their own used border-box width and height. The reported height is not the vertical coordinate. Keep the full request open while publishing the independently testable consumer repair.

`spec/prototypes/P-BASE-SELECT.yaml` criterion `P-BASE-SELECT-ITEM-SIZING-POLICY`, `P-BASE-SELECT-CONTENT.yaml`, and `spec/contracts/C-TARGET-SIZE-MATCH-0001.yaml` describe the draft public sizing direction and its host feasibility boundary. Public Root omission remains intrinsic. The website must explicitly opt in; page-owned Item dimensions are not the implementation.

The fixed baseline is `9e58834d167618216ed9b39278eb8dded2f2f596`. Header recipes supplied Trigger minimum height but omitted sizing policy. Both Projection and locale Root composition paths also omitted it. This change:

1. Selects public `match-trigger` in the shared Shadcn Header recipe.
2. Passes the current materialization request's family to both runtime/family controls, including repeat family switches.
3. Forwards an explicitly supplied policy through the Projection Root and the locale Root.
4. Preserves ordinary preview omission and public intrinsic defaults, Item inheritance, animation and positioning modes.

Brutalist still has legacy Content-owned chrome and lacks the public Surface/Viewport/ItemText anatomy. Enabling match-trigger there would encounter `select.structure.missing-size-parts`. Its explicit intrinsic compatibility behavior is retained; it is **not** a completed Brutalist width/height fix. That family obligation remains open.

## Exact candidate and observed results

The final nine-file executable patch has SHA-256 `0ce4072884d9afe65839e069ecb1d1ff3458b81205bd380b7462e209c1f51889`. The companion [results JSON](2026-11-06-header-select-sizing.results.json) binds individual source hashes, commands, configuration, failure identities and raw-result hashes. These nine files were tested as read-only overlays on the fixed baseline. The two records were authored afterward; this does not claim the eventual publication ancestry was executed as a complete workspace.

- Original five files on the original implementation: 98/98 passed, exit 0.
- Final test files on the original implementation: 86/115 passed, 29 missing-policy assertions failed, exit 1.
- Same final test files with the candidate: 115/115 passed, exit 0.
- Remove only Projection Root forwarding: 101/115 passed, 14 policy assertions failed, exit 1.
- Remove only locale Root opt-in: 103/115 passed, 12 policy assertions failed, exit 1.
- Paired scoped strict TypeScript on original and final candidate: both exit 0.
- Read-only Prettier check of the final nine files: exit 0.

All phases used Node 24.22.1, Vitest 2.1.9, TypeScript 5.9.3, Prettier 3.8.1 and Happy DOM 15.11.7. Source and 105 existing locked dependency packages were checked before and after. One worker, a 120-second phase limit, credential-free temporary mounts and denied network syscalls bounded execution. This was not a fresh full-workspace dependency installation. No browser or application server ran.

### Retained failed attempts

The first test launch did not execute cases: Vite `mergeConfig` appended the repository include patterns, causing file-descriptor exhaustion during discovery. The corrected temporary config replaces the include list with the exact five files and disables test cache. No file-descriptor or security permission was increased.

The earlier v2 candidate ran 115 cases: 107 passed and eight failed at a newly authored `surfaceStyle === undefined` assertion. Existing `createProjectedProto` / `mergeSurfaceStyle` normalizes absent style to `{}`. The final test requires exactly `{}`, preserving the no-Item-CSS rule and rejecting any added style property. Separate static review confirmed this fixture correction. The final identical tests still fail on original product source. Product semantics did not change during this correction; locale's import and tests were formatted. Original failures remain in the companion report.

## Reproduction boundary

The isolated command was:

```sh
node node_modules/vitest/vitest.mjs run --config /work/config/header.config.ts \
  --reporter=default --reporter=json --outputFile.json=/work/results/vitest.json --no-cache
node node_modules/typescript/bin/tsc -p /work/config/tsconfig.header.json
```

The full temporary configurations are in the companion JSON. `/work/repo` is the fixed repository mounted into the temporary environment; replace it with the chosen local checkout when reproducing. The test include list contains exactly these existing files:

- `apps/www/src/components/site-header-control-recipes.test.ts`
- `apps/www/src/components/Homepage/homepage-locale-select.test.ts`
- `apps/www/src/components/Homepage/homepage-runtime-client.test.ts`
- `apps/www/src/components/PrototypePreviewer/projection-composition.test.ts`
- `apps/www/src/components/PrototypePreviewer/select-item-sizing-consumer.test.ts`

The negative controls delete one forwarding line each and retain all final tests. The public Root-context probe uses the WC adapter even when its input recipe carries another runtime label. The eight recipe combinations inspect authored structure, not four real rendering hosts. No injected or observed pixel dimension is presented as browser acceptance.

## Agent evidence and remaining work

Evidence disposition: **partial**. The local policy repair and its discriminating checks are complete; development integration and full visual acceptance are not.

- [x] Shared recipe, current-request family and both Root forwarding paths implemented.
- [x] Same-test failing baseline, passing candidate, two single-line negative controls, scoped types and final source formatting executed.
- [x] Earlier setup and fixture failures retained with the specific correction.
- [ ] Exact-head independent review, applicable platform CI/DCO and normal integration.
- [ ] Actual Trigger/Item used width and height on WC, React, Vue and Vue2; selection, disabled, reopen, narrow/long-text, RTL, text enlargement and resize.
- [ ] New-head actual screenshots labeled with route, state, runtime, viewport and theme. No old image or mockup stands in for them.
- [ ] Brutalist public anatomy completion and its actual equal-size behavior.
- [ ] Full-workspace, package/consumer, accessibility and release acceptance where applicable.

The old Select native 0/8 result, Header resize and merged test/CSS mismatch remain separate history. #1290 repairs motion evidence handles, not this product sizing path. No Issue umbrella closure, approval, merge, deployment or protection change is asserted.

## Provenance

This is an authorized AI-assisted repair to existing Proto UI MIT-licensed source. OpenAI dot assisted implementation, tests and records. No external implementation, asset or private source was imported. The responsible contributor's own verified public identity supplies the DCO sign-off; no other author's certification is made.
