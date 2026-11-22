# Shared repository data

[`links.json`](links.json) owns the project's shared website, repository and community destinations. It is read directly by [`SocialIcons.astro`](../apps/www/src/components/override/SocialIcons.astro), and [`scripts/sync-shared-links.mjs`](../scripts/sync-shared-links.mjs) projects selected links into the bilingual READMEs, contribution guide and FAQs.

After changing a destination, run from the repository root:

```sh
corepack pnpm@10.32.1 sync:links
```

Review the resulting diff and the affected website links. The synchronizer updates only its explicit target patterns; it is not a repository-wide link rewrite or a network-availability check.

Use this directory for small data inputs shared by repository surfaces. Protocol definitions belong in the [`spec/` catalog](../spec/README.md), public type definitions in [`packages/types/`](../packages/types/README.md), and runtime helpers in the package that owns them. See the [documentation policy](../internal/governance/documentation-policy.md).
