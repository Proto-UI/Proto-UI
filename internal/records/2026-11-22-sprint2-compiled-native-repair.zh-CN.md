# Sprint 2：生成消费者首轮原生失败的责任层修复

本记录保留已发布 `f8e7d12ebe64343b8caec71a7f23a6b9761b6ef7` 的真实失败，不将后续 fixture 修复倒填成旧版本通过。适用子项属于 #732、#733、#1061、#1145 的有界 Web 消费者验收；全部原条件与其他目标保持原状。

## 原回执与分诊

[GitHub Actions run 45029016292 / job 137228248258](https://github.com/Proto-UI/Proto-UI/actions/runs/45029016292/job/137228248258) 的 `compiled-consumers` 为 **12 PASS、8 FAIL、0 未终态**。同次 `ordinary-linked-consumers` 的 12/12 是另一个普通框架/Happy DOM 套件，不替代这 20 条原生结果。

原 artifact ZIP SHA-256 为 `acd5bebb98575a3fb417f6b4897138f4861fee81b6f65b211a8eb91f0dad72ac`。本记录的 [证据目录](evidence/2026-11-22-sprint2-compiled-native-repair/) 保存原完整 Vitest report/run log/build manifest 的无损 gzip、八份原始失败 case JSON、逐文件及 trace hash、保留原 event 内容的 trace 摘取，以及后续 socket-free 红绿结果。没有覆写首轮截图、trace 或报告。

| 原失败对象 | 实际观察 | 责任层 |
| --- | --- | --- |
| React Base/Shadcn/Brutalist Button 与 sync/queued TextControl，共五条 | `mount()` 返回值中 `childText`、`role`、`physicalValue` 为 null，`rootIdentity` 的 true 来自 null 与 null 比较。普通 React 随后的异步 commit 才物化 Root；fixture 先前的可选 `setAttribute` 没有给不存在的节点打标，所以真实 locator 在 5000 ms 后失败。 | 浏览器消费 fixture 在物理节点就绪前返回。原 trace 不证明真实 Root 被替换。 |
| Vue3/Vue2/WC Shadcn，共三条 | 原 trace 已显示系统 dark 变化后实际应用 `border-input bg-input/50`。此前真实点击留下 hover，作者定义的 dark + hover 配方覆盖普通 dark 的 `bg-input/30`；旧断言使用了非 hover 前提。 | 原生旅程的输入状态与样式 oracle 前提不一致，未发现颜色 source 未响应的证据。 |

其余六条 TextControl 原生输入已经实际完成 `5678`、caret、拒绝、detach/reconnect、旧输入及退休检查；它们的成功不推断尚未执行到输入阶段的两条 React 路径成功。

## 有界修复

`sprint2-browser-consumer.ts` 在捕获首个 Root、child identity 与添加测试标记之前，等待真实 connected physical Root。`MutationObserver` 仅观察该 consumer host 的子树；它同时用于显式 detach/reconnect 后的存在状态确认。5000 ms 是失败上界，不是用于掩盖竞态的等待时间。成功、超时、观察器安装异常都撤销 observer 与 deadline；初次就绪失败还关闭框架 owner 并移除 host，保留原失败与可能的清理失败。

原生测试显式断言初次 Button 的真实 role 与三项 identity；TextControl 断言初次 physical value 为 `5`。不改 locator、不跳过身份检查、不改变原 45 秒 case deadline。Shadcn 顺序现在为真实点击后的 hover + dark `bg-input/50`，真实 pointer move-out 后 `bg-input/30`，显式 light 后移除 dark 背景；每步排除不应保留的另一背景 token。原 click/key、disabled、更新身份、拒绝、重连、isTrusted 与最终资源清理断言全部保留。

另外两份 Happy DOM 测试改用明确的 `HappyDOMWindow` 类型及 `happyDOM.waitUntilComplete()`。锁定的 Happy DOM 15.11.7 中旧 `whenAsyncComplete()` 只是该方法的别名；修复不改变观察器等待语义，也没有用 `any` 绕过类型检查。

本次没有修改 compiler/parser/IR/emitter、产品 helper、原型或共享语义定义。

## 已执行的有区分力验证

| 执行 | 结果与边界 |
| --- | --- |
| 原 f8 fixture + 新增延迟普通 React view 案例 | 精确 **1 FAIL**：DOM 仍为 null 时 mount Promise 已提前 resolve，`expected true to be false`。基线 source 与 Git blob 一致；重放测试仅改 import 指向该旧源。只选这一个反例，另一个新增清理案例未选择，不将其记成原失败。 |
| 当前 fixture + 同一延迟案例和永不出现 Root 的清理案例 | **2/2 PASS、0 skip**。后者使用 fake timeout 推进实际失败上界，验证 observer disconnect、deadline 撤销、框架 owner/host 清理。前者的受控延迟属于测试注入，不声称浏览器 input 结果。 |
| `release-family-consumer.test.ts` | **14/14 PASS**，包含三家族完整 Button × 四 Web 普通消费者及两个静态语义反例。 |
| `rule-meta-consumer.test.ts` | **8/8 PASS**，包括四目标样式/租约消费及原 listener/cleanup 反例。 |

这些执行使用 Node 24.22.3、pnpm 10.32.1、单 worker、关闭文件并行，并持有共同 `/tmp/proto-ui-s2-heavy-local.lock`。输入、候选五个源码 hash、原始日志和 JSON 在 `source-and-observations.json` 与相邻回执中绑定。独立 reviewer 直接读取原 trace、作者配方、五文件 delta 及 Happy DOM 实际 API，静态检查未发现阻断；这不等于 native20 通过或 GitHub APPROVED。

## 尚待回执

修复后的 **20 条真实 Chromium case 必须在最终整合源码上重新执行**。本地此前的标准 sandbox EPERM 没有通过关闭 sandbox 绕过，也未在此重复启动。最终托管结果、全 workspace types 与 PR 状态由整合队列分别回读；本记录中的 2/2、22/22 不替代那些条件。
