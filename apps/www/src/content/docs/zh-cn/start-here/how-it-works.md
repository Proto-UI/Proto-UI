---
title: '它是怎么工作的？'
description: '用 Prototype 和 Adapter，理解同一份组件定义如何在不同框架中运行。'
---

同一个组件，为什么可以在 React、Vue 和 Web Components 中使用？你可以先记住一个简单的组合：

> **Prototype + Adapter = 某个框架中可以使用的组件**

## Prototype：定义组件怎样交互

Prototype 就是原型。它描述一个组件应该怎样工作。

以 Switch 为例：

- 点击后，开关状态怎样变化；
- 禁用时，怎样处理用户操作；
- 开启和关闭时，分别显示什么；
- 状态变化后，怎样通知应用。

这些内容可以写在同一份 Prototype 中，不必在 React 和 Vue 里各写一遍。

## Adapter：让它在具体框架中运行

Adapter 就是适配器。它负责把 Prototype 接到你使用的框架中，处理事件绑定、渲染更新等具体工作。

例如，同一份 Switch Prototype：

- 配合 React Adapter，得到 React 组件；
- 配合 Vue Adapter，得到 Vue 组件；
- 配合 Web Component Adapter，得到自定义元素。

在 Proto UI 的文档中，这些组件运行的技术环境也被称为 **Host（宿主）**。

## 回到首页 Demo

在[首页 Demo](/zh-cn/#home-demo-previewer) 中切换框架时，Prototype 保持不变，换的是运行它的 Adapter。

这就是同一份交互定义能够在不同框架中复用的基本方式。具体能使用哪些组件，要看所选 Adapter 的支持情况。

## 使用时需要做什么？

通常，你只需要：

1. 从原型库中选一个组件；
2. 用 CLI 添加对应框架的组件入口；
3. 在应用里导入它，传入 props、监听事件。

如果现有原型库已经满足需求，你不需要先学会编写 Prototype，也不需要自己开发 Adapter。

接下来可以按[快速开始](/zh-cn/start-here/quick-start/)，在已有项目中添加第一个组件。

如果你想进一步了解这套分工的设计，以及跨框架一致性如何判断，可以阅读白皮书的[第五章：翻译层](/zh-cn/whitepaper/5-translation-layer/)和[第六章：一致性的边界](/zh-cn/whitepaper/6-consistency-boundary/)。
