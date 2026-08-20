---
title: '维护已有 Prototype'
description: '从适用 P/T 实体出发，修复行为、补证据并解决公开投影 drift。'
---

维护已有 Prototype 是进入 Proto UI 最直接的工程路径。你不需要重新证明这个 Prototype 是否应该存在，但必须先确认它当前承诺了什么，以及问题属于实现、证据还是公开投影。

## 适合这条路径的工作

- 修复与现有 `P-*` criterion 不一致的行为；
- 为已有保证补 regression 或 characterization test；
- 修复 package export、CLI registry、文档或 Demo drift；
- 补充某个已定义状态在 Light、Dark、键盘、窄屏或三 Adapter 预览中的证据；
- 修正来源、上游版本或兼容边界说明；
- 删除已经被实体明确排除的错误能力暗示。

如果你想增加新的 props、events、states、anatomy part 或兼容承诺，这通常已经不是普通维护。先判断是否需要修改 P criterion、revision 或关联 decision。

## 第一步：找到适用实体

不要从文件名开始猜规则。先搜索：

```sh
rg -n "<prototype name|entity id|criterion id>" spec packages/prototypes apps/www internal/records
```

至少确认：

1. 适用的 `P-*` 实体及其 `status`；
2. 与问题相关的 criterion；
3. 映射的 `T-*` 实体和 executable implementation path；
4. Base inheritance、related decision 和负向边界；
5. 相关 package source、tests、exports、CLI registry、docs 和 Demo；
6. 是否存在更新的相关 record 描述短期方向。

`draft` 是当前编目方向，不等于稳定公共保证；`active` 才是当前稳定保证。实现与适用实体冲突时，把它视为 drift，不要默认当前实现获胜。

## 第二步：给问题分类

### 实现 drift

实体和测试期望明确，但运行行为不一致。修复实现，并添加能在修复前失败的测试。

### Evidence gap

行为可能正确，但 `T-*`、focused test、三 Adapter preview 或真实消费证据不足。补最小可执行证据，不要顺手扩大语义。

### Projection drift

实现和实体一致，但 export、CLI、README、网站、Demo 或生成数据不一致。修改治理源或手写投影，并通过 generator 更新生成物。

### Spec change

期望行为本身需要变化。普通维护到这里应暂停：先在 Issue 中说明受影响 criterion、兼容影响、备选方案和所需 checkpoint，再修改实体及其 revision、T evidence 和所有受影响投影。

## 第三步：保持改动闭环

一个行为修复通常应按这条链检查：

```text
P criterion
→ T case and executable test
→ Prototype implementation
→ Base or design-language inheritance boundary
→ package exports and CLI surface when affected
→ docs, demo, and real preview
```

不是每次都要修改链上的每个文件；只有发生 drift 的部分才需要改变。但 PR 描述应说明检查了哪些节点，以及为什么其他节点不需要更新。

## 测试原则

- 测试应锚定 criterion 或明确的既有行为，而不是当前实现细节。
- 行为修复应证明测试在修改前失败。
- 风格状态应同时验证正向效果和不应出现的能力。
- 涉及跨 Adapter 语义时，先确认问题属于 Prototype 还是 Adapter；不要用 Prototype 私有逻辑掩盖 Adapter parity drift。
- 测试 teardown、remount 或异步行为时，保留 owner 和生命周期边界。

Focused test 示例：

```sh
corepack pnpm@10.32.1 vitest run packages/prototypes/base/test/separator.test.ts
```

## 文档和 Demo

当改动改变公开行为、状态、anatomy、样式或推荐用法时，必须在同一 PR 中更新官网已有的 Prototype 页面。纯测试、内部重构或不影响现有预览的修复不需要新建页面，但 PR 应说明为什么现有页面仍然准确。

Demo 是真实 package export 的消费证据，不应成为另一套实现。官网 Demo 应尽量拟合开发者安装 package 后的直接使用方式：

- 从公开 package subpath 使用 Prototype；
- 展示该改动涉及的状态或行为；
- 在适用时通过 Web Component、React 和 Vue 预览；
- 优先使用 Prototype 自己的 anatomy、trigger、state、event 和 default behavior 完成交互；
- 不通过页面私有 CSS、脚本或额外控制逻辑绕过协议问题；
- 为交互控件提供可访问名称。

例如，Dialog 应由 `dialog-trigger` 打开；不要为了让 Demo 成立，在无关 Button 的 click callback 中调用 Dialog expose。只有原型按设计没有自然 trigger，或其公开 controls 本身就是被演示的能力时，才允许最小外部控制，例如 Toast-style invocation 或直接驱动 Transition。例外代码必须：

- 位于 Prototype 之外，只使用公开 API；
- 保持为完成演示所需的最小范围；
- 在 Demo source 与 PR 中标记为不会随 package 安装、需要消费者自行实现的 orchestration；
- 不得掩盖缺失 anatomy、错误 ownership 或 Adapter drift。

新增公开 Prototype 不属于普通维护；对应贡献必须提供一个接入官网文档入口的可访问页面，并在 PR 中填写本地预览路由。内部 Demo Matrix 只能作为补充证据，不能替代官网页面。

## 提交前检查

```sh
corepack pnpm@10.32.1 check:prototype-catalog
corepack pnpm@10.32.1 check:types
```

涉及文档或 Demo 时再运行：

```sh
corepack pnpm@10.32.1 docs:build
```

完整测试是否需要运行取决于影响范围。PR 中应记录 focused test、catalog、types、docs 和任何手动验证的实际结果。

## 什么时候升级为设计工作？

遇到以下任一情况，先回到 Issue：

- 需要增加或改变 P criterion；
- 需要改变 Base 与 styled projection 的所有权；
- 需要新增 anatomy identity；
- 需要把宿主事实提升为跨宿主协议；
- 现有 P、T、实现和文档互相矛盾，无法确定哪个是 drift；
- 需要扩大第三方兼容声明。

下一步：如果你的工作是基于已有 Base 增加设计语言表面，阅读[从 Base 投射风格化 Prototype](/zh-cn/build/prototypes/projecting-base-into-a-design-language/)。
