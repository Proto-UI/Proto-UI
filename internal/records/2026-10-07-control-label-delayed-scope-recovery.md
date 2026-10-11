# Control Label delayed tree-scope discovery

Date: 2026-10-07. Bounded Finf [#872](https://github.com/Proto-UI/Proto-UI/pull/872) recovery for [r4200878871](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4200878871). The source baseline is `86f2c0c52e370d703665028d8ef5cef45f0685a0`; its Control Label Web bridge retains the reviewed `1d166ee703d2653cc32109dec914c31ae28bd869` behavior. No stable-admission claim is added.

## Failure and authority

`HC-CONTROL-LABEL-0001-VIEW`, `C-CONTROL-LABEL-0001-WEB` and `C-CONTROL-LABEL-0001-OWNED-NAME` require current physical-scope discovery with exact lease ownership. After a connected retained participant is removed and the scope observer delivers that removal, inserting it into another previously unobserved ShadowRoot does not notify its old observer. An unknown closed root cannot be discovered by observing the old root. The old name is already withdrawn correctly on removal; the defect is failure to renew the association after both live views enter the new valid scope.

The first host-only candidate passed the nine scheduling/lifetime controls but still failed the two retained React naming cases. React, Vue 3 and Vue 2 supplied the bridge with the connected-only focus getter, hiding a still-owned detached physical node as `null`. Their Label provider now retains the current physical trigger surface behind the existing view-readiness gate. Web Component's Label provider uses the equivalent current physical accessibility surface. Focus and A11y keep their existing connection/readiness getters, and explicit view retirement still disposes the Label lease.

## Bounded discovery and cleanup

Scope MutationObservers remain shared. Only a previously connected, still-live physical view that is currently detached joins the fallback. One animation-frame callback per Window checks the registered detached nodes' connection facts; it does not enumerate the document or shadow trees. Reconnection rebinds the scope observers and releases that membership. Replacement, absent targets and disposal also release it. Connected views and never-connected views do not start polling. A live view can remain detached indefinitely; discovery is tied to its lease rather than an arbitrary timeout. Native frame throttling still applies in a background document.

Exact tracker identity protects a successor from an old cancelled frame. Reentrant detachment during a reconnection notification retains exactly one new scheduled frame. One notification failure does not strand the other live members. Each disposer removes only its own member; the last member cancels the outstanding callback.

## Evidence and limits

The same nine selected files, with the new assertions preserved, produced **15 failures and 83 passes** on the baseline and **98 passes** on the complete repair. This includes nine controlled-frame host cases, six delayed open/closed-root retained-view cases across React/Vue 3/Vue 2, all existing four-Adapter Label cases, and the Control Label owner suites. The React fixture runs the real Adapter through its repository hook harness; Vue 3 and Vue 2 use their actual framework test utilities. All use the repository DOM test environment and synthetic pointer sequences. They are not real-browser input or assistive-technology evidence. Expected foreign-scope diagnostics remain in the interval when only one participant has moved.

The host controls cover both root modes, 30 participants sharing one scheduled callback, no notifications while still detached, no document query scan, replacement and absence, one-owner cleanup, cancelled-frame delivery, notification reentry and notification failure. The old source's passing existing cases are preserved. An initial test setup run could not resolve the worktree's `@floating-ui/dom` link; linking the existing central workspace dependencies resolved that setup issue before the paired run. No source claim is inferred from the setup failure.

An expanded run of Label ownership, A11y reference ownership, all four Adapters' focus and shadow-acquisition cases, catalog evidence integrity and lifecycle readiness passed **20 files and 313 tests**. Workspace TypeScript and prototype-catalog checks also pass. Node `24.19.0`, pnpm `10.32.1`, Vitest `2.1.9` and happy-dom `15.11.7` were used, with one test worker.

A separate actual-Chromium host probe was prepared, but this executor rejected Chromium's local socket creation before page startup, including one reviewed elevated launch. No browser assertion ran. Complete native/assistive-technology/GPUI admission and final integrated package cost checks remain separate gates; the narrower green harness does not replace them.
