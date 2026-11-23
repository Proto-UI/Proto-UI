# Sprint 2 collection semantics and public recipes

Date: 2026-11-22. Author: ChatGPT / Codex, executing the current user's Sprint 2 request. Source base: `dc3b184ba10b0de53e40359c52d012b204b2cd01`. The candidate is the commit containing this record. Final integrated browser and CI receipts must identify their own source head; this record does not substitute a development-tree result for them.

## Scope and linked acceptance

| Issue | Delivered slice | Original conditions retained |
| --- | --- | --- |
| #1099 / #523 | Authored Tree RTL navigation and family indentation; keyed Item/Group relationships; dynamic hierarchy reconciliation; ancestor-collapse focus repair; actual public recipes on all four Web Adapters. | Historical #678 reconciliation and independent admission of the full transition packet; actual two-domain application consumers; complete screen-reader/AT, non-Web and experimental-family evidence. |
| #1099 | Data Table column filters, column visibility, current-page selection, custom-cell recipes, portable row/sort activation and public controlled-state boundaries. | Native browser receipt, complete table/AT evidence, independent compiler/non-Web acceptance and original experimental-family criteria. |
| #1099 | One portable materializer lease per Windowed Collection, Root retirement, failure cleanup and stale-host isolation. | Stable independent admission; Web materializer remains an explicit experimental Web boundary, with native browser, compiler and non-Web evidence recorded independently. |
| #1099 / #522 | Current Resizable N-pane/nesting and Carousel continuous-scroll source was retained; its bounded regression suites were rerun and the existing native runner remains the acceptance path. | Exact candidate native geometry/input/paint/cleanup; full original adjustment transitions, AT and independent admission; actual optional desktop Inspector application proof. |

Message Scroller's existing anchor/end-follow implementation is unchanged by this slice. Its application transcript journey and announcement/AT conditions remain independently tracked. No parent Issue is closed by this record.

## Definition and implementation decisions

### Tree

`C-TREE-HIERARCHY-0001` and `T-TREE-HIERARCHY-0001` are new **draft** definitions since `0.3.0-alpha.2`. Logical identity remains `nodeKey` / `parentKey` within the nearest Root. Collection and Anatomy still supply membership and order; Focus owns physical focus. No virtualizer, loading protocol or domain-specific file/Agent state is introduced.

The Root owns `direction`, expanded keys and selection. Right/Left map to forward/backward according to LTR/RTL; vertical movement, Home/End and character navigation retain their existing policy. A committed ancestor collapse moves actual focus to the nearest visible enabled ancestor only if the Tree owned that focus. Controlled rejection keeps the old visibility/focus, and reconciliation does not steal focus from another control.

Each optional Group declares its corresponding Item's `nodeKey`. Item controls Group and Group is labelled by Item through existing scoped keyed A11y part relationships. Missing and ambiguous targets withdraw the link. Reparenting, reorder, insert/remove, nested Roots and rematerialization are exercised independently of selection requests. Group visibility follows committed branch expansion without retiring nested logical items.

Shadcn and Brutalist consume the Base Group direction state to choose inline-start indentation. The initial `ps-4` token was rejected by the repository's CLI style-compiler regression; the final projection uses the already supported `pl-4` / `pr-4` rules. No compiler feature or second family-specific hierarchy was added.

During detach/reparent, a strict Anatomy Root lookup can report the defined absent-domain state. The helper suppresses only that exact diagnostic from `partsOf`; invalid claim configuration and exceptions from the selected Root method propagate. Independent review prompted this distinction, and a Root-method `ANATOMY_CLAIM_INVALID` regression checks it explicitly.

### Data Table

`C-DATA-TABLE-RECIPES-0001` and `T-DATA-TABLE-RECIPES-0001` define these new draft operations:

- `columnFilters`: trimmed case-insensitive column substring filters, combined with the existing global filter before stable sorting and pagination.
- `columnVisibility`: an application-owned boolean map, projected through display/hidden facts and Header focus eligibility.
- `requestPageSelection(boolean?)`, `getSelectedKeys()` and `pageSelection`: one request for the current filtered page, retaining off-page selection; controlled props remain authoritative; empty/unchanged/readOnly/disabled requests are bounded.
- Cell `renderValue: false`: ordinary authored children retain passive Table semantics and current `displayValue`; formatting remains application-owned, including same-ID record replacement.
- Row and Header portable accessibility `activate` actions and eligible Space default prevention, using the existing Trigger owner.

