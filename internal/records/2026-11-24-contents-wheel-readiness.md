# Contents Popover wheel readiness and retained failure evidence

## Confirmed observation

The main regression run at `1dd7afa3ea4ff43c1f28306c9b035e87ed11ea62` failed the actual native-wheel assertion in `apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts`: [`test-browser (6/18)`, job 138198390177](https://github.com/Proto-UI/Proto-UI/actions/runs/45314673679/job/138198390177). The test expected Content's scroll offset to change after a real wheel input, but both the initial and observed offsets were zero. The assertion compares two observations; it is not a literal assertion that zero differs from zero.

The old test waited for the retained navigation tree and focus entry, then required `scrollHeight - clientHeight > 0`. Those checks do not establish a positioned, positive-height wheel target: a zero-height surface can also have a positive scroll range. The test checked the public Content's actual viewport geometry only after successful scrolling. The independent Issue #1191 capture script already waits for public available-space geometry before native input.

## Bounded candidate

The revised test waits for measured public available-width/height facts, a positive, viewport-contained scroll surface, and a hit within Content before the wheel. Coordinates now come from that actual scroll surface, including a Web Component's split surface. Hit testing descends into open shadow roots when the public dialog is itself an inner surface. The original 1000 ms scroll-change assertion remains, with additional signed-progress, retained-owner, trusted-input, uncancelled-event-path and unchanged-document checks.

A passive observer records initial geometry, the pre-input state, final state, wheel delivery and any failure for each family/runtime/opening action. Failure screenshots and observer cleanup are retained without replacing the original assertion error if evidence writing fails. No scroll offset, CSS, focus or synthetic input is injected by the observer.

Independent review identified two observer defects before acceptance: a native event can reach a microtask checkpoint before a later listener cancels it, and a detached old dialog can retain the same old split surface. The observer now retains each bounded WheelEvent and samples its cancellation at read time. Each browser reading also resolves the current public dialog and checks exact identity and connection both during scroll polling and after settling; replacing the whole dialog cannot pass by moving a detached old node.

This is a test-readiness correction and diagnostic improvement. It does not yet establish that the readiness gap caused the historical failure, that native scrolling now passes, or that a production scrolling defect is fixed. The Shadcn and Brutalist navigation contracts remain draft; no lifecycle or release acceptance changes here.

## Executed scope and remaining verification

The candidate is based on main `248f8270dd3458d1fcbc507e618337f98b9fde96`.

- `contents-wheel-evidence.test.ts` and `site-contents-evidence.test.ts`: **18 passed / 0 failed** on Node 24.22.3 and pnpm 10.32.1. The seven new controls inject layout to reject zero-height/unpositioned/offscreen/replaced owners and entire dialogs, resolve an open shadow hit, and distinguish synthetic or cancelled input including cancellation after a checkpoint. These are oracle checks, not native browser evidence.
- The self-contained observer passes a TypeScript no-emit check with ES2022, DOM types, NodeNext resolution and `skipLibCheck`.
- Local native reproduction first failed before test execution because the workspace ran out of space. A temporary external dependency-store attempt also failed during Astro setup. After those environment conditions were corrected, the website served successfully, but Chromium exited before any test because its process singleton UNIX socket was denied with `EPERM`. None of these setup failures is counted as a product failure or a pass.

Run the existing browser test on a browser-capable runner, retaining its three-family/four-runtime/click-Enter-Space matrix and the new wheel receipts:

```sh
corepack pnpm@10.32.1 exec vitest run \
  apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts \
  -t 'uses real family Popover Triggers' \
  --maxWorkers=1 --minWorkers=1
```

Review the initial/pre-input geometry and actual wheel path before attributing the historical failure. A remaining native failure still requires diagnosis and repair of its owning layer; these controls do not close Issue #1178, Issue #1191, the historical CI failure or browser acceptance.
