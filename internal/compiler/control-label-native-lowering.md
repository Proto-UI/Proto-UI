# Control Label source lowering and IR 6

The source regression was compiler coverage drift. The Button protocol added valid ControlLabel target participation that invokes its existing activation operation. The compiler independently rejected the public hook at import admission; weakening the Button definition would have hidden that missing implementation. Label and Toggle also exposed older, independent source-language gaps when the same real definitions were used as compiler consumers.

## Shared semantic boundary

The compiler admits `asControlLabel`, `label`, `target`, `sync`, the target request's `source`, and `isCurrent`. Both explicit instance refs and declared anatomy pairs remain generic operations. A component name, package path, DOM ancestor, text match, or target role does not select the implementation. The target callback retains its own disabled/controlled/focus and activation decisions.

The four implemented browser source profiles receive `instanceAssociations` independently of portable Props. React and Vue use that dedicated framework input; custom elements use an instance property and reject an attribute string or `setProps` transport. Association changes reach the host before an unchanged raw-Props snapshot can return early. Undeclared participants reject a non-null association without loading an unused ControlLabel helper.

Core, Runtime and independently generated graphs use the versioned same-realm opaque-ref and pair services. The generated host helper implements the capability directly and imports no Proto Runtime, Module, Prototype or Adapter. Native naming belongs to the target and composes with its existing accessible-name ownership. Foreign semantic objects are not reinterpreted as locally branded A11y handles.

Vue2 can attach its nonenumerable `__ob__` metadata to an otherwise valid association wrapper. A Vue2-only boundary discovers the actual framework's Observer constructor using its trusted `observable` function, verifies the observer's identity and back-reference, and removes only that internal metadata. The shared validator still rejects foreign keys, symbols, fake observer objects and forged refs. Reading `controlLabel` from the original wrapper preserves reactive tracking and accessor behavior.

## Checked source language and compatibility

IR 6 adds checked callable parameter signatures, per-call default expressions and conditional expressions. Helper callbacks must come from a statically checked body or another checked callable parameter, and their argument/result contracts are validated at both source and external-IR boundaries. These parameters support synchronous helper calls. Their borrowed callable identities cannot be captured by a registered callback or renderer, or escape through a returned function; aliases and wrapper helpers retain that restriction. Unknown host functions do not acquire callable authority. Defaults remain native JavaScript defaults; conditional expressions preserve branch evaluation. Neither becomes an emitted interpreter.

The parser also admits static public ControlLabel selection values, enum Props, closed-graph imported data declarations and the public `renderer.r.slot()` alias. Imported type files actually used by a checked signature participate in the source identity. Missing unused type-only imports remain erasable. Native resolved-Props types use conservative declaration/default-layer facts so strict generated types reflect proven non-null values rather than casts that suppress errors.

Input IR explicitly marked schema 5 is rejected. Old source should be recompiled to produce IR 6. Legacy event/control type labels may still be normalized by proven provenance inside a structurally valid current-schema input; that behavior is separate from schema compatibility.

## Reached support and project publication

A standalone program without reached ControlLabel operations emits no ControlLabel helper. For a project containing both participating and ordinary components, the publisher verifies canonical support bytes and chooses one shared reached capability closure. A component that did not reach the capability supplies no association getter and allocates no ControlLabel host owner. Modified support bytes still conflict; the publisher does not silently overwrite consumer edits.

Tests cover real Button, Toggle and Label definitions in all four browser profiles, strict complete generated graphs, ordinary framework imports, cross-output and mixed Runtime/generated pairing, callback/default signature rejection, anatomy declarations, conditional type integrity, helper omission, and mixed-project artifact collision controls. Executed command results belong in the accompanying source-bound repair record.

## Remaining explicit boundaries

GPUI explicitly rejects ControlLabel lowering, checked callback/default parameters and conditional expressions; these new IR forms have browser lowering and do not imply Rust support. Qt, Flutter and SSR registry profiles remain unimplemented; admission does not turn them into no-ops. ToggleGroup Root/Item already exceeded the compiler's checked language subset before this regression: array/record and capability mutation, queued callbacks, loops and dynamically obtained expose functions require independent language work. Their existing rejection remains visible and is not counted as compiled Group coverage. Runtime ToggleGroup behavior is a separate implementation and evidence path. The actual Input definition also remains rejected at its dynamic module requirements declaration; this change does not claim compiled Input coverage.

Parameter defaults are evaluated per call and checked in the caller phase. Their captured identities participate in the same imported-IR provenance checks as function bodies. Optional callable and execution-handle parameters without defaults, executable defaults inside callback signature metadata, and references to a current or later parameter in a default expression are explicitly unsupported in this bounded subset.

The existing private Web Component hydration experiment has an explicit `controlLabelHydration: 'client-only'` option. It emits the real browser host implementation and accepts the dedicated association property on the hydrated client. Server association inputs and anatomy-derived pairing are rejected; the server can render an unpaired declaration without transporting an opaque ref. The default direct SSR entry and all public SSR profile admission remain unsupported for ControlLabel. This option preserves the existing experimental Button SSR regression coverage and is not public SSR completion.
