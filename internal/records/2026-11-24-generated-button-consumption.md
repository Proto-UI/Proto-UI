# Sprint 7：真实生成 Button 的无内部 onboarding 消费实验

对应 [#750](https://github.com/Proto-UI/Proto-UI/issues/750)。Agent 按当前用户“补完 Sprint 7”的请求执行。此前 producer / operator 的 9/9 前置结果仍是前置结果；本文新增的是两个 fresh Agent 的实际普通应用消费旅程及其完整失败、修改、反馈和交付记录。

## 有限结论

两个参与者都使用真实 Compiler 产物完成了偏好设置应用的安装、使用、定制、调试和生产交付，实际独立 Chromium 旅程各有 9 个成功检查点。**只有 consumer-02 具有完整的原协议单调时钟，进入严格主样本：1 次尝试、1 次完成。** consumer-01 的原 operator PTY 计时器尾段丢失；其完整源码、实际命令、生产观察和解释保留为补充证据，未补造结束时间，也未分类成消费者或产品失败。

本轮支持的结论是：**这一份可编辑目录分发、这一项 React 偏好任务可由没有 Proto 内部 onboarding 的 fresh Agent 完成。** 它不证明“不需读源码、不需改码”：consumer-02 实际记录了 1 次样式信息需求，阅读随分发提供的生成源码后补了 `className` 转发；共 5 次有 preimage/diff 的源码修改，其中 1 次属于生成组件、4 次属于应用。没有记录 escape-hatch 事件，也没有替换生成按钮或绕开其激活逻辑。

因此，“无需内部 onboarding 的有界可行性”为 **supported**；“只看短 usage 即可零修改完成”不受本实验支持；整体易用性、普通人类开发者体验、库成熟度、需求、采用、维护经济学和相对优势均为 **inconclusive / unmeasured**。没有要求参与者偏好 Proto，也未把任务成功等同于真实产品需求。

## 实际产物与独立准入

| 对象 | 实际绑定 |
| --- | --- |
| source / Compiler | `d0eb81d3c61c3d3e93e46c4151e78031273d6116` |
| 官方 Base Button 直接输入 | SHA `806891994e6b141ca3f76dce3288a056064eadfb0c4be0c7d8860bb001923ee8` |
| Profile / target | `react-dom-source-v1`，React / react-dom 19.2.6 |
| 真实分发 | `directory-copy`，完整生成目录，包括隐藏 helper、map、原始 provenance；不是一个臆造的 registry 包 |
| 输出 | 12 个对象；完整清单摘要 `6705b19e96b27aa8dd1a5ff87e26241b655f7bb20c3980ac735ebd73472fb009` |
| 原始 provenance | SHA `7c5dd7c49f3d280059d6a5914dc99430ca975e171774e94afb02831cfd1a2e05` |
| artifact manifest | SHA `ca0d1bcb3f920c97c4de4e21668c776e7df1a19ede778990cea3255c3e954bed` |
| 实际依赖 lock | SHA `eb05de3d6a314e1f385cfed6494844e91696a8cc68541950a91cf0ace9426fdb` |
| 工具 | Node 24.22.3、npm 11.19.1、TypeScript 5.9.3、Vite 6.4.1、Playwright 1.58.2 |
| native operator | Chromium 145.0.7632.6，Linux x64，sandbox=true；与实现环境分开 |

producer 实际调用现有 Compiler 读取官方源，保留全部 source、Compiler source、输出、compile/write 诊断和命令。独立项目实际安装声明的依赖、通过 strict TypeScript / Vite build，并验证 target import closure 中没有内部 `@proto.ui/*` 包。前置 native 观察实际 9/9，资源与保留的生产文件绑定。

独立 Agent 在准入前检查了 219 个 manifest 引用、固定 source 的 Git 对应、生成闭包、干净安装 witness、实际构建与 native 结果。准入随后真实发布为 [#750 的有界准入评论](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-7111867656)，并保留其回读。评论不是 GitHub 原生 APPROVE。后来取得的完整 PNG/trace 只补充原执行的可读载体，不重标早先 reviewer 已看过当时缺失的原图。

最初 producer / consumer 的真实失败和后继修复仍绑定各自原版本；本轮没有沿用旧 candidate 的失败为当前结果，也没有用手写 mock 替代产物。公开 SSR、不相关 host、完整生命周期及全 Button 表面不在准入中。

## 固定任务、参与者与记录方法

原 `issue-750-button-consumption-v1` 协议 SHA 为 `a54dc7579bb3334d48dfb67b4fddb303013a8efc8408cffea818b71dfb5a2ee2`，任务 SHA 为 `15658434c09c6a6470c691a2f07d92704d236c29f98d846f4febb112530b9fc3`。七份初始 app 文件、框架版本、依赖锁和 60 分钟窗口原封不动；没有为准入放宽 collector。

任务为普通偏好设置：使用提供的生成 Button 保存 Display name，显示保存进度、阻止并发重复保存、展示存储错误并允许重试、保持键盘可达与可见焦点、提供消费侧样式、生产构建并在重新加载后读到保存结果。供给的 `storage.ts` 保持原样，使用真实 localStorage 与 600ms 保存延迟。错误复选框是任务明示的注入应用错误，不是发现的 Button 缺陷。

两位参与者都具有一般 React / TypeScript 知识，未使用过此分发，也未获得隐藏内部文档、其他参与者答案、Compiler 源码或 evaluator。普通分发包含的源码、helper 和不可避免的 provenance 仍可读。参与者为 Agent，隔离是共享环境中的指令边界，不是安全盲测，也不是人类用户样本。精确 provider snapshot、seed、tokens、billing 和 cost 无法取得，均保留 null 与原因。

consumer-02 的原 experience 还明确说明：起始 user context 已出现 Proto-UI 的名称。因此不声称参与者完全不知道该项目存在；本轮实际边界是未提供内部 onboarding、未接触先前消费实现，不是品牌盲法。

consumer-01 使用原 persistent recorder。该 recorder 在结束前丢失，原文件保留；其 UTC 自述不能合法替代缺失的 monotonic tail。随后创建 consumer-02 fresh packet，采用跨短进程读取 Linux CLOCK_MONOTONIC 的 `durable-recorder.py`，实际 boot identity 一致，所有 event 都由 recorder 计算偏移。新 recorder 的独立进程控制先实际运行成功；该控制不计为消费者。

## 严格主样本：consumer-02

| 阶段 | 实际内容 | recorder 阶段持续时间 |
| --- | --- | ---: |
| discover-install | 读取普通 usage、复制全部生成目录，真实 `npm ci --ignore-scripts --no-audit --no-fund`；lock 不变 | 21.863 秒 |
| use | import `GeneratedButton`，接上保存函数、返回值和持久化初值，类型检查成功 | 47.092 秒 |
| customize | 检查提供的生成源，新增可选 className 转发，应用 CSS、焦点与禁用样式；类型检查成功 | 108.557 秒 |
| debug | 同步 in-flight ref、受控 disabled、成功/失败/finally，类型检查成功 | 19.684 秒 |
| ship | `npm run build -- --sourcemap`；保留首次 preview / HTTP 失败并恢复静态服务；实际独立 browser；收到与审阅反馈；完成交付 | 2,050.086 秒 |

这些持续时间来自事件收到时的阶段边界，**不是主动工作时间**。use/customize/debug 的早期 completed 只表示当时源码和类型检查完成；记录明确将真实行为接受留到 ship。不能把其类型检查重标为第一次成功使用。

release 到首个阶段 start 另有 54.950357772 秒；参与者在 wrapper 前做过实际 date、目录及材料读取，其 consulted-materials 中已披露。这部分包含在总时钟中，但不在表中 21.863 秒的 discover-install 阶段持续时间里，不能把该阶段数字解释为全部初始阅读成本。

| 时间点 | UTC，2026-11-23 |
| --- | --- |
| 原始 release | 20:25:42.838254 |
| 生产构建完成回执 | 20:29:59.133632 |
| 交给 operator | 20:31:59.031634 |
| 实际 browser | 20:46:26.281–20:46:32.555 |
| participant 实际收到反馈 | 21:00:56.652435 |
| ship completed | 21:04:05.394544 |
| clock finish | 21:04:05.429189 |

完整时钟为 **2,302,590.915032ms，即 38 分 22.591 秒**，在原 60 分钟内。collector 的 `timeToFirstUseMs=2302469.801595` 是实际成功使用反馈的记录偏移，包含独立 operator 排队、传输、参与者恢复和审阅；不能回填为更早的 browser 时间，也不能解释为“写出 Button 花了 38 分钟”。实际成功 browser 的独立 UTC 区间另行保留。

## 两个实际生产应用的观察

两个消费者均有完整的真实应用构建、9 张状态截图、ARIA、trace 和 native 回执。consumer-01 的 native 执行完成于 20:05:17.765 UTC；consumer-02 的时序如上。下面列的是两个真实生产旅程各自观察到的事实，不是用前置 Button fixture 代替应用。

| 应用行为 | 实际观察 |
| --- | --- |
| 初始 | 稳定的 Save preferences button role/name、非零命中几何 |
| 保存中 | 控件受控 disabled，保存提示可见，按钮有不同禁用外观 |
| pointer 与重复 | 第一笔保存成功；600ms 期间第二次激活未产生额外成功写入 |
| keyboard | 真实 Tab 可达，截图与样式回执显示可见焦点；Enter、Space 各完成保存 |
| 注入失败 | 真实 storage error 可见，旧已保存名称不被伪造成功覆盖；控件恢复 |
| retry | 移除注入后再次保存成功，错误提示清除 |
| reload | 已保存名称真实保留 |
| source / asset | 实际 CSS/JS 响应与 dist 字节一致；consumer-02 的四个生产文件与交接快照一致 |
| errors | 本次实际运行均为 0 runtime errors；不外推未测场景 |

consumer-02 在重载前记录到四次成功写入：pointer、Enter、Space、recovered；错误尝试没有增加成功写入。参与者逐张审阅全部九张实际原图及 ARIA，root 另读回初始、禁用与焦点原图。这里接受所选状态的可见事实，不宣称完整视觉家族、屏幕阅读器或物理输入验证。

## 信息需求、改码与失败

consumer-02 的 `internals` 事件没有被清零：短 usage 未说明可定制样式的宿主/prop 行为，参与者需要查看**分发自带的可编辑源码**。它无需学习 Proto 的定义系统或读隐藏内部文档，但确实增加了源码理解与修改工作。最终将 optional `className` 送到物理 host。原 map/provenance 作为历史生成来源保留；live 旧 source-map 引用被移除，新的生产 sourcemap 包含当前消费侧改动。消费者改动后的文件没有伪称仍是原 Compiler 输出。

同时记录 4 次 app-owned 修改：初始接入、定制挂接、CSS、异步保存恢复。同步 in-flight ref 补充的是应用异步任务的并发责任，不能声称组件应自动完成业务保存防重。消费者没有替换组件或使用记录中的 escape hatch。consumer-01 也保留其 className 定制、应用防重与错误处理的完整 before/after/diff，未混入严格事件数量。

两位的本地 Vite preview 都遇到真实 `uv_interface_addresses` 环境错误；consumer-02 后续首次 HTTP 检查 exit 1，改用 Python 静态服务后 HTTP 200。构建失败与 server 失败分开：实际 TypeScript / Vite build 均成功，server 失败没有被涂改为成功或算作 Button 缺陷。参与者不声称本地 browser 成功，行为归属于另行执行的 native operator。全部失败、stdout/stderr、退出码及真实恢复保留。

consumer-01 无法进入严格主样本是 operator 记录故障；其最终交付和行为成功不因此作废。原 partial clock、两份实际应用、两个 source closures 都保留。没有从补充样本计算 2/2 严格计时成功率，亦没有只保留第二次成功而隐藏第一次尝试。

## Collector、独立接受与原条件

Main 对完整封存树实际运行未修改的 `inspectStudy`：`status=observations-recorded`、`observedRuns=1`、`primaryRuns=1`、`attempted=1`、`completed=1`。其 `originalCriteriaComplete:false` 原样保留：该工具只验证内容/形状与关联，不自动认证实验或关闭 Issue。固定协议中的历史 `prepared-unmeasured` 字段和 blocked fixture 也不被改成新实验结果。

封存摘要为 `6706ebce99adc9b301f61b626db0c892b81c4fea26fdff09ecf342d7bc324992`。所有原 participant events、clock、command receipt 原样保留；`normalized/` 只是为统一证据目录添加相对路径前缀。唯一派生 build receipt 只改 stdout/stderr 的文件定位，保留原命令、cwd、时钟、状态和原回执摘要，不是一次新执行。collector 之外另索引 consumer-01 的真实尝试与缺失记录，不能把它伪装成一个拥有完整时钟的合法 run。

| 原条件 | 实际后继证据 |
| --- | --- |
| issue.750.001 真实产物与可复现消费者 | 固定官方 source/Compiler、完整输出及 hidden helpers、真实 install/build/closure/native、公开独立准入、原 starter/lock/recipe |
| issue.750.002 完整旅程及测量 | consumer-02 的五阶段、42 个实际事件、原 release/finish、源改动/解释、真实 production ship；补充消费者的 clock 缺失明确排除 |
| issue.750.003 保留困难、内部需求、失败、无偏好要求 | 实际 1 次样式信息需求、源码定制、preview/HTTP/计时故障及恢复；没有要求偏好或满意度 |
| issue.750.004 有限结论 | 单任务/target/目录分发/Agent 样本；不推出人类 UX、全库成熟、真实需求、采用或维护经济学 |
| issue.750.005 前提不满足时保持 blocked | 原 blocked fixture 和失败版本保留；本次只有真实通过并独立准入的产物进入正式记录 |

实验完成记录与独立接受应绑定最终实际整合和 Issue 回读，不能用 `completionRate=1` 自动勾选平台条件。#734 的校准不计为本实验消费者，#749 的六个固定 Button 比较也不计为普通应用消费人数。

## 复查与复现

完整材料位于 [2026-11-24-generated-button-consumption](evidence/2026-11-24-generated-button-consumption/)：

- `sealed-study.tar.xz`：含实际 artifact、完整原分发与 producer 输入、两位消费者的所有原记录、完整 production source/dist、PNG/ARIA/trace、失败、原协议控制和 collector packet；SHA `09dc202c6f07fc737c47317c034573d51351cc8d7b467e62c93dc6f6b3c4a86f`。
- `inventory.json`、`seal.json` 与 `archive.json`：完整字节绑定；`collector-result.json` 是实际 reducer 输出。
- `consumer-01-disposition.json`：原始记录失败及真实行为接受边界。
- `consumer-02-clock.json`、`consumer-02-native-result.json`、`consumer-02-report.md`：方便直接阅读的原回执副本，完整原件仍在封存树。

解压后以目录 `study` 为 evidence root，使用原协议版本实际运行：

```sh
node scripts/analysis/invisible-consumption/study.mjs /absolute/path/study/packet.json /absolute/path/study
```

这条命令只重算保留数据。若重建应用，在一份新的消费者目录中复制完整 source、保持 package-lock，执行已记录的 npm ci 与 build，使用固定 Chromium 的独立生产观察；新命令和事件必须写新目录/实际时钟，不能覆盖本轮证据。最初七文件 starter、历史生成 provenance 和消费者编辑后的源各自保留，不互相替代。
