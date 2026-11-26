# Sprint 2 整合记录：源码、原失败与最终验收入口

本记录为 2026-11-22 的非规范性交付记录，关联 PR #1716。用户授权执行 Sprint 2 并推进至 Ready；本次授权不包含合并、发布或改变仓库规则。源定义仍保持各自原有的 draft/active 生命周期。

## 本批范围与真实消费者

主承接 #1458、#1145、#1055、#1061、#733、#732、#1160、#1099、#1096、#1094、#793、#523、#522、#1154、#1132，同时接续 #1098 的 Slider/OTP 和 #1488 B/C/D。按原子能力验收，不因拆 Sprint 删除原条件。

各路完整记录和原始回执：

- [共享输入与 Form/Field/Select](../../2026-11-22-sprint2-shared-input.zh-CN.md)：TextControl selection/caret、AxisInput/Slider、OTP、Field choices 及对应公开配方。
- [树、集合、几何](../../2026-11-22-sprint2-collections.md)：Tree RTL/Item 关系、Data Table recipes、Virtual List owner、Resizable/Carousel/Calendar/DatePicker。
- [编译器、固定版本消费与 CLI](../../2026-11-22-sprint2-compiler-consumers.zh-CN.md)：独立 authored source × target × actual consumer 清单，以及原失败、支持/unsupported 分母和成本。
- [交叉独立评审](../../2026-11-22-sprint2-collections-review.zh-CN.md)：网站、输入、编译器、CLI、队列和 Field 反例复验。
- [DatePicker 独立评审](2026-11-22-sprint2-datepicker-independent-review.zh-CN.md)：保留原 001/002 失败、每次候选源码和后续追加结果。

真实 Harness 消费者为 `cyjin-yl/shenko@f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`；其他实际消费者包括 `OpenGreendam/verdant@91a775546ebd21a87d76d76568195a6513437719`。Shenko 的两条自有 compiled source 消费路径和九家族 Adapter 消费必须分开计数。Verdant 的真实 producer 检查不替代缺少 Cargo 的桌面运行。本批没有把 Tree/Table 等演示夹具改称这两个应用的真实使用；Harness session/follow-tail、Inspector 和两领域应用证明仍随 S7 原条件推进。

## 网站 #1488 B/C/D 与 #1154 当前公开证据

`4b3a9c8` 交付同一 Tabs/profile owner 的公开配方，保留行为实例、选中状态、子节点与焦点；四宿主 Code 字符串通过普通 imports 构建并执行。导航的原生 summary/details/a 继续拥有交互，组与叶的几何来自所选家族。Hero 使用 pill 规则，普通文本链接保留 underline 对照。双语 Hook 文档链接到原失败 JSON，并明确 R3 exit 1、未执行后续断言与 13 个未完成条件。

原站点负控 `site-before.log` 为 4 失败、7 通过；对应更新后 31/31。实际 r4 浏览器观测为 40/42，两条 Hook 证据链接失败已修复。独立查看原截图还发现 Hero 双重焦点绘制，`f0aa85b` 收敛为单个可见焦点轮廓；最初修正运行 33/34 的 Happy DOM observer 终态失败保留，使用仓库已有 scoped observer keepalive 后 `hero-focus-green-r2.log` 为 34/34。r5 远端运行因服务额度耗尽而无法回读，终态为 UNKNOWN；本记录不把它写为通过。三张真实 r4 截图已随交叉评审归档，最终修正后的视觉接受以托管 site 42 条和截图为准。

## Calendar / DatePicker 因果修正

原实现先发送 completion/关闭弹层再返回选择回调，导致回调中退休 owner 不能阻止旧关闭。`3bd5bcf` 将 completion 延后到 proposal callback 返回并重新验证 owner/view/request。后续独立评审证明：只提前发布 Calendar Context，以及从 Popover 通知的 prev.open 推断请求起点，仍无法覆盖跨通道重入。

`2419927` 先补 draft 定义；`322a871` 实现 Calendar setup 注册的纯 request capture，以及 Popover 的 canonical accepted `openSessionId`。DatePicker 在任何可观察选择写入之前记录 request/root/session，只允许同一仍 open 的会话消费 completion。新会话中发起的新请求不受旧 Context 通知退休；Calendar 不识别 Popover 组件。`dbcdecb` 修正 Popover 到新测试定义的版本关系。

验证保留如下差异：

