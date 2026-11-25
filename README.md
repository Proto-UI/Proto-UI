# Proto UI

**Proto UI is a framework-independent component interaction protocol and a toolchain for projecting the same prototype into different hosts.**

A Proto UI _prototype_ describes the identity and interaction semantics of a component. Adapters translate that protocol into React, Vue, Web Components, and, over time, other platforms. The goal is to make interaction logic explicit, testable, reusable, and portable across ecosystems.

English | [中文](README.zh-CN.md)

> **Status:** Proto UI is a v0 project. The exact `0.2.0` ecosystem release is available on npm under the stable `latest` channel. Stable publication on the 0.2 line does not imply a v1 compatibility promise; evaluate the current boundaries before production adoption.

## The core idea

Component implementations change across frameworks, but the interactive subject should remain recognizable. Proto UI separates those layers:

```text
Prototype protocol -> Adapter -> Host component instance
```

The prototype owns portable behavior and semantic identity. The Adapter owns translation into a host. Applications continue to compose and use the resulting components through their native framework.

This is deliberately different from inventing another application framework: Proto UI is intended to work with the stack you already have.

The [0.4 compiler foundation](internal/compiler/README.md) defines a future source compilation route:

```text
Prototype protocol -> Compiler -> Host component code
```

The stable `0.2.0` onboarding path is Adapter-based. The old private compiler is retired. The replacement specification targets React, GPUI, Vue 2, Vue 3 and Web Components; all five backends are currently unimplemented.

## Start with stable 0.2.0

The public onboarding flow uses npm `latest`. For this release, `@latest` resolves to `0.2.0`, and the CLI installs Adapter and Prototype packages at its own exact version so the ecosystem stays on one release train:

```sh
npx @proto.ui/cli@latest --help
npx @proto.ui/cli@latest init
npx @proto.ui/cli@latest add react shadcn-button
```

Run `init` and `add` from an existing application project. The CLI creates a local `proto-ui/` workspace, installs the matching official packages, writes style presets, and generates host-specific component facades.

