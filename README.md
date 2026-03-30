# Proto UI

**Proto UI is a Human–Computer Interaction (HCI) protocol and a component generator for any framework or platform.**

It describes interaction logic as a protocol-level model (a _prototype_), then maps that model to concrete components in different technologies. The goal is to make interaction logic explicit, stable, and reusable across ecosystems.

English | [中文](README.zh-CN.md)

---

## Why now

We already have too many frameworks, yet their component logic is largely the same. Proto UI collects that shared interaction logic as a reusable asset, so components can be generated across React, Vue, Web Components, and beyond without re-inventing the interaction model each time.

---

## What Proto UI is **not**

- **Not production-ready yet.** It is usable, but not stable enough for critical production workloads. It is suitable for demos, experiments, and small real projects where you accept risk.
- **Not a new framework.** Proto UI does not ask you to abandon your existing stack. It generates components for your stack and aims to add **zero runtime dependency** in v1.

---

## How it works (short version)

Proto UI supports two paths:

- **Adapter (v0):** `Prototype -> Adapter -> Component Instance`
- **Compiler (v1):** `Prototype -> Compiler -> Component Code`

Adapters are already usable and help validate feasibility. Compilers will provide the same semantics with zero runtime overhead.

---

## What you can do today

- Use **React / Vue / Web Components** adapters to generate native component instances from the same prototype.
- Build and test cross-framework demos with consistent interaction logic.
- Explore ideas like Headless UI on Web Components or cross-technology design systems.

---

## Current stage and roadmap

- **v0 (now):** Validate the protocol and build adapters for major Web technologies. Research adapters for non-Web tech (e.g., Flutter).
- **v1 (next):** Shift to compiler-first output, ensure zero runtime overhead, and extend support to non-Web platforms.

The architecture is stable enough to move from v0 to v1 without destructive rewrites.

---

## Where to look in this repo

- **Contracts (like RFCs):** `/internal/contracts`
- **Adapters:** `/packages/adapters`
- **Prototype libraries (planned):** `/packages/prototypes`
- **Docs / website content:** `/apps/www/src/content`

---

## Who should care

- Component library authors
- Frontend engineers who care about interaction quality
- HCI practitioners and researchers
- Design system maintainers and UED teams
- Students who want to explore foundational UI work

---

## Contributing and discussion

- **Website:** [proto-ui.com](https://proto-ui.com) (docs and demos are in preparation)
- **Issues:** GitHub Issues are the main entry point for contributions.
- **Start contributing:** see `CONTRIBUTING.md` and the issue templates.
- **Discord:** [Join the community](https://discord.gg/MrWQd7h34R)
- **Email:** guangliang2018@foxmail.com

If you want to help with adapters, prototypes, docs, or community building, we would love to talk.

---

## License

MIT
