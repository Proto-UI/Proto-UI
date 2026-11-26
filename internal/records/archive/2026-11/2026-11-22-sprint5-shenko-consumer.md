# Sprint 5 actual Shenko application consumer

Date: 2026-11-22. Agent: ChatGPT, acting on the current user's Sprint 5 request and explicit identification of Shenko as a real Harness application. Related conditions: #1144, #1170, #1171, #1172; the separate full Harness journeys remain with #746/#745/#522/#523. This record describes executed candidate evidence, not upstream adoption.

## Fixed sources and actual consumer

The public application source is [cyjin-yl/shenko at `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`](https://github.com/cyjin-yl/shenko/tree/f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42). Its original reviewed Proto UI pin is `f29738eb6a804ccfc58510cc5a5bd1692690716e`, with upstream lock SHA-256 `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8`. An isolated candidate changed the pin explicitly to the publicly available Sprint 5 commit `457eb4ed08bae27c4db12b87a9238e3c1b074ca8` and its actual lock digest `506e325a918331c1a90273876aeee280c08bb25ef74ba54a93b7a48f33fb3863`. The original pin was saved before the change. The producer's exact-pin, clean-source, package-version and provenance checks were retained.

The two application-owned prototypes are `transport-badge.proto.ts` and `message-bubble.proto.ts`. Their generated React components are imported by the real `src/ui-kit.tsx` / `src/im.tsx` application, including ordinary React children. Button, Textarea, Scroll Area, Collapsible, Drawer, Toggle Group, Input, Separator and Toggle remain React Adapter consumers. The [consumer inventory](../compiler/application-consumers.md) keeps these distinct.

## Executed first candidate

On Node 24.22.3 / pnpm 10.32.1, the unchanged application producer consumed the real 42-package upstream public build, generated both prototypes, bundled the actual application and wrote its normal asset manifest. The application's **51 tests passed**, with no skips, and its strict TypeScript check passed. Commands were:

```sh
node scripts/build/public-packages.mjs --package @proto.ui/adapter-react --package @proto.ui/prototypes-shadcn --package @proto.ui/cli --json
# From the application crates/shenko-ui/web directory:
PROTO_UI_SOURCE=/absolute/clean/proto-ui PROTO_UI_BUILD_RECEIPT=/absolute/public-build.json node build.mjs
node --test tests/*.test.mjs
corepack pnpm@10.32.1 exec tsc --noEmit
```

The actual application was served from its generated `crates/shenko-ui/src/index.html` and static assets. Chromium 145.0.7632.6 ran with its normal process sandbox. The selected `?demo=1` route uses the real application renderer with explicit fixture data; no WebSocket was opened. It is not the live server/model/restart journey.

The first successful browser run on this candidate passed five checks:

1. The generated transport badge and message bubbles render actual application text and ordinary React Markdown children.
2. The real theme control changes appearance while retaining the observed DOM roots.
3. Real thread selection replaces the previous message bubbles and renders the new thread's native children.
4. Leaving chat for the Inspector view removes the message roots; returning creates the expected chat view while retaining the transport badge DOM root.
5. An explicitly synthetic `pagehide` event invokes the application's actual disposal callback and empties the application root.

These DOM observations do not assert logical owner identity. The synthetic lifecycle trigger does not claim a physical browser navigation. The run had no page errors, unexpected WebSockets or cleanup errors. Light, dark and returned-chat screenshots were captured; the dark application screenshot was visually inspected during integration.

The successful first receipt binds compiler HEAD `457eb4ed...`, compiler tree `0af39ea4f762248be2a838545968add6890b236b`, application HEAD `f3fa6f4d...`, observer SHA-256 `49ae5001d21aacf33c22b2d600dfbe2b3f0fdedd21f85bb0486e8911a4812d55`, compiler source-tree digest `e4abb66c36f1c3998a2300267edca129e81d24d36c272d9214ffc92152b61a08`, and manifest digest `60bd9399b9bbc1dc3b5d51dc111d1790db470c4624ffbe977d455ed23d331e3c`. This is historical candidate evidence; later source or observer changes require their own result.

## Failure controls and independent review

Two executed negative controls reject before opening the browser: changing only the generation receipt's compiler-bundle hash while retaining old assets, and changing unbound application source. Original bytes were restored after each control. The earlier positive attempt failed with `spawnSync git ENOBUFS` because a real generated application diff exceeded Node's default output buffer. The observer now uses a bounded 32 MiB buffer and 30-second timeout; the failed receipt remains separate from the later passing run.

Independent review corrected an initial overclaim about owner identity and required full producer/manifest/source binding. The observer now cross-checks generation and shipped manifest fields, the clean compiler source and lock, source-tree hash, prototype/generated/provenance bytes, actual package entries/bundles and every static asset. Allowed application changes are restricted to the explicit candidate pin and the normal producer outputs. It verifies source and asset stability at the end of the run and includes late page errors, unexpected sockets and cleanup errors in its final pass condition.

The final observer and any later integrated compiler candidate must be run again. The earlier five-case pass is not silently reassigned to those changes. Final source-bound receipts and their reader-accessible evidence links belong in the integration acceptance record.

## Remaining original application conditions

This candidate demonstrates actual compiler and Adapter consumption inside an existing Harness application. It does not certify the live model/server, replay/restart, every append/depart/resume/anchor journey, physical input, screen readers, the editor/Inspector's entire original acceptance, or upstream adoption of the candidate pin. Those conditions retain their original owners and explicit criteria.
