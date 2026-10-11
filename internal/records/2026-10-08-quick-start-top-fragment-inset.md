# Quick-start page-top fragment clearance

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and governing intent

Finf PR #872, owner-requested continuity of the visible quick-start first frame. This is a website reading-layout repair, not a new Prototype/Adapter guarantee. The 2026-10-07 quick-start continuity and absolute-header records define the observed public-projection gap. No catalog entity specifies the website page-top inset. `D-SCROLL-PROJECTION-0001` is draft direction retaining host-owned scrolling; this change leaves native fragment scrolling in control.

## Candidate and evidence

The page uses a 24px reading inset below 1024px and 32px above it, while every bookmark including the page title previously received only a 16px inset in its scroll margin. Native fragment navigation after deferred document loading can therefore move the complete viewport by 8px or 16px without changing content layout. The candidate shares the existing responsive reading inset with the page-title scroll margin. Ordinary section/legacy bookmark clearance remains unchanged. It adds no hidden page, placeholder, scroll reset, timer, fixed header height or reduced browser tolerance.

Source baseline: `c0f83b30f613e6dafd6ae2e7a83589ca3427f6d2`. The official run `37675761459`, artifact `11507224026`, has digest `sha256:95c13733aa04af3faaa47bddb78490cd359fafcf7cb0fc7feeb5b9bcd2ebdd10`. Its receipt identifies the executed PR merge SHA as `733573c777fc0881fc9e82b219a174448bfb4067`; its Vitest result records all eight runtime/viewport failures at title viewport Y 96→80 or 80→72. This matches the clearance mismatch, but the runtime artifact omits the quick-start geometry/screenshot directory, so the precise scrollY cause is still a source-derived diagnosis pending native confirmation.

The new source guard failed before the change (1 failed, 17 passed). After the change, four files passed, 63 tests: `site-header-layout.test.ts`, `site-header-disclosure.test.ts`, `quick-start-first-frame-geometry.test.ts`, and `quick-start-first-frame-contract.test.ts`. Prettier and `git diff --check` passed. The actual browser oracle and its 1px/absolute-position/scroll checks are unchanged.

## Remaining validation

The local browser attempt and the same approved escalated attempt both failed before tests because Chromium's singleton Unix socket is disallowed. They are startup blockers, not regression red runs. The supported cloud browser could not reach the isolated executor's ready localhost server. No socket/CDP/security bypass was attempted. No candidate native screenshot or cold/refresh/no-JavaScript pass is claimed.

Run the unchanged 10-case browser suite on the exact integrated head using the existing GitHub workflow. Preserve its complete pre-module, hydrated and per-frame JSON/PNG artifacts; confirm unchanged document Y and scrollY as well as viewport Y, text, fonts, Note paint and overflow. Review responsive and no-JavaScript results separately. If the first-frame workflow fails before execution, repair that environment independently rather than treating unrun tests as green. Broader types/build/CI and independent review remain integration gates.

## Independent review correction

The first candidate left `--docs-reading-inset` undefined on nohero splash pages, invalidating the winning title scroll-margin declaration. The `en/internal/demo-matrix` and `zh-cn/internal/demo-matrix` source/selector negative controls reproduced this (2 failures, 18 passes). The title rule now uses a 1rem variable fallback, preserving the original splash clearance while documentation still resolves its existing 1.5rem/2rem inset. Ordinary section clearance remains unchanged. These are source/DOM controls, not a claimed native computed-style run.

The corrected candidate passes the same four suites with 65 tests; formatter and diff checks pass. Local commit uses the contributor guide's connected-publication path after a live GitHub `get_repo` response confirmed public repository ID 840178061, default `main`, not archived, and current maintain/push permissions. The CLI publisher remains unavailable without a local gh login; no CLI success or native-browser pass is claimed. External publication remains with the integrator.
