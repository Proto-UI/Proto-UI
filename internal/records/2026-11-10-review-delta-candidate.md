# Issue840 same-head review delta candidate

Date: 2026-11-10. State: source candidate; product validation and independent acceptance are not run. This record changes no lifecycle, permission, publication policy or release disposition.

The current explicit user assignment authorizes bounded read-only tooling in `fix/release03-thirty-issue-840-sol-20261110`, based on `0607c6c5c386b8a932ab850e92a8873b2121dc45`. The live Issue is open/reopened; both Nov6 comments deferred it to0.4. Those historical comments remain true history and do not become a0.3 acceptance claim. The original source key is `agent-workflow:same-head-review-delta:20261005`.

## Authority and source boundaries

`CONTRIBUTING.md#validate-proportionally`, `internal/agent-operations/contributor-agents.md#review-as-an-evidence-packet` and `internal/agent-operations/handoff.md` own this uncataloged operations boundary. No product spec entity, Prototype, Module, Adapter or Compiler lifecycle changes. The dated Oct2 cloud-incremental-review record supplies context, not authorization. The Issue's exact historical Oct5 source links and #831/#563 and #816 observations remain historical evidence; no historical replay is rerun or reported as new evidence here.

One new module, `scripts/agent-operations/review-delta.mjs`, owns only preparation and its direct CLI. It reuses existing canonical input/packet validators, digests, finding reconciliation, trusted CI/DCO summaries and the complete/stable collector. There is no second review runtime, writer, transport, ledger or policy. Shared review/runtime/schema/skill/publication files are untouched. No shared runtime integration patch is needed for the directly executable CLI; a convenience alias or central documentation link remains a separately owned Main transaction.

The module retains literal before/after material and exact IDs, suggests all original scopes conservatively, requires each reviewer delta disposition, accumulates original findings without retargeting, and gates a new candidate on complete collector replays plus a current same-input observation. No-change emits no candidate; changed targets rescope; incomplete/failing/unknown/ambiguous input fails closed. A candidate never supplies approval, a publication receipt, merge eligibility or authority. The existing fresh live writer still owns later drift, permission, identity, CI/DCO, prior-publication and unknown-write outcomes.

## Complete original conditions

All seven original checkbox bodies follow without shortened replacement. Every row remains `authored-not-executed`; none is checked by this record. Their full original Issue body, original parent/source references and both complete live comments are retained in the Main handoff's original-condition artifact.

### Original source condition 1

- [ ] 一个只读命令接受两个真实、schema-valid canonical inputs 和 prior packet，输出完整的新增/修改/删除 ID、前后 digest、原判断覆盖范围、未完成项及建议重新打开的 scope。重复输入必须为 no-change。

Candidate coverage: canonical v5/v2 validators, exact IDs and both digests, no-change and priorCoverage. Planned control/remaining work: I0/I1 inventory and deterministic replay controls.

### Original source condition 2

- [ ] 新评论中的缺陷、变更的接受条件、撤销/降级权限、失败/未知检查、source/provider/workflow provenance 变化、线程重开等必须保留，并明确触发重新审查或 fail closed。不能用作者、Bot 身份、关键词或“被动评论”标签自动证明无关。

Candidate coverage: all discussion retained; explicit scope reopening; existing trusted CI/DCO; permission/provenance fail closed. Planned control/remaining work: withdrawn evidence/acceptance/thread and failed/unknown CI/DCO/permission/provenance controls.

### Original source condition 3

- [ ] reviewer 对每个 delta 记录处置依据；未处理 delta 不可封包。只有明确判定仍适用的既有判断/材料才沿用。最终仍是新输入上的完整、独立判断与 fresh live preflight。

Candidate coverage: every delta has a bound reviewer rationale; unfinished deltas/scopes emit no packet; current complete replay and original live preflight remain. Planned control/remaining work: actual CLI unhandled-scope and stale/current-drift controls.

### Original source condition 4

- [ ] 保留已有 prior finding 累积关系、权限/身份/授权、CI/DCO、正式发布 receipt、未知写入结果处理与精确 head；该工具不发布 review，也不生成自批准。

Candidate coverage: exact prior packet/head, immutable finding targets and cumulative pointer; no writer/approval/authorization credit. Planned control/remaining work: finding identity/resolution/history and original publication/self-disposition controls.

### Original source condition 5

- [ ] **减少重复工作的正控制：** 同一 head 新增一条无新增验收要求的状态说明，经 reviewer 检查该 delta 后，工具复用其余已审 scope，生成新候选 packet；记录人工重填字段数、重复材料读取数和测试执行数，证明无需重填所有 scope、无需重跑未受影响测试。正式 publication 仍按现有要求执行。