Follow the complete [Quick Start](https://proto-ui.com/en/start-here/quick-start/) for generated paths, style imports, typed component usage, multiple hosts, and the current limitations. See the [v0.2.0 release](https://github.com/Proto-UI/Proto-UI/releases/tag/v0.2.0) for release evidence.

## Published stable baseline

- Official Adapters for **React**, **Vue**, and **Web Components**.
- A Base prototype library for reusable interaction protocols.
- A Shadcn-derived prototype library that layers a design-language surface over Base protocols.
- A [Brutalist prototype library](packages/prototypes/brutalist/README.md) with its own design-language projection and documented release scope.
- A Lucide-derived icon prototype library with per-icon import paths.
- A CLI for initialization, exact-version package installation, style generation, and host component facades.
- A machine-validated spec catalog connecting knowledge, decisions, contracts, prototypes, modules, host capabilities, conformance cases, and executable test paths.

## Current boundaries

- `0.2.0` is stable on the npm `latest` channel, but v0 APIs, generated structure, and protocol details may continue to evolve in later releases.
- The current CLI installs official Prototype packages and generates local component facades; it does not yet vendor styled prototype source into the application for direct editing.
- Shadcn compatibility is intentional but incomplete. Proto UI deliberately does not expose Radix-style `asChild` in the current model.
- The stable Adapter architecture carries a runtime. The compiler rebuild belongs to 0.4 scope and does not block 0.3 delivery.
- Documentation, real-project trial evidence, SSR coverage, accessibility validation, and bundle analysis are still being expanded.
- Most catalog entities are still `draft`; catalog presence should not be confused with a stable public guarantee.

Proto UI is currently best suited to experiments, controlled adoption, component-system research, and teams that can evaluate v0 compatibility boundaries.

## Project truth and documentation

Proto UI uses versioned entities under [`spec/**`](spec/) as its machine-governed source of truth. Entity lifecycle matters: `active` records a current stable guarantee, while `draft` records cataloged work in progress.

The older [`internal/contracts/**`](internal/contracts/) documents are being progressively superseded. They remain useful for explanation and for subjects that are not fully cataloged, but they do not override an applicable spec entity. Short-term direction and daily engineering history live under [`internal/records/**`](internal/records/) and are intentionally non-normative.

For contributors and Agents:

- [Agent repository guide](AGENTS.md)
- [Composable Agent skills](internal/agent-operations/contributor-agents.md)
- [Spec catalog guide](spec/README.md)
- Generated project understanding: run `corepack pnpm@10.32.1 spec:docs:agent`, then read the Git-ignored local file documented in [AGENTS.md](AGENTS.md)
- [Contributing guide](CONTRIBUTING.md)
- [Documentation policy and ownership](internal/governance/documentation-policy.md)
- [Release preparation entry point](RELEASE_CHECKLIST.md)

## Repository map

- [`spec/`](spec/): machine-governed project entities.
- [`packages/spec/`](packages/spec/): schema, validation, snapshots, and graph tooling.
- [`packages/core/`](packages/core/): core protocol syntax and primitives.
- [`packages/runtime/`](packages/runtime/): Adapter-era runtime and orchestration.
- [`packages/modules/`](packages/modules/): reusable semantic modules.
- [`packages/adapters/`](packages/adapters/): React, Vue 3, Vue 2, Web Component, and shared Adapter implementations. Vue 2 belongs to the 0.3 prerelease line, not stable 0.2.0.
- [`packages/prototypes/`](packages/prototypes/): Base, Shadcn, Brutalist, and Lucide libraries, plus separately labeled experimental families.
- [`packages/compiler/`](packages/compiler/README.md): private compiler availability boundary; the replacement contract and work sequence live in [`internal/compiler/`](internal/compiler/README.md).
- [`packages/cli/`](packages/cli/): project initialization, facade generation, and style tooling.
- [`apps/www/`](apps/www/): public documentation and demos.
- [`apps/workspace/`](apps/workspace/): internal spec workspace UI.
- [`internal/governance/`](internal/governance/): release and package governance.
- [`internal/releases/`](internal/releases/): release notes, BOMs, and evidence.

## Local development

Use Node.js 24, which is the current CI baseline. Use the pnpm version declared in `package.json`; it is aligned with the lockfile and CI.

```sh
corepack pnpm@10.32.1 install --frozen-lockfile
corepack pnpm@10.32.1 docs:dev
```

Common repository checks:

```sh
corepack pnpm@10.32.1 check:types
corepack pnpm@10.32.1 test
```

## Near-term direction

Repository development follows the [0.3 delivery plan](internal/governance/release-0.3-plan.md) and [source-bound delivery list](internal/governance/release-0.3-list.md). The committed libraries are Base, Shadcn, Brutalist and Lucide, together with their required website, CLI and shared implementation work. Other families remain WIP / Experimental. The plan owns dates, dependencies and acceptance boundaries.

The workspace currently prepares `0.3.0` under [draft `V-PROTO-UI-0012`](spec/versions/V-PROTO-UI-0012.yaml); this does not change the stable `0.2.0` install path or prove 0.3.0 publication. Compiler rebuilding and native-host development have their own documented scope and implementation boundaries.

Relevant dated records under [`internal/records/**`](internal/records/) explain engineering history and remaining work. Release commitments come from the governed plan, and stable guarantees from applicable spec entities and release evidence.

## Who may find it useful

- Component library and design system authors
- Frontend engineers focused on interaction quality
- HCI practitioners and researchers
- Adapter, compiler, and cross-platform tooling authors
- Contributors exploring foundational UI architecture

## Contributing and discussion

- **Website:** [proto-ui.com](https://proto-ui.com)
- **GitHub Issues:** [Proto-UI/Proto-UI](https://github.com/Proto-UI/Proto-UI/issues)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Discord:** [Join the community](https://discord.gg/MrWQd7h34R)
- **X:** [@Proto_UI](https://x.com/Proto_UI)
- **Bluesky:** [@proto-ui.com](https://bsky.app/profile/proto-ui.com)
- **Email:** guangliang2018@foxmail.com

Contributions to protocols, tests, Adapters, Prototype libraries, documentation, and consumer evidence are welcome.

Give this one line to your Agent to enter the contribution flow:

```text
Read AGENTS.md and enter through $pui-dev. Treat my current request as the bounded working scope, select and load one registered leaf at a time, and continue ready work through implementation, evidence, review response, and exact-head integration while live permission and repository conditions stay current. Use the local assessment to calibrate unattended scope. Pause only for an unresolved product-direction choice or a privileged or irreversible operation, and return exact evidence and limitations.
```

## License

MIT
