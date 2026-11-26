# Sprint 2 / #1145 #732：无 payload 事件的数据来源分析收敛

执行者：OpenAI Codex；2026-11-24（北京时间）。

## 修复及保留的语义

完整 authored Transition 在原 6b6462b526094cee9d3fa385332162c384624e3e 的 Compiler 回归中持续占用 CPU。真实分阶段记录显示公共 callable demand / phase 分析已结束，额外 outward JSON aggregate provenance 检查仍在进行。原全套两队列在保存现场后受控停止：29 个完整文件的 485 个 case 通过；两个在运行文件没有完整 JSON，241 个一般文件及 15 个 browser 文件未执行。原 287-file 分母保持不变，未把受控停止报作完整通过。

本次只在实际可执行 IR 中所有 expose.emit 都省略 payload 或直接给出 undefined 时，省去没有数据对象可追踪的额外 JSON aggregate 分析。普通 callable / phase 检查始终执行。只要任一真实 payload 是 literal、call、reference、alias、record 或其他表达式，就保留完整数据来源检查；不依赖 event.payload 的 void 注解、事件名称或目标 profile。遍历覆盖 setup、module bindings、hooks、默认参数和嵌套 callable。它没有证明非 void 的任意复杂 JSON 图性能均已解决。

## 验证

下列实际命令在独立候选 checkout 执行，原 case / hook 超时保持不变；来源为上面的 6b 基线加与本提交相同的三个源文件。该候选与后来的整合 commit 分别记录，不冒充新整合树完整回归。

| 完整测试文件 | 结果 | 接受范围 |
| --- | --: | --- |
| host-callback-fixed-point.test.ts | 13/13，0 skip，exit 0 | 实际完整 Transition 编译、序列化冷 IR、缺 payload / undefined 正例、void 返回真实对象 / 函数反例、phase 拒绝、伪 metadata 的独立来源检查 |
| authored-native-types.test.ts | 10/10，0 skip，exit 0 | 原五 profile 的完整 Transition 严格类型及五个 higher-order 生成消费者 |
| authored-native-consumer.test.ts | 8/8，0 skip，exit 0 | 原完整普通消费者文件，保留每 case 30 秒 |
| 合计 | 31/31 | 三个完整文件，不等同于原 287-file 全套或 12,180-cell 库存 |

此前选定七个小反例包含在 13/13 内，不重复计数。新增子进程 watchdog 捕获同步分析卡死，不延长原 authored 文件的限制。

独立只读审查验证了真实 emit 扫描、函数默认值 / getter / try-catch-finally、冷 IR 的 exact-kind schema 边界及原反例仍启用完整检查。[审查原件](./evidence/2026-11-24-sprint2-compiler-convergence/independent-review.md)明确没有冒充独立重跑或 GitHub approval。

## 原始证据与来源

[232 个原始文件清单](./evidence/2026-11-24-sprint2-compiler-convergence/manifest.json)、[归档收据](./evidence/2026-11-24-sprint2-compiler-convergence/archive-receipt.json)及[全部原始证据](./evidence/2026-11-24-sprint2-compiler-convergence/raw-evidence.tar.gz)随本提交交付。归档 1,803,320 bytes，SHA-256 为 3ea35a28c10833c58e3fd9d5e4a8a8450465c1304c06084a2f2a930dcad23fd1，逐成员读回哈希一致。

原件包含两队列的已完成 / 运行中 / 未执行事实、CPU profiles、被否定的分析假设与诊断变体、每个变体完整源码、最终 full-index patch、独立审查及三个完整通过文件的输出。保留第一版只按 void declaration 的实验，不将它冒充最终实现。

本提交同时纠正 Bootstrap 派生摘要里手写历史 SHA 多出的末尾字符；正确历史头由实际 Git rev-parse 和原报告共同取得。原 39/40、4/4、40/40 结果与原始压缩包未修改。

## 后续整合接受

原 #1145 的完整 admitted source → IR → emitter → consumer、#732 原 library × profile 分母与独立差分仍需绑定最终整合源树。该修复不关闭两条 Issue，也不把未支持、未实施、未执行或真实硬件 / AT 条件升级为通过。
