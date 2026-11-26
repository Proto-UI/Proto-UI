# J1 批准与 S3 目标执行

日期：2026-09-13。状态：user-approved direction / engineering evidence，non-normative。

用户批准 `2026-09-13-shadow-s3-context-reentrancy-and-j1.zh-CN.md` 的 J1，并授权同等规模、服务于既定 S3 的决策由 Agent 自行完成，记录取舍后连续实施，进入目标模式直到 S3 可人工验收。执行仍为 human-assisted/current-user；不推断远端写入、发布、draft 提升或更大范围 API 扩展权限。继续按节点本地提交，保留工作区无关内容。

## J1 决策落实

规范由 draft `C-CONTEXT-0010` F/G/H 和 `D-CONTEXT-NOTIFICATION-SCHEDULING-0001` 承载。本节点在 `ContextCenter` 中为每个 provider 代次和 ContextKey 设置独立 delivery 队列：

- update 先提交当前 provider value；同通路嵌套 callback 等待当前 transition delivery，保留每次 next/prev。不同通路不强加全局总序或 microtask。
- 提交时捕获 callback 注册集合，逐个送达前检查原 subscription record、当前 ancestry 和 provider 代次。解绑／销毁／重建不得收到旧任务。
- 委托范围内补充的异常策略：有限同步窗口中收集 callback 错误，继续其余有效 delivery，清理后报告单个或聚合错误；已提交值不回滚。不承诺终止作者无限 feedback。
- Runtime 原有 recipient callback scope 保留，不通过页面 microtask、删通知或覆写 Tabs 选中属性规避问题。

## 已验证

- `packages/modules/context/test/reentrancy.test.ts`：8 项，覆盖 commit order、立即 read、嵌套返回时序、scope rebind、subscriber/provider 重建、提交后新订阅不补收旧消息、单／多错误与清理、独立通路。
- 原有 Context with-tree 10 项与 Runtime context lifecycle 1 项通过。后者使用真实 Runtime，覆盖 repeatable view epoch 与 terminal cleanup。
- `packages/adapters/{react,vue,vue2,web-component}/test/context-reentrancy.test.ts` 共 4 项，真实框架 owner + Runtime callback scope，验证后订阅者派生 DOM 最终为 2、每次 transition 仍可见、销毁后无泄漏以及第二代实例。不是四框架原生 Tabs 键盘声明。
- `scripts/analysis/shadow-s3-controlled-audit.mjs` 由历史失败观察升级为修复断言：12 组 Light/full split × L1/keepMounted × 非受控/同步 echo/microtask echo，原生 ArrowRight/Left、Root/Trigger/Content 一致、每次单一 valueChange、清理均通过。公开 dist 和真实 companion，不用 source alias 替代公共入口。

## 独立的工作区基线问题

无关的已暂存 `packages/modules/context/test/catalog-boundary.test.ts` 有 10 项失败，集中在 opaque falsy identity、显式 undefined/null 和缺少 capability 的既有实现。使用临时 Vitest loader 将本节点唯一变更的 ContextCenter 替换为 HEAD 版本，仍得到同样 10 项失败；`impl.ts`／`create.ts` 未在本节点修改。这些失败不通过改写测试或夹带其他 Context 编目内容处理，后续汇总测试会单独列出。

## 下一节点

完整 S3 journey 已越过受控选中问题，通过首轮布局与初始隐藏／AX、方向键、disabled skip、details 和空面板入口，当前在返回设置页后的 Tab 应进入 Switch 的断言失败。需先确认实际焦点和后代 rematerialization 状态，再做最小修复。后续 journey 未达路径不能标为 passing；S3 尚未接入 demo-matrix。
