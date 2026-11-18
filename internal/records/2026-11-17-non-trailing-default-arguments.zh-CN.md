# 非尾默认参数的调用位置与原生产物类型修复

本记录绑定已发布父提交 `0b8b403179759250664587a4a0e990a5354e02e4`。它续接 Array.every 的默认参数检查，修复已被最小 source、portable IR 和完整严格消费者证实的相邻问题。原 21 项夹具已在相同断言下由 11 pass / 10 fail 转为 21 pass；105 项既有相关回归与 4 项新增真实 DOM 消费者也已通过。这是此补丁的有界开发证据，不表示整个 Compiler 已验收。

## 合法输入与实际缺陷

普通函数可以在必需参数之前声明默认值，例如 `(first = 7, last: number) => first + last`。调用方仍需提供第二个位置；传入 `undefined` 才会在第一个位置使用默认值。[TypeScript 官方函数说明](https://www.typescriptlang.org/docs/handbook/functions.html#optional-and-default-parameters)明确区分了这种默认参数与只能位于尾部的可选参数。项目的 [thin compiler 标准](../compiler/atomic-lowering-completion.md)要求保留合法作者函数和目标语言语义；此次没有把默认参数位置改成新的 Core 限制。

当前 `checkedCall` 已按最后一个必需参数的位置计算最少实参数量。新增 local source 与 portable 负控制实际通过，因此本修复不把正确的通用调用检查误记为旧缺陷。真正不一致的路径是：

1. `ir-validation.ts` 的 module `helper-call` 仍按必需参数的数量计数，错误接纳删去最后一个必需实参的 portable IR；它又未承接默认参数的显式 `undefined` 输入，反而拒绝前端已接受的合法调用。
2. `valueAssignable` 的 callable 分支也按必需参数数量比较签名，并把函数体内参数类型直接用于入口兼容性。它因此允许两位置函数被缩成一位置 view，同时拒绝显式允许 `undefined` 的合法位置 view。
3. 共享 JavaScript callable type formatter 把前置默认位置输出成 `first?`，随后跟着必需 `last`。四个 DOM source profile 的实际严格消费者都产生 `TS1016`。未被调用但身份可观察的函数还有一条独立路径：Vue2 的 uninvoked JSDoc 在真实默认 initializer 之外再次输出 `[first]`，也产生同一诊断。

## 最小修复与边界

`minimumArgumentCount` 共享最后一个必需位置的计算，供原有 `checkedCall`、callable 赋值与 portable helper 校验使用。`parameterArgumentType` 只描述调用入口可接受的值；它为可选或默认位置保留 `undefined`，不改变函数体中的 `parameterValueType`，也不把已初始化的参数重新降为可能缺失。

Callable 赋值仍按参数逆变检查，现有 `erasesRuntimeAuthority` 前置门保持不变。Helper 校验先完整验证实参表达式，再对已规范化为可选/default 的位置接纳 `void`；原本的 literal/record 事实检查没有替换，callback effect 分析没有修改。相关回归实际保留并执行了 structural-authority 的 13 项和 e46 所属 control-label-callable-context 的 57 项；新增正例没有替代这些边界。

共享 typed formatter 对前置可选/default 位置输出必占位置的 `(T) | undefined`，只在可省略的尾部使用 `?`。Vue2 uninvoked JSDoc 让真实 JavaScript initializer 表达默认值，不重复标成可选。原有未调用函数的分配身份、参数 initializer 形状与不可达函数体处理保持原样。

## 已执行的真实基线

| 检查 | 父提交实际结果 | 失败归因 |
| --- | --- | --- |
| `non-trailing-default-arguments.test.ts` | 13 项，8 pass / 5 fail，0 skip，exit 1，2.630 秒 | 两条 helper-call 不一致、source/portable 缩短 callable view 被误接纳、合法 `undefined` 位置 view 被误拒 |
| `non-trailing-default-types.test.ts` | 8 项，3 pass / 5 fail，0 skip，exit 1，17.127 秒 | 四 DOM 的 called record member 与 Vue2 的 uninvoked allocation 均在最终完整 Program 检查报 `TS1016` |

两组无未处理异常。严格消费者先通过生成 AST 的真实两形参 allocation 断言，再经 `compilePrototype`、`writeCompilation` 写入完整产物与 supporting files，最后使用 `strict/noEmit/allowJs/checkJs` 的 TypeScript Program 检查。没有用未发射的死代码、手写的类型字符串或单一输出文本匹配代替该证据。

环境为 Node `24.22.1`、pnpm `10.32.1`、TypeScript `5.9.3`、Vitest `2.1.9`。本树实际离线 frozen/ignore-scripts 安装依赖，2.537 秒、exit 0；各测试使用单 worker，禁用文件并行。两组执行前后 24 个枚举输入保持一致，全部 21 个测试断言在当前产品补丁中保持原字节。已有 esbuild `ES2024` target warnings 保留在原始日志。

机器记录位于 [对应证据](evidence/2026-11-17-non-trailing-default-arguments.json)。基线与候选分别绑定源码和文件摘要；生成临时目录按测试清理，原命令、诊断、日志与 Vitest JSON 均保留。

## 当前候选验证

三份产品文件在以下三轮之间保持冻结，两份原夹具与基线逐字节一致，原 21 个用例的完整名称和顺序也一致。

| 检查 | 当前候选结果 | 实际范围 |
| --- | --- | --- |
| 原 source / portable IR | 13 / 13，0 skip，exit 0，3.003 秒 | 原 5 个失败转绿；已经正确的 `checkedCall` 负控制保留 |
| 原完整严格消费者 | 8 / 8，0 skip，exit 0，14.865 秒 | 四 DOM profile 的 called / uninvoked 产物图均经真实 TypeScript Program |
| 既有关联控制与新增普通消费者 | 109 / 109，0 skip，exit 0，27.889 秒 | control-label 57、structural-authority 13、Every source 15 / consumer 16 / types 4，以及新增普通消费者 4 |

三轮均无未处理异常；各轮执行前后 31 个枚举输入的 SHA-256 完全一致。枚举包括实际源码、配置、三个新增 fixture、共享普通消费者 helper 和五份既有相关 fixture，不声称它是完整 import graph。初始 24 输入的两份红例收据保持原样，没有用后补 manifest 冒充历史绑定。

`non-trailing-default-consumer.test.ts` 的四个 profile 各自真实 compile、write、import、mount，再读取公开结果：module helper 与本地合法 callable view 在提供 `2, 3` 时都得到 `5` 且默认值未调用，显式传入 `undefined, 3` 时都得到 `10` 且各自默认值恰好调用一次。未调用函数的 alias 身份保持一致，其默认 initializer 调用次数为零。Module helper 显式接收 fallback 参数，用来在同一小 program 中观察真实默认行为；这里没有夹带另一候选中 module default 捕获 owner support 的修复。四项属于追加的行为验收证据，未在旧产品上执行，不能算入原 10 个红例。

完整机器记录保留每条命令、文件数量、exit、耗时、原始日志 / Vitest JSON / 收据摘要、失败用例及其归因。所有候选检查均以单 worker、无文件并行执行；无须重跑原 21 项来汇总新的 109 项。临时生成目录由 fixture 清理，不声称留存了生成字节归档。

## 未执行边界与交接

当前没有完整 workspace types、全量 CI、native browser、其它 native backend 或 release acceptance 的声明。HappyDOM 的普通挂载与公开读取是行为证据，不是原生浏览器截图。下一步由 root 独立复核精确补丁，再与 finite-index、Scroll 或其它编译器补丁按来源整合，并绑定真实组合消费者。本记录不修改其它候选的代码或贡献来源，也不构成 GitHub formal approval。
