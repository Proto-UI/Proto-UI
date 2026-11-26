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

### Sprint 3 dispatch evidence

`.github/workflows/sprint3-consumer-evidence.yml` is dispatch-only and checks out exactly `github.sha`. It uses Node 24, frozen pnpm dependencies, an identified Chromium executable and one serial runner. `scripts/test/sprint3-consumer-evidence.mjs` owns the complete suite inventory: component fixtures, generated/runtime Transition, four native Focus suites, reading, public Tooltip, Button, Select, Spinner and Scroll Area. The existing whitepaper workflow and required regression workflows retain their separate scope.

The runner first executes independent fixtures, then builds the production website once and serves those exact emitted files from its own loopback listener. A file failure does not prevent later independent files from running. Missing prerequisites, cancellation, resource deadlines, missing JSON, a changed case count, skipped/todo cases and source drift all remain non-passing results. Process deadlines do not alter the suites' interaction assertions. The workflow always uploads the full planned inventory, per-suite Vitest JSON/logs, native capture files that the suite produces, source/lock hashes, build manifest and server request log. Internal Focus retry suites retain native state/assertion evidence; a suite without screenshots is recorded explicitly and receives no visual-acceptance claim.

Finalization compares current captures, Vitest reports, logs and source receipts with the immutable hashes recorded at execution. Changed/missing artifacts, symlinks and read/write failures turn the saved outcome into a failure while preserving the original execution status and all readable observations. Output-directory validation resolves existing symlink ancestors before creating new directories; an external alias cannot write into an ignored source-checkout directory.

For a local reproduction on a sandbox-capable Linux browser host, install the declared dependencies, set `CHROME_PATH`, bind `CANDIDATE_SHA` to the clean checkout and set `SPRINT3_EVIDENCE_DIR` to a fresh directory outside the repository. Run `node scripts/test/sprint3-consumer-evidence.mjs init`, then `run`, and finally `finalize` even when `run` fails. Each attempt needs a new directory; an old failed receipt is never overwritten. A green bounded dispatch still does not establish installed Shenko/OpenGreendam/Verdant application acceptance, historical Camoufox results, physical-device/OS assistive-technology acceptance, non-Web completion, or the full release cycle.

## Internal documentation hygiene and readability checks

Run the deterministic, offline internal-docs gate from the repository root:

```sh
corepack pnpm@10.32.1 check:internal-docs
node scripts/docs/check-internal-docs.mjs --warnings --files <path>
node --test scripts/docs/test/check-internal-docs.test.mjs
```

`scripts/docs/check-internal-docs.mjs` enforces the [internal engineering writing guide](../../internal/governance/engineering-writing-guide.md) across `internal/**`:

- **Hygiene & size**: bans binary screenshots/media/archives/raw logs under `internal/**`, enforces JSON/Markdown size budgets, and checks single-H1 discipline.
- **Prose readability (AST)**: parses Markdown via `mdast` to detect wall-of-text paragraphs, inline-code path stuffing, repeated per-paragraph defensive disclaimers, stacked negative clauses, long unbroken prose runs, and oversized table cells.
- **Legacy debt ratchet**: grandfathers existing violations in `internal/baselines/internal-docs-debt.json` (regenerated via `corepack pnpm@10.32.1 check:internal-docs:baseline` after cleanup) so new or modified internal docs cannot add debt.
- **Advisory English prose linting (Vale)**: executes `.vale/styles/ProtoUI/*.yml` rules locally in Node (warnings only) and natively via `errata-ai/vale-action@v2` in CI (`internal-docs-lint`).

## Repository documentation references

`check:public-docs` also runs the repository reference check. To inspect it independently:

```sh
corepack pnpm@10.32.1 check:repository-docs
node scripts/docs/check-repository-docs.mjs --json
```

The checker uses the existing Markdown parser to inspect actual links, images and reference links in maintained repository prose. Code examples are not interpreted as links. Relative targets must exist and remain inside the repository, including after symlink resolution. It checks directory entrypoints and static `pnpm` script invocations against the relevant package manifest, including package-local commands, exact package filters and `--dir`/`-C` selectors. It also checks the existing generator/command boundary for the Git-ignored Agent projection.

For static command checking, an unqualified command starts in the nearest package containing the document; a shell fence can change directory with a literal `cd`. In package-local documentation, encode a root command with `-w` or an explicit selector even when prose also explains its working directory. This makes the command independently usable without asking the checker to infer shell context from natural language.

Command classification follows the pinned pnpm 10.32.1 dispatch in `dist/pnpm.cjs`: its native command registry, first-argument npm forwarding table and script aliases. For example, `pnpm root` does not require a package script; an explicit `run root` invocation does. Native npm forwarding such as `pnpm view --help` applies only when the forwarded command is the first pnpm argument. The script aliases `pnpm t` and `pnpm tst` check `scripts.test` in the selected package; an explicit `run t` or `run-script t` invocation checks `scripts.t`.

For deterministic documentation checks, write executable tools as `pnpm exec <tool>`. Bare executable shorthand is valid pnpm syntax, but this checker does not resolve the installed binary environment. An undeclared bare command therefore fails with both explicit `run` and `exec` remedies instead of being reported as a nonexistent executable. A misspelled or removed script still fails; explicitly selecting `run` never receives a native-command exemption.

`repository-doc-policy.mjs` declares the required entrypoints and bounded exceptions with reasons. New Markdown defaults to maintained. Dated records, retained planning documents, test inputs and evidence retain their original context; maintained directory indexes remain checked. Release directories are frozen only when their version has an active V entity under `spec/versions/`; draft release notes remain maintained. The JSON report enumerates every classified document, excluded scope and recognized command context outside the static subset. `skippedCommands` counts only recognized `pnpm`/`cd` fragments; it does not inventory arbitrary shell syntax such as environment assignments before a command. A zero count does not certify every shell example.

This is a reference-integrity check, not proof of semantic freshness. It does not fetch external URLs, resolve website routes as filesystem paths, validate heading fragments or execute dynamic shell examples. Website routes remain covered by the public gate and site build; semantic ownership and lifecycle review follow [the documentation policy](../../internal/governance/documentation-policy.md).
