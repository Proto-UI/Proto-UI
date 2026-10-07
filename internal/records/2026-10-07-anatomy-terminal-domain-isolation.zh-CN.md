# Anatomy terminal teardown 的嵌套 domain 隔离

日期：2026-10-07。Finf PR #872 的 Accordion 生命周期回归修复。

## 原始失败

Base Accordion 的真实 WC/React/Vue/Vue2 demo 对照保留原始 `p-3` 消费 recipe。在 nested 内容打开/关闭后，再关闭和重开外层内容，React/Vue/Vue2 合计产生 21 条未处理的 duplicate value / duplicate part 错误。WC 不产生这些错误。该对照不依赖新的 Base spacing 修复。

新增直接 Anatomy 5 项回归中原始实现 4 项失败，同时保留上述 21 条未处理异常；没有捕获并吞掉错误，也没有关闭原生 pageerror 检查。

## 根因与修复

原始 `dispose()` 先删除 owner 的一个 family claim，立即通知，然后继续删除下一 family。父 owner 可先于 framework 子 owner 终止：

- nested root claim 消失后，尚存的子 part 沿逻辑父链意外穿过该节点，暂时加入外层同 family root，导致相同 value 冲突；
- item claim 消失后，其 heading/trigger/content 可暂时被外层 item 接收，导致 duplicate part；
- 第一 family 的订阅 callback 还能观察该 owner 在第二 family 尚未撤销的部分状态。

修复在第一次通知前一次撤销 owner 的所有 family claims。对仍被现存后代 claim 的父链穿过的退休节点，仅保留 token/family 边界，不保留其 ClaimRecord、Expose 或 listener。domain 解析遇到该边界返回 missing，而不是偷偷加入外层；默认 strict query 仍失败。后代完成自身 disposal 或真实 logical reparent 离开边界后清除该边界。

普通 repeatable view detach 不进入 terminal retirement；现存 claims 和重新 mount 的语义不变。后代仍拥有自己的 claim 生命周期，没有递归删除其他 owner 的 claims，也没有延迟通知来掩盖中间错误。

## 验证范围

- 直接模块回归：nested root、item boundary、跨 family 原子撤销、真实 surviving-child adoption、view detach/remount。
- 真实四 Adapter demo：原始 p-3 recipe，重复三轮 nested/outer close-reopen，并检查 retained 内容 A/B 往返。Vitest 的未处理错误保持 fatal。
- 相关 Anatomy、Collection、Runtime lifecycle、四 Adapter 与 Base Accordion 共 17 文件、142 tests 通过。
- Base Accordion 原生 parity suite 的 pageerror 断言保留；最终提交上的官方原生结果仍待收集。不能据本地源测试宣称页面 320px/200% overflow 或全部 Finf 项目通过。

本次补充 `C-ANATOMY-0005` 的 terminal boundary 明确说明和 `T-ANATOMY-0002` 的测试映射，均保持 draft，不扩大 public author API。

## 独立复核修正

独立 Reviewer 用相同 family、两份不同 ancestry getter 的 renderer map 复现了 1/1 失败：A 的无关 disposal 曾错误清除 B 仍需保留的退休边界。剪枝现在按每个 live claim 自己的当前 ancestry getter 遍历，而不借用 disposer 的 getter；正式测试同时覆盖无关 disposal 与 syncStructure。旧候选和该独立 red 均保留。

修正后相关整组为 17 文件、143 tests 通过，完整 workspace/docs types 为 534 files、0 errors。首轮 142 结果仅代表修正前范围，不替代最终复核。

更广的 CheckboxGroup renderer reparent 验证又暴露了本候选通用回归：上一版 ClaimRecord 的 getter closure 会在剪枝时重新读取暂时撤销的 caps。独立模块负控不依赖 CheckboxGroup 也复现 `ANATOMY_CAP_UNAVAILABLE`。该版本因此暂停发布，不能标作新原型专属问题。

后继最小修正保存每个 claim 已解析的最后有效 getter 函数，保留动态父链读取；只有新的有效 caps 出现时才刷新函数。尚无已知 getter 的 claim 表示不确定，剪枝保守保留退休边界。普通 detach 不删除 claim，不吞异常，也不缓存旧 parent 结果。新增临时撤 caps 与真正 getter replacement 两个控制；8 模块加旧四 Adapter Accordion 共 13 tests 通过。所有受影响 root 需按最终代码重新测量 package bytes，旧预算不适用于该修正。
