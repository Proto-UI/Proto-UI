# Proto UI

**Proto UI 是一份人机交互（HCI）协议，也是一个面向任意框架/平台的组件生成器。**

它将交互逻辑抽象为协议层的模型（_原型_），并映射为不同技术栈中的具体组件实现。目标是让交互逻辑可描述、可复用、可跨生态迁移。

中文 | [English](README.md)

---

## 为什么现在做

我们已经有太多框架，但它们的组件交互逻辑大同小异。Proto UI 希望把这份“公共交互资产”抽离出来，让同一套交互在 React、Vue、Web Components 甚至更多技术中被一致地生成。

---

## Proto UI 不是

- **还不能用于关键生产环境。** 目前“能用”，但尚未稳定到用于关键业务。适合 Demo、实验和可控的小项目。
- **不是新框架。** Proto UI 不要求你放弃现有技术栈。它生成你现有技术的组件；v1 目标是 **零运行时依赖**。

---

## 工作原理（简版）

Proto UI 有两条路径：

- **Adapter（v0）：** `Prototype -> Adapter -> Component Instance`
- **Compiler（v1）：** `Prototype -> Compiler -> Component Code`

v0 用 Adapter 验证可行性，v1 将用 Compiler 保证零运行时开销。

---

## 现在能做什么

- 使用 **React / Vue / Web Components** 适配器，从同一原型生成原生组件实例。
- 构建跨框架 Demo，保持一致的交互逻辑。
- 探索 Web Components 版 Headless UI、跨技术栈的设计系统等实验方向。

---

## 当前阶段与路线

- **v0（现在）：** 验证协议，完善主流 Web 技术的适配器，并研究非 Web 技术（如 Flutter）的适配路径。
- **v1（下一阶段）：** 转向编译输出，保证零运行时开销，并扩展非 Web 平台支持。

架构已足够稳定，能够从 v0 平滑演进到 v1。

---

## 仓库导航

- **契约（类似 RFC）：** `/internal/contracts`
- **Adapters：** `/packages/adapters`
- **Prototype libs（计划中）：** `/packages/prototypes`
- **官网/文档内容：** `/apps/www/src/content`

---

## 谁会感兴趣

- 组件库作者
- 关注交互质量的前端开发者
- HCI 从业者 / 研究人员
- 设计系统维护者 / UED 团队
- 希望探索基础性 UI 工作的学生

---

## 贡献与讨论

- **官网：** [proto-ui.com](https://proto-ui.com)（文档与 Demo 正在准备中）
- **Issues：** GitHub Issues 是主要贡献入口。
- **开始贡献：** 参见 `CONTRIBUTING.md` 和 Issue 模板。
- **Discord：** [加入社区](https://discord.gg/MrWQd7h34R)
- **邮箱：** guangliang2018@foxmail.com

欢迎参与适配器、原型库、文档或社区建设。

---

## License

MIT
