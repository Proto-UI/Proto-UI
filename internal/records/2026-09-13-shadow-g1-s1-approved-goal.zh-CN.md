# G1 / S1：正式 Shadow split 接线与人工验收目标

日期：2026-09-13。状态：用户已批准的阶段性目标与实施计划，non-normative。

本记录承接 `2026-09-13-shadow-f1-delivery-and-public-split-gate.zh-CN.md`。用户选择 G1，并批准下列 S1 目标及中间路线委托。旧记录中的提案保留历史原貌；语义由对应 spec 决策治理，本记录不替代 spec，不提升 draft lifecycle。

## 已批准的 G1

仍只有一个 `AdaptToWebComponent`，通过以下显式配置启用实验性 split profile：

```ts
AdaptToWebComponent(proto, {
  shadow: {
    mode: 'open',
    presentation: 'split',
    styleArtifact: protoShadowStyleArtifact,
    // colorSchemeSource: { get, subscribe },
  },
});
```

同步 v1 artifact 由真实 CLI 生成。WC package root 导出 `ShadowStyleArtifactV1`、`ShadowColorSchemeSource` 类型，不导出 renderer、builder 或 coordinator。Omitted/false 仍为 Light，true 仍为 direct Shadow，绝不静默迁移。

Owner 在首次 connection、view 初始化前同步建立环境、stylesheet、stable inner surface 和 Root routing，失败回滚，view epoch 与同步 move 保留资源，terminal teardown 释放、reconnect 建立新 generation。环境 retained source 同时驱动 host marker 与 runtime colorScheme，其它 meta 委托原 getter。

Surface 位于 ShadowRoot 内并暴露 `part="surface"`，复用 normalized `surfaceStyle` / `surfaceClassName`。类只保证投递，不自动引入 document CSS；主题变量继续继承。生成式 token recipe 保证受治理的 sizing/cascade parity；native host CSS、part、raw surfaceStyle、Shadow-local CSS 是显式 escape，覆盖 layout/font/padding/border/display 等可能破坏尺寸等价。没有 arbitrary CSS 自动分析/同步，也没有新增作者 `surface:` / `placement:` 语法。

首版拒绝未治理的 text-control/image-view 声明、unresolved/composite recipe 和缺失编译闭包，不静默回退。完整 Dialog Mask 的 hidden 不重分类。异步 artifact/reveal barrier、严格 CSP/nonce/constructable stylesheet 保证不在本阶段。

## S1 必达结果

人工入口在现有 demo-matrix 内，走正式 Adapter 与 CLI artifact，不使用 private harness 或页面模拟组件行为。两组完整原型必须并排比较 Light 与 split：

- Brutalist Badge：inline baseline、布局/受限宽度、tone/主题、slot 与隔离。
- Shadcn Checkbox Root + Indicator：真实 Context 组合、glyph 更新、嵌套 WC、焦点/输入/a11y。Root-only 不算完成。

验收场景：

1. 布局与首次显示：baseline、尺寸、换行和受限容器；首帧没有可观察的未着装闪现。
2. 主题与状态：light/dark、继承主题变量、props/state 更新、逐实例独立 colorScheme source。
3. 隔离：可切换的局部 document CSS 干扰，证明内部 surface 不被直接匹配；明确 host、继承和 slotted content 不是完全隔离。
4. 定制：`::part(surface)`、surfaceStyle 改色/复原、surfaceClassName 只投递；不把任意 CSS metrics gap 标成通过。
5. 输入与组合：鼠标、Tab、Space、disabled、Indicator、状态通知，不重复事件、不增加焦点目标。
6. 更新与生命周期：slot 替换、props 更新、同步 move 保持实例、terminal remove/reconnect 更新实例并撤销旧资源/事件。

交付前需有真实 package build/types、CLI 生成/import/再生成证据；boolean profiles 和其它 Adapter 无本轮引入的回归；无效 artifact/不支持原型或 token 明确失败且不残留半初始化资源。提供固定入口 URL、短验收清单、已知限制与可复制项目接入片段。

基线为 Chrome 完整验收。不承诺全浏览器支持、真实 screen reader conformance、native text/image、Dialog/portal、任意 raw CSS sizing 自动同步。

## 实施与授权边界

继续 `codex/shadow-dom-style-role-record`。按记录/权威同步、正式 Adapter 与测试、demo/CLI 交付、浏览器验收与收尾分节点本地 commit；节点可因合理内聚性调整。现有 unrelated staged/untracked 文件不参与提交。

用户授权自行决定内部拆分、seam、先后顺序、preview profile 注册/artifact 组织、目标内兼容修复与证据补齐。继续工作直到 S1 可验收或真正需要语义决策，不为每个内部选择重复请求批准。

若需要改变既有原型/协议语义、新增作者概念、扩大 G1 公共保证或削减必达目标，必须提出决策，不自行修改目标。此授权不包括 push、merge、publish、release 或其它外部写入。

## 权威与检测路径

- `D-WEB-COMPONENT-SHADOW-PROFILE-0001`、`D-WEB-COMPONENT-SHADOW-STYLE-0001`：对象配置、交付、资源/环境和公共边界。
- `C-HOST-SURFACE-PROJECTION-0001`、`D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`：target/domain 与生成式尺寸贡献。
- `T-WEB-COMPONENT-SHADOW-PROFILE-0001`、`T-WEB-COMPONENT-SHADOW-STYLE-0001`：按实际运行结果补 production evidence，不提前标 passing。
- `packages/adapters/web-component/src/adapt.ts`、`packages/cli/src/services/shadow-style-delivery.ts`、`apps/www/src/components/PrototypePreviewer/DemoMatrix.astro`：实际实现与验收入口。

本记录写入时，F1 已交付；正式 public split 与 S1 页面尚未完成。后续 checkpoint 应追加事实、命令与限制，不把本计划当成完成证据。
