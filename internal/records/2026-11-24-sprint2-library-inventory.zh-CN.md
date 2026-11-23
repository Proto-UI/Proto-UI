# Sprint 2 / #732 F3：全库 × 公开 profile 清单与 ratchet 执行器

日期：2026-11-24（北京时间）。执行者：OpenAI Codex。本交付提供真正从 authored source 到 emitter 的全库执行器和历史分母账本。完整整合候选的全量运行由整合 owner 串行调度；下面的小样本不是全库接受。

## 分母和状态

[`library-profile-inventory.mjs`](../../scripts/compiler/library-profile-inventory.mjs) 从当前 Git tree 枚举 `packages/prototypes/*/src/**/*.proto.ts` 的每个 tracked 文件，验证实际工作树字节对应其 Git blob，保存 entry / family / bytes / SHA-256 / blob / mode。不固定成某几个消费入口，也不把文件数写死。

profile 来自实际 `TARGET_PROFILES`：当前六个 implemented profile 全部独立运行 `compileFile`；包括 `react-runtime-v1`，不是将它换成 Vue2 的四个 source profile。另外六个 Qt / Flutter / SSR 公开 profile 按真实 registry 声明生成 `UNIMPLEMENTED` / `profile-declaration-only` 行，并保留 resolver 的拒绝诊断。它们没有被调用私有 emitter 后记成公开成功。

每份最终报告仍保留 **完整 entry × 全部公开 profile** 的分母。执行选择、分片、中断或分批只改变哪些行获得真实收据；未执行的 implemented 行保持 `UNTESTED`。状态为 `PASS`、`UNSUPPORTED`、`FAIL`、`UNIMPLEMENTED`、`UNTESTED`。 `compiler-defect`、`invalid-input` 和其他失败分别保留在 `failureKind`；混合诊断中存在 compiler defect 时不会因为首个诊断是 unsupported 而将其降级。首个诊断及完整原诊断序列均保留。

`PASS` 只代表当前 `compileFile` 从源输入经过 parser / IR / emitter 返回实际产物。报告不把它解释成 target strict build、Adapter differential、运行时交互、native platform、视觉或 AT 通过。每个成功行保留 IR/source graph 和实际 emitted artifacts 的哈希、字节数、依赖及独立 metadata 收据。

## 一入口一 worker 与可恢复执行

每个 entry 都启动一个独立 Node worker，默认 `--max-old-space-size=3072`，完成该 entry 后退出。worker 内先读一个 `FileSourceGraph` snapshot，随后六个 implemented profile 分别实际调用 `compileFile({ sourceSnapshot })`，各自执行到 emitter。共享只限于同一入口的已读取 source closure，没有复用某个 profile 的编译结果。

closure 读失败时，脚本不会将不完整 snapshot 传入从而绕过 `compileFile` 的 loader 拒绝；各目标会走真实 file API 的错误路径。每个入口保存完整已读取 closure 成员、内容哈希、import / package-resolution 记录和实际失败。

每个 profile 完成后立即原子保存一条收据。单 entry worker 的 before / after memory、RSS high-water mark、heap 上限和终态资源均有记录；这些包含导入、closure 读取和该 worker 已执行的多个 profile，不是组件 allocation 或运行时性能结论。默认每个 entry worker 的监督 timeout 为 180,000ms，可显式调整。signal、timeout、OOM 或其他进程退出按实际 status / signal / error 记录；没有 durable row 的目标仍是 `UNTESTED`，不会假装获得 compiler diagnostic。

run 目录由 exclusive writer lock 保护。正常分批和退出会清理 lock；如果整个执行器被 SIGKILL，应先确认原进程终止，再由操作方处置遗留 lock，不能并行接管同一目录。分片使用不同输出目录。resume 要求相同 source / compiler / profile / script identity 和相同选择；已经完成的行不会重跑或替换。历史对象后续变为可用时，已有 run 仍保留它启动时的历史观察，不影响已完成当前源码的收据。

```sh
# 默认完整分母，全部 implemented profile；输出必须在 checkout 外。
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-all

# 有界执行，下一次接着处理尚未完成的入口。
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-batched --max-entries 25
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-batched --max-entries 25 --resume

# 源冻结相同的四份 entry 分片；是否并发由实际资源 owner 决定。
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-0 --shard 0/4
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-1 --shard 1/4
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-2 --shard 2/4
node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-3 --shard 3/4
node scripts/compiler/library-profile-inventory.mjs --merge /tmp/library-report.json /tmp/library-0 /tmp/library-1 /tmp/library-2 /tmp/library-3
```

其他明确选择：重复 `--entry <path>` 或 `--family <name>`； `--profiles <comma-separated ids>`；`--heap-mb <MiB>`； `--entry-timeout-ms <milliseconds>`；`--plan-only`。这些选择不会删掉完整分母中的其他行。 `--compiler /absolute/pinned/index.js` 可以使用已交付 artifact，并逐文件核对它的 compiler-build inputs 与当前 source-loader / compiler 源码；省略时使用当前真实源码。

## 原 394 × 四 named profiles 已按真实 Git bytes 恢复

