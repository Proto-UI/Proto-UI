# 2026-09-15 Agent 图证返工

本文补充同日的[首批记录](2026-09-15-agent-visual-evidence.zh-CN.md)，不改写其历史。用户指出此前把报告截图作为 bug 图证，不能直接看到组件故障，要求重做；纯内部故障应通过实际变量表和状态变化，像技术文章一样讲清细节，而不是凑图片数量。

## 用户要求转述

以下为 Agent 脱敏转述：可见组件故障需要真实运行截图；纯内部故障需要实测 varlist、状态转折和因果解释。所有历史 Issue 都要补充适合题材的证据，不能只做少数样例。用户已将“2000 多个”更正为“两百多个”；当前明确范围是 `Proto-UI/Proto-UI` 全部历史 Issue，包含 closed。Agent-only 责任、需求转述、软门禁和不限制人类提交保持不变。

## 对先前证据的更正

- #647–#650 的旧 HTML 报告图片不再计为合格的本轮补图成果。原始观察测试和日志可以保留为辅助资料，不冒充实际组件截图或充分的内部故障讲解。
- #630 当前页面的成功截图只证明当前观测，不能替代旧版本样式冲突的复现。
- 先前图证的上传成功、可访问和哈希一致，只证明传输，没有证明证据质量。
- 清单登记、正文图片搜索、历史关闭状态都不代表逐条补证完成。需要分别记录讨论阅读、复现、已发布核验和剩余缺口。

规则集中在 [visual-evidence.md](../agent-operations/visual-evidence.md)，开发入口同步强调这一区别。没有改动产品语义、给人类增加表单要求、关闭 Issue 或批准 PR。本次全量历史任务仍未完成；实际批次进展以逐项复现和公开回执为准。

## 本次已重做的范围

全分页核对得到 228 个 Issue（61 open、167 closed）与 514 条评论；抓取完整不等于逐条审阅或补证完成。

- [#648](https://github.com/Proto-UI/Proto-UI/issues/648#issuecomment-5670903279)：真实 Chromium textarea + TextControlModuleImpl/Web host，受控 mount 与合成 composition。截图展示 owner 更新后对照编辑框有值、实验编辑框为空；不声称 OS IME 或完整 Adapter 验证。
- [#650](https://github.com/Proto-UI/Proto-UI/issues/650#issuecomment-5670905385)：真实 WC/Brutalist、trusted pointer、L1 detach/remount。恢复后 pressed/hovered 仍为 true 且阴影缺失，再次移入移出恢复；未手工修改组件状态或 CSS，不扩展到全部 Adapter。
- [#649](https://github.com/Proto-UI/Proto-UI/issues/649#issuecomment-5670904363)：真实 StateKernel 的 value/emitting/pending 采样，与 actual event payload 按序对照。说明异常如何留下队列以及下一次派发如何越过旧事件；不是虚构的 UI 故障，exception-policy 仍待决策。

三条自身 evidence comment 已原位更正并回读，没有重复发新评论。#647 自身旧评论增加了撤回图证充分性声明，仍待重做；#630 仍缺本轮历史失败复现。其余条目没有因为清单已获取而被计作完成。

[固定版本源码与采样](https://gist.github.com/cyjin-yl/a716d0491c9b49a3896baa7135507df0/8950d8690faeb6ee06051641a78ca5f24cdecf04) 提供 Astro/TypeScript 页面、JSON 与启动步骤。10 张实际采集图片通过单个 evidence-only Git commit `6dff445ad78b38cbfb52cb4ac26b55baad615e4e` 上传，并逐张目视与匿名下载哈希核对。相同画面共享 Git blob；证据分支不合入产品。没有新建 clone/bundle 或安装另一份依赖。

Node22.22.1 / pnpm10.32.1：两条浏览器复现与对照断言、StateKernel 采样断言、`check:agent-operations`（58 tests）、`check:agent-doc`、两个变更 skill 的 quick validation、格式检查通过。未跑全量产品/types suite：没有产品修复；局部临时页面已单独归档，不进入本 PR。上述验证不是独立 review 或人工验收。
