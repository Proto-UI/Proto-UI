# CodeExample host assertions and deferred Tree admission — 2026-11-17

The current user requested continuation of the remaining 0.3 repairs. This record explains a fixture-only observation correction, prepared with AI assistance. It does not claim a product fix, a native pass, or stable admission.

## Governing behavior and failure

`P-SHADCN-TREE` remains draft. The existing detailed consumer direction in `internal/contracts/prototypes/shadcn-tree-embedded.md` installs usable native host/file controls immediately, then admits one complete real Tabs or Tree group per idle callback. Outer host Tabs admit first; only the current host's unattempted file Tree follows. A later host selection schedules its own Tree. Native-focus and failed-admission guards retain working native controls.

The exact `bf8b1f55f93a89f3c689276d6e339d83891f4dba` [official grammar job](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/job/133905785039) completed with 14 passing and 12 failing cases. All twelve failures occur at the immediate Tree count in the seven-host coverage loop. The failed-baseline screenshots already show the initial React Tree; this is not evidence that the whole page never initialized. The loop next clicks Web Components and immediately expects that newly selected host to have a Tree.

The [original artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/artifacts/14311530497) is preserved with its upload hash in the structured record. It has no native phase stream or console/pageerror observations. It therefore cannot establish the precise scheduler state or rule out another browser error at the failing instant.

## Discriminating local observations

An isolated diagnostic executes the actual CodeExample controller and actual WC Tabs/Tree in HappyDOM. It injects idle-callback delivery and synthetic host actions; it does not run native Chrome.

| Controlled transition | Actual observation |
| --- | --- |
| Initialization | Native file controls work before a Tree exists. First queued callback admits host Tabs; the next admits the current React Tree. |
| React to newly visited WC host | WC selection/source changes immediately, Tree count is zero, and one idle callback is pending. Delivering that callback produces one WC Tree while retaining source nodes and the file selected in the interim. |
| Native file already focused | Admission retains native controls with Tree zero and no queued work or error; revisiting does not retry. |
| Deliberately colliding file path | Admission logs the existing collision error and retains native controls. |

The initial diagnostic result is **3 passed / 1 failed**. The fourth failure came from the diagnostic's overly specific error-message regex, not changed product behavior. Correcting that regex to the real unchanged error text produced **1 passed / 3 skipped** in a selected rerun. Both raw results are retained. No combined four-case green rerun is claimed.

## The five-line fixture correction

After a ready host is clicked, wait for the current visible panel's real `[data-code-example-tree][role="tree"]` to become visible, then retain the original `count() === 1` assertion and all later geometry, source, Copy, keyboard and node-identity checks. This observes the public boundary that those checks require; it does not supply a fake Tree or mutate application state.

The added readiness wait inherits the existing 30,000 ms locator default from locked Playwright 1.58.2; this fixture and its harness set no override. The new wait therefore has an explicit existing backstop, while the old count assertion remains after it. Each of the twelve cases keeps its original **120,000 ms** deadline. The WIP branches, the other runtime/family cases, no-JS cases and every original assertion remain byte-identical after removing the added block. Product source, dependency versions and workflow limits are unchanged.

The final candidate file has SHA-256 `61aee02e02a3e3ab6314712b52eda443b890d433003e3b83ab1ca8cd70ec21a0` (the machine record contains the authoritative complete digest). Source/diff review and TypeScript syntax/emission passed; no semantic type or native execution is inferred from that check.

## Remaining acceptance

Rerun the unchanged 26-case browser inventory on the actual published head. If admission still fails, collect the existing phase stream and actual page errors to distinguish pending scheduling, focus fallback and a real initialization exception. The new wait will still fail when the requested Tree does not appear. All candidate native and screenshot evidence remains pending.

[Structured observations, original diagnostic failure and selected rerun](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-17-code-example-tree-readiness.json)
