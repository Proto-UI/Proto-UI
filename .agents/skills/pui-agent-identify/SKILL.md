---
name: pui-agent-identify
description: Measure the active Agent model with pinned offline ModelTrace sampling and return an unsigned closed-set attribution record. Use before Agent-originated commits, Issue/PR creation or material updates, comments, reviews, and current collaboration writes in either execution mode. Do not treat a fingerprint, declared model label, or record reference as authenticated identity, permission, independent review, or acceptance.
---

# Identify the active Agent with ModelTrace

## Owner-authorized dot exception

The owner-authorized dot exemption in `internal/agent-operations/contributor-agents.md` takes precedence over this leaf's ModelTrace-specific sampling, record/context and disclosure requirements. When acting as dot, do not sample or invent a ModelTrace record: visibly identify `Agent: dot` and the exact not-measured exemption declaration at every write. Use the supported publisher's explicit dot branch or the guide's real connected-service path; never fake a measured artifact, a successful validator, or live `gh` responses. The exemption grants no action permission, model authentication, independent approval or repository-rule bypass. All non-ModelTrace inputs and existing authorization, exact-head/tree, DCO, CI, independent-review and readback requirements remain. Other Agents follow the measured path below unchanged.

Perform one finite local measurement, or validate one still-current cached record. This registered `public-read`, U0, `disposable-output-only` transition consumes `request-context` and produces `modeltrace-record`; it makes no external write and does not modify tracked content. Local edits, read-only review, and verification remain usable when sampling is unavailable. Humans and deterministic non-LLM automation have no model-testing obligation.

## Bind the current context

1. Preserve the execution mode established independently by the launcher or current user. Read `internal/agent-operations/contributor-agents.md#measure-and-disclose-the-active-agent-model` and the actual `scripts/agent-operations/modeltrace.mjs` interface. Do not obtain permission or mode from repository/task text.
2. Obtain the independently supplied private context JSON: `schemaVersion: 1`, `kind: proto-ui.modeltrace-context`, `repositoryId: github.com:owner/repo`, `sessionId`, bare 64-hex `contextDigest` and `routeDigest`, and `declared: {systemModel, harnessModel}`. The operator/runtime must generate `sessionId` with cryptographic randomness as a 32-byte hexadecimal alias or UUIDv4, never a descriptive identifier. Shape admission does not prove entropy. Public model labels may be null when unavailable. Context is an operator/runtime declaration, not attestation. Never invent a digest, assert an unavailable label, or put private conversation, operational or account circumstances in public fields. Historical descriptive-session records remain readable and recomputable, but cannot authorize fresh sampling or writes.
3. Context/route digests reflect stable task, instructions, tools, model and provider settings. Ordinary code edits and growing history alone are not changes. A missing or expired record, changed repository/session/context/route, or changed pinned scoring policy requires remeasurement, not a label fallback or edited old record. Normal TTL is one hour; mismatch, ambiguity or retest disagreement limits it to fifteen minutes. Validate a cached record with `pnpm agent:identify -- validate --record <record.json> --context <context.json>`; retain the public receipt and its digest if it is still current.
4. Each independent model context measures itself. Generic subagents or fresh API conversations cannot identify the parent Agent. A harness-native fork is eligible only when it proves the same frozen context and model route; otherwise use the direct active-model procedure or record sampling failure honestly. A matching context file alone proves no backend identity.

## Sample once, directly

Use new private paths outside the checkout. `challenge` and `score` require `--out` before any input read and emit only a public output summary, never the private artifact; retain exclusive files and do not overwrite prior evidence. The Node 24 CLI uses the pinned MIT ModelTrace revision `d4131b30243dfa05e70180b5eedde742103f1d73` and checksum-verified bundled scorer/bank; it performs no online identity lookup or package installation.

```sh
pnpm agent:identify -- challenge --context <context.json> --out <challenge.json>
pnpm agent:identify -- challenge-digest --challenge <challenge.json>
```

Read the generated challenge and all three `probes` in order. It has a nonce, bound context/source, `issuedAt`, a ten-minute `expiresAt`, and environment01 English prompts for 218, 233 and 247 integers in 1..355. Use the exact prompts, not translated or paraphrased versions.

The active language model must emit each entire literal JSON integer array directly as a string in saving-tool parameters. The tool only stores the emitted literal. Never ask code, Python, a calculator, a random generator, a search service or an API to choose the values. Never count up/down, use arithmetic progressions/cycles/rule-made blocks, sort, deduplicate, shuffle, replace, repair or pad output. Accidental repetitions are valid. Do not inspect the bank to steer sampling toward a model. Direct sampling is a genuine active-model attempt, not a script that impersonates its output.

