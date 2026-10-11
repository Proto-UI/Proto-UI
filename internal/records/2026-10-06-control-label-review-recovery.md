# Control Label review recovery and nested input ownership

Date: 2026-10-06. This is a bounded correction for Finf [#872](https://github.com/Proto-UI/Proto-UI/pull/872), following review comments [r4199624956](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4199624956) and [r4199624979](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4199624979). It does not complete Label's native, assistive-technology or GPUI acceptance.

The failing production source is identical in Label tree `14235600eda88d22cc8279e050e4eb4bc6351070` and Finf commit `8c3133a6690ed1daf0307f5631d0edac2d493027` for the three changed implementation files. The controls below execute the actual Runtime, Control Label Module and A11y Module with injected host failures, plus synthetic DOM pointer sequences for Web classification. They are not browser or assistive-technology evidence.

## Failed acquisition remains retryable

Previously, a host attachment error left the reference installed without a binding, so applying the same reference again returned without retrying. If naming projection failed after host attachment, the host lease and A11y's unpublished naming contribution could also remain installed.

The acquisition catch clears only its current reference and retires its partial lease. It clears intent before invoking cleanup, so a cleanup callback can install a newer association without the old attempt erasing it. The generation guard also preserves a newer association installed inside a failing attachment callback. A11y withdraws its exact failed contribution and attempts to project the resulting snapshot before rethrowing the original error. A second projection or cleanup error does not replace that original error. If the host also fails to apply the rollback snapshot, this correction cannot claim that external host output has been restored; the logical claim is released and a later explicit retry remains possible.

Five controls cover same-reference retry after attachment failure, naming/host cleanup followed by successful retry, cleanup reentry with a newer reference, stale attachment failure after a newer association is installed, and a second failure while projecting name withdrawal. Assertions compare opaque references and error objects by identity. They preserve the existing clear-old-slots-before-disposal lifecycle behavior.

## Descendants keep their own interaction

The existing `C-CONTROL-LABEL-0001-INPUT` boundary already excludes nested interactive input. The Web classifier omitted conditional media controls and several input/action/selection roles. It now recognizes native interactive content and explicit interactive ARIA roles, including slider, spinbutton, option, menuitemcheckbox, menuitemradio, searchbox, treeitem and scrollbar. Read-only or disabled controls still retain their input boundary. Plain captions, progressbar/meter roles, nonfocusable separators, tabpanel content and media without controls remain passive; declaring any ARIA widget role is not itself sufficient to suppress Label activation.

This classification compares the existing Proto ownership rule with the [HTML label activation rule](https://html.spec.whatwg.org/multipage/forms.html#the-label-element), [HTML interactive content](https://html.spec.whatwg.org/multipage/dom.html#interactive-content), and [WAI-ARIA role categories](https://www.w3.org/TR/wai-aria-1.2/#widget_roles), read 2026-10-06. It does not import a native HTML label's full default-action algorithm or change the documented synchronous click-cancellation boundary. Descendant handlers still receive their original event; the bridge neither cancels that event nor clears text selection.

## Evidence

- Final paired controls on the unchanged implementation: **14 failed, 26 passed** across the two targeted files. Four failures expose acquisition/name recovery, ten expose nested interactive input; the remaining controls preserve working behavior.
- Corrected targeted controls: **40 passed**.
- Related Control Label/A11y suites, Runtime A11y contract and all four Web Adapter Label integration suites: **12 files, 211 passed**. Expected foreign-tree-scope diagnostics belong to explicit negative cases.
- Workspace TypeScript check: **passed**. Catalog evidence integrity and lifecycle readiness: **2 files, 93 passed**. Browser/AT/GPUI evidence and the integrated package build/budget remain pending in Finf; earlier Label build or budget results do not certify this new increment. This correction adds no acceptance promotion.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
