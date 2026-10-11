---
title: 'Material 实验'
description: 'Base Button 与自有场景材质实验组合的执行边界，以及它与 Liquid Glass 的关系。'
---

本页记录 [PR #809](https://github.com/Proto-UI/Proto-UI/pull/809) 的实验组合，与当前 [Liquid Glass Button](/zh-cn/ui-libraries/liquid-glass/button/) 分开。`experimental-owned-material-button` 只是 Base Button 加候选通用材质能力的测试身份，不是新增获准的 Button 协议、公开包 import 或永久私有组件 API。

## 实验组合声明什么

在[检查点 `9ce6011`](https://github.com/Proto-UI/Proto-UI/blob/9ce6011b50c4ab6792bd1261142d03a87f5b9471/experiments/material-specializer/button.proto.ts)，真实 Prototype 通过 `asButton()` 获得输入和激活语义。实验 module 声明折射材质、应用拥有的场景源、几何来自最终样式的圆角形状、显式不透明回退、由样式拥有的前景，以及 Button 按压语义。声明不包含纹理、uniform、shader 语法、渲染 pass、同步命令或隐式页面截图。

Base Button 继续拥有事件、disabled、focus 与 press。实验研究的是可复用视觉能力如何通过公共框架传递这些事实，不应通过另造页面专用 Button 实现来绕过问题。

## 已实现的实验链路

该检查点的 Feedback 材质能力观察已有 Base state handle，将材质状态与最终 post-patch 样式结合。涉及几何、填充、前景的材质 Rule 保留在 runtime evaluator。Web Component Adapter 通过显式启用的材质宿主消费视觉输出；特化编译器为明确注册的实验 consumer 选择固定、已审计的 WebGL 实现与有限资源计划。

源归应用所有：自有 RGBA source lease 不等于捕获任意 DOM 背景。几何只有一个最终样式 owner。consumer 必须随 view 释放 GPU 与源订阅。未安装 GPU consumer 时，显式不透明 CSS 回退报告 `material-support-unavailable`，并失去折射、场景源采样、光学按压响应。这是明确降级，不是等价画面。

## 证据与限制

隔离浏览器 fixture 覆盖指针按下/释放、键盘激活、disabled、注入的偏好丢失、源丢失、图形上下文丢失/恢复，以及替换 owner 后挂载。测试注入偏好不等于修改操作系统设置。源码测试、真实 GPU 运行、包体积检查与语义准入是不同证据类别；应查看 [PR #809 对应精确提交的检查](https://github.com/Proto-UI/Proto-UI/pull/809/checks)。

该精确检查点的[隔离 GPU workflow](https://github.com/Proto-UI/Proto-UI/actions/runs/37186882384) 已通过。artifact `11296769949` 包含八张截图、绑定源码的 JSON 报告、LICENSE 与 NOTICE。报告记录 errors 为空、外部请求为零、指针按压时真实 canvas 像素变化、键盘激活、disabled 门控、偏好/源/context 丢失回退、恢复和替换 owner 挂载。这是该候选的真实 GPU 证据，不是此前上游基准的画面。

包预算仍独立失败。opt-in 拆分使有限材质实现不进入普通 Runtime、React、Vue bundle，但这些完整入口经过 minify 与 gzip 后仍超出未修改的预算阈值。这是包级测量，不是该 Button 的体积。PR 单独跟踪包构建与类型检查；GPU workflow 通过不代表这些检查也通过。

后续检查点 `157269bbd9bea981a4c59425f667628b9b6d5b8e` 通过了[双 consumer GPU workflow](https://github.com/Proto-UI/Proto-UI/actions/runs/37188311449)。artifact `11298042765` 在工作区源码与构建后包产物两种模式下覆盖同样八个场景，均无外网请求或 page error。后一模式使用 291 个包 `dist` 输入，不使用包 `src` 路径；此前包构建/类型问题已在该检查点修复，包预算仍失败。这验证了本次构建输出，不代表 npm 发布或完整 packed-tarball 兼容性；下方图片仍明确绑定较早的 `9ce6011` 源码。

有界 WebGL 执行结果不能证明：

- 任意效果图编译或完整 Prototype 提前编译；
- React、Vue、Vue 2、GPUI、Flutter、Qt 等材质 consumer；
- 自动采样周边页面内容；
- 形状融合、共享组、morph 或完整 Liquid Glass 家族；
- 材质已经稳定准入、包已发布，或包预算回归已被接受。

本页不提供公开 RuntimeBox：私有实验 consumer 尚未进入网站公开原型注册表。此历史 V1 fixture 与当前公共 Previewer 的 V2 可见 canvas 光学路径不同，后者必须提供自己的 exact-head 证据。[PR #807 的隔离上游基准](https://github.com/Proto-UI/Proto-UI/pull/807) 是另一个 fixture，也不能替代本组合的验证。

## 精确检查点画面

以下原始截图来自源码 `9ce6011` 的 fixture，不是 stage-0 库 Demo。两图展示同一自有场景的静止与指针按压状态；后续提交需要自己的证据。

![材质fixture静止状态，源码9ce6011](https://raw.githubusercontent.com/Proto-UI/Proto-UI/a8abe11e7cd969d0bc764bf834d179ddc6a99733/evidence/pr-809/9ce6011/01-rest.png)

![同一fixture指针按压状态，源码9ce6011](https://raw.githubusercontent.com/Proto-UI/Proto-UI/a8abe11e7cd969d0bc764bf834d179ddc6a99733/evidence/pr-809/9ce6011/02-pointer-pressed.png)

[已核实的证据报告](https://github.com/Proto-UI/Proto-UI/pull/809#issuecomment-5977934590)

## 来源与许可证

所选 shader 源码固定到 `naughtyduk/liquidGL` 3.0.0、提交 `88f681ab7035fd55b04f63edff1841e32c4199e9`。实验目录保留 MIT 许可证、源码 hash、区间、uniform 清单与修改说明；原演示素材的排除条款仍然有效。生成产物必须保留相关声明。详见[检查点源码与许可清单](https://github.com/Proto-UI/Proto-UI/tree/9ce6011b50c4ab6792bd1261142d03a87f5b9471/experiments/material-specializer)。

本页记录实验，不修改 `P-LIQUID-GLASS-BUTTON` 生命周期，也不准入其后端。公开工作表面见[库概览](/zh-cn/ui-libraries/liquid-glass/)，其他仅在分支存在的新增项见[文档覆盖索引](/zh-cn/build/prototypes/documentation-coverage/)。
