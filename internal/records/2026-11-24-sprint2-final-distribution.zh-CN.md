# Sprint 2：最终候选的固定分发、干净消费与生产成本

本批实际执行来源固定为 `5cb80eb937f20982dd7dc8cbc93a90e91d665c31`，在独立干净 checkout `/workspace/scratch/b2027510c911/s2-consumer-final` 上运行。此前 [分发准备记录](./2026-11-24-sprint2-final-consumer-gates.zh-CN.md) 中的最终 registry / packed / cost 待执行项，本次取得了各自的实际终态。完整机器收据见 [receipts.json](./evidence/2026-11-24-sprint2-final-distribution/receipts.json)。

## 完成的执行门

| 执行组 | 实际结果 |
| --- | --- |
| Workspace 工具身份 | frozen lock、ignore-scripts、offline 安装成功；实际工具与 lock 对齐 |
| 分发相关测试 | 5 files、76/76；CLI、watch、artifact writer、target 版本及 output |
| 固定 Compiler | 两个新目录各产生九个文件，总计 10,134,569 B，逐文件 bytes / SHA-256 完全一致 |
| Compiler 自身的干净安装 | 独立 npm cache、空 node_modules、仅声明 TypeScript 5.9.3；真实 npm ci 后 plain Node 回读正确 build identity |
| CLI / 文件所有权 | 15 条命令均按预期终态；新目录、父目录、只读 diff、用户编辑与普通重建、collision、symlink、两个真实并发 writer |
| Watch | 初次成功、依赖编辑成功、非法输入保留 revision 2、恢复后新产物；预期 SIGTERM 处置与两种 session replacement 原件保留 |
| 四个 native source profiles | React / Vue 3 / Vue 2 / WC 4/4；每个消费者从自己的精确 manifest 生成 lock，再 npm ci，完成普通构建、原始与编辑后的执行、更新和清理 |
| 完整作者 Button 家族 | Base / Shadcn / Brutalist × 四个 Web profiles，12/12；每目标独立 registry 安装 |
| Canonical public pack | 从 Core / Hooks / React Adapter / Base 四个种子的真实 manifest 闭包生成 40 个包，均实际 build / pack；未调用 publish |
| 实际 packed 配对消费 | `react-runtime-v1`，40 个 internal tarballs + 21 个实际 external packages（含工具）；原 Adapter 与生成物各完成六个独立 Button 检查点 |
| 生产成本 | 四目标 × 1/3 modules 的八个 bundle；React 0/1/3 三个新进程初始化观察；测量器校准及负控通过 |

执行器将所有输出置于源码树之外，并在每组前后校验完整 HEAD 与干净状态。CLI / native / family 使用 `registry` 路径，未用 payload-copy 路径替代。消费者父目录没有可意外提供模块的 `node_modules`；安装使用新 cache、仅声明的依赖及普通 Node 环境。npm 对环境 proxy 配置的警告和版本通知保留在原 stderr 中。

`react-runtime-v1` 的实际生成声明、profile、helper 与所安装 Core / Hooks / React Adapter 均为 `0.3.0-alpha.2`；React 目标为 `19.2.6`。packed 脚本没有将 alpha.1 声明静默映射到 alpha.2。原 alpha.1 provenance 和此前候选结果仍保留原身份。Compiler 继续使用固定源码 SHA / profile digest 支持方式，没有改变 private / experimental 或 registry 发布状态。

## 预期拒绝与一次未终态尝试

15 条 CLI 命令中，缺失 parent、collision、symlink、并发中的一个 writer 和用户编辑后的 diff / collision 都具有各自的预期非零退出；不能将它们误计为产品失败，也不能把 15 条描述为全部 exit 0。两个 watch session replacement 分别使用真实目录与 symlink，均 fatal 拒绝后续发布并保留原成功版本，消费者替换内容未被修改。原始及编辑后的普通 target build / mount 均成功。

第一执行会话在三家族组开始后失去可读终态。工具随后明确返回 `Unknown process id 49755`；其 receipt 最后保持 RUNNING，首目标尚无终态，退出码及 signal 不可恢复。因此它被单列为 `INCOMPLETE_SESSION_UNAVAILABLE`，没有推断为 SIGKILL、没有伪造 Compiler 诊断，也没有回填为通过。原日志、原 summary 与单独 disposition 全部保留。

续跑在新目录中只执行 family / pack / packed / cost。此前六组均已有完整 PASS 终态，引用其未修改的原 receipt；九份同来源 Compiler 文件重新核对 bytes / SHA-256 后复用。续跑最终 exit 0，四组均 PASS。本记录描述的是同一冻结来源的完整执行集合，未宣称一次不中断的单次运行。

## 生产 bundle 的实际数据

`N=1` 为 Base Button，`N=3` 为 Base / Shadcn / Brutalist Button。esbuild `0.25.12` 实际打包保留公开 component exports、真正可达的目标依赖，source / retained / gzip 分开记录；以下单位均为 bytes。

