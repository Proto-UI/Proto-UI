# Base Popover initial presence (v0, bounded composition)

Status: independently reviewed bounded definition admitted 2026-10-11; implementation evidence remains separately reviewed. This is not full Popover catalog admission or completion of family motion.

The applicable draft definitions are C-AS-TRANSITION-0001-C/D/O/P/Q and C-LIFECYCLE-0002-I. Popover Root owns its semantic initial open context. Content must preserve inherited appear semantics: initial open with appear=false begins entered without startup beforeEnter/afterEnter, while appear=true materializes then enters after the view mounts. Subsequent close/reopen is ordinary transition behavior even when appear=false.

Content binds Transition's setup-only initial fallback to the required boolean `POPOVER_CONTEXT.open` direct field. This is a declarative single created-time read under Popover's existing context subscription; it creates no new subscription, callback, watcher, clock, activation owner or ViewIntent writer. The binding must work even when a consumer has legally installed the once asTransition hook before asPopoverContent. No early-created state seed or preferred hook ordering may substitute for that guarantee.

The existing overlay presence binding is registered after Popover's existing created callback that synchronizes open into Overlay. Same-checkpoint registration order then ensures Transition initializes, Popover synchronizes the Overlay logical target, and the binding reconciles that target. It must not drive Overlay's stale default false into the newly initialized entered state. All mounted callbacks, focus/entry scroll behavior, portal, a11y, boundaries, geometry and family density recipes remain unchanged.

Explicit Content.open/defaultOpen still precede the bound fallback. Root/Content conflicting explicit inputs are an existing uncataloged ownership boundary, not newly accepted semantics. Preserve and compare the observable phase and event sequences for those inputs; do not remove public inputs or silently call them fully resolved. In initial source tests, only the agreeing Root=true, Content=true, appear=false cases change from a spurious leaving/beforeLeave to entered/no events. Actual conflicting-value cases retain their observed baseline behavior. This observation is not normative admission of those conflicts.

Acceptance includes controlled/uncontrolled initial false/true × appear false/true; no spurious startup events; legal prior once-hook installation; explicit-input no-context-read precedence; immutable binding identity and setup guards; first close/reopen, retained leaving epoch, interruptions, explicit complete, unmount/dispose, reduced-motion ordering; existing controlled/focus/scroll/density regressions. Source-runtime and Compiler, packed consumers, official native-browser Actions, and GPUI evidence remain separate. No CSS animation or native intermediate-paint completion is claimed by this fix.

Agent: dot
