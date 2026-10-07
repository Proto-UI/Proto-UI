# S4：受控 Escape 同步回写修复

日期：2026-09-14。状态：bounded regression repair，non-normative。

K1 实现节点 `9593fc82` 后继续完整 Dialog 验证，定位到 Base Dialog Content 的 Escape watcher：保存旧 Context → 发出关闭 request → Maker 同步 setElementProps(open=false) → 仍按旧 ctx.controlled 重新打开 Overlay。结果是 Root 已关闭、Mask 已退出，而 Content 的 Transition 回到 entering/entered，portal 留在 body。Light 与 split 都会受影响。

修复只改该 watcher：request 返回后读取当前 Context，仅在 owner 仍保持 controlled open 时恢复 Overlay。没有新增调度、修改 Context Module、接管父级 open 或引入跨实例事务。`P-BASE-DIALOG-CONTENT` 的 CONTROLLED/PRESENCE 是既有依据。

新增 `packages/prototypes/base/test/dialog-controlled-dismissal.test.ts` 覆盖拒绝回写、同步接受、microtask 接受三条路径；修复前只有同步接受失败，修复后连同原有 Base/WC Dialog 测试共 23 项通过。公开 dist 重建后，`shadow-s4-admission-browser.mjs` 默认直接执行同步受控 Escape 关闭，不再通过环境变量选择已知失败路径；其断言包括自然动画完成后的 L1 detach、portal 归位与滚动锁释放。

前一记录中的失败诊断保留为当时事实。后续继续检查打开状态下的整个逻辑组合移除、失败准入清理、实际 AX/focus 与完整设置区，不由本次关闭修复推断这些路径已经通过。
