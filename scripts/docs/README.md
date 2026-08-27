# Public documentation drift checks

Run the deterministic, offline gate from the repository root:

```sh
corepack pnpm@10.32.1 check:public-docs
```

The check derives the current stable release from the newest active `stable` entity under `spec/versions/**` and follows that entity's `package-bom.json` source. It does not own a version constant and does not contact npm or GitHub.

It validates four projections:

- every literal primary sidebar slug in `apps/www/astro.config.mjs` resolves in both `en` and `zh-cn`;
- README and primary routes do not present a prerelease from the current stable line as the current install/release, while explicitly archived routes remain readable;
- package exports from released Base, Shadcn, Brutalist, and Lucide packages are classified against catalog lifecycle, overview inventory, and sidebar detail routes;
- primary routes do not expose configured authoring markers such as `写作提示` or `Coming soon`.

## Intentional changes and exceptions

Update `scripts/docs/public-doc-policy.mjs` in the same review as the route or package change. Every exception must identify one exact export or route and include a durable reason.

- A new component-family export normally needs a matching catalog root entity, an entry in `PrototypeLibraryOverview.astro`, a bilingual detail route, and a primary sidebar slug. Its catalog `since` version determines when stable-release coverage begins.
- A helper, behavior, preset, theme, manifest, or aggregate export belongs in `exportClassifications` with `kind: 'non-component'` and a reason.
- A deliberately searchable or generated family such as Lucide may use `kind: 'overview-only'`, but must name the shared catalog entity and explain why one page represents the family.
- A localized route fallback belongs in `navigation.fallbacks` with the exact locale/slug and a reason.
- A historical release route belongs in `release.archivedRoutes` with its locales and a reason. Do not add a global prerelease-string ignore: current pages may still discuss historical releases when the wording is explicitly historical.
- A deliberate scaffolding phrase belongs in `scaffolding.exceptions` with an exact locale, slug, marker, and reason. Prefer replacing public scaffolding whenever possible.

Focused fixtures live under `scripts/docs/test/fixtures`; run them with:

```sh
corepack pnpm@10.32.1 test:public-docs
```

Failures name the affected file/export, the governed release or catalog source, and the expected remediation so CI output can be acted on without reproducing a live registry check.