原 revision 为 `35195a6e6f1ba6a7d800da0029f2683013abd18b`，实际 tree 为 `de698a62e9ecf41db438e039830eacf5e71cf5aa`。本地 tree 先可枚举全部文件；其中 30 个旧 blob 当时尚缺。仅从已连接 Git origin 取回这些确切对象后，394 份 authored entry 全部实际读回，再生成 [`library-profile-history-35195a6.json`](../compiler/library-profile-history-35195a6.json)。

原 Base 178、Shadcn 216 和四个原具名 profile 分母均保留，共 1,576 个原 pair。文件清单含真实旧 mode、blob、bytes、SHA-256；成员账本 digest 为 `8ff2977a9c5d101beba1975b999cd87d7a257f4470fa97a86643e58278a7b8f8`。当旧 Git objects 不可用时，执行器明确写 `recovered: false` 与原错误，不编造 hash。

原每 profile 的 `5/178 Base + 0/216 Shadcn = 5/394` 及五个 reported pass 文件仍标为用户历史报告；本次恢复源码账本没有重新执行原 compiler，也没有用当前结果改写这些旧结果。当前报告另列 retained / removed / added membership，原分母不会消失。

## Ratchet 的实际约束

`--baseline <previous-report.json>` 可用于完整 run，或作为 merge 的最后一个参数：

```sh
node scripts/compiler/library-profile-inventory.mjs --merge /tmp/current.json /tmp/library-0 /tmp/library-1 /tmp/library-2 /tmp/library-3 --baseline /tmp/accepted-baseline.json
```

ratchet 不允许 baseline 的任何行静默消失，包括原 unsupported 行；原 PASS 变成 UNSUPPORTED、FAIL、UNTESTED 或缺失都失败。新出现的 compiler defect 独立失败。source change、改善和原首个诊断分别输出，不因源码改变自动豁免回退。不同 source/compiler/profile/script identity 的 run 不能合并；相同 entry/profile 的重叠收据也直接拒绝，不能重复计数。

exit 0 只表示本次所选执行预算正常完成且没有 compiler defect / ratchet 拒绝；有界 `--max-entries` 退出仍可能 `selectedComplete: false`。完整性的权威字段是 `admissionCoverageComplete` 和完整状态计数。merge 有未执行 implemented 行时 exit 2；ratchet 或 compiler-defect 失败为 exit 1。UNSUPPORTED / invalid-input 的完整分类可以形成终态清单，但不等于所有入口已准入，后者还需要单独的 `allImplementedEntriesAdmitted: true`。

## 本轮小样本验证

小样本绑定本工作树原 compiler 来源 `fff0ed748`，两入口为 Base Button 与 Table Caption。该旧树实际为 1,011 个 entries（Base 180），与整合树后来新增的入口分开记账。

- 第一次 `--max-entries 1` 完成 Button 的六个独立 profile。
- 同一目录 `--resume --max-entries 1` 完成 Caption 的六个独立 profile。总共 12 个真实 source-to-emitter PASS；前六个收据保留，没有重复执行。
- 两次 worker heap 限制均为 1,024MiB，RSS 峰值分别约 382.3MiB / 336.0MiB。
- 小样本 merge 明确保留 6,054 个 implemented `UNTESTED`，exit 2，没有把 12 个选中 PASS 宣称全量通过。
- 相同目录重复 merge 真实拒绝 overlapping receipt，exit 2。
- 三个直接 ratchet / classification 测试成功，覆盖混合 compiler-defect、无诊断 failure、删除或未执行原 PASS、变化源码的回退、删除 unsupported 分母、重复身份及改善。

小样本之后仅加强了“任何 baseline 行都不得消失”的 ratchet 条件，并重新执行上述三个测试。实际小样本执行器的精确字节按计划中的 SHA 恢复保留，避免给不同脚本版本代填执行。

[完整小样本证据与逐文件哈希](./evidence/2026-11-24-sprint2-library-inventory/validation.json)随本记录保存。完整源码与新定义融合后的全库 sweep 尚未在此记录中执行；必须使用最终确切来源另留结果。

随后还增加了真实工具身份绑定：description 读取 compiler 实际解析的 TypeScript、source-loader 的 TypeScript 和 tsx 的 package / implementation 哈希。直接 `--describe` 已实际观察 TypeScript 5.9.3 与 tsx 4.21.0；正式执行会将各自实际路径、版本和哈希写入 run fingerprint。这是执行元数据增量，没有重标上述小样本的脚本 SHA 或扩大其通过范围。

执行器自审进一步收紧了恢复和失败边界：每个 entry worker 在读取源码前再次核对 checkout、HEAD、干净状态、脚本、compiler 入口、source-loader 及实际 TypeScript / tsx 身份；共享 snapshot 的不可变检查移到每份收据持久化之前。恢复读取会核对 profile 身份和原诊断分类，PASS 必须同时有对应 profile 的输出及匹配的 artifact 哈希。报告保留全部 worker attempt 的退出状态、信号、资源和缺失终态收据，后继 resume 不会抹掉先前 OOM / 中断等执行失败；编译行结果与进程是否正常结束分开记录。可选 ratchet baseline 另绑定实际报告文件字节的 SHA-256，避免只列候选来源却没有绑定所比较的结果内容。
