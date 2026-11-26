# Sprint 7：固定主线与 discovery 夹具修复的整合

本记录追加到 [实验成果恢复记录](2026-11-24-sprint7-experiment-recovery.md) 之后，保留原提交和原回执，记录一次有界的正常合并。它不重新执行四项参与者实验，也不把原 S1 主线合入或局部测试通过解释为整个 Sprint 的验收。

## 固定输入与来源保留

本次合并的两个输入为：

- 已完成的恢复 head `8f6dbb6b3fea5af0031bb0560af7c74a21d2ca96`。其父 `b69f195e706af286c162dbd808d56fa5c076a7e9` 是保留原始 `4e5e50e159573a627d5e75037b23513ad8f5f164` 的双父源合并；当时的原 116 个 mode/blob 全部相同，原 bundle 和验证回执继续保留。
- 已发布的夹具整合提交 `5df50345c1dfb0feb8158be20f763ce5f97ffbf3`。它的两个父提交为原夹具修复 `c06a43cd13bed4bbd67ea5579ba156714581ca1d` 和固定主线 `1dd7afa3ea4ff43c1f28306c9b035e87ed11ea62`；相对该固定主线，仅有三个 discovery 测试夹具文件。这里保留同一个修复提交，没有重新实现或改写其作者历史。

正常合并只在 `.prettierignore` 产生一个真实冲突。两边均在共同的 `8b052eb9cdb707ab7a4c8b7660c9442a7e3ee489` 字节前缀后追加规则；处理方式是保留完整原 S7 文件，再追加完整 S1 后缀。两方的规则和注释均保留，没有增加否定规则或删去任何一方的冻结证据保护。见 [冲突处置](evidence/2026-11-24-sprint7-current-main-integration/conflict-resolution.json)。

在追加本记录前，对合并源码 tree `bf9d1ae27c39255d0fb078051d4836f68c5326ce` 核对了三方全部 **17,608 个路径**：除上述明确的配置冲突外，每个 mode/blob 都来自相应的正确未冲突父方，没有发现被误选或丢失的路径。原始 116 个改变路径中，**115 个载荷仍与原 4e 完全相同**；唯一不同为双方规则并集后的 `.prettierignore`。此前恢复提交新增的 **49 个文件全部保持原 mode/blob**，并入的三个夹具文件也与原 5df 完全相同。详见 [源并集核对](evidence/2026-11-24-sprint7-current-main-integration/source-union-preservation.json)。

这项主线整合不会改变原研究的执行版本。四项实验仍绑定原报告中实际使用的源码、模型条件、样本和浏览器产物；新主线上的 Compiler 或 Runtime 改动不会自动成为那些历史观察的新验证结果。

## #748 夹具修复与本轮八项控制

原恢复记录保留了四个 discovery 测试先在 README 摘要保护处失败的结果，以及独立核对发现的五处既存 source 漂移。本次并入的修复只修正测试夹具的来源：生成器按 manifest 声明的 `0607c6c5c386b8a932ab850e92a8873b2121dc45` 提取原始源码，并逐项验证原摘要；测试再由这个受控快照构造独立 source root。当前 harness 与稍后加入的 participant prompts 保持它们自己的输入边界。测试执行时不依赖 Git 历史或网络读取。

原研究 manifest 没有被改写，SHA-256 仍为 `173ac30c94ce1143f0fa80da3bd62937adb31f09c1ad98215163917b75d89fbb`。研究 harness、冻结数据和研究报告的摘要也没有被改成当前 checkout 的内容；被改写的源字节仍会被原保护拒绝。这是测试输入来源的修复，不是放宽实验接受规则。

在上述合并源码 tree 上实际执行：

```sh
node --max-old-space-size=256 --test --test-concurrency=1 --test-reporter=tap scripts/benchmark/test/discovery-study.test.mjs
```

终态为 **8 tests、8 pass、0 fail、0 skipped、0 cancelled，exit 0**，测试报告耗时约 0.77 秒。覆盖原四个分析/冻结控制，并保留或增加源字节变更、缺失 run、缺失预定 cell、伪造 control 成功与信息暴露边界等拒绝条件。实际命令起始记录、终态、stdout/stderr 摘要和原输出均保留在 [控制测试回执](evidence/2026-11-24-sprint7-current-main-integration/discovery-controls.json) 及其相邻文件。

这份八项后继结果没有覆盖原来的 106 项组合命令或整套 agent-operations，也没有重新执行全仓文档检查。原 102/106、1051/1054、丢失终态的限定重跑和两次文档检查 exit 137 仍是各自原候选上的真实记录，均未改写成通过。后续独立审查和平台准入应继续分别检查当前 head 的适用条件。

普通 merge 提交的首次 Husky hook 在处理完整改变范围时，Prettier 报告 SIGKILL，Husky 返回 137，Git 返回 1，未生成提交；原始输出保留为 `integration-commit-initial.*`。随后只检查首个尚未报告完成的输入文件，使用同一 Prettier 和 128 MB heap，结果 exit 0；这只是定位范围的单文件观察，不替代完整 hook。后继仍通过完整普通 Git/Husky 提交流程，所有任务和断言保持原样，实际终态由提交回执分别记录。

完整普通 hook 的第二次尝试使用 128 MB heap，仍因 SIGKILL 返回 Git exit 1；lint-staged 回滚中的 `git apply` 也报告 signal 9。后续实际读取发现 HEAD 仍为原 8f6、tracked index/worktree 已回到干净状态，MERGE_HEAD 已清除，并留有零字节的过期 index lock。没有将错误文本直接解释为永久 index 冲突。已保存该空锁及真实自动备份 `24d4dffc1` 的 index parent，再通过同一正常合并恢复已审 ignore 与新增记录，逐字节重建完整提交前 index tree `fa2eb8e5903d8c22ea71961325becc1fcea19257`。两次失败均未产生新 commit；后续正常 hook 和真实整合提交须在独立执行环境完成，不能把本地准备状态冒充已提交或已合入。见 `integration-commit-bounded.*` 与 [状态恢复回执](evidence/2026-11-24-sprint7-current-main-integration/failed-hook-state-restoration.json)。
