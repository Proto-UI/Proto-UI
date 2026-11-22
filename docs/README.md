# Retained design records and evidence

This directory preserves design discussions, implementation plans and source-bound evidence that existing Issues, catalog entities and coverage records reference. Public documentation is authored in [`apps/www`](../apps/www/README.md).

| Location | Purpose | How to use it |
| --- | --- | --- |
| [`superpowers/`](superpowers/README.md) | Earlier design and implementation records | Read the named source revision, decision context and any replacement notice. Follow applicable catalog entities for current semantics. |
| [`evidence/579-docs-content-flow/`](evidence/579-docs-content-flow/README.md) | Retained screenshots and geometry for Issue #579 | Use the original capture scope and measurements; these are historical review evidence, not current production screenshots or pixel baselines. |

## Place new documentation

Use the [documentation policy](../internal/governance/documentation-policy.md) to select the maintained source and reader entry. In particular:

- Protocol rules and lifecycle belong in the [`spec/` catalog](../spec/README.md).
- Public guides and examples belong in [`apps/www/src/content/docs/`](../apps/www/src/content/docs/).
- New dated engineering observations and plans belong in [`internal/records/`](../internal/records/README.md).
- Current repository and release process belongs in [`internal/governance/`](../internal/governance/).
- A package's usage and implementation map belong beside that package.

Keep retained paths and source bytes intact when they are evidence inputs. A historical checkbox or approved design label does not establish current implementation, release acceptance or a stable catalog guarantee. Check incoming catalog and coverage references before relocating a record; correct current guidance in its maintained source and link the historical context.
