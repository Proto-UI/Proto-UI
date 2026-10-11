# Accordion reopen：按 Content commit 检查 relationship

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## 范围与权威

- Finf #872 CI 收尾；本地基线 `e85f251f08687f8c1816b6e33735d3ee9faf41bd`。
- 输入失败来自官方 run `37726400860` / job `113145445483`：Base React 的 Enter → Space → Enter 后，`expanded=true` 但紧接着读取 `aria-controls=null`。该官方 checkout 与本地基线不是同一个证据对象；不能把本地通过追溯为该 run 通过。
- `P-BASE-ACCORDION-TRIGGER-A11Y`、`P-BASE-ACCORDION-CONTENT-RELATIONSHIP` 与 `C-A11Y-PART-RELATIONSHIP-0001-D/E` 都仍为 draft 方向：detach 撤销 IDREF，rematerialization 在当前 view commit 可见前恢复 reserved identity 与 reciprocal IDREF。
- `C-LIFECYCLE-0008-J` 要求新 view 首次 commit 与 projection 一致前保持 pending。canonical expanded 本身不是 Content 的 host commit 证据。
- Anatomy 提供 item domain scope/role；A11y registry 匹配完整 tuple 与 view epoch；Web projector 持有 ID reservation。未把 relationship 所有权移动到 Accordion 或 portable State。

## 诊断与最小改动

真实 React 19.2.6 `createRoot` + 官方 Base Accordion，synthetic keyboard Enter → Space → Enter：第二次 Enter 的事件回调内，expanded 已为 true、controls 仍为空且 Content 不存在；`act` 完成后 Content 已非 pending，旧 ID 与双向 IDREF 均恢复。连续三次关闭/重开结果相同。

事件内采样是人为同步 observation，证明旧 oracle 可在合法的未 commit 阶段误报；不是 native input、paint 或精确官方失败帧的复现。未发现需要 production 修复的持久 relationship 缺陷。

browser 测试现在只等待当前 Content 存在且不再 pending，然后立即严格检查旧 controls ID、实际 target ID 及 labelledBy。没有轮询 relationship 结果，没有新增 sleep 或扩大 deadline。关闭撤销断言保持不变。四个 adapter / 五个 family 的共享 conformance 增加三次 reopen 双向关系检查。

## 负控与验证

- 旧同步 oracle 负控：事件内把 controls 断言改回旧 ID，失败 `null` vs `pui-a11y-2`，不是启动或依赖失败。
- ready 负控：在真实 Content 非 pending 后故意删除 controls，严格断言仍失败 `null` vs `pui-a11y-2`。负控注入不进入候选。
- 本地 Node `v24.19.0`，pnpm `10.32.1`；使用冻结锁文件与离线 store 安装；359 个 workspace links 均解析到此 worktree。
- 5 个 focused test files：四 adapter Accordion conformance 与真实 React keyboard regression，共 81 项全过；最终版本所有 family 的重复 reopen 为三轮。
- `check:types` 初次 docs 阶段因 Astro 尝试访问不可用默认配置目录而失败；后续使用明确 XDG cache/config 与禁用 telemetry 重跑。重跑通过（601 files、0 errors、0 warnings、7 hints）。该环境错误不能当作代码失败，也不能遗漏。
- 没有 production 源码或 budget 配置改动；此候选不会增加 runtime source closure 字节。没有修改 material、portal-origin 或 startup。

## 未完成边界

本地 browser socket/file-scheme 限制不绕过。当前候选 native browser、真实 pixels、官方 exact-head CI 和独立审查仍由父任务后续收集。局部 DOM 证据不等于浏览器通过，也不等于 draft 稳定准入。

## 独审后收紧 oracle

- readiness 还必须排除 `data-pui-view-detached`，避免把保留的关闭 shell 当作当前 materialized view。
- 事件内采样不固定 React 必须异步 commit：未就绪分支检查无悬空 IDREF，已就绪分支检查精确双向关系；`act` 结束后无条件严格检查旧 ID、双向关系及非 pending/非 detached。
- 前述同步 `expanded=true / controls=null / Content不存在` 是本次观测和负控依据，不是要求未来 React 实现保留这个调度间隙的规范。
