# Contributing to Proto UI

Thanks for your interest in Proto UI. Contributions are welcome, and we value clear discussion before large changes.

If you are unsure, open an Issue first. You do not need to join [Discord](https://discord.gg/MrWQd7h34R) to contribute, but a quick heads-up there can help reviewers help you faster.

---

## Contribution paths

- **Adapters**: add or improve adapters for specific frameworks/platforms
- **Prototype libraries**: add headless prototypes or design-language prototypes
- **Docs**: API docs, tutorials, philosophy guides, or translations
- **Website**: docs site improvements and demo UX
- **Community**: issue triage, discussions, and contributor guidance

---

## Where to start

1. Open an Issue using a template
2. Discuss scope and constraints (Issue comments are enough)
3. Submit a PR

---

## Architectural expectations

- **Contracts first**: implementations should follow existing contracts. If behavior is unclear, propose updates or add contract tests.
- **Cross-adapter consistency**: prototypes should preserve interaction semantics across adapters.
- **API alignment**: design-language prototypes should mirror the official API shape where possible.

---

## Dependency policy

New dependencies are **discouraged** and must be **explicitly discussed** in an Issue before a PR. Dependencies are part of module design, so changes require review.

---

## Communication

- GitHub Issues are the primary entry point.
- [Discord](https://discord.gg/MrWQd7h34R) is available for quick syncs, but not required.