| Profile                   |   N | Retained production |   Gzip | Retained supporting code |
| ------------------------- | --: | ------------------: | -----: | -----------------------: |
| `react-dom-source-v1`     |   1 |              89,196 | 29,825 |                   55,019 |
| `react-dom-source-v1`     |   3 |             193,651 | 50,207 |                   63,622 |
| `vue-source-v1`           |   1 |              93,795 | 32,475 |                   53,870 |
| `vue-source-v1`           |   3 |             190,738 | 50,687 |                   63,816 |
| `vue2-source-v1`          |   1 |              73,655 | 24,841 |                   54,353 |
| `vue2-source-v1`          |   3 |             181,224 | 43,704 |                   63,882 |
| `web-component-source-v1` |   1 |              76,910 | 25,586 |                   60,549 |
| `web-component-source-v1` |   3 |             170,261 | 42,146 |                   68,764 |

八个 bundle 均保存实际 entry、bundle 和 metafile hashes、逐输入路径及保留大小。1 → 3 组合中，React / Vue 2 / WC 各保留八个相同路径及 hash 的共享支持模块，Vue 3 为七个；各目标新增六个所需支持模块。在这组实际产物中，没有观察到相同内容落在不同支持路径的重复模块。这个观察没有扩展为任意项目的最大去重证明。

## 初始化与注册工作的独立观察

每个 N 使用新进程、新 Happy DOM window 和自己的生产 bundle；零组件也真实创建、卸载 React 根，提供框架工作的独立对照。以下为成功的宿主 API 调用数量，不是唯一活跃监听器数或全部 JS 堆分配。相同 callback 的重复 add 调用仍分别计数；once / signal 自动解除不会被伪装为显式 remove。完整 import / mount / cleanup 事件序列保留在原报告中。

| React modules | Mount addEventListener | Cleanup removeEventListener | MutationObserver observe / disconnect | Cleanup 后根子节点 | 终态旧 handle 拒绝数 |
| --- | --: | --: | --: | --: | --: |
| 0 | 139 | 0 | 0 / 0 | 0 | 0 |
| 1 | 157 | 18 | 0 / 0 | 0 | 1 |
| 3 | 196 | 57 | 1 / 1 | 0 | 3 |

三个新进程的挂载观测分别为 `8.003` / `13.173` / `26.774` ms；这是包含框架和探针开销的各一次环境观测，没有接受的时间预算。`acceptedBudget` 保持 null。三者清理后根子节点均为零，1/3 组件的旧 public handles 均明确拒绝访问。

原 F6 的 text-watch 17.2 KiB、counter-press 110.7 KiB、三探针 224.5 KiB、Adapter 562.6 KiB 使用原任务与 excluding-React 边界。本批 Button / 可达目标依赖的结果没有复现或替换这四个历史数字。原输入的同边界对照、全库能力闭包、所有目标的完整分配 / 注册预算与最大项目级去重继续分别核对。

## 接受范围

本批普通消费者执行于 Happy DOM。它覆盖真实框架挂载、公开状态、更新、编辑、生命周期及终态清理；物理输入、浏览器布局、AT 和原全库 Adapter/generated differential 属于各自的接受条件。现有普通 `buildProgram` 的 Vue 2 JavaScript 主体未启用 checkJs；Compiler 的独立严格生成类型切片另有自己的原回执，不能由本表替代。

本批没有 GitHub 远端写入、平台 APPROVE、Issue 关闭、registry 发布或全 Sprint 完成声明。后续 evidence commit / PR 等载体由整合 owner 使用受支持的 `agent:publish` 路径处理；本记录不制造该发布的 receipt。

## 可恢复交付

[执行归档](./evidence/2026-11-24-sprint2-final-distribution/execution.tar.xz) 为 `5,379,824` B，SHA-256 `b56374f126f951574cfc250acc694d6ad312f711eeec56991c3aa34a7fcb5665`。[逐成员清单](./evidence/2026-11-24-sprint2-final-distribution/execution.manifest.json) 记录 `4,376` 个成员的 bytes、mode、SHA-256，全部已从压缩包读回核对。

归档保存两次执行的原 receipt / logs、固定 Compiler 两份产物、生成源码与 maps、输入 fixtures、manifest / locks、安装 payload hashes、普通消费者轨迹、实际 public tarballs / staging、成本报告与协调器。可重装的 node_modules 和 registry cache 不在归档中；精确省略路径列于 manifest。为使归档可安全移植，2 个原 symlink 不作为可解析的绝对链接写入 tar，而在 `archive-symlinks.json` 保留原路径及目标；普通文件原始 bytes 不变。源码来源继续绑定上述完整 Git SHA。

归档传输格式补记：原 gzip 归档仍保留；本载体仅把同一 tar 字节流以 xz（LZMA2 level 6、32 MiB dictionary）重新压缩，逐字节 tar 流 SHA-256 和全部成员 bytes / mode / SHA-256 均再次读回相同。全部执行 receipt / log / source / artifact 内容未改写，原 gzip 身份及同流证明载于逐成员清单的 transport 字段。
