# S2 准入审计与 Root 动态几何决策包

日期：2026-09-13。状态：observed entry audit / proposed H1，non-normative；H1 尚未批准。

承接 `2026-09-13-shadow-s2-approved-goal.zh-CN.md`（`0a54c8d4`）。S1 已由用户验收并提交至 `008584ac`；本轮没有待补的 S1 实现。S2 目标已批准，但不等于此前 unresolved role 获得自动准入。

## 实际拒绝点与后续缺口

`packages/adapters/web-component/test/shadow-s2-admission.test.ts` 使用完整官方原型与实际 CLI collector/renderer，并对每个原型重复 activation。`scripts/analysis/shadow-s2-admission-browser.mjs` 使用现有公共 dist root/subpath exports 与真实 CLI companion，在 Chrome 原生 Custom Element connection 上交叉验证；明确禁止 source alias。

| 完整原型 | 当前第一次拒绝 | 后续源码清单中的 unresolved Root tokens |
| --- | --- | --- |
| Shadcn Button | setup `group/button`：compiled split closure 校验缺少物理 token 证据 | `translate-y-px`、`pointer-events-none` |
| Shadcn Switch Root | setup `peer`：同类 compiled split closure 校验缺口 | `scale-[0.98]`、`pointer-events-none` |
| Shadcn Switch Thumb | setup `pointer-events-none`：application role unresolved | `pointer-events-none`、`translate-x-0`、`translate-x-[calc(100%_-_2px)]`、`will-change-transform` |

上述结果不是“测试通过所以组件受支持”。6 项新的 unit tests 和 Chrome audit 验证的是**当前拒绝与清理正确**，没有得到 S2 动画或交互通过证据。三个原型失败后 ShadowRoot 为空、environment listener 归零、scheme/projection marker 被撤销，消费者文本身份保留。

`group/button` 与 `peer` 在 Core 中已是 canonical surface，CLI `proto-style-css.ts` 将它们识别为空声明 marker。它们确实被收集，但不会生成绘制规则；当前 `shadow-split-effects.ts` 用 CSS selector 文本查验 compiled membership，于是把无声明 marker 当成缺失 recipe。这是独立的交付/验证缺口，不是允许删除 marker 或猜测 selector 穿透的理由。

三者均包含 `transition-all`，该 token 已是 canonical surface；effects port 另有显式拒绝：`animated sizing contributions are not implemented`。完整 Button/Root 在更早的 marker 检查就失败，因此不能把 `transition-all` 冒称为它们当前实际 first failure。现有 `shadow-split-effects.test.ts` 直接验证了该独立拒绝。动画同源尺寸贡献是 S2 工程工作，不能仅移除 guard 后宣称支持。

## 为什么需要用户决定

`D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-B/C/K` 明确禁止 Adapter 改写 canonical role、猜测已知高歧义 token，并要求完整投影在修改任何 target 前 fail closed。`application-role.ts` 与其 48 项测试确实把 translate/scale/pointer-events/will-change 保留为 unresolved。

`C-HOST-SURFACE-PROJECTION-0001-D` 和 `K-HOST-SURFACE-ROLES-0001-B` 又说明 surface 不是通用 focus/event/hit-testing target。故“这些最终都是 CSS，所以都扔到 surface”不是普通实现决定；把它们一律改为 placement 也会把命中领域混进布局分类。

## H1 推荐：Root 变换保持完整实例的几何语义

申请批准的行为方向如下；这是提案，不是已实现或已入 spec 的保证。

