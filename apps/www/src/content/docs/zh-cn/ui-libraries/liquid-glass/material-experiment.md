---
title: 'Material 实验'
description: '基于 Base Button 与应用自有场景源的折射材质实验记录及其与 Liquid Glass Button 的关系。'
---

本页记录早期的折射材质实验组合（`experimental-owned-material-button`），用于探索如何在不绕过公共协议的前提下，为 [Base Button](/zh-cn/ui-libraries/base/button/) 叠加可复用的视觉材质能力。该实验仅作为历史技术参考，与当前的 [Liquid Glass Button](/zh-cn/ui-libraries/liquid-glass/button/) 相互独立。

## 设计思路

实验原型通过 `asButton()` 复用 Base Button 的输入、焦点、禁用与按压语义，并在此基础上声明：

- **折射材质意图**：由样式决定圆角几何、前景颜色与不透明回退外观，不在原型中直接编写 shader、纹理或渲染通道。
- **应用自有场景源**：材质采样来自应用显式提供的 RGBA 场景源，而非隐式截取任意页面 DOM。
- **确定性资源释放**：当视图卸载或宿主不支持材质后端时，自动释放 GPU 与场景源订阅，并退回到声明好的不透明 CSS 样式（返回 `material-support-unavailable`）。

## 实验链路与边界

实验链路将 Feedback 材质能力与最终计算样式结合，由 Web Component Adapter 通过可选材质宿主接入固定 WebGL 实现，并验证了指针按压、键盘激活、禁用态、系统偏好变化、场景源丢失以及图形上下文恢复等行为。

这一 V1 实验路径与当前公开预览页使用的 V2 可见 canvas 光学方案不同，且不包含在公开组件包或 CLI 安装目标中。

## 许可与延伸阅读

实验所使用的着色器衍生自 `naughtyduk/liquidGL` 3.0.0（MIT 许可证），衍生输出需保留相应的许可证与声明。

- 如需体验当前公开可用的交互预览，请参阅 [Liquid Glass Button](/zh-cn/ui-libraries/liquid-glass/button/)。
- 如需查看其他工作区原型的覆盖情况，请参阅[文档覆盖索引](/zh-cn/build/prototypes/documentation-coverage/)。