Public recipes for Base, Shadcn and Brutalist compose their actual Input, Button and Table parts. They provide a column filter, column visibility, page selection, previous/next controls, authored status formatting and an exposed-state summary. Each is included in both language routes. Domain formatting subscribes through public instance APIs and queues rendering outside the framework's in-progress commit; cleanup invalidates queued work.

Cross-host recipe execution exposed a real child-lifetime boundary: L1 `setPresent(false)` retains its own instance, but does not guarantee retaining nested framework children (`C-LIFECYCLE-0008-I`). Using it to hide authored columns or empty body row slots destroyed their logical cells in React/Vue while WC retained slotted nodes. Final Table visibility uses hidden presentation without unmounting the authored parts. Hidden columns retain their logical coordinates, children, selection and filter/sort data; empty row slots stay structurally complete and unselectable. The existing Table topology assertions were preserved.

### Window materializer ownership

`C-WINDOW-MATERIALIZER-OWNER-0001` and `T-WINDOW-MATERIALIZER-OWNER-0001` add a portable lease to the existing logical window model. Competing materializers fail before modifying host DOM. Releasing the current lease revokes its generation before user cleanup, permitting a reentrant replacement without an old owner's later state write. Releasing an obsolete lease cannot retire its replacement.

Virtual List Root retires the materializer on view unmount and terminal disposal. The explicit Web host establishes cleanup before observer construction, releases failed initial attachment, and cleans observers, listeners, materialized nodes and spacers. Retired hosts ignore refresh, ensure-visible and late disposal; they do not re-enter a terminally disposed Root's scoped exposes.

Independent review identified a further reentrant path: `renderItem` can synchronously dispose the actual Root. Two production `createAdapterHost` + `virtualListRoot` + scoped-expose negative controls reproduced the error before correction: returning a node incorrectly threw a terminal-disposal error; throwing the original materializer error had that error overwritten. The final request-current and abort checks inspect local host lifetime first, and retired abort cleans only owned physical nodes. Subscription and ensure-visible post-refresh reads have the same lifetime guard.

Pixel geometry, ResizeObserver and HTMLElement identity remain in the Web materializer. Logical keys, bounded windows, generations and the exclusive ownership lease remain host-independent. A Web receipt cannot establish compiler or GPUI parity.

## Validation and failure attribution

The pre-review combined source run completed **20 files / 287 tests passing**, including the original Tree, Data Table structure, collection control/props, Virtual List generation/resize, Resizable and Carousel tests, Shadcn Tree projection, and actual public recipes. These are deterministic/runtime-adapter tests in the repository's normal Vitest environment, not native-browser or assistive-technology results.

The independent review additions then passed **4 files / 42 tests** covering actual-Root materializer retirement, existing generation/resize contracts and Tree dynamic hierarchy. The separately updated Tree activation suite checks that malformed Root-method claims are not hidden as detachment. Final integration should rerun the changed-source selection at its own head.

The public recipe suites execute the real DemoSpec, real framework and real Adapter for Base/Shadcn/Brutalist × WC/React/Vue/Vue2:

| Public suite | Cases | Coverage |
| --- | --: | --- |
| Tree | 12 | Keyed real Group, RTL, selection, physical focus, collapse and cleanup. |
| Data Table | 12 | Filter input, page selection with off-page preservation, hidden column identity/topology, authored formatting, keyboard sort/default prevention, cleanup. |
| Virtual List | 12 | Actual Root/model/materializer, bounded window requests, owner retirement and cleanup. |

Only runtime dependency acquisition is replaced with the installed framework packages in these deterministic tests. Component semantics, generated state, geometry decisions and expected results are not mocked. The native runner bundles the ordinary local runtime modules and loads generated website styles.

Additional checks: scoped TypeScript for changed prototypes, new tests, public recipe and native fixture; existing Table HeaderRow TypeScript probe; prototype catalog; bilingual public-doc inventory; lifecycle authoring against the stated source base. No lifecycle is promoted beyond draft.

