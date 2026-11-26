# Scroll 检查点的单提交 DCO 补签

## 实际失败与身份

Scroll Web 检查点已经发布为 `d80a09cd8f208274d10cb1c83354168c726eafda`，tree 为 `38be289cd95063cce2a9a6c895df6ae44be3e99a`。GitHub 原始 commit 回读的 author / committer 均为 `cyjin.yl <chenyejin2004@foxmail.com>`，对应已核实的当前连接账号 `cyjin-yl`。

本地准备提交 `3819c4ae21e8b208e373f3821bb4c24a6775a8d0` 使用了环境默认 `Codex <codex@openai.com>`，`git commit --signoff` 因而生成了错误的签署行。连接器创建公开 commit 时采用实际连接账号身份，但消息中的签署行仍是本地默认值。这是本次提交整理的身份核对遗漏。

[该提交的实际 DCO 检查](https://github.com/Proto-UI/Proto-UI/runs/134010296167) 返回 `action_required`，明确指出期望 `cyjin.yl <chenyejin2004@foxmail.com>` 而实际签署行是 `Codex <codex@openai.com>`。前十四个提交的 DCO 成功不适用于这一新提交。

## 精确恢复范围

依据本会话已保留的当前用户本人贡献与 DCO 机械记录授权，按[单提交补签政策](../governance/contribution-provenance.md)记录原作者对其自己这一个确切公开提交的 certification：

```text
I, cyjin.yl <chenyejin2004@foxmail.com>, hereby add my Signed-off-by to this commit: d80a09cd8f208274d10cb1c83354168c726eafda

Signed-off-by: cyjin.yl <chenyejin2004@foxmail.com>
```

补签提交的 author、committer 与 trailer 均明确指定为该已核实身份。它只补签原作者自己的 `d80a09c`，不补签他人提交，也不重新认证已成功的前十四个提交。公开旧 commit、tree、原消息和上述失败均保留；本地准备对象另保留在 `archive/local-followup-fifteen-20261117`。

## 验证与责任

本次只新增这份可审计记录，产品、测试与 Scroll 原始证据内容均保持 `d80a09c` 原字节。检查本文件的政策链接、格式和实际 diff；不把文档检查计作新的产品测试。Scroll 的 150 项组合结果及后续未解决的 to-end 重入红例仍按[原记录](./2026-11-17-compiler-scroll-recovery.zh-CN.md)各自的源码范围报告。

本记录及补签消息由 AI 按已有用户授权机械准备；人仍是 certification 的签署者和责任主体。下一步读取新 head 的 DCO App 实际结论，提交本身不替代该机器结果、独立审查或最终验收。

## 发布后的实际回读

补签已发布为 `9520b5adb6618bd558c2e2559f7db7135894d19e`，tree 为 `b34073852d27d7edd61322b952be18148b059d2c`。2026-11-17 11:50 UTC 的独立回读确认[该 head 的 DCO App](https://github.com/Proto-UI/Proto-UI/runs/134015978545)为 `completed / success`。这关闭了本次错误 trailer 的机器检查失败，原提交和失败仍完整保留。

该 head 共回读 24 个 check runs：6 个 success、18 个 skipped；6 个成功项为 DCO、ci-config-audit、lockstep-check、test-plan、public_package_plan 与 Vercel Preview Comments。跳过的重型检查不算通过，预览评论检查也不代表浏览器交互验收。PR #1490 的说明已更新到十六笔提交并实际回读一致，仍保持 draft。
