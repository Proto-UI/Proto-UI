# Sprint 2 证据归档独立范围审查：9d0f47d4

**结论：可用于独立证据分支发布。** 本轮发现的 112 份日志未进入 index 问题已实际修复并独立复核，未发现剩余归档发布阻断。此结论针对下面绑定的文件、来源和范围；不是 GitHub APPROVE，不是 canonical review packet，也不表示产品已经合并或部署。

## 审查绑定

- 产品 HEAD：`9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`。
- 产品 tree：`0c9d31e5bb05d3af79932ec3c62a61480197f9eb`。
- 归档载体分支：`codex/sprint2-evidence-1450ffd5`；本轮检查时 HEAD 已为上述 9d 产品提交。载体名称中的历史前缀不改变执行来源。
- 审查范围仅为 `.prettierignore` 和以下两个归档目录：
  - `internal/records/evidence/2026-11-23-sprint2-final-1450ffd5/`
  - `internal/records/evidence/2026-11-23-sprint2-ready-9d0f47d4/`
- 独立最终 index 闭合检查完成于 **2026-11-23 15:29:23 UTC**。补入日志后的阶段回执 tree 为 `4670c66adb9a59298b212bb118373cc7c29662cd`；这是归档暂存树，不是产品执行树。
- 本轮没有运行产品测试、修改产品、stage、commit 或外部发布，也没有重新进行像素视觉验收。

## 发现及关闭

### S2-ARCHIVE-001 — 清单中的 112 份日志被忽略，未进入 index — 已关闭

**位置与依据：** 根 `.gitignore` 第 2–3 行的 `logs` / `*.log` 规则，以及本次 publication manifest 的文件清单。

首轮检查发现清单有 616 个文件，暂存区却只有 506 项。独立执行 `git ls-files --stage` 与清单对账后，确认缺失恰好 **112 个 .log**：历史 1450 目录 6 个、当前 9d 目录 106 个。`git check-ignore` 证实这些路径命中现有忽略规则。若直接发布当时的 index，日志证据及其引用会缺失。

所有清单文件完成哈希、大小、公开路径和凭据检查后，root 只对这 112 个明确路径执行了补入。独立后续检查确认：

- 暂存路径、index 路径与预期集合均为 **618 项**，无缺失或额外路径。
- 对 112 份补入日志逐一重算 SHA256、大小及 Git blob，全部与清单及 staged 内容一致。
- `.gitignore` 与产品 HEAD 中的内容逐字节一致；没有扩大忽略规则或改变产品文件。
- 原首轮 NEEDS_REPAIR 记录保留，后续 PASS 单独记录，没有重写首次发现。

## 完整性与公开边界

| 检查 | 实际结果 |
| --- | --- |
| publication manifest | **616/616** 文件 SHA256 与大小一致，共 **35,113,199 bytes**；manifest 自身按声明排除 |
| 两个归档目录 | 无清单外文件、无缺失文件、无重复清单路径 |
| index 与工作目录 | 原已暂存文件的 Git blob 一致；后续补入的 112 份日志也独立一致 |
| 公开文本与图像容器 | 检查 **412 个 UTF-8 文本文件**及 **205 个 PNG**；未发现私人设备路径或高信号凭据候选 |
| Markdown 相对链接 | 全部可解析；JSON 中预留的最终 review 路径由本报告补齐 |
| formatter 保护 | `.prettierignore` 只增加上述两个精确归档目录和说明，无删除或其他范围变更 |
| 消费者公开包 | **149 个文件**；147 个 ledger 条目，另有 manifest 与 SHA256SUMS；148 条 checksum 完整覆盖除 SUMS 自身外的文件 |
| 原件到公开副本 | 147 项原件 SHA256/大小、17 条字面替换规则、逐文件替换次数、派生来源 SHA256、公开字节及 SUMS 全部一致 |
| 原始失败记录 | 9d 原 FAIL summary SHA256 仍为 `cff996a44c584d3a4f4ba141e7cc8b2a13f6f2457ebaff70f4fde7b5be4d0392` |

