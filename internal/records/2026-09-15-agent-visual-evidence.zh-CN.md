# 2026-09-15 Agent 图证软门禁与首批补证

本文是实施与验证记录，不是另一份规范。执行规则见 [Agent evidence](../agent-operations/visual-evidence.md)，操作方法见 [gh 上传教程](../agent-operations/github-evidence-upload.md)。

## 用户请求转述

以下为 Agent 转述，非用户逐字原文：所有由 Agent 提交或推进的 Issue/PR 都应附适合题材的图证、必要示意/HTML artifact 和经过脱敏的需求转述；历史 Issue 通过复现逐步补证。要求对当前 Agent 立即生效，不等规则 PR 合入。用户进一步明确，这是 Agent 的责任，人可以只描述现象，不应被图片或表单限制；Gist 与 API 都可作为上传路径。

## 本次范围与实现

- 一份集中指引承载软门禁；开发/维护入口、Issue/PR 只读检查、验证 skill 和贡献入口引用它。
- 公共模板只增加可忽略的 Agent 说明，没有必填字段、图片存在性 CI 或新的合并限制。
- `pui-issue` / `pui-pr` 仍只读。上传、评论、分支、设计和审查的授权边界保持分离。
- 教程区分附件、Gist、Contents API、普通 Git、独立证据分支、已授权 Release/托管与 Actions artifact；没有启用 Pages、创建 Release 或更改设置。

## 图证与实测

![人只描述现象；Agent 负责调查、复现、上传、需求转述和显式证据缺口](https://raw.githubusercontent.com/Proto-UI/Proto-UI/0f22e503ad173974b276b8341c223e1a5010853f/evidence/2026-09-15/agent-policy-4e0e93f9dda7.png)

上图是流程解释，不是产品复现或平台已强制执行的截图。[固定版本 Gist](https://gist.github.com/cyjin-yl/a716d0491c9b49a3896baa7135507df0/3c92ff8dd6697043a127fddf853cad09f96c22d9) 包含该图的 HTML、四条 Issue 的执行报告、夹具和日志。Gist 保存源码，不直接执行 HTML。

Gists API 和 Contents API 已分别上传文本/HTML 与 PNG，并回读核对；5 张图片匿名 HTTP 返回 `image/png`，下载内容 SHA-256 与本地一致，总计 372,231 字节。PNG 位于 `codex/issue-visual-evidence-20260915` 独立证据分支，不合入 main；它仍占 Git 存储，不是零成本附件。没有克隆或生成 bundle。附件编辑器、Release 和 Actions 上传仅有机制说明，未作为本次实测成功路径。

在产品基线 `8f2eba12c2c980d0f4d92713106e798891738106`，Node 22.22.1 / pnpm 10.32.1 / Vitest 2.1.9 + happy-dom / Windows 下重新执行 14 个观察测试。这些测试确认当前缺陷和正常对照，不是修复验收；临时夹具已从 worktree 移除，保留在 Gist 中。

首批追加到 [#647](https://github.com/Proto-UI/Proto-UI/issues/647#issuecomment-5670902304)、[#648](https://github.com/Proto-UI/Proto-UI/issues/648#issuecomment-5670903279)、[#649](https://github.com/Proto-UI/Proto-UI/issues/649#issuecomment-5670904363)、[#650](https://github.com/Proto-UI/Proto-UI/issues/650#issuecomment-5670905385)，原文与状态保持不变。执行轨迹的 HTML 截图和解释性图示被明确标注，未冒充产品 UI、原生终端、真实 IME 或四 Adapter 浏览器截图。

## 验证与剩余范围

`check:agent-operations`（58 tests）、`spec:docs:agent`、`check:agent-doc` 和 `git diff --check` 通过。另有独立只读文档复查；它不是 PR approval 或合并验收。没有产品变更，因此未运行全量产品/types 测试。

盘点覆盖全部 228 个历史 Issue：61 open、167 closed。首批 4 条已补确定性图证，其中 Runtime Adapter、原生 IME、真实 pointer/style 等仍有明确证据缺口；其余 224 条尚未完成逐条讨论阅读、复现与补图。不能把正文没有图片视作评论也没有证据，不能把清单当作已执行结果。后续按讨论、已有资产和安全的历史基线串行处理，保留未知原始 prompt 与不可复现环境的事实，不改变历史关闭状态。
