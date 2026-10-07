# Shadcn Dialog Close 无样式边界与 Footer 消费布局修复

## 真实回归与适用边界

Finf #872 的第五批 Dialog 修复在 `a1e3f0db4956606b90a5e069427ad1dddac63422` 为 Close 添加 `min-w-0 max-w-full`。当前 `86f2c0c52e370d703665028d8ef5cef45f0685a0` 验证树的四 Adapter journey 均在原有 `expectTransparentSemanticParent` 断言失败：Close 出现 `data-pui-style`。这是实现偏离既有 draft `P-SHADCN-DIALOG-CLOSE-UNSTYLED-SURFACE` / `CURRENT-BASE-DEVIATIONS`，不是应放宽的测试。

本次仅恢复已确定的实现边界，不修改 Close/Footer 规范、生命周期、Button API、Footer recipe 或任何原有阈值。第五批记录中的 Header/Close 共同拥有 inline bounds 是当时实现描述；此处用新记录修正，不改写历史。

## 最小所有权调整

- Close 仅调用 `asDialogClose()`，不再贡献默认 style tokens。
- 真实公开 Shadcn Dialog demo 的两个 Footer action 各增加一个普通、无 role、不可聚焦的 consumer layout box，由它持有 `min-w-0 max-w-full`。
- 每个 box 位于完整 `Close > Button` 链之外。Close 仍持有关闭命令，内层 Button 仍是唯一 pointer/focus/a11y surface；box 和 Close 的宿主空白区域不能触发关闭。
- Footer 保留 intrinsic `flex-wrap-reverse`，Button 保留显式 `wrap: true`、自动高度和 label wrapping，Content 保留 bounded single grid track。没有通过移除换行或隐藏溢出来掩盖裁切。
- 这是明确的消费层布局，符合 `P-SHADCN-DIALOG-FOOTER` 对任意后代尺寸的责任边界，不宣称未采用该布局的任意自定义 action 都会自动适配。

## 已执行证据

工具链为 Node 24.19.0 / Corepack pnpm 10.32.1。

1. 原四 Adapter journey：4 fail，全部命中原有 Close `data-pui-style` 断言。
2. 增加 standalone Close 无 style-token 与四 Adapter 长标签组合控制后、修改 source 前：9 fail / 1 pass；失败仍为相同无样式边界。
3. 负控制：只移除两个 consumer sizing box、保留无样式 Close，得到 8 fail / 2 pass，失败指向缺失的布局 owner。它证明测试能识别只回退 Close 而丢失消费层约束的方案，不是原生几何证明。
4. 恢复最终 source 后，以下六套 focused Vitest 共 21/21 通过：`packages/web-conformance/test/shadcn-dialog.journey.test.ts`、Shadcn `dialog.test.ts` / `button.test.ts` / `component-presets.test.ts`、previewer `demo-renderer.test.ts` / `demo-narrow-reflow.test.ts`。四 Adapter 原短标签旅程及新长标签旅程均通过，包含内层焦点循环、激活、关闭后焦点返回及 layout box 不激活。
5. 正规 `corepack pnpm@10.32.1 check:types` 通过：workspace TypeScript 与 Astro 528 files，0 errors / 0 warnings / 6 hints。没有以非规范全局 tsc 结果替代它。

6. `check:styles:preset` 与 `check:prototype-catalog` 通过，生成的 token manifests 无变化；历史 Dialog baseline classifier 11/11 通过。

Happy DOM 的这些结果只证明真实 consumer recipe 与交互所有权，不证明 CSS layout、真实 pointer hit 或可见 focus ring。

## 保留的原生验证债务

`dialog-available-space.browser.test.ts` 保留 390px / 200% root text、长内容、长 action label、CDP scale 2、滚动、实际 action hit test、Tab / Shift+Tab 以及关闭恢复的原有断言；新增同一长文本条件下的 Shadcn 320px / 200% 对照。

原生探针额外要求两个 Footer Button 加独立 CloseIcon 共三个 action，Close 无默认样式和额外 role/focus surface，consumer box 实际有 inline bounds，长 label 不溢出 Button，所有 action 位于实际 Content inline region 且可命中、可达。逐 action observations 绑定实际 source SHA、family/runtime/阶段、viewport 与 root font size；截图仍由真实 browser capture 产生。现有八个 native journey 名称、数量、历史 baseline 分类及所有几何阈值保持不变。

本环境此前已确认 Chromium Unix socket 创建被拒绝，审查后的提升执行仍失败。本次未重复启动、未绕过限制，也没有新截图或 native pass。仍须由最终集成 head 的受支持 CI 执行完整八旅程并检查真实截图；旧 head 的图片和本次 21 个非浏览器通过不能替代它。没有从该局部修复推断整个 Finf 或第五批视觉验收完成。
