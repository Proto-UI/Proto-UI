# 2026-09-15 历史 Issue 图证续补

本文接续[图证返工记录](2026-09-15-agent-evidence-correction.zh-CN.md)，只记录本批执行事实，不修改产品语义或历史验收结论。

后续校正：评论计数的时间口径及持久逐项账本见[执行链修正记录](2026-09-15-agent-evidence-workflow-repair.zh-CN.md)。以下原记录保留历史，不作为更晚快照的总量声明。

## 范围与进度

用户已把数量笔误更正为“两百多个”。本轮清单仍为全部 228 个历史 Issue，包含 61 个 open 和 167 个 closed。Agent 负责真实复现、题材适当的图、脱敏请求转述与证据缺口；不限制人类用纯文字提出问题。

截至本批回读，6 条已有按明确范围发布并核验的新标准证据：#647–#650、#630 和 #3。其余 222 条尚待按新标准补证。该数量不是完整验收或已解决数；每条已有证据仍保留自己的覆盖限制。抓取的 514 条历史评论也不等于逐条审阅完成。全量任务未完成。

## 本批实际交付

| Issue | 新证据 | 没有证明的范围 |
| --- | --- | --- |
| [#647](https://github.com/Proto-UI/Proto-UI/issues/647#issuecomment-5670902304) | 实际 RuntimeSession 与最小 DOM host；旧 view 回执保留时，新 epoch 已 mounted 的 update 不 render；交付旧回执仍不恢复；同 epoch 对照正常排空 | 官方 deferred-commit Adapter、其他回执交错、终止/异常路径、完整修复验收 |
| [#630](https://github.com/Proto-UI/Proto-UI/issues/630#issuecomment-5671056994) | 原报告源码 `27b7c12dc256ab326422547d298f884f124aa7ee` 的实际文档站；1440/390、light/dark 共四图可直接比较 Previewer 与 EC 排版/背景 | 共享依赖下的 Astro dev，不是当年 production 环境重建；320px、同源 token、collapsed 交互、导航与其他浏览器仍欠缺 |
| [#3](https://github.com/Proto-UI/Proto-UI/issues/3#issuecomment-5673875673) | 当前官方 WC Base Button 示例；真实焦点轮廓、鼠标/Space/Enter 激活、disabled 对照与原始状态/事件采样 | 不是 2024 年实现重建或追认；其他 Adapter、主题/移动端、完整 Button 语义未覆盖 |

#647 与 #630 原位替换 Agent 自己的 evidence comment；#3 追加署明来源的补充，不改作者原文与 closed 状态。#648–#650 的上一批新证据保持其原范围，未冒称本批重新执行。

## 内部状态如何解释

#647 使用 `4d28834624dfcd1a0fd31aa6ec0d5f6e30482aae`，其 `packages/runtime/src/instance/session.ts` 与报告产品基线 `8f2eba12c2c980d0f4d92713106e798891738106` 无差异。夹具绑定真实 `RAW_PROPS_SOURCE_CAP`，通过 `renderer.read.props.get()` 读取输入，仅绘制 Runtime 返回的模板；回执与 mounted task 显式交付，无 timer/retry。

实测 epoch/phase、render 次数、host 持有的 signal、owner input 和 DOM text 按步骤对照。跨 epoch 渲染计数为 `1→2→2(detached)→3→3→3→4`。旧回执交付后没有自动新 render；同 epoch 对照则能自动渲染第二次输入。`updateInFlight`、`updateQueued`、`dirty` 是闭包局部变量，夹具没有读取；共享标志与 stale 分支的作用是源码推断，公开说明将两者分开。额外 update 仅为诊断对照，不是消费者 workaround 或修复方案。

期望沿用 active `C-LIFECYCLE-0008-D/E`；`C-LIFECYCLE-0006-C/D` 仍为 draft，不提升稳定性。

## 历史与当前事实不互相替代

#630 新图确实来自原报告源码。先前同日的当前版本成功截图单独署明 revision 与运行归属；未把历史差异说成当前仍存在，也不以当前正常推翻旧报告。

#3 是 feature 请求，补的是对应题材的真实组件示例，不虚构 bug。当前 `P-BASE-BUTTON`、`T-BASE-BUTTON-0001` 仍为 draft。示例视觉来自消费层 className，不是 Base 内置视觉参数。真实键盘焦点状态与三次业务 custom click 有原始采样；原生 click 不重复计入业务事件。

阅读时还发现 `internal/contracts/prototype-base/button.v0.md` 的通用行为 substrate 表述，与当前 `D-BASE-PROTOTYPE-INDEPENDENCE-0001` 的协议专属 authoring-entry 方向不一致。补充说明服从 spec，不在本批改写旧合约、创造新语义或绕过设计决策；该文字投影差异单独留作后续核对。

## 归档、验证与成本

- [#647 固定版本夹具与原始状态轨迹](https://gist.github.com/cyjin-yl/a716d0491c9b49a3896baa7135507df0/75ca1644454fa35485c774ad2de7a93dd12737c0)。六张截图所在 evidence-only commit：`7c1b62b4fcfc3fac31d23df7ee8e6610969db08d`。
- [#630 固定版本操作说明与 computed styles](https://gist.github.com/cyjin-yl/a716d0491c9b49a3896baa7135507df0/a8f6b0b9ba29890df9aaaf6b7288b67d51f13395)。四张截图所在 commit：`ce376b2506808f953da614d220bd2853c75d1c3e`。
- [#3 固定版本操作说明与状态/事件采样](https://gist.github.com/cyjin-yl/a716d0491c9b49a3896baa7135507df0/4b6950451082aafe70902350c37a65594549d6ef)。两张截图所在 commit：`b7c4fc4b6920837b4f95062ad07b05aeb3fc3e40`。

图片经逐张目视、上传回读和匿名下载 SHA-256 核验；Gist 展示源码，不执行 Astro。12 张新增截图按三个小批次写入同一证据专用分支，该分支不得合入产品。复用共享 Git、worktree 和依赖，没有另建 clone/bundle 或安装依赖。

本批执行 Node22.22.1/pnpm10.32.1 下的 Runtime 跨 epoch/正常对照断言与当前 Button 浏览器断言。未把调试夹具的初始化/API 绑定错误算成产品缺陷。PR651 旧 head `4d288346` 的实际 CI/DCO/preview 检查均为 success，包括 type-check/test；这不预先证明后续提交，也不是人工批准。没有产品修复、Issue 状态变更、认领、approval、merge 或 loop/自动化。

本记录的 `check:agent-operations`（58 tests）、`check:agent-doc`、Prettier 与 diff 检查通过。临时 Runtime 复现页与归档源码 SHA-256 一致后已移出产品 worktree，测试服务器和浏览器已停止；保留源码、截图、脚本、回执与可续跑账本。没有本地重跑全量产品/types suite。
