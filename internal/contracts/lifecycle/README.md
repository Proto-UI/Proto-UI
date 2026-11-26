# Lifecycle Contracts

> Human-readable projections of `spec/contracts/C-LIFECYCLE-0001..0008.yaml`. Where wording differs, the spec catalog takes precedence.

## Documents

| Document | Scope |
| --- | --- |
| [component-lifecycle.v0.md](./component-lifecycle.v0.md) | Component-visible lifecycle timeline, callback ordering, execution domains, disposal, and error model. |
| [adapter-lifecycle.v0.md](./adapter-lifecycle.v0.md) | Adapter-side lifecycle responsibilities and host commit boundaries. |
| [exec-phase-guard.v0.md](./exec-phase-guard.v0.md) | Setup vs. runtime permission domain guard (`__sys.domain()`). |
| [module-resource-ownership.md](./module-resource-ownership.md) | Audited instance vs. view resource ownership matrix across runtime modules. |
| [view-intent-l1.md](./view-intent-l1.md) | L1 desired-view and adapter reconciliation model governed by `C-LIFECYCLE-0008`. |

Historical Chinese drafts remain under [`base-text/`](./base-text/) for reference only.
