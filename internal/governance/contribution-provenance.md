# Contribution provenance policy

This policy defines the source information that contributors must provide and the review steps maintainers use when contribution rights are unclear. It applies to contributions first submitted on or after August 2, 2026. It does not require rewriting Git history that was already merged before that date.

The [Developer Certificate of Origin 1.1](../../DCO.md) applies to every human-authored commit in a pull request. Each commit requires either its own valid `Signed-off-by` trailer or an individual remediation from that commit's original author as described below. The signer remains responsible for the submitted content. Provenance disclosure supplements the DCO; it does not replace sign-off or prove that material may be submitted.

## Individual DCO remediation

Contributors should normally add `Signed-off-by` while creating each commit, for example with `git commit -s`. When an open pull request already contains an unsigned commit, the commit's original author may add an individual remediation commit instead of rewriting published history. This preserves existing commit identities and cryptographic signatures while leaving an auditable certification in the pull request.

An individual remediation commit must:

- be authored by the same name and email as the unsigned commit;
- identify every remediated commit by its full commit SHA using the exact form required by the DCO App;
- contain a matching `Signed-off-by` trailer for the remediation commit itself; and
- remediate only commits authored by that signer.

Use one certification line per unsigned commit, followed by the remediation commit's own trailer:

```text
I, Example Author <author@example.com>, hereby add my Signed-off-by to this commit: FULL_COMMIT_SHA

Signed-off-by: Example Author <author@example.com>
```

Third-party remediation remains disabled. A maintainer must not sign on behalf of another contributor, copy another contributor's trailer, or use the DCO override button as a substitute for author certification. Individual remediation is a recovery mechanism for published history, not the default contribution workflow.

## Original contributions

For an original contribution, the contributor states that they created the material and have the right to submit it under Proto UI's current [MIT License](../../LICENSE). The contributor retains copyright in their original work; Proto UI does not require copyright assignment.

## Derived or ported contributions

For copied, adapted, translated, generated-from, or ported material, record enough information for a reviewer to locate and evaluate the actual source:

- upstream project or source name;
- exact source location, such as a repository URL and file path;
- upstream release, version, or commit;
- upstream license;
- the scope copied, transformed, or referenced;
- the scope of the changes made for Proto UI; and
- required `NOTICE`, attribution, or license copies.

Saying only that a contribution was "inspired by" or "referenced" another project is not sufficient when implementation or assets were derived from it. If multiple sources were used, identify each source separately.

## Third-party design systems

For Shadcn, Brutalist, Lucide, or any other design language, component system, or resource collection, distinguish among:

- observing public interaction or visual behavior without copying source material;
- rewriting or adapting public source code;
- copying style tokens;
- copying icons, images, fonts, or other assets; and
- using trademarks or brand names.

Public visibility does not remove copyright, trademark, license, attribution, or notice requirements. Record the relevant upstream version and material even when the resulting Proto UI implementation is substantially modified.

## AI-assisted contributions

The DCO signer remains responsible for all submitted content, including AI-assisted content. Disclose AI use that had a material effect on the contribution, for example when AI:

- generated a substantial portion of an implementation;
- migrated or rewrote an implementation from another codebase;
- generated tests, documentation, or static assets; or
- used external material whose authorization status the contributor cannot confirm.

Routine completion, spelling corrections, and localized refactoring suggestions do not require disclosure.

When disclosure is required, state at least:

- the tool or model category used;
- the approximate work performed by AI;
- the human review and validation performed; and
- whether third-party or private code was provided to the model.

AI disclosure does not establish that generated content can legally be submitted. The contributor must still identify sources, confirm rights, and satisfy applicable licenses.

## Employer and client ownership

Contributors are responsible for confirming whether:

- their employment agreement assigns related work to an employer;
- work created during working hours or on company equipment requires permission;
- client-project code may be published; and
- the contribution contains trade secrets, internal APIs, or non-public implementations.

Proto UI does not routinely require an employer authorization letter for every contribution. Maintainers may request confirmation or supporting authorization when there is a reasonable ownership concern.

## Unacceptable sources

Proto UI will not accept:

- copied code whose source cannot be determined;
- material under a license incompatible with the repository's use;
- proprietary code submitted without permission;
- implementations copied from an employer's or client's internal repository;
- material whose source cannot be explained solely because it was produced by AI; or
- material from which author, copyright, license, or attribution information was deliberately removed.

## Reviewer process

When a reviewer identifies a provenance concern:

1. Pause the merge without assuming malicious intent.
2. Identify the specific material or claim that requires clarification in the pull request.
3. Request the relevant source, license, attribution, or authorization information.
4. When the questionable material can be isolated, ask the contributor to remove or replace it.
5. Record material third-party sources in the appropriate `NOTICE`, package metadata, spec entity, or governance document.
6. Do not merge if the contribution's provenance or submission rights cannot be confirmed.
7. Add the `provenance-review` label for significant or repeated concerns.

The reviewer should keep the request proportional to the concern and preserve a clear, auditable record in the pull request.
