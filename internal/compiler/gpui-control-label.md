# GPUI direct control-label associations

This draft lowering implements the direct-reference branch of
`C-CONTROL-LABEL-0001`. It does not reinterpret an Expose event as an input.
The same authored target callback owns disabled policy, focus and activation
when a native label requests it. Ordinary Button press behavior is unchanged.

## Typed host boundary

The shared native SDK owns `ControlLabelRef::new()` and
`NativeInstanceAssociations { control_label }`. The private reference identity
is shared by clone, not serialized, and cannot enter JSON Props. Independently
generated components using that SDK participate in one exact-reference domain.
`new_with_associations` and `create_with_associations` admit this bounded input;
ordinary constructors retain their existing behavior. Supplying an association
to a component without an authored participant is an error.

One live label and one live target, in the same native window, are required.
Missing participants, duplicate bindings and different windows fail closed and
are observable through the host diagnostic. Rebinding and detach retire the
old request revision; cleanup removes only its own registration. A remount
retains the authored association intent. Target requests carry a borrowed
`isCurrent` check covering both view epochs, pair revision and exact members.

## Naming and input

Naming projects AccessKit `labelled_by` to the actual label node from the same
layout frame. It never copies caption text to the target. Explicit nonempty
names and labelledBy sources retain ownership and report a naming conflict,
without suppressing an independently requested activation. Content-derived
default names yield to this relation. Missing current frame bindings cannot
reuse an old node identifier.

An actionable label keeps its visible text semantic node, no Tab stop, and no
portable button role. Its explicit AccessKit Click action enters the target
callback. Native mouse activation requires an unmodified primary down/up,
the same current pair and view, no drag beyond six logical pixels, no cancelled
or default-prevented turn, and a known passive label subtree. This does not add
a Label keyboard activation path or cancel pointerdown/text selection.

GPUI does not expose the complete event path of arbitrary native slot views.
Consequently unknown `NativeSnapshot::native_view` content makes label pointer
activation unsupported and inert; its naming and explicit assistive action
remain available. Passive text and compiler-emitted passive content preserve
eligibility metadata through ordinary native factories. This is a conservative
host boundary, not a guess that an unknown native widget is passive.

GPUI ordinary text supports the native `none`/`auto` selection defaults. An
explicit `selection: text` still reports the missing selectable-content host;
it is not silently treated as `none`. Editable TextControl selection is a
separate owner and is unchanged.

The anatomy-descriptor branch and native touch gesture qualification are not
admitted by this lowering. A supplied anatomy descriptor is a compiler error,
not a silently ignored argument. These limits must not be reported as complete
platform or assistive-technology conformance.

## Executable evidence

The generated consumer compiles the actual Base Button and Label sources and
uses their real native entities, public exposes and AccessKit projector. It
checks direct/assistive activation parity, disabled behavior, exact pairing,
naming conflicts, duplicate and foreign-window rejection, reentrant retirement,
detach/remount, and mouse qualification. The producer emits every Rust component
and SDK file from source; generated Rust is not patched by the consumer.
