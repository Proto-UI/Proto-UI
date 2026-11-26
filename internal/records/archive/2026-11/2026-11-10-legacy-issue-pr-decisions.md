# 旧 Issue / PR 决策调和：#1147 的有界源记录

日期：2026-11-10。源码基线：`0607c6c5c386b8a932ab850e92a8873b2121dc45`。关联 [#1147](https://github.com/Proto-UI/Proto-UI/issues/1147)、[#1091](https://github.com/Proto-UI/Proto-UI/issues/1091)、[PR #887](https://github.com/Proto-UI/Proto-UI/pull/887) 与 [Finf v2 #890](https://github.com/Proto-UI/Proto-UI/issues/890)。完整机器可读记录见 [decision projection](2026-11-10-legacy-issue-pr-decisions.json)。

本记录补齐原始条件、历史处置与后续纠正之间的可追溯关系。当前 release disposition 保持 **unresolved**；原始“全部 Issue 与 PR”同步条件保持 **pending / OPEN**。本地源记录准备完成不代表该条件已全部实现、通过独立验收或合入。

## 原条件与父源

原条件逐字保留：

```text
- [ ] 同步旧有全部 Issue 与 PR 并记录决策 — 历史状态 pending
```

| 来源 | 原 source key / 精确定位 | 条件状态 |
| --- | --- | --- |
| #1147 body，第 6 行 | `issue.1147.001`；body SHA-256 `39087aacfb9143dfbd6f6937f5b833d2a1e6e7b11f102eb89937f2138fcbbfa6` | 原 checkbox 未勾选 |
| #1091 body，第 8 行 | `issue.1091.002`；body SHA-256 `2eeccd625582b4d1ce99d01929b3403d657b2ec6d781c0628183fcc3f1470a3a` | 父源原 checkbox 未勾选 |
| PR #887 body，第 170 行 | `相邻中断会话：完整剩余工作 / 后续设计语言工作`；body SHA-256 `796af070cd5b007c84311d91e632b2486f3013b88bc5debab6c5bcd2d04933bf` | 原文字样是 ``历史状态 `pending` ``，仍未勾选 |

前两个 key 来自已入库的 [冻结 release source ledger](../governance/release-0.3-source-ledger.json)。PR #887 的行号和内容哈希是本次采集的定位信息；更早 adjacent-session task ID 尚未恢复，不能把新定位伪装成历史 task ID。采集时 #1147 / #1091 的 body 哈希与冻结源相同；后续评论新增的决策不能通过改写旧 body 消除。

#1139 的源恢复另找到了较晚 main-session migration 快照：session `01a0cc26-1013-72dd-b00d-4429c2af2b17`、event `5788e9e7`、时间 `2026-10-14T05:47:23.344Z`、phase `113 / Adjacent interrupted session intake`、task index `1`。该处同名任务的状态是 **blocked**，其 blocker 逐字保留：

```text
Current user moves development TODOs to #872 followups and a future new PR. Preserve task/evidence; resume only under the new PR after fresh baseline/authorization.
```

它是 later main-session 的迁移状态，不能覆盖 PR #887 所携带的 originally adjacent-session **pending**。JSON 分别保留这两种来源。phase/task index 只是源定位，不是捏造的 native task ID。本 worker 已读取实际 sanitized source projection、精确选择和 source-owner recovery receipt，并在 Main handoff 保留各自 SHA-256；receipt 明确没有产出 raw-event byte SHA，不能把 projection digest 称为原始事件字节哈希。本次不回放原始会话或输出凭据。当前有界修复的授权来自实际当前请求，不是历史 blocker 的重放。

## 决策按时间并列保留

下表中的 author 是实际 GitHub 账号 `cyjin-yl`，不是对人类或 Agent 身份的独立认证。JSON 保留每条所选评论的完整采集文本、平台 author ID、created/updated 时间和正文哈希，包括原文中的 Agent 声明。本记录不重新认证其他贡献者的提交或 DCO。

| 时间（UTC） | 实际来源 | 保留的决策与适用边界 |
| --- | --- | --- |
| 2026-10-30 09:28:59 | [PR #887 comment 6519493896](https://github.com/Proto-UI/Proto-UI/pull/887#issuecomment-6519493896) | 剩余工作转由 #1091 等子载体追踪；迁移不满足原条件。 |
| 2026-10-31 23:00:49 | [#1091 comment 6550303172](https://github.com/Proto-UI/Proto-UI/issues/1091#issuecomment-6550303172) | #1147 是有界子 Issue；父 Issue 要在全部子 Issue 关闭且验收通过后才能关闭。 |
| 2026-11-06 12:04:52 | [#1147 comment 6684398558](https://github.com/Proto-UI/Proto-UI/issues/1147#issuecomment-6684398558) | 将全历史同步称为 meta bookkeeping，并记录 deferred to 0.4。保留原文，不转成完成。 |
| 2026-11-06 12:05:17 | [#1091 comment 6684405905](https://github.com/Proto-UI/Proto-UI/issues/1091#issuecomment-6684405905) | 父 tracker 记录 0.4 deferral；不能据此删除或勾选子条件。 |
| 2026-11-06 12:10:22 | [#1091 comment 6684495264](https://github.com/Proto-UI/Proto-UI/issues/1091#issuecomment-6684495264) | 补充逐内容理由，包括 governance bookkeeping、完整 family 工作和不可继承的旧 takeover 授权。 |
| 2026-11-06 13:26:01 | [#890 comment 6685904031](https://github.com/Proto-UI/Proto-UI/issues/890#issuecomment-6685904031) | 明确保留 `#1091 → #1146 / #1147 / #1148 / #1149 / #1150` 原条件；拒绝把所有 Finf follow-up 整体延期，要求与已入库承诺逐 criterion 对账。该评论未执行新测试、未代作 APPROVE。 |
| 2026-11-06 17:18:25 | [#1323 comment 6690899056](https://github.com/Proto-UI/Proto-UI/issues/1323#issuecomment-6690899056) | Workflow/history umbrella 后续仍在 deferred 栏逐字携带 #1147 未勾选条件。该事实与 retention correction 一并保留，不用时间排序静默消除任何一方。 |
| 2026-11-06 22:28:27 | [#1323 comment 6697414819](https://github.com/Proto-UI/Proto-UI/issues/1323#issuecomment-6697414819) | 0.3 是 Base/Shadcn/Brutalist/Lucide、www/CLI 与必要前置；其他 UI libraries 为 WIP/Experimental。混合来源须逐 criterion 处置。 |

[#1323 当前 body](https://github.com/Proto-UI/Proto-UI/issues/1323) 另有 2026-11-07 release-audit note：早先 blanket deferral 对已承诺的四家族 / www / CLI 部分被后续纠正。JSON 单独保留这个当前编辑版本及其哈希；未采集的 body 编辑历史仍是未知，不把当前文字倒填为创建时原文。

当前用户指定本次有界 source repair，Main 明确要求当前 release disposition 为 unresolved。它不批量裁定其他 owner 的 0.3 / 0.4 范围，也不修改其审批、源 ledger 或验收状态。旧三小时无人接管授权仍不可继承。

## 源集合、当前状态与未覆盖范围

这次精确采集了 #1147、#1091、PR #887、#890、#1323 的完整当前顶层讨论：分别 1、3、77、56、6 条评论。每个集合保留分页结果、独立计数与唯一 ID 计数。PR #887 另采集了 16 条 reviews、27 个 review threads 及其全部 27 条评论。API 采集分多次请求，不能描述为跨对象原子快照；完整 raw captures 当前只在 Main handoff 的本地证据目录，未宣称已上传。

采集时 #1147、#1091、#890、#1323 均为 OPEN；PR #887 为 MERGED，head `8941fab0c6da7a0cbb7875c51c031a58ea67eb3a`，merge commit `a0dc3792b78ab593f6466a53876ea1d91fe32004`。GitHub assignee 为空不撤销本次 owner 分工或历史 claim。

[原始 Finf source debt](2026-10-14-finf-followup-source-debt.json) 的全部原文、compound 条件、历史 dispositions 与 metadata 保持原文件字节：

| 保留集合 | 行数 | 计数含义 |
| --- | --- | --- |
| `originalDebtSnapshot.records` | 1042 | 原始 / 历史记录，含 955 条保守未完成条件和 87 条历史处置。 |
| `firstRefreshRecords` | 26 | 较晚的 source versions，保留前后原文与来源。 |
| `finalPostmergeRecords` | 16 | 最后追加的 source versions，保留合并后状态与原条件。 |

合计 1084 个保留 source versions；其中携带的未勾选记录是 `955 + 26 + 16 = 997`。这些数值不是独立 bug 数、全部仓库历史分母或完成百分比。JSON 绑定整份历史源 SHA-256、各集合 pointer 与原 key 顺序摘要；不去重、不复制为第二份完整原文，也不改历史哈希。

[历史 source closure](2026-10-14-finf-source-closure.json) 与 [continuation](2026-10-14-finf-followup-continuation.json) 保留原 archive refs、原 head、贡献来源、真实 dated native DCO receipts 和六个公开 carrier URL。本次只读查询再次观察到原八个 PR #846 / #869 / #872 / #878 / #879 / #884 / #885 / #886 均为 MERGED；精确平台 head、merge commit、author 和采集时间记录在 JSON。没有重做这八个 PR 的当前全部讨论或技术验收。尤其 PR #846 早期 evidence-only / never-merge 文字与较晚真实 merge 回执都保留；平台已合并事实不产生新性能结论，也不回写旧审查决定。

冻结 release source ledger 只含采集时的 187 个 Issue。八个原 PR、187 个 Issue、997 条未勾选记录都不能定义原文“全部旧有 Issue 与 PR”的完整人口与截止时点。这个分母尚未恢复；不能以开放 Issue 列表、样本或本记录替代全历史同步。

## 原条件仍须完成的工作

| 原条件的必要部分 | 当前处置 | owner 与下一步 |
| --- | --- | --- |
| 全部旧 Issue / PR 的范围、截止时点和成员完整 | unknown | 本 owner 与 Main 从已有完整源 inventory 恢复人口；包含 closed / merged 对象，保留全部条件与未知。 |
| 每个对象的原条件、全部历史决策和当前事实 | bounded source-prepared | 本记录仅调和精确父源与保留载体。扩展成员后逐条件复用实际 owner 的证据，不重复接管其代码。 |
| 适用 spec / lifecycle、当前 owner / claim、真实 CI / DCO / native 证据 | 原来源保留；当前产品验收未声明 | 各实际产品 owner 提供其精确 head 证据；Main 验证本 records-only 差异与合法集成条件。 |
| 对应 PR、独立 review、合法合入与原 Issue earned closure | not-executed | Main 执行外部操作。准备 PR 使用 `Refs #1147`，在全部原条件满足前不使用自动关闭语法。 |

本次没有新增或提升 spec 实体、运行产品检查、修改全局 ledger、改动其他 owner 的产品实现，也没有 commit、push 或 GitHub 写入。历史测试 / CI / DCO 的实际源范围保持历史；新 candidate 的格式、文档检查、独立审查与平台验收交给 Main 串行执行。

## Main 的消费者与验证边界

实际读者路径是打开 #1147 → 父源 #1091 → PR #887 的原条件，再阅读时间表链接的 deferral / retention correction 和 JSON 的 `conditionAccounting`。预期可观察结果是：三个原条件一致且未勾选、历史决定均可追溯、当前 release disposition 为 unresolved、全历史覆盖未被错误报告为完成。

Main 的 source / consumer 验证脚本、before / after 命令、故意篡改的负控制、完整 preimage / after-SHA 清单及短 PR 文案位于本次 v2 handoff 的本地证据包。它们全部是待执行的验证材料。负控制仅修改内存副本，用于拒绝丢失 retention correction、伪造完成、整体改成 0.4 或正文哈希不匹配；不制造实际产品缺陷。

视觉检查针对本 Markdown 的真实渲染：原条件代码块、决策表中的时间 / 链接 / 作用域、保留集合计数表，以及仍未完成的工作应可读且不会显示成已接受 checklist。没有新的组件 UI 变化；native / browser / AT 截图不适用于这个 records-only 差异，其他 owner 的产品视觉债务仍保留。