公开文本扫描覆盖私人设备/工作区路径、常见令牌和私钥格式、认证头及带凭据或签名参数的 URL。未把原始凭据内容写入审查输出。PNG 检查用于文件完整性与容器 metadata；实际视觉结论仍来自[独立视觉报告](../visual-review/README.md)。

[消费者 manifest](../consumers/manifest.json)准确区分原件与公开副本哈希。带路径占位符的编排脚本是执行来源记录，不能被当作未经路径恢复即可直接执行的新入口。原控制区文件未被公开副本替换；本轮逐一读取的原件仍匹配其记录哈希。

## 结论与失败语义核对

[最终范围对账](../scope-reconciliation.json)、[归档说明](../README.zh-CN.md)和[消费者说明](../consumers/README.md)在以下关键边界上保持一致：

- 原 hosted 队列保留 **304 = 292 browser + 12 Node/HappyDOM**，前置构建与类型阶段单列。独立 Tabs13、历史 275 回归及普通消费者没有被加入该分母。
- 9d 初始本地流水线继续是 **FAIL**：Tabs worker 初始化 exit 1、0 suite / 0 tests。JSON 中的 `success:true` 没有被解释为测试通过。
- 独立 follow-up 保留原两文件与原 13 项，仅补充缺失的 worker 下限。实际结果为 **2 suites / 13 tests / 13 passed / 0 failed / 0 pending / 0 todo**；style 与 docs-types 均实际 exit 0、无 timeout。
- follow-up 的 **10 次 source checks**全部绑定同一 9d HEAD、tree、lock 与 clean 状态，并有 finish 检查。原 FAIL 字节未变。
- 消费者组合结果为 PASS，但 `aggregateAcceptanceClaim` 保持 **false**。完整 Sprint 范围结论由 root 联合独立源码、hosted、消费者及视觉证据形成。
- 历史 1450 聚合 `check:types` 的 **1200.055 秒 timeout、exitCode=null**仍保留；没有声称当前重新执行了聚合命令。
- Shenko 原 legacy identity 的 3 PASS / 1 FAIL 与临时 identity 断言迁移明确保留；Verdant 原 pin 拒绝与临时上游 pin 变更没有隐藏。未改写冻结 authored sources 的身份。
- 23 个入口仍为 9 PASS / 14 UNSUPPORTED。Cargo、桌面、live backend、超出原范围的 Harness/IME/AT/非 Web 条件及原 Hook 未完成条件没有被接受。
- #1488 的条件映射保留创建时的条件化表述，最终说明另以已经完成的 Tabs13 和当前视觉证据补足；旧 C23/24 FAIL 没有改勾。没有据此关闭整个父 Issue。
- Ready、平台 review、Vercel 和分支规则按照观察时刻及各自状态记账；内部独立审查没有冒充平台批准。

## 完成封存时的唯一剩余动作

本报告写入前，清单为 **616 个文件**，加 manifest 自身与 `.prettierignore` 后暂存共 **618 项**。root 将本报告复制到 `independent/archive-scope-review.md` 后，应按既定装配步骤刷新 publication manifest：

- 清单文件数预期为 **617**，manifest 仍排除自身。
- 最终暂存数预期为 **619**，仍只有 `.prettierignore` 和两个精确归档目录。
- 重新确认本报告已在 index、清单中的哈希/大小与实际文件一致即可；无需增加产品执行 gate。

本次检查所绑定的、尚未加入本报告的 publication manifest SHA256 为：

`c88db01516a553c44a77d1b0a973f31ac5f451a8f2334249db881f9f826eddee`

首轮独立审计记录 SHA256：

`cadb6a6feb28b0424f61b3dec610b1f61dfd80d2289de57bce1913c4bb78c3d1`

关闭缺日志问题的独立 index 检查记录 SHA256：

`cd21ad7ce585328436f02a967cbf34fb38beb61f4a7040d50ae211e794d455ab`

上述历史哈希保留各自检查时点；加入本报告后的最终清单哈希会按预期改变。发布的载体提交始终与实际执行的产品 9d 提交分别记账。