Candidate coverage: two prior scopes/finding/evidence retained with no packetUpdates; instrumented counts separated from reviewer-reported work. Planned control/remaining work: Main must execute real reviewer action counts; no saving claimed from unrun source.

### Original source condition 6

- [ ] **反控制：** 把该评论改为真实缺陷或撤回原证据，必须重新打开对应 scope；失败检查/权限撤销必须阻断。head/base 改变在首期返回需重新定界，不把旧 head 绿色当新 head 绿色。

Candidate coverage: defects require reopened scope and finding; withdrawals reopen; failed checks/permission loss block; base/head/source changes rescope. Planned control/remaining work: Main must execute controls without changing original inputs or policy.

### Original source condition 7

- [ ] 固定两份 inputs 重放结果确定；未完成 pagination、ID 歧义、删除/编辑材料、并发再变化均不可丢失。增加实际 CLI 控制，不仅新增 schema。

Candidate coverage: existing stable complete collector replay; retained literal edits/deletions, ambiguity rejection and concurrent-change guard. Planned control/remaining work: Main must execute CLI/collection and genuine collected-input consumer controls.

## Executable controls and consumer outcome

The dedicated `scripts/agent-operations/test/review-delta.test.mjs` contains14 top-level controls plus9 named failing/unknown/permission/provenance subcontrols. This is authored inventory, not executed counts. It drives real child-process `plan`/`reconcile` commands with injected transport captures made by the existing collector. The positive status-note control retains two original scopes, their original finding, prior evidence and pending unknown without packet-field reconstruction; a reviewer-classified defect reopens only its original scope and needs a finding. Existing review consumers preserve canonical freshness/publication rejection. Injected transport material is not a genuine live GitHub observation or a product bug reproduction.

The positive report records zero supplied packetUpdates, zero finding changes and one explicit delta disposition. Human reentry, repeated material-read and test-execution counts are separately reviewer-reported; no measured saving is asserted until Main runs the actual scenario and retains the real action log. The CLI launches no product tests or external writers. The public consumer is the existing local reviewer workflow, not a website UI.

Main's serial checks, in Node24, are:

```sh
PUI_REVIEW_DELTA_EVIDENCE_DIR=/tmp/release03-840-main-cli-evidence-20261110 node --test scripts/agent-operations/test/review-delta.test.mjs
node --test scripts/agent-operations/test/review-publication-binding.test.mjs scripts/agent-operations/test/review-runtime.test.mjs scripts/agent-operations/test/collect-live-review-input.test.mjs
corepack pnpm@10.32.1 exec prettier --check scripts/agent-operations/review-delta.mjs scripts/agent-operations/test/review-delta.test.mjs internal/agent-operations/review-delta.md internal/records/2026-11-10-review-delta-candidate.md
corepack pnpm@10.32.1 check:agent-operations
corepack pnpm@10.32.1 check:agent-doc
```

For a before control, Main may run the dedicated new test file with the new module withheld in a disposable base source tree; the intended failure is absence of the requested delta CLI/module, not a claimed existing product defect. Preserve that actual outcome, then restore the candidate module and run the unchanged dedicated test. No baseline test was run by this owner.

The actual collected-input consumer uses the guide's `capture → plan → explicit per-delta decisions → current capture → reconcile` commands against a real assigned PR and its actual original packet. Use naturally retained genuine before/after inputs; label any added/edited/removed control material as injected, and do not mutate public discussion just to produce a test. Inspect every raw delta, unchanged scope reuse, pending item, prior finding/receipt source and blocked control in the resulting JSON. A log/prose screenshot is not visual evidence for this internal workflow. No browser/native/AT evidence is applicable or claimed.

## Remaining original work and provenance

Main must execute unchanged before/after and meaningful CLI/collector/consumer controls, record genuine reviewer action counts, resolve implementation/review findings, obtain independent exact-head review, prepare a lawful PR with actual DCO/rights/platform gates, integrate and read back actual criterion-bound Issue closure only after every original condition is earned. The Issue remains open. Source readiness, metadata admission and this record do not close any original checkbox.

Candidate source/evidence was authored by the user-assigned custom SOL role with material AI assistance; no independent approval, authenticated backend identity, human authorship certification or third-party source rights are inferred. Existing repository functions/fixtures retain their original provenance. No product checks, formatter/build/import/install/native/browser/server, Git mutation or GitHub write was performed by this owner. The handoff records actual source hashes and metadata-only resolver outcomes separately from unrun product evidence.
