# Historical v0 public launch checklist

> Archived on 2026-11-22 from [RELEASE_CHECKLIST.md at `dc3b184`](https://github.com/Proto-UI/Proto-UI/blob/dc3b184ba10b0de53e40359c52d012b204b2cd01/RELEASE_CHECKLIST.md). The date records archival, not the document's original authorship.

This is historical planning material, not a current release gate. Its unchecked items are preserved as written; archival does not mark them complete or waive current requirements. The original contract entry point, information architecture and personal filesystem paths describe the old planning context.

Use the current [release entry point](../../RELEASE_CHECKLIST.md) and [documentation governance audit](2026-11-22-documentation-governance.md) for the current owners and the section-by-section disposition. The original document below is preserved verbatim from the source revision.

<!-- original-checklist:start -->

# Proto UI Release Checklist (v0 Public Launch)

> This checklist summarizes all decisions and requirements discussed in this thread. It is oriented toward the v0 public release.

## 0. Positioning & Messaging (must be clear everywhere)

- [ ] One‑sentence定位明确：Proto UI 是人机交互协议 / 任意框架与平台的组件生成器
- [ ] 明确“不是新框架”
- [ ] 明确“暂不适合关键生产环境”
- [ ] 强调 v0 仍可用于 Demo / 小项目 / 试验
- [ ] 强调 v1 目标是 Compiler 输出与零运行时开销

## 1. v0 基线能力

- [ ] React / Vue / Web Component 三种 Adapter 可用
- [ ] 适配器可跑通同一原型生成多技术组件实例
- [ ] 原型库覆盖“常见 Headless 原型库”级别（最小集合）
- [ ] 运行时可以切换 Adapter（PrototypePreviewer）
- [ ] Demo 具备跨适配器一致性展示

## 2. 使用方式（对外标准路径）

- [ ] 文档明确使用路径：`npm 安装 adapter -> 复制官网原型 -> 适配为对应框架组件`
- [ ] 说明 v0 / v1 的开发者侧 API 外形保持一致
- [ ] 明确“非严格历史兼容”

## 3. 官网与 Demo

- [ ] 首页 CTA 指向 Overview 的白皮书概要（哲学优先）
- [ ] 首页有 Demo（哪怕精简）
- [ ] 原型库页每个原型可运行时切换 adapter
- [ ] 官网文档不强制使用 Proto UI（避免新人贡献门槛）

## 4. 原型库结构与策略

- [ ] 原型库分层：
  - [ ] 底层 headless 原型库
  - [ ] 上层设计语言原型库（如 shadcn / Material）
- [ ] 设计语言 API 形态对齐官方（降低迁移成本）
- [ ] 保持署名与尊重原作者意愿（侵权即移除）
- [ ] 发布期优先：
  - [ ] Headless UI 级原型库
  - [ ] shadcn/ui 原型化实现（作为门面与噱头）

## 5. 契约与实现关系

- [ ] internal/contracts 作为契约入口（类似 RFC）
- [ ] 契约测试与实现关系清晰
- [ ] 新 Adapter 的 Review 检查契约遵循与必要测试补充
- [ ] 契约如何指导实现的流程化机制可后置，但需文档说明现状

## 6. 贡献入口（最小可用）

- [ ] 有清晰贡献入口：README / CONTRIBUTING / Issue Templates
- [ ] 贡献流程允许：Issue 讨论 -> 不加入 Discord 也可直接提交
- [ ] Issue 模板齐全：Adapter / Prototype / Docs
- [ ] 新增依赖：不鼓励，必须先讨论

## 7. 文档结构（已确定 IA）

- [ ] Overview / Usage / Contributing / Reference 四级结构落地
- [ ] Overview 包含：
  - [ ] 白皮书概要
  - [ ] 项目简介
  - [ ] 原型库总览
  - [ ] 适配器总览
  - [ ] 贡献者索引
- [ ] Usage 清晰标注：普通用户不必学习原型语法
- [ ] Contributing 中明确：写原型/写适配器是贡献路径
- [ ] Reference 逐步补齐：协议语法 / 原型参考 / 白皮书

## 8. 文档最小集（发布前必须有）

- [ ] 白皮书概要（已作为主入口）
- [ ] 快速开始（只讲复制原型 + adapter 跑通）
- [ ] 贡献路径概览
- [ ] 写原型 / 写适配器最小教程（哪怕是 outline）

## 9. 语言与国际化

- [ ] 英文优先 + 中文版本
- [ ] README 双语互链
- [ ] 文档站中英文切换可用

## 10. 法律与 License

- [ ] MIT License 明确
- [ ] 原型库中对第三方设计语言注明“非官方衍生”

---

## Current File Locations (for reference)

- README: `/Users/yangguangliang/Desktop/projects/Proto-UI/README.md`
- 中文 README: `/Users/yangguangliang/Desktop/projects/Proto-UI/README.zh-CN.md`
- License: `/Users/yangguangliang/Desktop/projects/Proto-UI/LICENSE`
- Contracts: `/Users/yangguangliang/Desktop/projects/Proto-UI/internal/contracts`
- Adapters: `/Users/yangguangliang/Desktop/projects/Proto-UI/packages/adapters`
- Docs content: `/Users/yangguangliang/Desktop/projects/Proto-UI/apps/www/src/content`

<!-- original-checklist:end -->
