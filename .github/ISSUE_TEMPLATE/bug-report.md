---
name: Bug Report
about: Describe a suspected bug or symptom; reproduction and evidence can be added later
labels: [bug]
---

## Summary

<!-- Humans may describe the problem in plain language; images, artifacts and prompt disclosure are not required from you. Agents: supplement this item under internal/agent-operations/visual-evidence.md with a sanitized request paraphrase, uploaded subject-appropriate evidence and explicit debt. Upload guide: internal/agent-operations/github-evidence-upload.md. -->

What happened, and why does it appear incorrect?

**A plain-language symptom report is enough.** All fields below are optional for human reporters. You do not need to find the cause, reproduce it, provide images, or know a spec entity. An Agent following up owns investigation, reproduction and evidence under the Agent policy.

## Reproduction (optional)

If available, share a repository path, public package example, docs route, or steps you tried. It is fine if you cannot reproduce the symptom yet; an Agent can supplement it in an attributed follow-up.

1.
2.
3.

## Expected behavior

Describe the expected observable result. Link the applicable `P-*`, `C-*`, `T-*`, or other spec entity and criterion when known.

## Actual evidence (optional)

Share existing logs, screenshots, tests or comparisons only if convenient; none are required from you. An Agent investigating the report supplies real reproduction evidence and states its limits. Screenshots alone do not prove protocol claims.

## Suspected ownership

- [ ] Prototype implementation
- [ ] Design-language projection
- [ ] Adapter or Host Capability parity
- [ ] Runtime or Module
- [ ] Package export / CLI / generated facade
- [ ] Docs or Demo only
- [ ] Unknown

Explain why, if known. Do not patch a Prototype or page stylesheet merely to hide an Adapter-level problem.

## Environment

- Proto UI version or commit:
- Host / Adapter:
- Browser or runtime:
- Operating system:

## Scope and validation hints

What should remain unchanged, and what focused test or manual evidence would prevent regression?
