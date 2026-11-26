# Sprint 7 实际执行交付与整合边界

本轮由 Agent 按当前用户“补完 Sprint 7”执行。原 #757 已完成，不重新做实验。本记录是十条剩余执行项的结果入口；每条的原范围、失败、未测项及独立接受详见其来源。候选交付、GitHub 审批、实际合入和 Issue 完成是分别记录的事实。

## 已取得的实际结果

| Issue | 本轮结果 | 具体来源 |
| --- | --- | --- |
| #1151 | 生产 source、image、binary 与 dcbot#5 合入版本一致；GET-only 核对四份已有日报，全部匹配；原部署暂停计时器恢复 | [生产部署与回读](2026-11-24-sprint7-dcbot-production-readback.md) |
| #1150 | 冻结十项对象与真实观察截止；逐项核对活动和承接；当前均已承接，无新增无人负责的合格空闲项；整合循环继续按实际回执补齐 | [空闲批次审查](2026-11-24-sprint7-idle-batch-review.md) |
| #1147 | 1,697 个历史对象的决定、来源与未完条件逐项接受；11,962 条条件保留；219 个对象的后继路由修正。不是 1,697 项产品完成 | [#1757](https://github.com/Proto-UI/Proto-UI/pull/1757)，固定 head `49d8102da5421cade92de85afec6aa68d46ec85c` |
| #746 | canonical matrix 的 follow-tail 行对齐实际 Shenko 消费和已合入版本；原 82/82 范围保留，派生投影重建 | [#1757](https://github.com/Proto-UI/Proto-UI/pull/1757) |
| #745 | editor 与矩阵证据、引用、M0 延期边界对齐；当前范围 5/5 核对；Option C 仍为提案，engine 仍是豁免 | [#1757](https://github.com/Proto-UI/Proto-UI/pull/1757) |
| #754 | 真实 Dialog 源变体、合法定制、held-out 对照实际运行；原 28 条漏掉一个应用动作接线错误，新增观察能捕获；原早期入场焦点故障保留并交回 #1178 | [#1757](https://github.com/Proto-UI/Proto-UI/pull/1757)；未把实验用 settled-entry 处理宣称为生产修复 |
| #751 | 在预先声明的零边际费用假设下，复用实际 Tabs 轨迹，未观察到知识路径的行为或修复收益；费用假设与未知账单分开 | [压力实验](2026-11-24-sprint7-zero-marginal-cost-study.md) |
| #750 | 两个 fresh Agent 完成真实生成 Button 的普通应用消费，实际各 9/9；只有第二个拥有完整原协议时钟，严格样本 1 次尝试、1 次完成 | [消费实验](2026-11-24-generated-button-consumption.md) |
| #749 | 官方 Compiler 三次真实生成与三个独立生成实现，在同一 React Button 契约下均通过；修复均为 0，源码、体积和输入边缘差异另记 | [确定性与生成式比较](2026-11-24-button-projection-comparison.md) |
| #734 | 成熟库、附带知识、普通要求各三个独立实现，全部 22/22；三个预定维护修改也全通过；修正未来知识入口的错误 criterion 锚点 | [知识比较](2026-11-24-sprint7-knowledge-comparison.md) |

这些实验接受中性或负面结果，不以证明 Proto UI 优势为关闭前提。Tabs 的 #734 与 #751 共用轨迹，不计为两次独立实验；Button 的固定比较样本也不充作 #750 的普通应用消费者。

## 独立复核

独立 Agent 的角色是核对真实来源、冻结、执行、失败、比较与有限结论。它们没有补造原生审批。

- [Tabs 结果审查](evidence/2026-11-24-knowledge-value-study/independent-audit.json)：核对 1,401 份原始文件、12 份观察、源码及资源绑定。
- [Button 比较结果审查](evidence/2026-11-24-button-projection-study/results-review/review.md)：有界比较接受，无阻断发现；固定 d0 源、1,693 份来源记录与六条真实旅程可复查。
- [消费结果审查](evidence/2026-11-24-generated-button-consumption/independent-review/review.md)：751 份封存文件、42 条实际事件、四份生产资源及九张原图一致，无阻断发现。
- [#1757 已实际发布的原生 COMMENT](https://github.com/Proto-UI/Proto-UI/pull/1757#pullrequestreview-6029605765)：独立范围审查的真实出版回执；状态是 `COMMENTED`，不是 `APPROVED`。完整输入及发布包在 [整合证据目录](evidence/2026-11-24-sprint7-integration/)。

Playwright trace 的响应正文并不总是完整：Tabs 的 JS 没有 trace body，依据是保留的 dist、实际服务器读取摘要及请求/200 记录；Button 和普通应用的 JS 另外有实际 observer `response.body()` 摘要，但也不能称为 trace 内嵌正文。具体报告分别说明这个边界。

冻结 oracle、参与者输入、archive 和已接受记录保持原字节。维护脚本如作格式整理，其前后摘要、语义对照及冻结字节核对另记；原执行使用的 oracle 不因此改标版本。压缩容器转换有逐份路径、长度和 SHA 等价核对，没有删除失败或改变来源。

## 验证及实际整合条件

本轮不是完整全库回归，也不替代其他 Sprint 的 release、硬件、读屏或非 Web 条件。受影响的来源、安装、构建、原生浏览器与独立接受按各条实际范围记录。

#1757 固定 head 的一次补充 `check-coverage-matrices` 在 240 秒上限被 SIGTERM 终止；stdout/stderr 为空，峰值 RSS 930,328,576 字节。它不是成功，也不能从这次记录断言 OOM 或产品断言失败。旧 SIGKILL 和 aggregate prototype failure 各自保留。当前有界来源核对与其它成功验证没有被这条未完成检查自动扩大或抹消。

截至已留存的 2026-11-23 21:12 UTC 平台回读，#1757 为 Ready、MERGEABLE/BLOCKED，真实 DCO 成功，轻量 PR CI 聚合成功；Vercel 为 build-rate-limit failure，缺少独立原生 APPROVE。普通重型 CI 按事件策略未运行，不是因为 Draft，也不因 Ready 自动成为已运行。后继状态须从真实平台重新读取。

仓库 `pui-integrate` 要求普通整合的精确 head 独立批准、CI、DCO、线程和权限全部符合。当前连接的 GitHub 身份也是 PR 作者，不能自我批准；Agent 的独立内容复核与已发布 COMMENT 不能伪作另一身份的批准。若最终仍需要另一路精确整合决定，必须保留实际失败/未执行项及全部来源，并由当前用户明确决定那些具体延期；不会把一般“补完”指令擅自改写成该决定。

Issue 回填应链接实际候选、独立接受、真实合入 SHA 与合入后检查；原延期关闭历史保留。未取得的合入回执不能用本记录代填，已经完成的有界结果也不因此再列作未开发。