Other development failures were classified and corrected without weakening old acceptance:

- The inherited HeaderRow test omitted the actual Shadcn style-scope wrapper. It now registers the real scope and locates the inner Root; its original structural/count assertions remain.
- Initial recipe assertions incorrectly treated hidden columns as removed logical columns and expected a single `aria-labelledby` token. The existing Table/A11y contracts retain authored topology and the self naming token; the tests now assert those definitions and retained identity.
- A new page-selection retirement probe initially expected a previously accepted request to vanish when a later exposed-state observer removed the Root. The actual transaction order publishes the accepted request first. The final probe requires exactly that request, terminal invalidation, and no later request.
- Synthetic Vue event probes were sent in the same JavaScript turn as `api.call`, which also schedules a view update. They now wait for the queued host commit before delivering input. Native browser input runs in separate host turns.
- React view destruction deliberately defers final owner disposal for StrictMode replay. The synchronous terminal-retirement negative control therefore uses the real production AdapterHost and Root, rather than falsely treating immediate React unmount as terminal disposal.

## Native browser execution

`scripts/analysis/collections-recipes-browser.mjs` is a new standalone runner for **36 independently terminalized cases**: three public collection recipes × three release families × four Web Adapters. It records source head/tree digest, dirty state, bundle/style hashes, browser/environment, native trusted inputs, screenshots, per-case failure and cleanup. Local bundle preparation succeeded. Native execution is queued by the integration owner on the authorized browser machine; **this record does not claim a native pass**.

The first remote launch stopped before any browser case: line-delimited `git ls-files` quoted the existing Chinese source path `apps/www/src/styles/__行文脉络.md`, which was then incorrectly opened as a literal escaped filename. The source inventory now uses `git ls-files -z` for tracked and untracked paths, without changing Git configuration. Its Node test preserves the old ENOENT negative control against that actual file and successfully hashes the complete new inventory. Run `node --test scripts/analysis/test/collections-source-inventory.test.mjs` independently of browser acquisition; this startup correction does not claim that the browser cases passed.

Prerequisites are an installed workspace, built package exports and current generated website styles:

```sh
corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style
PUI_EVIDENCE_DIR=/path/to/evidence/collections \
  CHROME_PATH=/path/to/chromium \
  node --import tsx scripts/analysis/collections-recipes-browser.mjs
```

The original Resizable/Carousel native matrix and assertions remain unchanged; the integration owner aligns browser launch with the shared sandboxed harness. Run its **24 lanes** under the same serialized heavy-validation queue:

```sh
PUI_BROWSER_KINDS=resizable,carousel \
  PUI_BROWSER_FAMILIES=base,shadcn,brutalist \
  PUI_EVIDENCE_DIR=/path/to/evidence/geometry \
  PUI_CHROME_EXECUTABLE=/path/to/chromium \
  node --import tsx scripts/analysis/component-capabilities-browser.mjs
```

Chromium keyboard, pointer, wheel, layout and cleanup are browser evidence. They do not constitute physical OS input hardware, screen-reader, non-Web, compiler parity, full visual-design acceptance or historical candidate receipts.

## Actual downstream inventory and remaining conditions

The user identified canonical actual consumers as `cyjin-yl/shenko` and `OpenGreendam/verdant`. Read-only source snapshots were inspected at:

- Shenko: `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`.
- Verdant: `91a775546ebd21a87d76d76568195a6513437719`.

Their authored frontend/Proto sources do not directly consume Tree, Data Table, Virtual List or Resizable at these heads. Shenko's generated aggregate vendor bundle includes library implementations; that is not evidence of authored application usage. The separate compiler-consumer workstream owns the actual current sources and build seams. This slice adds no unrequested downstream widget to manufacture application evidence.

Accordingly, #523's original two independent domains and optional Inspector hierarchy, and #522's optional desktop Inspector min-width/breakpoint/collapse/input journey, remain actual application work under the later Harness Sprint. The full original controlled-state/keyboard transition packet, historical #678 correspondence, complete native/AT review, compiler/non-Web routes, experimental Bootstrap/Liquid family conditions and independent semantic admission remain explicitly open. They must not disappear when this bounded Sprint 2 implementation is accepted.
