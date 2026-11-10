# @proto.ui/module-focus

Proto UI module that provides focus capability for adapters.

## Purpose

The draft `M-FOCUS-0001` catalogs the instance-owned Focus Module and shared FocusCenter. `asFocusable`, `asFocusEntry`, `asFocusRoving`, and `asFocusScope` separate observed target facts, entry delegation, sibling navigation, and scope policy. Event and State are dependencies; host target/readiness and entry projection are governed by `HC-FOCUS-TARGET-0001` and `HC-FOCUS-ENTRY-0001`, and the order of scope and roving members by the draft `HC-FOCUS-ORDER-0001`.

Current Adapter evidence covers Web hosts. Each navigation takes one total order from the host of the entry that owns it, which is document order on the Web, and keeps registration order for the whole navigation when the host cannot order the set. The implementation still exports one shared center; this is not a claim of independent cross-document focus domains.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Host requests

The privileged `FOCUS_REQUEST_FOCUS_CAP` receives `(target, options, kind)`. `kind` is required: `programmatic` requests synchronize target facts, `native` requests rely on host-observed focus events, and `entry` requests delegate focus without owning the descendant's target facts. Adapters may reject an application with `false`; the Module retains target requests under the existing Focus policy and rejected entry acquisition as distinct entry intent. Entry readiness re-resolves the current target, preserves cancellation and retained-view boundaries, and does not synthesize or take ownership of descendant facts. This distinction does not change the author-facing Focus facades.

## Scope restore modes

The draft `C-AS-FOCUS-SCOPE-0002-D` distinguishes ordinary restoration from the existing explicit opt-out. `asFocusScope().configure({ restore })` governs automatic focus transfer on deactivation. Focus still clears the closing scope's target facts and pending target requests in either mode.

- `previous` (the default) restores the owner captured before activation, which is the activating trigger for a trigger-driven scope.
- `none` requests no focus transfer on deactivation. A close caused by an outside press or an outside focus keeps the destination focused instead of restoring the captured owner.

The existing `trigger` configuration spelling uses the same capture mechanism; the Focus facade has no separate trigger-registration input. Overlay trigger identity remains owned by Overlay. A prototype may configure scope restoration to `none` and explicitly return focus for selected close reasons, such as Escape. That explicit request is independent of automatic scope restoration.

Closing a scope retires its logical members' existing pending target focus requests before publishing the inactive notification, including requests waiting for a detached view. This retirement cancels retained operations and host retries without changing observed target facts or physically blurring the current target. Detaching a view while its scope remains active preserves that intent for remount.

Target-fact cleanup and automatic restoration stay after the notification under their ownership guard. If an active-state observer activates another scope, the older operation cannot remove that new boundary or restore through it. A newer target request from the close notification also supersedes that old continuation while its target is still pending, even when the scope stack and observed focus have not changed. The new request survives whether it replaces the retired request on the same logical target or belongs to another target. A later successful focus owner can still retire that pending request.

## Install

```bash
npm install @proto.ui/module-focus@0.3.0-alpha.1
```

## Adapter integration

Adapters may supply the optional internal `FOCUS_SAMPLE_SCOPE_TARGETS_CAP` for live sequential traversal within an active scope. The host returns ordered eligible targets and native focus; Focus keeps top-scope gating, direction, looping and default-action prevention. It does not synthesize logical focus facts from that sample. Without the capability, the logical-member path remains available and respects `navParticipation`. See draft `C-AS-FOCUS-SCOPE-0002` J; this is not a new author-facing hook or configuration option.

Focus passes its current traversal direction to the optional sampler so native direction-dependent eligibility (such as entry into an unchecked radio group) can be observed. The host does not choose the direction or apply scope policy.

When native focus is inside the scope but not a sequential stop, the sample may report its insertion position separately. Focus uses that position for next/previous traversal without adding a programmatic-only target to the Tab stops.

## Internal Structure

- `src/caps.ts`
- `src/center.ts`
- `src/create.ts`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-event`
- `@proto.ui/module-state`
- `@proto.ui/types`

## License

MIT
