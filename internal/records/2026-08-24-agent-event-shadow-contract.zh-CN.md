# Agent Event shadow：认证、重放与乱序契约

日期：2026-08-24

关联：Issue #504、PR #485、PR #487、Issue #486

## 这份记录解决什么

PR #485 的维护者讨论已经选择 webhook / event-driven 作为预期主路径，并保留定时 shadow 作为 reconciliation。Issue #504 把这条方向拆成多个 transition。本记录只描述第一个 Event shadow transition 的实现和边界，不把后续 controller、review 写入或 merge 设计写成既成事实。

这个主题不属于 Proto UI 产品语义，`spec/**` 当前也没有对应实体。现行机器边界仍由 `internal/agent-operations/policy.yaml`、`workflows.yaml` 与 `capability-policy.yaml` 管理。日期化记录只保存这次工程方向和观察，不能覆盖这些文件。

## 已收敛的第一条 transition

第一条 transition 是 contract-only Event shadow：

```text
signed raw GitHub delivery
  -> raw-byte HMAC-SHA256 verification
  -> repository / hook / installation trust binding
  -> identity-only event envelope
  -> allowlist and self-echo decision
  -> delivery replay and object-order decision
  -> no-write receipt plus pure next state
```

它不部署 listener，不创建 queue，不运行 Agent，不读取 GitHub write credential，也不修改 GitHub。`ADMITTED` 只表示应当重新采集 live state；`OUT_OF_ORDER` 与 `AMBIGUOUS_ORDER` 只表示应当 reconciliation。Event、sender、fork、CI 或模型输出都不能把这两个结果升级成 mutation authorization。

当前 contract-only allowlist 仅覆盖 `pull_request` 的 `opened`、`reopened`、`synchronize`、`ready_for_review`、`converted_to_draft`、`edited` 与 `closed`。这是离线 shadow/replay 的输入边界，不是已部署订阅，也不是未来生产 allowlist 的最终批准。Review、comment、thread 与 check 事件要在各自输入、成本和 reconciliation 契约明确后单独加入。

## 机器工件

- `internal/agent-operations/event-shadow.yaml` 固定 contract 状态、allowlist、fork 边界、去重与乱序规则，以及零写入条件。
- `schemas/event-shadow-delivery.schema.json` 保存 headers 和原始 body bytes 的 base64 表达，使签名可以针对原字节重算。
- `schemas/event-shadow-trust.schema.json` 要求部署时提供 repository、hook、installation 和 dedicated Agent actor IDs；这些 ID 不从 payload 自证。
- `schemas/event-envelope.schema.json` 只保留 repository、delivery、sender、对象、revision 与 fork identity。它不携带 body、comment、patch、commit message、filename 或其他 authored instructions。
- `schemas/event-shadow-state.schema.json` 描述 delivery keys 和逐 PR cursor；state 的全局原子持久化仍由未来 controller 负责。
- `schemas/event-shadow-receipt.schema.json` 把结果约束为 `ADMITTED | DUPLICATE | UNSUPPORTED | SELF_ECHO | OUT_OF_ORDER | AMBIGUOUS_ORDER`，并固定 `mutationAuthorized: false` 与 `writeOperationsPerformed: 0`。
- `scripts/agent-operations/event-shadow.mjs` 实现纯 normalization/evaluation；`event-shadow-cli.mjs` 只做离线 replay，打印 `nextState` 而不写回 state。

## 零信任边界

签名验证使用 request body 的原始 bytes、webhook secret 和 `X-Hub-Signature-256`，并以 constant-time comparison 检查 HMAC-SHA256。验证发生在 JSON 解析之前。Runtime 随后交叉检查 header target、payload repository、hook ID 与 GitHub App installation ID。

签名只证明收到的 raw delivery 与 secret 对应，不能证明 authored content 正确，不能授予 GitHub permission，也不能代替 live state。外部 contributor 与 fork 可以触发观察，但其 actor identity 没有 semantic、review 或 mutation authority。Dedicated Agent 的 self echo 被确定性丢弃。

Delivery key 绑定 hook ID 与 GitHub delivery GUID。相同 key 是 replay；不同 delivery 不能仅因 payload digest 相同而被当作重复。逐 PR cursor 使用 `updated_at` 与 head SHA 检测明显旧事件；相同时间不能建立 total order，因此必须回到 GitHub live state reconciliation，而不是猜测先后。

Envelope 本身不是可跨信任边界携带的签名凭证。未来 controller 若把 raw delivery、envelope、receipt 或 state 分开传输，必须原子保存原始签名输入，并在消费边界重放 normalization 或增加独立的服务签名。当前实现没有全局 state store、service lease、delivery acknowledgement、dead letter、retry controller 或 kill switch，因而不能宣称已经防止跨 runner replay。

## 可执行证据

`scripts/agent-operations/test/event-shadow.test.mjs` 覆盖：

- GitHub 公布的 HMAC-SHA256 test vector；
- raw body tamper、错误 secret 等签名失败；
- repository、hook、installation 与重复 case-insensitive header 的 fail-closed；
- external fork 只进入 read-only collection；
- unsupported action 与 dedicated-Agent self echo；
- delivery replay；
- 明显乱序与无法建立顺序的同时间事件；
- forged envelope、receipt 与 state 边界；
- CLI 第一次 replay 与 duplicate replay；
- 所有结果的零 mutation 字段。

聚焦命令：

```sh
node --test scripts/agent-operations/test/event-shadow.test.mjs
corepack pnpm@10.32.1 check:agent-operations
```

## 仍然需要单独决定

- listener 与 durable controller 的部署位置、owner、SLO、acknowledgement、retry、dead letter、lease、cancellation 和 kill switch；
- pi SDK v2 或 DeepSeek harness 的选择与隔离边界，不能在 repository runtime 中重造 Coding Harness；
- GitHub App identity、最小 permissions、secret 管理，以及 trust anchor 的部署流程；
- comment、review、thread、check 等下一批 event allowlist；
- maintainer inbox、notification 与 decision callback；
- standing authorization 与 deterministic applier；
- `REQUEST_CHANGES` + own dismissal 或 `COMMENT` + required check 的可逆 blocking 选择；
- 任何 GitHub write、Review、approval、merge、publication 或 release graduation。

这些决定应分别形成可审查的 transition。Event shadow 通过测试不能作为其中任何一项的授权证据。

## 外部契约依据

- GitHub Docs, Validating webhook deliveries：<https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries>
- GitHub Docs, Webhook events and payloads：<https://docs.github.com/en/webhooks/webhook-events-and-payloads>
- GitHub Docs, Best practices for using webhooks：<https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks>
