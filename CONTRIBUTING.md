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

## Contribution license

Proto UI is currently licensed under the [MIT License](./LICENSE). You retain the copyright in contributions you create. By submitting a contribution, you represent that you have the right to provide it under the repository's current license. This policy does not require a copyright assignment.

Third-party material remains subject to its original license, attribution, notice, and other applicable requirements. Your contribution must identify and preserve those obligations.

---

## Developer Certificate of Origin

All new contributions, including documentation and small changes, must comply with the [Developer Certificate of Origin 1.1](./DCO.md). The DCO applies to commits: every human-authored commit entering a pull request must contain a valid sign-off trailer. A pull request checkbox or comment does not replace commit sign-off, and the configured DCO GitHub App is the authoritative automated merge check.

Create a signed-off commit with:

```bash
git commit --signoff -m "feat: describe the change"
```

To sign off the latest existing commit:

```bash
git commit --amend --signoff --no-edit
git push --force-with-lease
```

To sign off multiple local commits that are not on `origin/main`:

```bash
git fetch origin
git rebase --signoff origin/main
git push --force-with-lease
```

A valid trailer has this form:

```text
Signed-off-by: Contributor Name <email@example.com>
```

The name and email must represent the person making the certification. A DCO sign-off is different from a cryptographic GPG or SSH commit signature. Do not copy another person's `Signed-off-by` trailer, and expect maintainers to ask you to amend your own commits rather than signing on your behalf.

As an optional local convenience, you can define a repository or user-level alias yourself:

```bash
git config alias.cs "commit --signoff"
git cs -m "feat: describe the change"
```

Proto UI does not install hooks or change contributor Git configuration to add sign-offs automatically. The sign-off must be an intentional statement by the contributor.

This policy applies to contributions first submitted on or after August 2, 2026. It does not require contributors to rewrite commits that were already merged before that date.

---

## Contribution provenance

Read the [contribution provenance policy](./internal/governance/contribution-provenance.md) before opening a pull request. Disclose material that was copied, adapted, generated, or otherwise constrained, including:

- code copied or rewritten from another project;
- third-party design systems that were referenced or ported;
- external images, icons, fonts, test data, and documentation;
- substantial AI-generated or AI-transformed content; and
- contributions that an employer or client may own or restrict.

Disclosure helps reviewers verify rights and required attribution; it does not by itself establish that material may be submitted. If provenance cannot be confirmed, maintainers may pause the review, request evidence, or require the material to be removed.

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
