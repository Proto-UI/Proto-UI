# 2026-07-19 React release consumer smoke 记录

> Internal record. Not normative. 本文记录 `0.2.0-rc.0` 发布前第一份 monorepo 外消费模板的验证范围、发现与后续边界；正式 CI 与发版规则以治理文档和流水线为准。

## 1）目的

已有 `release-stage` 能证明公开 package 可以 build 并通过 `npm publish --dry-run`，已有 `cli-smoke` 能证明 CLI 可以操作 npm 上的历史发布包，但二者都不能证明当前 37 个 `0.2.0-rc.0` 产物可以组成一套真实可消费的 release train。

本轮新增 React + Vite 消费模板，要求 Proto UI 产物只来自当前工作树生成的 tarball，不允许使用 `workspace:*`、源码路径或 npm registry 中的旧版 `@proto.ui/*`。

## 2）产物与安装模型

- release staging 为 37 个公开 package 全部生成 tarball，并输出包含 name、version、相对路径和 integrity 的 `pack-manifest.json`。
- React 消费项目以 CLI、React Adapter 和 Shadcn Prototype library 为根，根据 staged manifest 计算声明依赖闭包；当前闭包包含 34 个 Proto UI package。
- 闭包中的每个 Proto UI package 都以本地 `file:` tarball 安装；lockfile 中出现 HTTP registry resolution 会使 smoke 失败。
- React、Vite、TypeScript 和 happy-dom 等第三方依赖仍正常来自 npm registry。

这种模型验证发布 manifest 所声明的实际闭包，同时不会用“把所有 package 都直接装进项目”掩盖缺失依赖。

## 3）消费路径

隔离项目使用已打包 CLI 执行 `init`，并生成 React 的 Shadcn Button、Switch、Select 和 Dialog facade。随后执行：

- 严格 TypeScript 检查；
- Vite production build；
- happy-dom 中的真实 React mount；
- Button 异步 disabled prop 更新；
- Switch 初始状态与点击切换；
- Select 的 combobox/listbox/selected option；
- Dialog role 与 accessible name；
- 完整 unmount 后再次 mount。

## 4）本轮发现并修正的问题

1. CLI registry 遗漏了已有实现与编目的 `shadcn-select`，导致消费者无法通过推荐路径生成 Select family。
2. React Adapter 把 `useContext` 参数错误描述为不完整的结构对象，导致 CLI 生成的 `createReactAdapter(React)` 无法通过真实 React 类型检查。
3. React Adapter 把模板的静态多根结果作为动态数组 child 传入 React，导致 Select Trigger 出现无意义的缺少 `key` 警告。

修正后，34 个声明闭包 tarball 的安装、CLI 生成、TypeScript、Vite build 和上述运行时断言均通过。

## 5）观察与非目标

- 当前示例 production chunk 约为 561 kB、gzip 约为 150 kB，并触发 Vite 默认 chunk-size warning。本轮只记录该信号，不把未经拆分的单页 fixture bundle 直接解释为稳定的 package 成本；后续真实项目试用需要继续检查 tree-shaking 和按需加载。
- 2026-07-19 follow-up 已建立 Base/Shadcn family subpath 与 Button-only module-graph 门禁；详见 `internal/records/2026-07-19-prototype-family-import-boundary.zh-CN.md`。
- happy-dom smoke 不是完整浏览器、视觉回归或辅助技术测试，不能替代真实浏览器中的焦点、Portal、CSS 和 reduced-motion 验证。
- 本轮只建立 React 模板。Vue 与原生 Web Component 应复用相同的 tarball manifest、registry 泄漏检查和隔离安装规则，分别增加自己的 build/runtime 断言。
