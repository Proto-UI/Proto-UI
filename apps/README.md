# Applications

| Application | Responsibility | Start here |
| --- | --- | --- |
| `www` | Public documentation, localized reader guides, and runnable component demonstrations. | [Website guide](www/README.md), [content](www/src/content/docs/), [sidebar and locale configuration](www/astro.config.mjs). |
| `workspace` | Internal viewer for the semantic catalog and its generated dataset. | [Package commands](workspace/package.json) and [spec projection workflow](../spec/README.md#validation-and-projections). |

Public docs belong under `www/src/content/docs/`; the repository's root [docs/](../docs/README.md) retains other design and evidence sources. Change a generated dataset through its generator. A demo demonstrates its own consumer path and does not alone certify every package, host, or release condition.

See [documentation ownership](../internal/governance/documentation-policy.md) before adding a parallel guide or moving existing content.
