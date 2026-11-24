# Website visual source reconciliation

Bounded author source review for [Draft PR #1788](https://github.com/Proto-UI/Proto-UI/pull/1788), not an independent approval. Original visual head `009bb8fcece87e3f0e45a698cbda1011b0a8bcf2`, reviewed main `88fc0883bec70abbc0d7505d88370657c279639e` (includes #1790), and integrated source snapshot `bd2d1cf66f72532c0aa529349a40893d00f513bc`. The original two contributions and newer main documentation stay intact.

- The homepage gallery's existing stage gains a compact inert presentation and explicit expansion. Search alignment is scoped to the Shadcn homepage sample. Runtime material paint matches opaque corners only against established flat color without clipping the interactive subtree. The existing grouped owners remain blocked.
- The static wrapper embeds one semantic source. The client imports only `./prototype-modules`, `./registry` and `./wc-registry`, mounts the public Shadcn root, viewport and two tracks/thumbs for the same generated file pane and RuntimeBox footer, and retains the native pre for early focus/selection. The WC registry adds only an orientation-prop forwarder through an existing raw package specifier.
- The integrated Astro configuration differs from reviewed main only in two existing zh-CN Dropdown Menu labels. The new Sprint 2 File Input and Selectable Row sidebar entries remain. Retry/plugin/resolver/Worker bytes and owners do not change. Only the integrated digest is added to the existing four-owner exact profile; general bare package resolution does not change.
- The preceding markup reference is archived byte-for-byte as `website-markup-provenance-d8dfeab.json`. The current reference remains `sourceAdmission: unverified`. No independent review, served/transitive closure, release, production deployment, or cross-browser acceptance is inferred. Older screenshots are not relabelled as pictures of this integrated commit.

| Exact integrated source | SHA-256 |
| --- | --- |
| `apps/www/astro.config.mjs` | `c0a7f33cceaf8b66e31592b7d266b6cd63d28c032467f6b833eb0e989577f1ee` |
| `apps/www/src/components/CodeFileBrowser.astro` | `0322d541a583390c8ce2d6af06b8a24432ca0ba20c8e466f65394e2a52381635` |
| `apps/www/src/components/Homepage/homepage-demo-participant.ts` | `621722fc928e6bdeb5c0526da489bf49085bebc567038586414dd57e54ce83cd` |
| `apps/www/src/components/Homepage/homepage-showcase.ts` | `dc485e86101ce785a9dd98066c348c1a841d82f5652ea9439554d8102a366815` |
| `apps/www/src/components/PrototypePreviewer/CodePanel.astro` | `a4ae6efe883bdbbd038167179669e811df6582a13bf77853b7314ea2bbcabde3` |
| `apps/www/src/components/PrototypePreviewer/HomeDemoPreviewer.astro` | `a6ddb4c223030b63e6f0ade8e2497f7447db25c8d43318024c7faa7c35db96f4` |
| `apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro` | `4fd03809c049a6a70e774dd6a5402edad258b08e16fdd43648cc6e4159f73460` |
| `apps/www/src/components/PrototypePreviewer/code-panel-client.ts` | `0d9271cdf2edb564cfbe0441d717a55278026ca18ef96301f77b006d27640c0c` |
| `apps/www/src/components/PrototypePreviewer/preview-material-scene.ts` | `ecdab0f478c9567cf6cb24a6834001409a89e1d3c535cf5609b3425e4d1c984d` |
| `apps/www/src/components/PrototypePreviewer/runtime-preview-surface.ts` | `d89dc89aaae69a0f6e9f1f4b23ce77f171edc62c7e2fba36bdb10244a2af60c2` |
| `apps/www/src/components/PrototypePreviewer/wc-registry.ts` | `3176c5c92408e9428283b428c130f818c33ab2fd53666fd255e6d6a99b2a31ca` |
| `apps/www/src/components/PrototypePreviewer/CodeScrollArea.astro` | `bfce678e82b0e8b1ef580098575b36d987beb5e74f2afa16217b710dd50b3daf` |
| `apps/www/src/components/PrototypePreviewer/code-scroll-area-client.ts` | `bfa460a54734e816879bccecdbbb5f32f184ba4d73e34c8c752da13d3b8f9f1f` |
