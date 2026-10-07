# 快速开始首帧与增强后外观连续性

日期：2026-10-07。范围：Finf PR #872 的公开快速开始页消费层；不是 Prototype 或 Adapter 新契约。

## 原始观察

用户提供同页首帧/稳态截图。逐图检查可见 Note 从蓝紫底、粗左边框切换为浅色细框，标题和发布说明首行字重下降。两图裁切不同，不能据此宣称精确布局位移。

公开生产页 DOM 只读检查补充了对应事实：

- Note 原生标题为 18px/600，而实际 Text label 为 14px/500；旧 Starlight flow border 为 4px，增强后真实 Surface 在绝对定位装饰层，原生 border 清为 0。
- 发布说明原生标题 15.68px/600，自动 body Text 为 16px/400；正文原生 14.72px，Text 为 16px。
- 所有这些差异都能由当前消费源码解释；未将其归因于未经证实的字体网络下载。

## 修复与边界

1. Note 从首帧开始使用与公开 Surface outline/all/no-elevation recipe 一致的被动备用装饰层。Shadcn 和 Brutalist 的颜色、边框、圆角、字体来自已有 family 输入。真实 Surface 提交后仅移除备用层；原生 Aside、源内容、图标和语义始终保留，失败或无 JavaScript 时可读。
2. Note title 的 label 意图在第一次收集时确定，不依赖 Surface 异步挂载后追加 marker。原生标题与增强后的三层载体使用相同字体和 flex 行盒。
3. DocStageNotice 显式消费 `notice-title` 应用角色，映射到既有公开 Text props：base/semibold/body/relaxed。正文和标题首帧尺寸、行高、墨色与实际 Text 一致；没有修改发布说明正文。
4. 仅对原生 heading、p、figcaption 这些块级阅读消费位置明确 Text 的 block 布局，保留 label/legend 与其他合法 inline Text。原生正文 leading 与公开 relaxed 输入一致。
5. 没有隐藏整页、延后整页展示、用不透明遮罩掩盖切换，也没有绕过 Prototype paint owner。

## 证据

- 新增源回归先 red 后 green；真实四 Adapter typography 测试验证标题输入、原文节点/链接/选择与销毁，仍保留 inline negative。
- `quick-start-first-frame.browser.test.ts` 有 10 个原生用例：4 Runtime × desktop-light / narrow-dark，每个包含冷启动和刷新，另含两个无 JavaScript 用例。
- 用例暂停可执行脚本而放行真实 HTML/CSS/fonts，保存 stylesheet-ready 首帧，再放行脚本、保存稳态。逐帧记录变化，比较相同源、主题、字体、视口下的可见性、文字、几何（1px）、字重/字号/行高/墨色及装饰层 paint。
- 截图和 JSON 在断言前保留，专属 workflow 校验全部 10 项并上传 exact-head 工件。它是公开源码页实测，不是拼造初始 DOM 的截图。

本地 Chromium 执行受环境限制，未重试或绕过；本记录不能替代最终提交上的原生 CI 结果和图像复核。历史失败保留。
