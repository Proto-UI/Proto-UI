# Hit Participation 编目与共享 target 决策落实

日期：2026-09-09。基线：`5f722821`。本文记录工程事实，不替代 draft spec。

用户已阅读 2026-09-08 决策包并明确接受：同模式共享、不同模式原子拒绝、最后 owner 释放后恢复。新增 `C-HIT-PARTICIPATION-0001`、`M-HIT-PARTICIPATION-0001`、`HC-HIT-PARTICIPATION-0001`、`T-HIT-PARTICIPATION-0001` 与四 Adapter 有界关系，全部保持 draft。既有 `asHitParticipation(patch)` 依迁移 D 暂时保留，不借编目改变作者入口。

Web bridge 用 per-owner claims 保存每个 target 的同模式贡献，预检全部 next regions 后再释放旧 claim 或写入投射。最终释放恢复原始 pointer-events 值与 CSS priority。disabled 与 passthrough 不因都使用 none 而混为同模式。同 owner 重复 target 保留原有最后声明优先行为。

Module 在宿主拒绝时回滚 regions/configuration，避免失败 registration 留在内部，污染下一次操作。disposer 如果暴露与另一 owner 冲突的较早 mode，同样拒绝并保留旧 claim；移除另一 owner 后可以重试。

证据涵盖两种共享释放顺序、participating/passthrough 对 disabled 的冲突、跨多 target 的原子性、四真实 Adapter 的拒绝恢复与 fresh owner，以及 Runtime detach/remount/terminal disposal。测试断言实际 inline projection 与恢复；DOM 模拟不宣称完成真实浏览器 hit testing 或统一 blocking 语义。

电脑重启清空原 `/private/tmp` worktree，未提交改动已从任务历史重建并重新验证。现工作区为项目旁持久目录 `Proto-UI-worktrees/catalog-batch`，本地验证 artifacts 位于同级 `catalog-evidence`，不进入源码 commit。

后续仍按 roadmap 处理 Presence → Positioning → Overlay → Text Control / Image View / Scroll；新设计边界另行决定。
