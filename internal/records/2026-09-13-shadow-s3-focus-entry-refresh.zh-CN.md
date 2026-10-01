# S3：后代焦点就绪后的入口刷新

日期：2026-09-13。阶段记录，不是新增稳定保证。

## 决策与归属

沿用用户对 J1 之后同等规模 S3 决策的授权。`C-AS-FOCUS-ENTRY-0001` D/E/G、`D-FOCUS-ENTRY-DELEGATION-0001` C 与 `P-BASE-TABS-CONTENT-FOCUS-ENTRY`（均 draft）已经要求宿主负责 descendant-first / fallback-self 的实际顺序焦点投射。无需新增原型 API 或改变 slot 归属。

J1 后完整 S3 浏览器路径发现：L1 重显 Settings 时，Content 先得到 fallback tabindex=0，随后后代 Switch 恢复 tabindex=0，但 Content 未刷新。原生 Home → Tab 因而先停在 Content，而非 Switch；Light 同样存在，不是 Shadow 隔离特有问题。

WC `packages/adapters/web-component/src/runtime/modules.ts` 在启用 descendant-first entry 时观察当前容器的后代结构与解析器所用属性。变化只刷新 fallback 投射，不调用 focus、不制造 focus facts、不接管键盘。观察器在禁用、目标替换、capability epoch 和清理时断开；自身 tabindex 写入不引起刷新循环。当前范围仍是现有 DOM 解析器，不扩展任意 closed Shadow 树的焦点遍历保证。

## 证据

- `packages/adapters/web-component/test/focus.test.ts`：新增用例修复前在后代 tabindex 变化处失败，修复后通过；覆盖动态可聚焦、禁用、删除/添加、entry 禁用/启用、终止移除与重连。DOM 模拟器的 MutationObserver 通过宿主任务等待交付，不以纯 Promise 循环假定时序。
- `corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test packages/modules/focus/test packages/runtime/test/contract/focus.v0.contract.test.ts --pool=forks --no-file-parallelism`：80 文件、332 测试通过。
- 重建正式 WC dist 后，`node scripts/analysis/shadow-s3-public-browser.mjs`：Chrome 152.0.7977.83，Light/split/mixed × L1/keepMounted 全路径通过，包含真实键盘、AX labelledby、实际布局、反复切换、组合更新、移动和重连。

此时 standalone 已通过；正式 demo-matrix 页面接入、页面级验证和 S1/S2 回归是下一交付节点，不能据此称人工验收已完成。J1 记录中的无关暂存 Context baseline 失败仍不在此次修复范围。
