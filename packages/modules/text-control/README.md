# @proto.ui/module-text-control

Portable host-mediated single-line and multiline text-control protocol for Proto UI adapters and prototypes.

## Purpose

Owns the host boundary for a semantic plain-text, line-mode-aware, host-owned editing requirement: stable controlled or uncontrolled value ownership, normalized input/change/IME composition events, live property projection, and physical focus access. Adapters select the physical host editor; the current Web profile resolves single-line declarations to `HTMLInputElement` and multiline declarations to `HTMLTextAreaElement`. The module does not own labels, form submission, validation messages, rich text, auto-resize policy, system selection handles, or edit menus.

## Package role

Adapter-facing dependency used by Base Textarea, the admitted Base Input prerequisite path, and official Web Component, React, and Vue adapters. Host integrations provide a `TextControlHost`; Web hosts can use `resolveWebTextControlLocalName` and `createWebTextControlHost`. The three current adapters are one Web-host profile, not multi-host conformance.

## Install

`0.2.0-rc.7` is published for reproducible prerelease trials. The stable `0.2.0` package is under review and is not installable until publication completes.

```bash
npm install @proto.ui/module-text-control@0.3.0-alpha.0
```

## Main exports

- `declareTextControl`
- `createTextControlModule`
- `createWebTextControlHost`
- `TEXT_CONTROL_HOST_CAP`
- `TEXT_CONTROL_RUN_IN_CALLBACK_CAP`
- `TextControlFacade`, `TextControlHost`, `TextControlPatch`, and normalized event types

## Related packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/prototypes-base`
- `@proto.ui/types`

## License

MIT
