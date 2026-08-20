---
title: '兼容性'
description: '已审计的 Adapter profile 切片，以及当前兼容性证据的边界。'
---

Proto UI 通过 Adapter profile 实体及其指向 Module、host capability 与可执行证据的类型关系记录兼容性。本文只报告实际完成审计的切片，不从 package inventory 推导完整 feature matrix，也不承担生态路线图。

## 官方 Adapter profile

| Profile | 公开 package | 目标 | Framework 范围 | 生命周期 |
| --- | --- | --- | --- | --- |
| `A-WEB-COMPONENT-0001` | `@proto.ui/adapter-web-component` | Web / Custom Elements | Platform APIs | 从 0.2.0-rc.7 起 `active` |
| `A-REACT-18-19-0001` | `@proto.ui/adapter-react` | Web / React | `>=18.2.0 <20` | 从 0.2.0-rc.7 起 `active` |
| `A-VUE-3-0001` | `@proto.ui/adapter-vue` | Web / Vue | `>=3.4.0 <4` | 从 0.2.0-rc.7 起 `active` |

三者都是官方 Web profile。React 与 Vue 提供跨 framework runtime 的 cross-Adapter 证据，但这**不是** native mobile、desktop 或 server UI 的 multi-host 证据；目录当前没有这些宿主的官方 profile。

## 已审计的共同切片

三个 profile 都记录了对以下语义 Module 的 required support：

| Module entity         | 能力                   |
| --------------------- | ---------------------- |
| `M-PROPS-0001`        | Props ingress          |
| `M-EVENT-0001`        | 语义 event binding     |
| `M-STATE-0001`        | Owned State projection |
| `M-EXPOSE-0001`       | 外部 expose surface    |
| `M-EXPOSE-STATE-0001` | Exposed State          |
| `M-EXPOSE-EVENT-0001` | Exposed Event          |

三个 profile 还以 translated 方式提供以下 host capability：

| Host capability entity        | 宿主侧职责                         |
| ----------------------------- | ---------------------------------- |
| `HC-PROPS-SOURCE-0001`        | 提供 Props value 与 presence       |
| `HC-EVENT-BINDING-0001`       | 把宿主 event 绑定到 semantic event |
| `HC-DEFAULT-ACTION-0001`      | 表达 default-action control        |
| `HC-EXPOSES-RECORD-SINK-0001` | 接收 exposed record                |
| `HC-EXPOSE-EVENT-SINK-0001`   | 接收 exposed event                 |

这说明上述切片已在三个 profile 中完成正向审计，并不表示所有 Module package 或 Core capability 都已分类。当前 profile 没有 `omits` relation：未列出的 Module 只是**尚未登记**，不能被自动解释为支持、不支持或延期。

## 证据与解释方式

`D-ADAPTER-PROFILE-0001` 规定 partial profile 的阅读方式。`T-ADAPTER-PROFILE-0001` 验证 profile schema 与 graph integrity；各 profile 还指向 Props、Event、Lifecycle、State 与 Expose 切片的可执行 conformance entity。

请精确使用以下表述：

- **已登记支持：**存在带 role 的、经过审计的 `supports.modules` relation。
- **已登记省略：**存在带原因的、经过审计的 `omits.modules` relation；当前三个 profile 均没有此类记录。
- **尚未登记：**profile 尚未作出支持或省略决策。
- **没有官方 profile：**目录没有该宿主的官方 Adapter identity。

Package availability 与 entity lifecycle 彼此独立。Proto UI 0.2.0 是已经发布的稳定生态版本（`V-PROTO-UI-0008`），当前工作区则可以包含此后的 draft entity 与 draft 0.3.0-alpha.0 train。兼容性判断必须同时读取发行身份、profile lifecycle、精确 relation 与可执行证据。

底层协议模型见[核心规范](/zh-cn/specifications/core/)；实现与参与路径见 [Build / 参与贡献](/zh-cn/build/contribute/)。