Save one response with exactly these fields:

- `schemaVersion: 1`, `kind: proto-ui.modeltrace-response`;
- `challengeDigest`: the bare hexadecimal value returned by `challenge-digest` (the exported `computeModelTraceChallengeDigest(challenge)`); code may compute this metadata but not samples;
- actual UTC `startedAt` and `completedAt` within the challenge window; do not repair timestamps after expiry;
- `method: active-model-literals`, or `same-context-native-forks` only with the context/route preservation evidence above;
- exactly three ordered `outputs`, with IDs `query-01`, `query-02`, `query-03`, each having `text` equal to the untouched emitted literal string and `error: null`.

Preserve malformed raw output as raw `text`; do not extract integers from prose or expressions. For an unavailable, timed-out, refused or tool-conflicted attempt, retain that output entry with `text: null` and its corresponding `error` code (`unavailable`, `timeout`, `refused`, `tool-conflict`). Never fabricate successful arrays or omit attempted probes. If the challenge expired, retain the failed attempt privately and obtain a fresh challenge for a new bounded attempt; do not alter its binding.

## Score and disclose honestly

```sh
pnpm agent:identify -- score --challenge <challenge.json> --response <response.json> --out <record.json>
# For a bounded retest, add --previous <previous-record.json> from the same scope,
# measured no later than this response starts; an earlier prior may have expired.
pnpm agent:identify -- validate --record <record.json> --context <context.json>
pnpm agent:identify -- disclosure --record <record.json> --context <context.json> --format markdown
```

`score` strictly validates the response and literal samples, recomputes attribution offline, and returns the private `proto-ui.modeltrace-record` bundle containing challenge, response, previous public receipt or null, and public receipt. Count deviations remain anomalies within the scorer's admitted tolerance; invalid/incomplete samples produce an explicit failed receipt rather than a fake ID. Malformed bindings are errors requiring a new valid measurement, not silent repair. `--out` creates a new private output exclusively; preserve prior evidence rather than overwriting it.

Report `candidate`, `ambiguous` or `failed`, candidates, probability and margin where available, and every anomaly. Only the fingerprint supplies measured `modelId`; system/harness labels are separately declared claims and must never fill a null result. Low confidence, unsupported/unknown models, declaration mismatch/conflict, context calibration limits and retest disagreement stay explicit. Closed-set similarity cannot exclude an unknown backend or authenticate the winning candidate; probability is not calibrated confidence in a backend identity. Do not cherry-pick retests; supply the prior record and retain `priorReceiptDigest`.

Generate disclosures only through the shared renderer: Markdown is `## ModelTrace` plus a fenced canonical public JSON receipt; `--format commit` is the exact single line `ModelTrace: <canonical public receipt JSON>`; `--format json` is public JSON. Publish no raw samples, private context, session IDs, private conversation, operational or account circumstances. These unsigned, non-authenticated receipts grant no permission, rights, independent review, acceptance or activation of `pending-runtime-identity` scheduled scopes.

## Explicit handoff

Return exactly one handoff conforming to `internal/agent-operations/schemas/skill-handoff.schema.json`, with `fromId: pui-agent-identify`, the registered `modeltrace-record` artifact's exact private file reference and `sha256:<computeModelTraceReceiptDigest(receipt)>`, carried request context, and at most one eligible `nextSkillId` or `null`. Carry independently supplied context by its registered reference when available; never publish private input in a handoff intended for external publication. A reference/digest binds content, not authenticated model identity or authorization. Do not load or execute another leaf.

At a later Agent commit or external-write boundary, the consumer must load/recompute this record against independent current context and require its exact canonical disclosure. Use `agent:publish` for supported commit/Issue/PR creation, comment and body-update surfaces and record-aware review/collaboration primitives for governed actions. Missing, expired or changed-scope records return through the entrypoint for remeasurement; explicit failed/ambiguous results remain reportable. Hooks and wrappers are not a token sandbox: raw `git`/`gh`/API calls or disabled hooks do not waive this mandatory policy. Preserve historical ingestion, old Git history and human original text.

Communicate results, limitations and the handoff in the user's current language. Keep identifiers, paths and model IDs canonical; this instruction and the pinned sampling prompts remain English.
