---
title: '快速开始'
description: '初始化 Proto UI，并把组件安装到你的项目中'
---

:::caution[当前暂不可安装] Proto UI CLI 目前尚未就绪，暂时**不可安装，也不可按本文命令直接使用**。

CLI 预计在 **2026 年 4 月 15 日前**就绪。当前这篇文档的命令、目录结构和接入方式，仅用于提前说明 Proto UI 未来的使用方式，避免误导，现阶段请不要实际执行这些安装命令。:::

## 安装 Proto UI CLI

你可以直接通过 `npx` 使用 Proto UI CLI，不需要提前全局安装。

```bash
npx @proto.ui/cli --help
```

---

## 初始化项目

在你的项目根目录执行：

```bash
npx @proto.ui/cli init
```

初始化完成后，项目根目录会生成一个 `proto-ui/` 文件夹。

一个典型结构可能像这样：

```txt
your-project/
├── src/
├── proto-ui/
│   ├── adapters/
│   ├── prototypes/
│   └── components/
├── package.json
└── ...
```

其中：

- `adapters/`：当前项目使用到的适配器
- `prototypes/`：当前项目安装的原型
- `components/`：组装后的可用组件入口

你通常不需要手动维护这些文件，CLI 会负责管理它们。

---

## 添加一个组件

初始化之后，就可以按组件安装 Proto UI 组件。

例如，在 React 项目中添加一个 `shadcn-button`：

```bash
npx @proto.ui/cli add react shadcn-button
```

这个命令会：

1. 识别你选择的宿主适配器（`react`）
2. 安装对应的 Prototype（`shadcn-button`）
3. 在本地完成组装
4. 生成当前项目可以直接使用的组件入口

---

## 在项目中使用它

安装完成后，你可以直接在项目中导入组件：

```tsx
import { Button } from 'proto-ui/components';

export function Demo() {
  return <Button>Click me</Button>;
}
```

如果你安装了多个组件，它们会统一从 `proto-ui/components` 暴露出来。

---

## 继续添加更多组件

Proto UI 的接入是按组件进行的。

你可以继续执行：

```bash
npx @proto.ui/cli add react shadcn-input
npx @proto.ui/cli add react shadcn-dialog
```

然后继续从同一个入口使用它们：

```tsx
import { Button, Input, Dialog } from 'proto-ui/components';
```

---

## 它不会要求你一次性迁移整个项目

你可以只在新功能里使用 Proto UI，也可以只替换现有项目中的一两个组件。

一个更常见的起步方式是：

1. 先初始化 Proto UI
2. 先安装一个最简单的组件（如 Button）
3. 在局部页面里试用
4. 再决定是否继续扩展

---

## 下一步

如果你想理解它最基本是怎么工作的：

- 前往 [它是怎么工作的？](/zh-cn/start-here/how-it-works/)

如果你想判断它是否值得引入：

- 前往 [Why Proto UI](/zh-cn/start-here/why-proto-ui/)

如果你想进一步了解它背后的原则与边界：

- 前往 [Whitepaper](/zh-cn/whitepaper/component-as-protocol/)
