---
title: 'Compatibility'
description: 'The reviewed Adapter profile slice and the limits of current compatibility evidence.'
---

Compatibility in Proto UI is recorded through Adapter profile entities and their typed relations to Modules, host capabilities, and executable evidence. This page reports the slice that has actually been reviewed; it is not an inferred feature matrix or an ecosystem roadmap.

## Official Adapter profiles

| Profile | Public package | Target | Framework range | Lifecycle |
| --- | --- | --- | --- | --- |
| `A-WEB-COMPONENT-0001` | `@proto.ui/adapter-web-component` | Web / Custom Elements | Platform APIs | `active` since 0.2.0-rc.7 |
| `A-REACT-18-19-0001` | `@proto.ui/adapter-react` | Web / React | `>=18.2.0 <20` | `active` since 0.2.0-rc.7 |
| `A-VUE-3-0001` | `@proto.ui/adapter-vue` | Web / Vue | `>=3.4.0 <4` | `active` since 0.2.0-rc.7 |

All three are official Web profiles. React and Vue provide cross-Adapter evidence across framework runtimes; they do **not** constitute multi-host evidence for native mobile, desktop, or server UI. No official profile for those hosts is currently cataloged.

## Reviewed common slice

Each current profile records required support for the same semantic Modules:

| Module entity         | Capability              |
| --------------------- | ----------------------- |
| `M-PROPS-0001`        | Props ingress           |
| `M-EVENT-0001`        | Semantic event binding  |
| `M-STATE-0001`        | Owned State projection  |
| `M-EXPOSE-0001`       | External expose surface |
| `M-EXPOSE-STATE-0001` | Exposed State           |
| `M-EXPOSE-EVENT-0001` | Exposed Event           |

Each profile also records translated provision of these host capabilities:

| Host capability entity        | Host-facing responsibility          |
| ----------------------------- | ----------------------------------- |
| `HC-PROPS-SOURCE-0001`        | Supply Props values and presence    |
| `HC-EVENT-BINDING-0001`       | Bind host events to semantic events |
| `HC-DEFAULT-ACTION-0001`      | Represent default-action control    |
| `HC-EXPOSES-RECORD-SINK-0001` | Receive the exposed record          |
| `HC-EXPOSE-EVENT-SINK-0001`   | Receive exposed events              |

This means the listed slice has been reviewed positively for all three profiles. It does **not** mean every Module package or every Core capability has been classified. The profiles currently contain no `omits` relations: an unlisted Module is **uncataloged**, not implicitly supported, unsupported, or deferred.

## Evidence and interpretation

`D-ADAPTER-PROFILE-0001` governs how a partial profile must be read. `T-ADAPTER-PROFILE-0001` verifies profile schema and graph integrity, while the profiles point to executable conformance entities for the Props, Event, Lifecycle, State, and Expose slices.

Use these labels precisely:

- **Cataloged support:** a reviewed `supports.modules` relation with a role.
- **Cataloged omission:** a reviewed `omits.modules` relation with a reason. None are recorded in the current three profiles.
- **Uncataloged:** no support or omission decision has been made in the profile.
- **No official profile:** the catalog has no official Adapter identity for that host.

Package availability and entity lifecycle are separate. Proto UI 0.2.0 is a published stable ecosystem release (`V-PROTO-UI-0008`), while the current workspace can contain later draft entities and the draft 0.3.0-alpha.0 train. Always combine the release identity, profile lifecycle, exact relations, and executable evidence before making a compatibility claim.

For the underlying protocol model, read [Core](/en/specifications/core/). For implementation and contribution paths, continue to [Build / Contribute](/en/build/contribute/).
