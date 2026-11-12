# Documentation callers and portable inputs

Date: 2026-11-12. Scope: the two authored-caller findings in the current #1042 documentation candidate. This is a non-normative repair record, not whole-Issue or release acceptance.

## Authority and repair

`P-SHADCN-BUTTON` remains draft. Its inherited Base activation and disabled behavior, six declared variants, five sizes including the Proto `icon-compact` extension, and explicit Rhea presentation selection remain the existing direction. `C-PROPS-0009` governs invalid and empty input fallback; an empty string is not a boolean `true`. The active Web Component profile, `A-WEB-COMPONENT-0001`, separates a configured `getProps` source from the existing public `setElementProps` input channel. The normal CLI facade does not install an attribute classifier for these Button inputs.

The authored Shadcn WC snippets now deliver their intended `styleProfile`, `variant`, `size` and boolean `disabled` values through `setElementProps`. Their ordinary module scripts import the public Adapter entrypoint; the existing complete-file wrapper still supplies the public CLI facade and application styles. The examples retain their controls, nested content, glyph labels, Ghost listeners and activation counters. Both Vue hosts now bind disabled values as `:disabled="true"`, using the same existing facade inputs rather than relying on bare HTML attributes. React callers and the previously repaired Base examples are retained.

`P-LUCIDE-ICON` also remains draft. Its fixed-glyph input is named `strokeWidth`, and the existing Vue Adapters preserve the keys of undeclared attributes. Both authored Vue Check examples now bind `:strokeWidth="2"`. The public factories, 18px size, decorative container and Saved composition are retained. The WC registration repair is retained. No Core, Adapter, Prototype, public API, coercion rule or CLI production implementation changes are part of this repair.

The retained WC capture shows Saved on the next line beneath the glyph. Both localized guides now describe the check with Saved and explicitly assign their layout to the application. This clarifies the observed composition without adding an inline-layout guarantee or changing any component payload.

`buttonCode.ts` was regenerated from `authored-code.ts` through the existing bounded `generate-code --folder button` producer. It was not edited by hand. The earlier authored, generated and Lucide module bytes and their receipts remain preserved privately with the repair evidence.

## Evidence boundary

The independent review established the two defects from the actual caller-to-facade-to-Props chains. Earlier Base and Lucide native passes remain evidence for their exact consumed payloads, package identities and observed behavior. In particular, a 2px Lucide rendering can match the protocol default even when an input was ignored; those old observations do not establish delivery of the repaired Vue input.

Parent validation must bind the new source and affected payloads, exercise the changed Vue icon callers and the real complete Shadcn application files, and inspect the resulting captures. A separate ordinary Vue consumer derived from the displayed file must supply a positive nondefault `strokeWidth` and observe the actual SVG projection, while the unchanged 2px display assertions remain separate. Shadcn verification must include Ghost enabled activation exactly once and disabled activation zero, all six variants, all five sizes, and the existing glyph/name ownership. Preserving the same retained candidate package archives does not execute those callers.

No tests, type checks, formatters, builds, installs, browser/native consumers or stable npm/pnpm cells were executed by this source-repair worker. Only the explicitly authorized normal code generator was run. All six stable 0.2.0 cells remain unrun. Parent owns serial validation, independent review, integration and tracking. The seven original #1042 conditions, 518 historical route rows, 5784 historical cells, remaining profiles, visual and AT breadth, Copy #1438 and Search #1435 obligations remain open to their actual evidence and owners.

## R5: sparse classification type

Parent's R4 handoff validation, five syntax checks, five authored format checks and public-docs gate passed; the latter covered 291 primary routes and four library inventories. The actual full `check:types:docs` run, `bg_9`, exited 1 after 322.21 seconds: 1219 files, one error, zero warnings and 30 hints. Its sole error was TS2322 at `apps/www/src/components/PrototypeDocumentationIndex.astro:21`. The worker accepted that observed failure without replaying the check.

`publicDocPolicy.libraries` supplies sparse, reasoned export-classification dictionaries. Ordinary component-family exports intentionally have no classification, while each library lists only its explicit root or non-component exceptions. TypeScript represents keys absent from individual members of that inferred union as optional values that can be undefined. The index had incorrectly annotated the selected dictionary as a total string-indexed record of classification objects.

R5 changes only that annotation to a readonly partial record, allowing an absent indexed classification. The dictionaries, package-export enumeration, existing falsy-classification filter, aliases, document lookup, labels, links and rendering are retained. No cast, non-null assertion, suppression or synthetic classification is introduced. The actual public-docs inventory consumer uses the same optional lookup and fallthrough.

This source-only type repair changes no Button or Lucide producer input or displayed payload, so the generator was not rerun. R4 source/preparation review and passed checks remain historical evidence for their original source. R5 has a separate source and consumer-preparation admission; the same 47 archives, genuine 43-package consumer identity requirements, 37 native oracles and six stable lanes are retained. No worker check, test, formatter, build, install, browser/native or Git operation was run for R5. Parent owns the single changed docs-type rerun and its actual outcome; no new pass is claimed here.
