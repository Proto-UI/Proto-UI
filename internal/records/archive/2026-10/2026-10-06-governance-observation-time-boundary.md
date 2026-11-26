# Governance facts and observation timestamps

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

The coverage reconciliation check failed on the shared candidate in [run 37501442006, job 112399177604](https://github.com/Proto-UI/Proto-UI/actions/runs/37501442006/job/112399177604), and independently on the Focus candidate in [run 37502546510, job 112402951110](https://github.com/Proto-UI/Proto-UI/actions/runs/37502546510/job/112402951110). Preserve these failures; they are not product/runtime failures.

Two independent read-only checks of the actual GitHub API compared all 27 bound Issues and PR #580 with the existing snapshot. Only Issue #377's `updatedAt` differed: `2026-09-27T00:53:27Z` became `2026-10-06T17:14:14Z` after its authorized navigation migration to #870/#872. Every title, state, state reason, label, assignee, milestone, reviewed owner, PR head and merge fact was identical. No owner token or issue binding was guessed or rewritten.

The former `--check` compared the entire formatted JSON text, so ordinary Issue activity caused a blocking drift even when none of the recorded governance facts changed. Repeatedly updating timestamps on many branches would create recurring races rather than settle the comparison's meaning.

The bounded repair compares every recorded root/Issue/PR field except each record's observation-only `updatedAt`. It retains exact Issue bindings, reviewed owners, titles, states/reasons, labels, assignees, milestones, PR heads, merge commits and unknown additional fields as blocking differences. Invalid/missing timestamps remain invalid metadata. Normalization and explicit `--write` retain the actual latest timestamps; this change does not fabricate freshness, mutate a snapshot during a check, weaken permissions or mark any consumer complete.

Verification includes timestamp-only success, each meaningful field changing independently, added/removed/unknown facts, invalid timestamps, immutability and preservation of real timestamps during explicit reconciliation. The live comparison uses the same exported functions with actual API results; test fixtures are labeled unit inputs, never substituted for `gh` or live GitHub evidence. This is one coordinated Finf hygiene patch; existing lanes should consume its frozen version rather than independently refresh the shared snapshot.
