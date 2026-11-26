# Sprint 2 第一轮托管终态与修复

此记录是实际观察和责任层归因，不提升 draft 定义，不代替当前候选的复验或独立接受。

## 原始完整队列

[Run 45029016292](https://github.com/Proto-UI/Proto-UI/actions/runs/45029016292)、job `137228248258` 直接运行 clean head `f8e7d12ebe64343b8caec71a7f23a6b9761b6ef7`，tree `df8009cd19537fa64c315e6427337d1e3cc24026`，Node `24.22.3` / Ubuntu 24.04 / 系统 Chrome。13 阶段都有终态；304 个选中用例为 **242 passed / 62 failed / 0 incomplete**。其中真实浏览器为 230/292，Node/HappyDOM 普通链接消费者为 12/12。

| 阶段                              | 原始终态                     |
| --------------------------------- | ---------------------------- |
| public packages / styles          | 通过                         |
| workspace types                   | 失败，327 个 TypeScript 诊断 |
| OTP / SliderValues                | 72/72                        |
| Tree / Data Table / Virtual List  | 0/36                         |
| Resizable / Carousel / DatePicker | 36/36                        |
| Form / Select / choices           | 18/36                        |
| 普通链接消费者                    | 12/12，Node/HappyDOM         |
| 编译产物浏览器消费者              | 12/20                        |
| 网站 B/C/D 与 Hook 投影           | 42/42，视觉另审              |
| Web preferences                   | 4/4，仅其原有限范围          |
| Collapsible                       | 23/23；另18条实验家族未选中  |
| Accordion                         | 23/23；另5条实验家族未选中   |

原 ZIP 为 53,712,220 bytes / 968 files，SHA-256 `acd5bebb98575a3fb417f6b4897138f4861fee81b6f65b211a8eb91f0dad72ac`。下载后的字节校验通过。完整 receipt、10 份 case report 和13份原始阶段日志逐字节保存在 `evidence/2026-11-22-sprint2-native-round1/`；`artifact-manifest.json` 索引原968份材料的路径、大小和哈希。截图和生成夹具仍可从原 artifact 获取，不能把日志链接称作已审阅的截图。

## 类型、库存和视觉环境

305 条类型诊断来自 `internal/records/evidence/` 中原样保存的历史源码和独立反例：它们包含原机器绝对路径和有意不完整的候选快照，不是当前工作区的编译单元。 `tsconfig.workspace.json` 仅把这个历史证据目录排除在默认枚举之外，材料不改写；当前产品、真实测试和被导入的当前源码仍在检查范围内。其余诊断属于当前源码/测试：公开 Form demo 的网站别名在工作区解析失败、测试的 HostBinding/非取消输入类型过宽、Props 可空结果未检查，以及两个工作包中的旧 Hook 域清单和 HappyDOM 类型声明。它们逐项修复，不能通过排除实际测试消除。

原本机 type check 的 exit137 保留；修复后的第一次本机复查在默认约2 GiB Node heap 达到限制并以134退出，原日志也保留。新环境可用内存实测约9.5 GB；串行重建47/47公共包后，用明确的4096 MiB heap复查取得正常TypeScript终态，剩下两工作包负责的8条类型诊断。这次尚不是最终类型通过。

[PR CI 45028025255](https://github.com/Proto-UI/Proto-UI/actions/runs/45028025255) 的 test-plan 发现 `sprint2-site.browser.test.ts` 和 `sprint2-native.browser.test.ts` 漏登全量库存。两者符合现有普通 shared-dev 执行责任，因此加入 `BROWSER_SUITES`，并加入网站实际探测的 `/en/ui-libraries/shadcn/tabs/` readiness route。完整性断言、测试分母和超时均不放宽。

网站原 terminal file summary 是 **162295 ms**，包含独立服务器准备；原 JSON 的首末测试时间差约99.7秒不包含完整准备，不能拿来低估成本。新增 run/head/job/log-hash 绑定的成本证据，只将该163秒观测纳入排程；编译消费者的原45597 ms失败终态仍保留，修复前继续使用原120秒未测预留。库存为101套、18 shards，最大估计694秒，原720秒套件预算、180秒准备预留和900秒总预算不变。

独立视觉审读发现部分中文截图缺字成方框。功能42/42不能证明中文显示正确。Sprint 2 托管队列新增 Noto CJK 字体安装，并把实际包版本及中文fontconfig匹配写入 `fonts.txt`；随后重新运行原套件和截图。网站内容与断言没有为环境缺字作修改。

## 接续责任与保留条件

集合、表单和编译消费者的失败按原逐case结果继续修复并独立审阅；原红色报告保持不变。新候选必须重新取得受影响终态与真实视觉回读，才可将对应开发子条件更新为已完成。物理OS IME、辅助技术、真实Harness session、Rust/桌面、GPUI及其他后端、完整历史接受和实验家族仍沿原Issue/Sprint保留。本记录不声称 Ready、合并、发布或生产部署已经发生。
