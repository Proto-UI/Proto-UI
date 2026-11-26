# Expose 可变记录与终态取消的组合验证

## 为什么需要独立组合

[PR #1491](https://github.com/Proto-UI/Proto-UI/pull/1491) 在 `a23bf1b24f07742ef8852cda474eff958a4dc845` 修复了初始数据记录后续新增 callable 的公开生命周期投影。[PR #1490](https://github.com/Proto-UI/Proto-UI/pull/1490) 的 `0b8b403179759250664587a4a0e990a5354e02e4` 则保留 ExposeState 实际签发的取消函数在 owner 终止后的清理能力。两者修改同一个 Expose reader，单独的测试结果不能证明共同使用时仍能正确清理并保留普通方法的终态限制。

本次在固定父提交 `e329c21ef07a5e7d05b093250ee5ae2be80a3eed` 上，依次应用冻结的终态取消补丁和 #1491 已发布的 Expose reader／契约测试两文件补丁，形成单独验证树。React 的五项 returned-callable integration 测试与父提交、#1491 均逐字节一致，直接复用原测试。源码来源、补丁摘要、全部命令、输入摘要及本地工程复核保存在[机器记录](evidence/2026-11-17-exposes-composition-review.json)。

这是既有 draft 方向的组合检查，涉及 `M-EXPOSE-0001-G/H`、`C-EXPOSE-0006-C/D/E`、`C-EXPOSE-0008-B/C/D/E`、`C-CONTEXT-0003-A`、`P-SHADCN-INPUT-SHELL-BINDING-LIFETIME` 与 `M-EXPOSE-STATE-0001-C/D/E`。本记录不改变这些定义、生命周期或公开兼容性承诺。

## 实际执行

两次测试都使用 Node 24.22.1、pnpm 10.32.1、单 worker；验证树独立完成 offline frozen install，未共享其他 worktree 的依赖链接。

| 实际命令范围 | 通过 | 失败／未选择 | 进程结果 |
| --- | --: | --- | --- |
| Expose reader 31、取消函数 15、ExposeState 9、InputShell 46、React integration 5 | 106 | 0 失败，0 跳过 | exit 0，7.552 秒，无 unhandled errors |
| 原先出现 terminal unsubscribe 错误的两条 Search Vue 2 case | 2 | 0 失败，32 未选择 | exit 0，8.022 秒，无 unhandled errors |

Search 两个实际名称为：

- `Docs shadcn/vue2 returns focus to the current opener after a runtime replacement`
- `public-mode Search through the actual projection materializer vue2/shadcn: staged activation, close/reopen and generation replacement retain the live query`

这里没有把 #1491 既有的 105／52 项、终态取消修复先前的 86 项或 Search 的其他 32 项累加。输入范围明确包括七个组合变更文件、所有实际选中的测试，以及列出的 Runtime／Adapter／Module／配置边界，共 28 个文件；安装和两次测试前后摘要全部相同。其余跟踪文件由固定父提交确定，不声称动态枚举了所有传递依赖。

## 独立复核与可重建性

主代理重新核对了原始 start/result/log/JSON 的摘要、退出码、全部 106 个断言和两条精确 Search 选择；还在临时目录中从固定父提交重新应用保存的完整组合补丁，七个变更文件与实际验证树逐字节一致。28 个列明输入与运行前后记录和当前冻结树一致。

单独的静态复核覆盖 raw graph 与 public projection 的身份边界、raw receiver、ContextKey、registry 私有 entry 过滤和取消函数的私有 WeakSet 身份。#1491 将初始可变纯数据图改为稳定的公开投影，公开对象不必等于 raw 对象；两个旧 raw equality 断言的变更属于该 PR 的明确兼容性范围。测试核对原始对象不被公开写回、显式 read/result 刷新、公开别名身份、普通终态 guard 与真实签发的取消函数，未把公开投影描述为实时 proxy。

这些是本地工程复核，没有提交 GitHub `APPROVE`，也没有代替正式独立批准。

## 本提交与剩余验收

本提交只保存组合证据。#1491 的 raw-graph 实现仍由其原 PR 承载，尚未并入 #1490 的生产源码；因此 106 + 2 的结果不认证 #1490 当前 head 或整个 #1491。后续若实际整合，需核对精确补丁组合及当时 head，并执行与新变更相称的检查。

测试使用测试 DOM，不是原生浏览器、全仓类型、完整 CI 或 release 验收。InputShell 的原断开实现保持原字节，取消函数的失败仍按原语义传播，详情见[终态取消 WHY](2026-11-17-expose-state-terminal-cancellation.md)。
