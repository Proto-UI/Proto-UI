# Portable pointer facts: private IR compatibility and admission

This implementation note follows the draft criteria `C-EVENT-0002-L`,
`C-EVENT-TYPE-0003-F/G/H` and `M-EVENT-0001-L`. It is neither a second
normative definition nor a claim of executed conformance. The new v4 candidate
was reconstructed after the original unpublished source became unavailable;
previous execution results do not certify these bytes.

## Public data and private authority

The six pointer semantic samples expose only finite `pointerType` and
`pointerButtons` values. The Web host mapping independently accepts exact
mouse/touch/pen and finite nonnegative integral buttons, never a guessed mouse
or no-buttons fallback. Other semantic samples omit both fields. The shared
native helper supplies the reached Web emitters; it is an atomic host boundary,
not a Select protocol or emitted IR interpreter. No component name/path selects
its mapping.

Private IR version remains **5**. `event` denotes the portable payload;
`event-control` denotes its synchronous default-action capability. The
`event-or-control` result join carries identity only: it has no members or
operations. Only positive strict identity against a proven payload/control
narrows an immutable lexical reference; inequality, truthiness, equality with
itself and an unproven label confer no authority. Ordinary data unions and
other capability rules are not widened.

Historical IR5 producers labelled `event.control`, aliases and helper returns
as `event`. The validator derives the current type from actual bound provenance
and validated bodies, allowing that historical label to narrow to control or
the inert join. It does not interpret a supplied label as proof of payload
fields. Reachable return alternatives determine helper results; unreachable
syntax is still validated but cannot widen the reachable result. Input objects
are not mutated. Canonical input retains object identity; a necessary legacy
normalization uses a descriptor-value copy preserving shared references.

The entire graph is checked before semantic reads or copying: proxies,
accessors, functions, symbols, foreign prototypes, sparse/custom arrays and
cycles are rejected. Expression and statement fields must fit their exact
kind; a literal cannot hide ignored `handle` or `function` content. This guards
against normalization invoking an accessor hidden outside the semantic walk.
Synthetic old-label unit mutations are not real producer provenance. The
separate compatibility gate must execute the actual fixed old parser, bind its
outputs, and replay them through this consumer; no hand-authored legacy IR may
be represented as that evidence.

## Consumers and explicit boundaries

- React Runtime-backed emission uses the existing public callback/control
  types. Four browser source emitters use their ordinary native carrier types;
  control aliases lower directly to the live capability's method.
- GPUI's canonical registry rejects the new alias operation and new pointer
  reads; no GPUI owner/source changes are made. Its historical generic control
  member carrier limitation is not repaired or disguised.
- Admission follows the output closure of the target. Targets that omit dead
  helper declarations use helper/alias/callback/authored-hook reachability.
  Qt/Flutter also check declarations they still emit, as detailed below.
  This is not proof that emitted Qt/Dart builds; native compile/runtime evidence
  remains separate.
- Qt/Flutter public registry profiles remain unimplemented. Their callable
  direct emitters also reject the new pointer/alias slice rather than silently
  emitting missing fields. Safe old identity reads and original direct
  prevention are retained. Flutter's actual `NativeInput.control => this`
  carrier is preserved, not replaced with a Web-shaped object.
- The four SSR registry profiles remain unimplemented. Their direct `ssr`
  emitters reject only the new pointer/alias slice; this does not remove old
  direct prevention or identity behavior, or claim SSR implementation.

New execution must cover parser/IR safety and compatibility, all applicable
consumer entry points, four full emitted dependency graphs under strict typing,
four real Runtime author callbacks, same-baseline regressions and actual
supported browser journeys. Emission success is not generated-graph type
success, native runtime proof or production acceptance. Existing Vue2 strict
failures must remain visible and compared, never filtered or bypassed.

### Direct native declaration boundary

Qt and Flutter currently print local helper declarations and authored hooks even
when their bodies are not called. Their new-facts admission therefore checks
that emitted declaration closure, stopping at terminal returns just as their emitters do.
It rejects unsupported pointer members/control-alias requests there instead of
producing a missing NativeInput getter. Targets that actually omit dead helper
declarations retain reached-only checks. This is a narrow new-capability gate,
not a claim that Qt/Dart dead-code lowering or native conformance is complete.
