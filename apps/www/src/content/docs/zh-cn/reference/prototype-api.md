---
title: 'Prototype API'
desp: '公开作者入口及其协议职责'
description: '公开作者入口及其协议职责'
---

本文把公开 TypeScript 作者 API 映射到 Proto UI 的协议表面。它是工程参考，不是独立规范；当 API 行为与 spec entity 冲突时，以适用实体为准。

下列入口同时存在于已发布的 0.2.0 package 和当前工作区中。API 已经可用，不会自动把相关 `draft` 实体提升为 `active`；当前工作区还可能包含面向 draft 0.3.0-alpha.0 train 的变化。

## Definition 结构

`definePrototype` 创建普通 Prototype definition，`defineAsHook` 创建特殊的可组合形态。两者可以共享同一个 setup 函数：

```ts
import type { DefHandle } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asFocusable, asTrigger } from '@proto.ui/hooks';

type ToggleProps = { disabled?: boolean };

function setupToggle(def: DefHandle<ToggleProps>) {
  asTrigger();
  asFocusable<ToggleProps>();

  def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
  const active = def.state.bool('active', false);
  def.expose.state('active', active);

  def.event.on('press.commit', (run) => {
    active.set(!active.get(), 'toggle');
    run.expose.emit('activeChange', { active: active.get() });
  });
}

export const asToggle = defineAsHook({ name: 'as-toggle', setup: setupToggle });
export default definePrototype({ name: 'base-toggle', setup: setupToggle });
```

这是官方 Base Toggle 共享 setup 模式的精简示例。生产实现还声明了 controlled Props、focus 行为、accessibility 与 transient interaction State。

## 公开入口

| Package | API | 职责 |
| --- | --- | --- |
| `@proto.ui/core` | `definePrototype` | 创建普通 Prototype definition |
| `@proto.ui/core` | `defineAsHook` | 创建具有结构化结果的特殊可组合原型形态 |
| `@proto.ui/core` | `moduleDeclaration` / `declareModule` | 标识并声明语义 Module 能力 |
| `@proto.ui/core` | `createAnatomyFamily` | 创建稳定、static-only 的 Anatomy family token，其 canonical spec 必须包含 root role |
| `@proto.ui/hooks` | `asBoundary`, `asCollection`, `asCollectionItem`, `asFocusable`, `asFocusEntry`, `asFocusRoving`, `asFocusScope`, `asHitParticipation`, `asTextControl`, `asOverlay`, `asScrollSurface`, `asTrigger` | 在 setup 阶段使用的官方 privileged semantic hooks |

hooks package 是语义作者表面，不是 React 风格的 state hook 集合；这些 hook 应在 Prototype setup frame 中调用。

## 按 phase 划分的 Handle

### `DefHandle`：在 setup 中声明

`DefHandle` 提供 lifecycle、Props、Feedback、Expose、Rule、Event、State、Context、Anatomy 与 accessibility 的声明入口。Declaration 建立身份和 wiring，不能被当作进入宿主 framework 的逃生口。

### Renderer handle：描述一个 root

当 setup 返回 renderer 时，renderer 为一个 Root Node 构造可移植 template children。Prototype-level component composition 被明确排除在这门语言之外；见 [Template](/zh-cn/specifications/template/) 与 `K-PROTOTYPE-COMPOSITION-0001`。

### `RunHandle`：在 callback 中执行

登记的 callback 会收到 `run`，其中包括 callback-time 的当前 Props 读取、Context 读取与更新、允许的 lifecycle/presence 操作、Expose event 发出、Feedback patch 与 Anatomy query。Phase guard 是 contract 的一部分；不要保留 callback handle 并在之后的任意代码中使用。

## 组合与外部表面

`asHook` 在当前 setup frame 内组合语义行为。返回的 State handle 以 State declaration 的稳定名称命名；嵌套 asHook 保持为结构化 child，不会被摊平到父结果中。Expose name 是面向 App Maker 的输出，不会反向定义内部 State identity。

复合原型通过 `createAnatomyFamily` 共享 Anatomy family，声明 root 与 part role，再由宿主组装实际 part 结构。稳定 family 以 token 引用身份区分，而不是以诊断用的 `debugName` 区分。

## 必须保持可见的边界

- API 存在不等于生命周期稳定；仍需检查相关 `C-*`、`D-*` 与 `P-*` 实体。
- Template 不嵌入其他 Prototype definition。
- 可移植作者 API 不提供原始 React、Vue 或 Custom Element 访问。
- 缺少 API 或 catalog relation 不一定表示禁止，也可能只是尚未登记的空白。
- State、Props、Expose 与 Context 的所有权和 phase 规则不同，不能被当作可互换的存储。

接下来可阅读[核心规范](/zh-cn/specifications/core/)理解协议模型，阅读 [asHook](/zh-cn/specifications/as-hook/)理解组合语义，或阅读[兼容性](/zh-cn/reference/compatibility/)查看已审计的 Adapter 表面。
