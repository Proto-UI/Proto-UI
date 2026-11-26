# 普通编目收尾进展

日期：2026-09-09。接续 `2026-09-09-overlay-and-remaining-catalog.zh-CN.md`，不改写此前计划和决策。

## 已完成语义切片

- Overlay：`M-OVERLAY-0001`、三个资源 HC、Event privileged input identity 与四 Adapter 映射；单 sample Escape、受控嵌套消费者、共享 modal 锁、provider 替换清理、layer disposer 修复。
- Text Control：补全既有 `M-TEXT-CONTROL-0001`、`HC-TEXT-CONTROL-0001` 的 addressable criteria 和四 Adapter 关联。旧 lease 回调与延后恢复只作用于当前 session；注册返回取消函数遵循 setup-only。现有单行、多行、IME、patch 与 Base Input/Textarea 证据保留。
- Image View：补全既有 `M-IMAGE-VIEW-0001`、`HC-IMAGE-VIEW-0001` 与四 Adapter generation 证据。Vue 2 此前没有物理 img 选择与 host bridge，本轮复用共享 Web host 补齐，增加 workspace dependency 与 lockfile；未另造 source/readiness/API。listener cancellation 对齐 `C-CORE-SYNTAX-0007`，旧测试中的 runtime unsubscribe 不作为隐式契约保留。
- Scroll：补齐 `M-SCROLL-0001` 的 State/Context/Anatomy 依赖及四 Adapter 关联。既有 `M-SCROLL-0001-D` 要求迟到 facts 无效，但实现没有 session guard；回归测试复现后修复。四 Adapter 新测试覆盖真实 wiring 的 request → 物理 offset → observed fact 与 cleanup；已有四 Adapter composed Thumb journey 继续覆盖 Move Gesture 通路。

所有实体维持原有 draft 状态。正向 Adapter 关系是这些有界切片的证据，不代表全领域、全部宿主或任意未来 capability 的认证。

## 下一批必须独立评估

本批次到此结束，提交一个 PR 后停顿，不继续扩张队列。

1. A11y 的 def → asHook API 重设计及迁移策略。
2. Rule Meta 的稳定 abstraction，以及 Rule deferred features 的真实使用需求。
3. Presence legacy compatibility 与 deprecated State module 的清理/兼容性决策。
4. Overlay 通用 focus entry/restore、anchor/trigger dismissal、focus-outside，以及更强 layer hierarchy 和完整 modal policy。
5. Text Control portable selection/edit-menu，Image View asset resolution/非 Web readiness，Scroll 非 Web/辅助技术/virtualization。它们需要场景推动，不因普通编目已收尾就自动启动。

后续工作应先从这些独立问题中选择有明确需求和验收边界的一项，而不是继续按 package 数补空实体。

## 本地验证与限制

Node 22.23.2、pnpm 10.32.1。最终使用独立 worktree 依赖安装；临时依赖 symlink 已移除，未提交生成的 Agent/workspace 投影。

- Spec fixture/graph：22 文件、61 项通过；catalog、完整 workspace/docs types、Agent projection check 和 package manifests 通过。
- 全量测试中的发布、治理、public-docs、type contract 检查通过；非浏览器部分 447 文件、2048 项通过，保留仓库既有 3 skipped files／34 todo。
- Vue 2 package build 及其 35 个构建依赖通过；新增 Image View dependency 的 BOM 通过生成器同步。
- 全量浏览器首轮：12 文件中 10 通过，41 项断言中 40 通过；Shadcn controls 在 Adapter 切换就绪等待处超时，Select 首屏套件断言通过但 afterAll 清理超时。因此不称整条 `pnpm test` 一次全绿。
- Select 首屏以 60 秒 hook timeout 定向复跑通过。Shadcn controls 第二轮在不同用例的同一 readiness wait 超时；基线 `839a6143` 的对照运行、当前分支诊断运行和移除诊断代码后的最终原样运行均为 5/5 通过。未修改生产代码或测试断言来掩盖超时，也未将不稳定性归因为已经证实的基线缺陷；CI 仍需复核。