| 原始运行 | 真实结果与边界 |
| --- | --- |
| `datepicker-causal-capture-first.log` | 新实现对既有两文件 114/114；当时尚未加入全部新回归。 |
| `datepicker-causal-capture-green.log` | 143/144；唯一失败为新测试在 dispose 后重新读取已清空 exposes。文件名不代表绿色。 |
| `datepicker-causal-capture-r2.log` | 将 oracle 改为预先持有的旧 request handle，3 文件 144/144，含 Popover entry 原回归。产品源未因这个测试前提改写。 |
| 独立原探针 | 001 State/Context 与 002 nested/old-close 共 8 个原失败已由独立评审者原样复验；以其独立记录与逐文件绑定为准。 |
| `sprint2-spec-final.log` | 原版本关联缺失 since，检查失败，原输出保留。 |
| `sprint2-spec-final-r2.log` | 对 `dc3b184` 的 36 个变更 catalog inputs 全部通过。 |

`69d8e8a` 的 native DatePicker 扩展保留实际受控回调中普通 owner 更新、close/reopen 和精确 proposal/openChange 顺序。它的静态打包与源码审查不替代 Chromium 运行。

## 最终托管验收清单

最终入口为 `scripts/analysis/run-sprint2-consumers.mjs`；现候选 `dbcdecb` 具备如下固定清单。单机只运行一条重型队列；普通套件失败不会跳过其他独立套件。共享 packages/styles 前置缺失时准确记 not-run，不生成虚构通过。

| 套件                                                            | 选定数量 |
| --------------------------------------------------------------- | -------: |
| OTP / SliderValues，三发布家族 × 四宿主                         |       72 |
| Tree / Data Table / Virtual List                                |       36 |
| Resizable / Carousel / DatePicker                               |       36 |
| Form / Select / Field choices                                   |       36 |
| 普通框架 imports / children / slots / Context / 事件 / disposal |       12 |
| 编译产物真实浏览器消费者                                        |       20 |
| 双语网站、同实例 profile、导航与 Hero                           |       42 |
| Web preferences 活更新                                          |        4 |
| Collapsible                                                     |       23 |
| Accordion                                                       |       23 |
| **合计**                                                        |  **304** |

其中 292 条属于浏览器清单，12 条 ordinary-linked 使用 Node/HappyDOM，二者不混记。preferences 的 4 条不证明 material-support/blur/alpha/fallback 完整接受。物理 OS IME、辅助技术、非 Web、原历史接受和实验家族继续保留原范围。

队列另记录 public-packages、styles 与 workspace-types 三个独立阶段。原本地 workspace types 进程 exit 137，输出为 Killed、无 TS 诊断；终止原因未确认，不能归因为产品或声称通过。托管类型阶段失败会使总结果失败，但不会阻止其余有完整前置的消费者运行。每阶段 15 分钟、有界进程组退出，workflow 总预算 225 分钟。最终五个队列负控全部通过，包括缺失/重复/选定 skip、伪满分矩阵、独立失败继续和忽略 SIGTERM 的后代清理。

`sprint2-integration-controls-r2.log` 保存 26 个 Node 控制测试（queue 5 + CI scheduling 21）、CI 调度检查、Rhea 103/103、目录 7/7 与 305 条双语主路由检查；这些结果绑定当时整合候选，不代表后续每个 commit 重新跑过所有检查。

## 提交、原作者与下一条回执

PR 已实际发布到 `c13d4d9` 的回执来自 [run 45023717671](https://github.com/Proto-UI/Proto-UI/actions/runs/45023717671)：18 个原始 Git commit 对象校验、一次精确 lease push、目标 ref 回读一致。第一次 run 45021743737 因脚本把 App token 误当人类 WRITE 角色而在写入前失败（0 writes）；原失败和修正后的成功 JSON 均保留。临时 carrier 不进入产品 PR，原作者、committer、sign-off、parents 与 SHA 均保留。此传输回执不是 DCO App 通过或技术验收。

本记录建立时最终托管队列尚未执行，本身不宣告 PR Ready。最终接受应追加实际发布 head、每套终态、artifact 摘要、独立复核、Issue 子条件回填和 GitHub Ready 回读；不会用本记录替代它们。

原件索引：[receipt-index.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint2-integration/receipt-index.json)。日志按确定性 gzip 保留，索引同时记录原文与压缩字节 SHA-256，当前相关源文件也按 `dbcdecb` 快照保全。
