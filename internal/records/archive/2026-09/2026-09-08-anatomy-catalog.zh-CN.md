# Anatomy 编目与 setup cancellation 漂移修复

日期：2026-09-08。本文为工程记录，不替代 spec authority。

## 范围

用户确认在同一批量分支推进 Anatomy 编目及已有契约漂移修复。Rule 已提交 `3e164178`；本轮 Anatomy 未 commit、push 或发布 PR。

新增 draft `M-ANATOMY-0001`、`HC-ANATOMY-STRUCTURE-0001`、`HC-ANATOMY-ORDER-0001`、`T-ANATOMY-0004`，同步四个 A profile。结构事实 HC 合并 identity、logical ancestry 与 prototype diagnostics 输入；顺序 HC 包含内部 target 比较及可取消 observer。不按每个 cap token 建一个空实体，不改变现有 cap API。

## 漂移与修复

直接 Module 和实际 Runtime onCreated 测试均复现：subscribeParts 返回的取消函数可在 setup 后移除订阅。这违反 C-CORE-SYNTAX-0007。修复在作者取消入口先执行 setup guard，保持 internal subscribeOrder disposer 用于生命周期清理。C-ANATOMY-ORDER-0003-A 显式引用并澄清同一通用规则，不新增 runtime removal API。

## 证据边界

- Module：取消拒绝后仍能收到通知；最近同 family root 隔离；同名 family token 不混淆；无 target 时保持稳定查询顺序。
- DOM observer：真实 child-list 重排产生一次 role order 更新；文本变化不改变签名；detach 与 terminal cleanup 停止观察。
- Runtime：重复 view epoch 保留 claim 和声明，清理并恢复 observer；terminal child disposal 通知成员删除，parent disposal 清理 observer。
- 四个实际 Adapter：nested domain、host order、自身相邻位置、安全 PartView、目标 callback scope 的 Expose 方法及 fresh owner State baseline。DOM 重排与 repeatable epoch 是独立测试，不推断每个框架全部 view transition 或跨物理树排序。

## 保留边界

family 派生、非 asHook requirement、普通作者 missing-query policy 不接纳。内部 tolerant read 与 target/domain/descendant port 已有消费者，继续保留。#553 在边界梳理时仍 OPEN；Anatomy 不获得 A11y relationship registry 或 lease ownership。

未断言通用 disconnected/cross-tree 顺序、全部 target replacement 情况或 CSS 几何；这些限制在 M 的 open question 中保留。

## 本地验证结果

Node.js 22.23.2 / pnpm 10.32.1。Anatomy、Collection、Scroll、A11y、Core family、Runtime 与全部 Adapter 范围：249 个文件通过，826 项通过，34 项原有 Rule TODO 保留。最终 shared observer 补充断言的 3 项直接测试通过。spec/schema/graph 61 项通过；完整 check:types 通过（188 个 Astro 文件零诊断），最后测试变更重新通过 workspace 类型检查。Agent/Workspace 投影生成、check:agent-doc、check:agent-operations（58 项）和 git diff --check 通过。未运行 release pipeline 或真实浏览器几何验收。
