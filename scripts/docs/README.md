# Public documentation drift checks

Run the deterministic, offline gate from the repository root:

```sh
corepack pnpm@10.32.1 check:public-docs
```

The check derives the current stable release from the newest active `stable` entity under `spec/versions/**` and follows that entity's `package-bom.json` source. It also reads the current workspace version from `VERSION`, so available draft families receive navigation coverage before the next stable publication. It does not own a version constant and does not contact npm or GitHub.

It validates four projections:

- every literal primary sidebar slug in `apps/www/astro.config.mjs` resolves in both `en` and `zh-cn`;
- README and primary routes do not recommend a prerelease as the current install/release; explicit draft workspace availability, unavailable-export evidence, and archived routes retain their distinct meanings;
- package exports from Base, Shadcn, Brutalist, and Lucide packages are classified against catalog lifecycle and availability in the stable release or current workspace, with direct sidebar detail routes or an explicitly reasoned shared overview;
- primary routes do not expose configured authoring markers such as `写作提示` or `Coming soon`.

## Intentional changes and exceptions

Update `scripts/docs/public-doc-policy.mjs` in the same review as the route or package change. Every exception must identify one exact export or route and include a durable reason.

- A new component-family export normally needs a matching catalog root entity, a bilingual detail route, and a primary sidebar slug. Its catalog `since` and removal versions determine availability in the governed stable release or current workspace. Direct route checks do not depend on the retired `PrototypeLibraryOverview.astro` component.
- Use a library's `familyRoutes` mapping when a family's real detail route differs from its default route prefix; for example, Brutalist Form uses `ui-libraries/brutalist/form`.
- A helper, behavior, preset, theme, manifest, or aggregate export belongs in `exportClassifications` with `kind: 'non-component'` and a reason.
- A deliberately searchable or generated family such as Lucide may use `kind: 'overview-only'`, but must name the shared catalog entity and explain why one page represents the family.
- A localized route fallback belongs in `navigation.fallbacks` with the exact locale/slug and a reason.
- A historical release route belongs in `release.archivedRoutes` with its locales and a reason. Do not add a global prerelease-string ignore: current pages may still discuss historical releases when the wording is explicitly historical.
- A deliberate scaffolding phrase belongs in `scaffolding.exceptions` with an exact locale, slug, marker, and reason. Prefer replacing public scaffolding whenever possible.

The Base, Shadcn and Brutalist entry pages use `PrototypeDocumentationIndex.astro` to derive reader links from the current package exports, the existing policy classifications/aliases, and the localized documentation collection. Missing public guides remain explicit protocol-source links and Usage/host evidence gaps. This projection does not supply a second catalog or replace the direct detail-route gate; a source-only link cannot satisfy a required sidebar route. Lucide retains its existing searchable gallery, direct interaction owners and source-bound evidence.

Focused fixtures live under `scripts/docs/test/fixtures`; run them with:

```sh
corepack pnpm@10.32.1 test:public-docs
```

Failures name the affected file/export, the governed release or catalog source, and the expected remediation so CI output can be acted on without reproducing a live registry check.

## Current release website inventory and reading regressions

Enumerate the current bilingual release routes and authored Preview/host cells:

```sh
node scripts/docs/release-website-inventory.mjs --check --out /tmp/release-website-inventory.json
node --test scripts/docs/test/release-website-inventory.test.mjs
```

The inventory derives exported families from the same policy and package manifests as the public-documentation gate. It parses MDX elements instead of counting example text inside code fences or comments. Missing routes, unsupported hosts and dynamic Preview identity/host expressions remain explicit errors. Each row retains its source path; the report binds input bytes, policy, generator and checkout revision. Lucide's generated icon exports retain their shared protocol overview. `codePanel` describes the authored permission for a Preview code panel; automatic source-map resolution and meaningful Usage acceptance still require actual rendering and review.

Every evidence field starts as `not-run`. The current inventory does not replace #1042's historical 518 routes/5,784 cells, #1141's retained Dropdown anatomy evidence or #1175's original Camoufox R5 driver/archive and matrix. A source count is not browser, package-installation, real-application, physical-device or assistive-technology acceptance.

The focused current-source reading regression uses actual public Base Button, Shadcn Button and Shadcn Dialog pages:

```sh
PROTO_UI_RUNTIME_EVIDENCE_DIR=/tmp/release-website-evidence \
corepack pnpm@10.32.1 exec vitest run apps/www/test/release-docs-reading.browser.test.ts \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Its 24 separately terminal cases cover both locales, 320/390/1280 CSS-pixel viewport profiles, no-JavaScript source and command reading, the four declared Preview/Usage hosts, a separately labelled 200% CSS-text scenario, keyboard expansion, actual document navigation and an explicit Astro owner lifecycle probe. The suite retains JSON, source hashes and screenshots on success and failure. It uses the shared source server and keeps Chromium's sandbox enabled. Supply `CHROME_PATH` when the standard browser path is unavailable; environment launch failures remain failures. Captures still need visual review. This bounded regression does not complete the historical route matrices or replace installed consumer and real assistive-technology results.
