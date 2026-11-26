# Focus request-kind integration, 2026-10-05

This record supersedes the unresolved integration boundary in the earlier entry-owner review record. The repository owner explicitly accepted the following draft direction: entry retains separate intent until the actual target's event-owning view is ready; explicit programmatic focus keeps its existing synchronous accepted-effect rule. Native requests retain their actual Trigger root admission and observed-fact ownership.

## History and integration

The #832 branch incorporates #811 at `13a7e5593dc3046c58150201f22b870059718785` with its original history and required `programmatic | native | entry` capability kind. #811 still owns its native Trigger surface readiness, FocusCenter observed-owner preservation, and Runtime nested-render phase repair. This integration does not close that PR or represent an independent platform approval.

The real merge had four source conflicts, resolved in React `adapt`, `platform/instance-tree`, `runtime/modules`, and Focus `create`. The result preserves one private owner-readiness registry, the committed target getter, #811 native owner subscriptions and fact ownership, and #832's separate rejected-entry intent and role-scoped cancellation. No existing native, A11y, blur, entry or retained-owner assertion was removed.

## Explicit semantic refinement

Draft `HC-FOCUS-TARGET-0001-D` now states the approved per-kind rule directly instead of extending the old “otherwise applicable” exemption by interpretation. Draft `M-FOCUS-0001-G` distinguishes retained entry intent from a pending FocusCenter target request. `C-AS-FOCUS-ENTRY-0001-H` specifies actual-owner readiness, re-resolution, cancellation and unchanged first-request no-target behavior. Adapter and Module reader projections follow those criteria. Lifecycle status and historical revisions are preserved.

Programmatic requests can apply while observation ingress is closed and synchronize Module-owned target facts after actual host success. Native requests still require the physical Trigger root and its actual owner readiness. Entry requests accept ordinary descendants as well as self fallback, and wait for the actual event owner; they do not synthesize or take ownership of descendant facts. Successful acquisition renews the bounded private layout-retry allowance.

## Evidence boundary

The first resolved-source run passed 7 focused files / 48 tests, including all three kinds from real React `onUpdated`, descendant owner apply/cancel/blur, repeated rejection and bounded retries, old-source callback rejection, and the existing #811 nested Trigger and entry/blur tests. The programmatic callback observation was `active=true, focused=true`; native and entry were `false/false` inside the callback and `true/true` after readiness.

Seven native browser cases are registered in the canonical runtime plan. Their fixture bundles locally; local browser launch is unavailable because Chromium's process-singleton socket is denied. Native results, broader checks, exact-head CI, new package/combination budgets and independent acceptance must therefore be reported separately. Prior #832 `75a9f16d`, #775's 822-frame audit and earlier #826 measurements do not validate this new integrated production tree.
