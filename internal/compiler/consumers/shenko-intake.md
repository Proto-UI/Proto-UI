# Shenko source intake

Observed on 2026-11-25. This page records the selected intake and its remaining migration work. See [intake APIs and verification](README.md).

## Scope & Limits

[`shenko-73d091ff.intake.json`](shenko-73d091ff.intake.json) is deliberately partial. Its selected source snapshot is the branch containing [decision 0010](https://github.com/cyjin-yl/shenko/blob/73d091ff581debe486b4bc809c3d001fbbdd3cb0/docs/decisions/0010-proto-ui-adapter-and-compiler-source-compatibility-2026-11-25.md). The following observations are separate revisions:

| Observation | Shenko revision | Proto-UI revision |
| --- | --- | --- |
| Selected decision branch | `73d091ff581debe486b4bc809c3d001fbbdd3cb0` | Its pin is `710a90df2ea57d9f93d7d09e43ebfb2b7b8e5057` |
| Separately observed `main` | `5e009cf7b59820f5cc002a8fc3604af22889edb3` | Its pin is `6ca8f262a074ed19cb24b35d5cc199b5b0e23e08` |
| Consumer's reported 204-file count | Not a supplied source manifest | Reported against `67fd94f5` |

The two pin files were read from those exact revisions. They must not be combined with the reported count as though all three observations described one verified source closure.

The [upstream review](https://github.com/Proto-UI/Proto-UI/pull/1915#issuecomment-7170144913) reports 16 families and 204 upstream files: 97 shadcn, 107 base, 98 `.proto.ts` filenames and 18,483 lines. It separately reports two consumer Prototypes.

Neither the comment nor decision 0010 supplies the 204 paths and digests. The older `docs/evidence/nightly-6782627-20261116/compiler-inputs.json` receipt binds upstream `7521cd501f454b4e013ec6e9656fb4b6e4951514`; it is not the missing manifest at `67fd94f5` or the selected `710a90df` pin.

### What was actually bound

The two default-export files registered in the inspected [`SHENKO_PROTOTYPES`](https://github.com/cyjin-yl/shenko/blob/73d091ff581debe486b4bc809c3d001fbbdd3cb0/crates/shenko-ui/web/compiler.mjs) list were retrieved as original GitHub blob bytes. Their Git blob identities were recomputed before their SHA-256 digests were recorded.

| File under `crates/shenko-ui/web/prototypes/` | Bytes | Raw-byte SHA-256 |
| --- | --: | --- |
| `transport-badge.proto.ts` | 1,995 | `2ee02ccc9ca4fdd8bb4d031d4d390ba4fe78113d290cd9f011735f77c1d272ae` |
| `message-bubble.proto.ts` | 1,553 | `50915675a5fb64b14bf4784594819ea64a76ceb2234e15f7db3321be03f61e8d` |

The intake also binds two configuration files (upstream pin and host tsconfig) plus four evidence files (compiler/build scripts, `ui-kit.tsx` and decision 0010). Those six files add no component entries.

Dependency registration remains missing: the two inputs import `@proto.ui/core` and require its exact upstream closure. An empty dependency list does not mean that they have no dependencies.

The consumer React/DOM tsconfig is recorded as host configuration evidence. It must not be loaded as the new Proto authoring environment. No controlled frontend configuration digest is bound in this partial intake.

### Additional actual declarations

The inspected [`ui-kit.tsx`](https://github.com/cyjin-yl/shenko/blob/73d091ff581debe486b4bc809c3d001fbbdd3cb0/crates/shenko-ui/web/src/ui-kit.tsx) also defines four local Prototype bindings used through the Adapter:

| Prototype binding          | Adapter consumer     |
| -------------------------- | -------------------- |
| `verticalScrollViewport`   | `ScrollViewportY`    |
| `horizontalScrollViewport` | `ScrollViewportX`    |
| `bothScrollViewport`       | `ScrollViewportBoth` |
| `readingViewport`          | `ReadingViewport`    |

They are recorded as unregistered declarations in one additional module. They are not silently counted as four completed entries, nor omitted to force a 206-component total. Their selection/binding and reached-source scope still need to join the registered consumer inventory.

### Remaining work

Obtain or derive the complete path-and-byte manifest at one explicitly selected upstream revision using the shared frontend, register the additional local declarations, and bind the actual resolution configuration. Preserve any differences from the consumer's historical reported inventory. Then perform the governed common-source migration and independent Adapter/generated consumer checks across the required five-target scope.

The inspected sources still declare legacy build-time compilation for the two own `.proto.ts` files and Adapter use for the adopted families. Decision 0010 specifies moving the two files to Adapter when the pin crosses compiler retirement; that conditional transition was not executed by this intake. Neither consumer repository nor application pin was changed, no old compiler was run, and no source was certified as valid Proto 0.4.