1. 对 S2 所需的 Root `translate-*` / `scale-*`，默认变换完整 Root 投影的视觉与命中几何。WC split 由 boundary 承载一次物理变换，内部 surface 与 slot 内容随其一起呈现，不在两个 target 上重复变换。变换不改变普通文档流的尺寸分配；百分比参照与 transform origin 必须与 collapsed Root 保持等价。
2. `will-change-transform` 跟随实际承担 transform 的 target，不能留在另一个空表面上；它的 stacking/containing-block 副作用也是验收内容。
3. `pointer-events-none` 保留“完整 Root 的指针命中控制”含义，按独立 host hit-testing 责任投影到 boundary，不把它宣称为 surface 绘制或布局 placement。不据此发明 disabled、键盘或焦点语义，也不屏蔽消费者后代通过原生 CSS 显式恢复 pointer-events 的既有能力。
4. 上述选择需要在 Core/spec 中先明确 canonical 信息与 host-domain 投影边界，再实现 recipe；不能以 Adapter allowlist 绕过 unresolved。内部 transport 的具体表达随后设计，若必须新增公共作者 API，则仍返回用户。
5. `transition-all` 由同源生成式 recipe 协调 boundary 尺寸/几何与 surface 绘制，验证中间帧、快速反向、嵌套 Root/Thumb，不做首帧后测量补丁。Marker 的合法 compiled membership 单独修复，不因此宣称跨 Shadow 的 group/peer selector 组合全部受支持。

推荐理由：当前 collapsed Web Root 的 transform 本来作用于完整物理元素；Button 按压位移与 Switch Thumb 位移都可以据此保持同一参照与命中位置。它也沿用用户刚确认的 slot 所有权：父容器的整体变换不是对消费者后代文字样式的接管。

## 替代路线与代价

- 只变换内部 surface、保留未变换 boundary：适合“视觉按压但命中区固定”的产品意图，但不能自动等同于已有 collapsed Root transform；可能留下旧位置的 host 命中区。若选该方向，需要明确承认/治理差异。
- 先引入作者显式 surface/placement qualifier：表达力更强，但扩大作者 API 与学习成本，超出当前 S2 已批准边界；真实需求尚不足以要求现在采用。
- 移除原型的 transform、pointer-events 或 transition：改变官方原型且削减 S2 必达目标，不作为修复方案。

最小待决事项是批准或调整 H1 的 Root 整体几何/命中方向，而不是要求用户选择内部文件拆分。授权后可继续自主处理 marker、动画 recipe、Button/Switch 接线、组合页与测试；不会据此改变 hidden、overflow、rotate/skew、relative、portal 或 native control 等其它 unresolved family。

## 后续验证与实体关系

- 先更新 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`、必要的 `C-HOST-SURFACE-PROJECTION-0001` 领域约束及 `T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`，明确本次准入的 token 范围；不把所有 unresolved 清空。
- 生成式 recipe 与 `T-WEB-COMPONENT-SHADOW-PROFILE-0001` / `T-WEB-COMPONENT-SHADOW-STYLE-0001` 映射必须由真实 Button/Switch public tests 与 Chrome geometry/input 证据支撑。
- 比较正常流尺寸、transform 后视觉 bounds、边缘命中、嵌套位移、slot 节点身份、pointer/Space/focus、继承与显式 pointer-events override、动画反向及 teardown；再做 S1 回归与独立消费检查。
- 当前 audit 是阶段性负向证据；准入实现后必须按新治理方向替换相关预期，不能让旧缺口成为永久“不支持”规范。

## 本轮验证

环境 Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。

- `vitest run packages/adapters/web-component/test/shadow-s2-admission.test.ts packages/core/test/feedback/application-role.test.ts packages/adapters/web-component/test/shadow-split-effects.test.ts`：66/66 passing。首次测试对 Button/Root first failure 预判为 transition，真实结果揭示更早的 marker 缺口，现已如实记录。
- `node scripts/analysis/shadow-s2-admission-browser.mjs`：三种完整原型的真实 dist/CLI 原生 connection 拒绝和资源清理符合上述结果；不修改用户打开的页面。使用的是 S1 已构建产物与已生成 artifact，本轮未重新 build，package 实现也未改变。
- `check:types:workspace` 在测试 closure 类型及非公共 native callback 句柄收窄后通过。
- 目标 record 的 Prettier、`check:agent-doc`、`check:agent-operations`（58 tests）通过。

本轮没有修改 Core classifier、Adapter/CLI/Prototype 实现，也未更改 spec 语义。S2 尚未实现/完成；按用户保留的语义决策边界停止功能推进。无 push/merge/publish/release。
