# Sprint 6：Bootstrap / Liquid 候选与原条件对账

## 状态与来源

本记录审查 Sprint 6 的七条执行 Issue：[#1467](https://github.com/Proto-UI/Proto-UI/issues/1467)、[#1148](https://github.com/Proto-UI/Proto-UI/issues/1148)、[#1149](https://github.com/Proto-UI/Proto-UI/issues/1149)、[#1049](https://github.com/Proto-UI/Proto-UI/issues/1049)、[#1050](https://github.com/Proto-UI/Proto-UI/issues/1050)、[#1053](https://github.com/Proto-UI/Proto-UI/issues/1053)、[#799](https://github.com/Proto-UI/Proto-UI/issues/799)。父追踪为 [#1091](https://github.com/Proto-UI/Proto-UI/issues/1091)、[#792](https://github.com/Proto-UI/Proto-UI/issues/792)、[#1323](https://github.com/Proto-UI/Proto-UI/issues/1323)。它不改变原条件，不把一次有界 PR 的 ready 状态等同于七条 Issue 全部完成。

- 审查基线：`dc3b184ba10b0de53e40359c52d012b204b2cd01`。
- 审查者：独立本地 agent `/root/review`；未实现被审切片，未代替用户提交 GitHub APPROVE，也未声称另一位可认证的人类 reviewer。
- 输入：当前 Issue 正文及其保留的原验收条件、相关历史 PR/Actions、基线源码与工作流、两路候选差异、官方已渲染参考。
- 第一候选：[9b6448e339a474bca6a8fbaae4ad8c24c522a84c](https://github.com/Proto-UI/Proto-UI/commit/9b6448e339a474bca6a8fbaae4ad8c24c522a84c)，tree `e03d3e6ddbd4141a90adc06a84768a67bdd18a18`；[PR #1712](https://github.com/Proto-UI/Proto-UI/pull/1712)。该提交包含下述 Liquid 源码和专用执行覆盖修复。以下逐提交回执保留实际原生终态；最终整合 SHA 仍需单独验收。代码审查结论不替代原生结果或平台正式 review。
- 本地 Chrome 启动受环境 `socket() EPERM` 拒绝，保留为环境失败；没有通过伪造 `GITHUB_ACTIONS` 或改变浏览器安全设置把它转成通过。实际分派 [matched frame-budget 45013193295](https://github.com/Proto-UI/Proto-UI/actions/runs/45013193295) 与 [material/library 45013196978](https://github.com/Proto-UI/Proto-UI/actions/runs/45013196978)，均绑定第一候选；两次运行均已失败，具体产品、fixture 与采集问题见下节；修复后仍须在新 head 重验。

## 已发布提交与真实原生终态

| 源码 | 变更 | 已执行的结果与限制 |
| --- | --- | --- |
| `9b6448e339a474bca6a8fbaae4ad8c24c522a84c` | CPU 预滤镜、decode/publication 成本归因、偏好资源退休、必要 WIP case 执行门槛。 | [material 45013196978](https://github.com/Proto-UI/Proto-UI/actions/runs/45013196978)：11 jobs，6 success / 5 failure。四个 hover host、tint-stage 与 visible-refraction diagnostic 成功；四个 prominent host 和主 browser 失败。主 browser 为 923 passed / 4 failed；WC prominent 为 101 passed / 4 failed。保留下面分诊，不将 diagnostic 成功当产品接受。 |
| `647ee7ad7e3e343cf18fc488b10a9a8fb877a389` | Bootstrap 紧凑顶栏、公共 navbar context、homepage/docs 组合。 | [Bootstrap 45014679306](https://github.com/Proto-UI/Proto-UI/actions/runs/45014679306)：新增 navbar 38 cells 与 12 个 pinned-baseline captures 成功；旧八部分测试 13 passed / 2 failed。实际看图另外发现 Docs Theme 白 glyph 在浅背景、Search 仍为 Shadcn pill，两项真实消费缺陷未被先前 38 cells 捕获，后续修复与新截图仍必要。 |
| `49fc3ac3a5df6f6850795f25503940c5a2d0f2e8` | 主题所有权、paused source DPR 通知、完整 footprint fixture、真实 trace category 描述符、portal 有界基线稳定、Bootstrap editor flow fixture、Liquid 八部分 31-case 执行链。 | tree `0d8d72af9c46232f38be26f7aaa73ec293b668c0`。独立源码复核和 144 个整合单测、39 个八部分关联单测、14 个工作流门槛、scoped types 通过。没有将它们称为新 native 通过。本提交固定为后续 profile 6 同 fixture 比较基线。 |

第一候选 matched frame-budget [45013193295](https://github.com/Proto-UI/Proto-UI/actions/runs/45013193295) 的五个 release/material 案例为 **1 passed / 4 failed**，未选择的独立 diagnostic 不计通过。同一运行的实际比较 probe 完成：baseline `dc3b184` 与 candidate `9b6448e` 的 workload、browser、lockfile、fixture 匹配；每种工作负载均执行 60 次 fresh press。候选静态/动态 handler→owned material commit p95 分别 **16.32 / 21.09 ms**，28/60 与 34/60 超过 10 ms；event timestamp→commit p95 为 **16.63 / 26.81 ms**。原门限未达到。drag opportunity、rAF、handler→commit、event→commit 和物理 input-to-photon 是不同测量，不能混用。真实物理 120 Hz 显示和输入链路仍未取得。

原始结果压缩保存于 [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/first-native-and-recovery-manifest.json)，其中列出解压内容和压缩文件各自的 SHA256。实际 artifact ZIP：material `14751322222` / SHA256 `8e4ac7329b202756a94b8962485f97ff8feaa0a96a18d96d195d3e64c320588f`；WC prominent `14750853650` / `2ffbe4dfa2711642839bf72b06c3422ef5217c50caa96373288b3d0d715fc0c3`；frame-budget `14750473577` / `09b7e163e12c44e7557c10565b5fbb4d14ce11ccf99bd07ca4aef889ac356330`。

### 第三提交的修复归因

- **真实 ownership 缺陷**：嵌套作者 `--pui-foreground:#aabbcc` 被只看 token 名的逻辑当成 renderer theme。现在复用已存在的 `rendererThemeEntries` 精确对象所有权。新 mounted-API 负控在旧源码有两条准确失败；当前作者值保留、外层 renderer palette 正常更新。旧 dynamic-child 测试反而要求改写作者背景的前提经独立审查明确纠正，未删去生命周期或样式断言。
- **paused source DPR 变化**：复用已有 ResizeObserver 观察 canvas 的 `device-pixel-content-box`，保留 MQL/window resize 与不支持时回退。旧实现无法观察物理像素变化的负控失败，修复后 CSS 尺寸不变时 source 从 420×104 更新至 840×208；dispose 后回调失效且 observer 回收。新 native DPR 结果仍待回读。
- **footprint fixture**：两个相邻材料都扩张 contact footprint，原 21px gap 未为两者同时预留空间。改为 32px，并在 native 中独立计算实际两侧 envelope、记录质量和几何，要求初态不相交。原 2px 外沿 blocker 必须拒绝、移除后 2000ms 内恢复新帧、overflow clipping 必须拒绝，全部保留。
- **trace 类目**：实际 Chrome 157 的 `Tracing.getCategories` 为 `[]`。缺失时读取实际 `Tracing.getTrackEventDescriptor` 的 Perfetto category，而非假造 required categories。保留两种原始响应，严格拒绝未知/缺失、malformed、重复 singular name；五类仍需全部存在，12 个解析/负控单测通过。
- **portal 基线前提**：真实 header 尚在发布时，三帧初始 TOC 高度 1027→1009。先收集最多 12 帧 settling，要求连续三帧几何 ≤1px 且 predicates 稳定，然后仍执行原三帧 baseline 和全部 ≤1px handover 断言。持续不稳定仍失败，没有放宽原容差。
- **Bootstrap 八部分 fixture**：原生 input/textarea 是 flex 直接子项，各 framework host 包裹差异产生 blockification；两条主题对照的 720 字段中仅 12 个 editor `display` 不同。为四个 editor 使用普通 flow slot，同时断言实际父层非 flex/grid；原完整 deepEqual 的 `display` 字段和输入行为断言保留。

独立记录分别为 [frame-budget 分诊](2026-11-22-sprint-6-frame-budget-independent-triage.md)、[WC tint 分诊](2026-11-22-sprint-6-tint-wc-independent-triage.md)、[第三提交 source review](2026-11-22-sprint-6-recovery-source-review.md) 和 [实际 Navbar 视觉审查](2026-11-22-sprint-6-navbar-visual-review.md)。读图审查与自动行为检查分别报告。

### 后续集成切片及当前验收边界

普通 Bootstrap Button 补 pinned 2.3.2 的 100ms linear background-position **hover/focus 进入**运动；离开即时恢复，disabled/navbar/reduced-motion 中断，按 4 hosts × 2 themes 保留 96 个终态 cells。Liquid private profile 6 为已经确认的 pastel tint 响应不足增加有界 source tone；原 profile 4/5 历史材料、4.5 前景 readback 和所有原光学门槛保留。原 48 cases / 1608 captures 追加 8 个真实 constant-field 序列，总计 56 / 1688，每宿主 14 / 422；收集名称不能代替执行。

新增 Liquid 八部分套件覆盖真实八个公开 export、四 Web host、31 个独立终态 cases，其中 16 个 CDP composition 路径区分 Input/Textarea 与 controlled/uncontrolled；它不是物理 OS IME。provider-free fallback 的行为验收也不是 optical 通过。缺失、重复、意外、失败、清理失败或源漂移都会阻止完整结果。

一次并发额外类型检查与整合 generator 的运行遭 SIGKILL 137，保留为资源失败；后续整合工作执行单一重型队列，正式 generator 与 `--check` 均通过，源码推导新增 `duration-100` 与 `transition-[background-position]` 两个词条。全工作区 types / coverage 既有资源失败也保持失败/未运行，不用 scoped types 代称全套成功。最终集成源的浏览器、视觉与性能终态将追加到 PR 回执。

## 七条 Issue 的验收映射

| Issue / 路线 | 必须保留的原条件 | 本轮候选已覆盖或准备交付的有界工作 | 目前不能据此勾选的条件 |
| --- | --- | --- | --- |
| #1467 Bootstrap 顶栏 | 固定 2.3.2 与参考截图；同视口修改前后图；桌面/窄屏所有入口可用、无重叠或溢出、面板锚定；鼠标/键盘/Escape；light/dark/hover/focus/expanded；最终 SHA；不在 Compiler/Adapter 加网站特例。 | 公共 Button 增加明确的 navbar presentation context，Surface 消费原生 link facts；品牌/导航/搜索/主题/设置密度与层级调整；homepage 和 docs 两个组合入口同步；同实例 context 往返和状态恢复单位验证；已取得官方 v2.3.2 原始渲染截图。 | 候选与基线的同视口原生截图、真实 computed paint、完整输入/面板几何及四宿主结果仍待新 native suite 和最终 Actions。CSS/token 单测不证明像素或触达通过。 |
| #1148 Bootstrap 完整 Base 投影库 | 全库逐 part 的固定 2.3.2 几何/排版/差异；四 Web host 的视觉/输入/主题/生命周期；披露运动与最新能力投影；Compiler/native 及独立接受；保留 WIP/Experimental。 | 复用现有真实 private 家族包、Base 继承、源 token/notices 与最新能力投影；本轮修顶栏组合及缺失的可复用 navbar palette。 | 顶栏或 Button 成功不等于完整家族。完整逐 part 矩阵、披露运动、四宿主与跨目标仍需逐项证据；旧首页十张卡片和历史通过数量不能替代当前整库验收。 |
| #1149 Liquid 完整交付 | #1049 全部公开部件四宿主；#1050 完整光学/官方 rendered 对照；#1053 性能/恢复；视觉/输入/辅助技术与偏好；Compiler/GPUI/Qt/Flutter 和独立接受。 | 复用真实源库、Base 控件、光学和 source-progress；本轮含 byte-preserving CPU prefilter 优化、decode/publication 成本归因、偏好订阅所有权故障恢复及专用 evidence lane 修复。 | 任一 bounded material demo、单位测试或 CPU 内核计时不关闭总项。原 120 Hz/10 ms、真实物理输入/呈现、全库 AT 和跨目标条件未因此完成。 |
| #1049 Liquid 四 Web host | 对每个 advertised public component 分别记录 route、WC/React/Vue 3/Vue 2、browser、SHA、console/mount failure 与 material reason；pointer/keyboard、controlled 更新、runtime switch/remount/dispose、light/dark 与 accessibility fallback；实际公开页面截图。 | 修复专用 Liquid workflow 未启用 WIP 导致必要 optical/lifecycle cases 不注册的问题；执行清单检查可防止 public Button 单例成功被误报为全组成功；偏好 listener 原子退休覆盖回收故障。 | 测试 fixture 或 Button 的四宿主不等于所有 advertised public components。实际公开组件逐项四宿主矩阵与 source/owner 终态必须由最终 head 的运行补齐，不能把注册面板当运行成功。 |
| #1050 Liquid 光学与接触 | 亲自查看 Apple 官方已渲染视频/时间点；background transport、refraction/lensing、厚度/边缘、可读前景和局部 press；仅功能/导航层；四宿主、移动受控背景、held/release/cancel、双主题与三类偏好；真实 fallback reason；exact-SHA before/after 像素与帧序列。 | 已读取并实际目视官方 WWDC25/219 多个渲染帧，记录源视频、时间点和 hash；CPU prefilter 优化保持原滤波字节、opaque/source/contrast/解码护栏。 | 官方参考观察仅完成参考输入，不等于当前 Proto-UI 的逐项对照结论。完整 candidate 光学序列及独立投影差异仍需最终采集；不声称 Apple engine parity。原 prominent tint 的全域/前景安全和负控条件继续保留。 |
| #1053 Liquid 成本与有界恢复 | 同 baseline/candidate 环境和精确 SHA，hardware/browser/vendor/renderer；render/encode/decode/allocations/long tasks、quality/reason 时间线；四宿主重复交互；source/style/session/dispose 与失败恢复；原偏好/unsupported 安全；冷暖 p50/p95；真实 120 Hz / 10 ms 和适用物理 input-to-photon。 | CPU horizontal prefilter 用滑动窗口减少重复字节读取，保留 separable 两次舍入；新增 decode ready/failure/cancel 与 publication callback 独立累计时间；偏好 add/remove 故障的原子回收与共享 callback 独立订阅；修复原测量 lane 的 release case 漏执行。 | CPU 微基准不能推出浏览器端到端收益，异步 decode wall time 也不是 decoder CPU time；event→owned CSS commit 不是 input-to-photon，rAF 回调不是 displayed frames。新候选原生同机比较未定稿，真实 120 Hz 显示/物理输入链路缺失；原门限不改。 |
| #799 两家族八部分 | Checkbox Root/Indicator、Switch Root/Thumb、Toggle、Input、Textarea、Separator；Base 唯一语义 owner；四真实 Web host 下单物理 editor、controlled/uncontrolled/restoration、readOnly/disabled/IME；强可见键盘焦点；双主题/状态/mobile 图；source-derived tokens/notices；逐 part Adapter/Compiler/native 分列。 | 复用已实现的两家族八部分及 Base 上下文/编辑器；安排既有 Bootstrap state-controls lane 和 token/notices 检查，按结果回填。 | 既有 Bootstrap 8-part suite 的 scope 明确不含 IME conformance；不能据其绿灯勾选物理 OS IME。Liquid opaque fixture 不证明 material、Compiler 或非 Web；全八部分逐 host 当前结果仍需矩阵。 |

## 可复用成果及不能替代的证据

1. 两个家族已经是真实源包，不应把历史 pending 重写成“尚无实现”。现有 README、P/T 链和 private/Experimental 状态继续有效。
2. `bootstrap-state-controls-evidence.yml` 是八部分 Bootstrap 专用入口，`ci-production-suites.yml` 的普通 projection-family lane 不等价于它。该八部分浏览器测试强制真实 `GITHUB_ACTIONS=true`、精确干净源码和独立受控 server；本地环境不能伪造这些事实。
3. `projection-family-evidence.yml` 的 new-family browser 范围包含 Bootstrap Button 的 variants/sizes 与 Liquid 诚实 opaque fallback；不覆盖全库 optical/native/Compiler。
4. `liquid-material-evidence.yml` 原 `browser-evidence` 以及 `liquid-glass-frame-budget.yml` 原 release step 没有 `PUI_LIQUID_GLASS_INCLUDE_WIP=1`，而相关 cases 仅在该 flag 下注册。候选修复 opt-in，并从真实 Vitest JSON 要求必要 cases 各自唯一且 passed；缺失、skipped、failed、重复或不完整报告失败。
5. `material-library` 必须执行六个 material cases；`frame-budget-release` 保留原选择的五个，额外的独立 idle/hover diagnostic 未被该 pattern 选择，不能算作这条 lane 的通过项。checker 初稿错误要求 Vitest 2.1.9 不提供的 `numRuntimeErrorTestSuites` 已在独立审查后修正，真实 pinned reporter 格式已回读；原命令退出码仍承担未捕获运行错误的失败传播。
6. 用户指出的 [run 44929149981 / job 136921732571](https://github.com/Proto-UI/Proto-UI/actions/runs/44929149981/job/136921732571) 已回读：baseline `fceb24418baabfd439a08c4a68100092a74abb63`、candidate `cdb8b8fa09e75dbea46b77a8c0995c5ef2cd81a9`，静态 fresh press event→held owned commit p95 为 9.815→10.105 ms，动态为 14.290→16.905 ms；candidate 各 60 个 fresh presses，静态 4/60、动态 10/60 超过 10 ms。它保留实际失败，不是达标报告，亦不是本轮新候选的运行。该历史 artifact `14717162037` ZIP SHA256 为 `51cfa0a3782dafe26d5a25d321860af9ce7367d38161cc90160e94a7875dffb5`。
7. #1667 的 uniform optimization 已撤回，不能把未接受/已撤回的候选计数计作新性能收益。既有 contact/release、source-progress、pixel/contrast/fallback、program-clear 负控应在新候选继续运行。

## 本轮独立源码审查发现与处理

| 发现 | 处理与当前判断 |
| --- | --- |
| 专用 Liquid lane 隐式遗漏 WIP optical/theme/release cases。 | 已提给整合 owner；候选显式启用并增加真实 case inventory gate。待最终 Actions 证明六/五个案例确实执行。 |
| checker 初稿把 Vitest 2.1.9 不存在的 runtime counter 当必有字段。 | 已修复为兼容当前 reporter；实际 `vitest-reporter-real.json` keys、title/status/file path 已独立回读。缺失案例拒绝逻辑保留。 |
| 新 decode 最大值是 Document 生命周期最大值，通用 delta 会造成窗口统计歧义。 | 候选移除该最大值字段，保留可正确求差的次数/累计毫秒。 |
| ready callback 抛错后，恢复 callback 时间被加进 ready callback 阶段。 | 独立审查构造 2 ms publication + 10 ms recovery 的区分条件；实现方记录旧版 12≠2 的失败，候选先封闭 publication 计时再进入 fail recovery，新增 oracle 保留。 |
| 内置 preference subscription 原实现中途 add 抛错会残留先前 listener；remove 抛错中断其余回收；共享 callback 可被 EventTarget 去重。 | 候选独立 listener、注册失败 rollback、先失活并清除 owner callback 再 attempt 所有 remove、保留首错误。五条注入故障 oracle 是 host-unit 证据。故障 host 可能保留 inert listener，测试如实记录一个残留，没有伪称完整物理资源清零。 |
| Bootstrap 导航 palette 容易污染普通 Button 或留旧 gradient。 | 候选对 default/primary/inverse 三 variant 做同实例 default→navbar→raw prop removal 和 disabled/focus/pressed 恢复；source rules 互斥，Base owner 不变。还需真实 computed paint/capture 验收。 |

已读的 Liquid 滤波循环保留 border replication、两次舍入、RGBA byte lanes、非对齐输入 view 范围与 opaque source 校验；未发现新增源码行为阻塞。偏好生命周期修复未扩张 MaterialPolicy 定义或改变用户偏好选择。Bootstrap 的 nav facts 仍来自已有原生 anchor owner，brand 不变成 selected tab，公共 Surface 保持被动；homepage 与 docs 两入口均已回读。以上结论均不提升未经执行的 native 或全 Sprint 验收。

## 官方视觉参考

### Bootstrap 2.3.2

官方 tag `v2.3.2` 解析为 `twbs/bootstrap@b4c4072679943773a7582daa63f545ba818fa627`。主要文字/几何依据为 [Navbar 文档](https://getbootstrap.com/2.3.2/components.html#navbar)、该提交 `less/navbar.less` 与 `less/variables.less`。取得并实际目视官方原始渲染的三个 example PNG，都是 1200×900：

| 官方文件（位于 `docs/assets/img/examples/`） | Git blob SHA | SHA256 |
| --- | --- | --- |
| `bootstrap-example-marketing.png` | `206e26e342488126aab5bdac12e6c4d01dd2a643` | `2e09222ed00dbaa980db0cf40f5a9ff1bf9f2bc01e129405fede79af53e2ae46` |
| `bootstrap-example-fluid.png` | `5f49a332f332252ed8135536ccfe256d397d5fd3` | `4f25fc3a7a1b1c17a6d7e91cf125b08f9dde10535a817f124290e0867c1c3aaa` |
| `bootstrap-example-starter.png` | `1bf4b85ecef67d3b7416aea639fd15200a97ce76` | `1b7911d66bff32e9c7a19ca5400102e74174a6f37d7da8e7512a7e831b73d656` |

可见品牌、导航与 active inset 属于一条连续的紧凑导航栏；marketing 图把真正的 form fields 和 Sign in 作为较小的 raised controls 对齐在栏内。它们展示 inverse/dark Navbar，蓝色、适配暗色和移动 44px 触达是明确的 Proto UI 改编；不把知乎/UOJ 方向参考冒充 2.3.2 标准。以上为官方已发布图，不是本轮新截图，也不代替同视口 Proto-UI before/after。

### Apple Liquid Glass

原官方视频：[WWDC25/219 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)。实际下载的 SD 文件为 960×540、30000/1001 fps、1172.871700 s、61515369 bytes；SHA256 `1104a39b374f50e4c856af8a2a0d96171a6911afdab81dd22b74b64902122b62`。来源为官方 `devstreaming-cdn.apple.com`，下载 URL 与每帧 hash 保留在审查附件 manifest。

| 时间点 | 已目视的事实 | 对照用途/边界 |
| --- | --- | --- |
| 1:50 | 手指接触前的材料圆盘，清晰前景、浅边缘及下缘光照。 | 静止/非接触的有限参考。 |
| 3:10 | 沙丘边界穿过玻璃区域仍连续可辨，内部位移/折射、边缘厚度与清晰播放符号同时可见。 | 不能用整面蓝色或仅 blur 存在来替代 background response。 |
| 3:46–3:51 | held contact 下局部白亮、边缘与压陷；不是整个表面换色。 | 局部接触参考；这些帧本身不证明完整 release 时序。 |
| 3:52–3:54 | top-down contact/morph 过渡，前景符号暂时模糊。 | 不能误作 settled 静态阅读目标。 |
| 6:25 | optical/background、material 和 foreground symbol 的分层展示。 | 支持把前景可读性与材料响应分别核对，不推出内部算法。 |
| 17:08 | 平面洋红教学对照。 | 这是对照画面，不能选为光学目标。 |
| 17:16 / 17:20 | 橙/红 prominent tint 保留背景明暗结构与边缘光照，浅色图标仍清楚。 | 需要比较 tint 与 transport；不证明一个数值对比阈值或 Apple 内部实现。 |

官方约 30fps 视频不能证明本项目 120Hz 或 input-to-photon。当前没有完成官方参考与最终候选截图/帧序列的逐项视觉差异判断；在这些结果取得前，#1050 的完整对照仍开放。

## 真实消费者与 fixture 的区分

| 对象 | 来源与定位 | 本轮可接受的证明范围 |
| --- | --- | --- |
| [shenko](https://github.com/cyjin-yl/shenko) | 应用提交 `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42`；`crates/shenko-ui/web/upstream-pin.json` 固定 Proto-UI `f29738eb6a804ccfc58510cc5a5bd1692690716e`。React/Shadcn + `react-dom-source-v1` 构建自己的 transport-badge / message-bubble。 | 真实应用的启动、交互、焦点、订阅和清理需要它自己的运行记录。内部 fixture 不能代验收。S7 Harness 实现责任保持原安排；S6 不因此扩张为接管 Harness。 |
| [OpenGreendam/verdant](https://github.com/OpenGreendam/verdant) | 应用提交 `91a775546ebd21a87d76d76568195a6513437719`；`frontend/proto-ui/compiler.pin.json` 固定 Proto-UI `e56b2d1a3d6b688a1cbc6930dab1d6757304d733`，`gpui-source-v1` 生成 PitchGestureSurface。 | 只在明确使用本轮家族/宿主能力且实际执行的路径上计证据；未运行不记作通过，不从仓库存在推断已支持。 |
| Proto-UI www 公开组件页与首页 | 本仓库实际产品消费路径。 | 最终候选公开页与 homepage 能证明对应组件组合，不覆盖外部应用、全公开库或所有编译目标。 |
| `/en/test/liquid-glass-material/`、内部 state-controls 与 analysis probes | 有控制变量和可执行负控的内部 fixture/测量面。 | 用于隔离 transport、optical、ownership、计时归因与回归，必须保留“fixture”标识；四 host fixture 成功不能自动变成真实 app consumer 接受。 |

## 定稿与父项回填要求

定稿应追加最终 head/tree、有效独立审查范围、所执行的 workload/命令、每个 lane 的终态、原生图片/序列及已实际打开的 artifact。每次满足一项原条件，可同步给多个相关 Issue 同一份证据；未完成的条件保持未勾选。

本轮应至少明确记录以下剩余状态，而不是把它们留成模糊的“后续测试”：

- 固定 2.3.2 的逐 part 可视差异与 Bootstrap 顶栏同视口 before/after。
- Liquid 公布的全部组件 × 四 Web host、偏好、输入、runtime/owner/clean-up 矩阵。
- Apple rendered reference 与最终候选的光学/状态逐项比较，以及不可用场景的诚实 fallback。
- 同机 baseline/candidate 冷暖、p50/p95、分阶段成本及真实性说明；原 120Hz / 10ms / 物理 input-to-photon 仍需适合的显示、硬件与测量链路。
- #799 的文本编辑器与 IME、readOnly/disabled、controlled restoration、mobile/主题图、source-token/notices 和逐 part 矩阵。
- Compiler 生成产物、GPUI Adapter 与编译器路线、Qt/Flutter 实际后端及原辅助技术条件各自接受；Web 路线不能互相代验收，也不能据 Sprint 拆分删除它们。

父 #1091/#792/#1323 只有其保留的全部原条件完成或取得明确范围处置后才关闭。当前候选的代码 review、一次远端绿灯、一个 ready PR，都不能单独宣布 Sprint 6 全部完成。

## 第一候选的可复现验证

集成命令采用 Node 24.22.3、pnpm 10.32.1，Vitest 2.1.9，单 worker：

- `node --test scripts/test/check-liquid-material-evidence.test.mjs`：5/5。
- `corepack pnpm@10.32.1 exec vitest run packages/adapters/base/test/web-material-image.test.ts packages/adapters/base/test/web-material-program.test.ts --maxWorkers=1 --minWorkers=1`：2 文件、113/113。
- `corepack pnpm@10.32.1 exec vitest run packages/adapters/base/test/web-material-preferences-ownership.test.ts packages/adapters/base/test/web-material-preferences-sequence.test.ts packages/adapters/base/test/web-material-adoption.test.ts --maxWorkers=1 --minWorkers=1`：3 文件、28/28。
- 两个实现切片的 scoped TypeScript、10 个变更文件的 Prettier、`git diff --check` 通过。独立审查回读了最终 10 文件差异及实际 pinned Vitest reporter。

一次未固定版本的 `pnpm exec` 解析到 11.25.0，被 engines 拒绝，未运行测试；改用声明的 `corepack pnpm@10.32.1` 后上列同范围通过。环境失败不计为产品失败或成功。

CPU 原始样本：[prefilter](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/prefilter-benchmark.json)、[contrast](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/contrast-benchmark.json)。8 次 warmup、31 对交替样本、同源字节 oracle；生产 buffer reuse、PNG、Image.decode、DOM、GPU 和显示链路均不在该测量中。

| 尺寸       | 原 p50 ms | 候选 p50 ms | 原 p95 ms | 候选 p95 ms |
| ---------- | --------: | ----------: | --------: | ----------: |
| 128 × 64   |    0.2309 |      0.1711 |    1.6886 |      1.4765 |
| 256 × 128  |    1.4522 |      1.2920 |    2.1934 |      1.9517 |
| 512 × 256  |    3.2405 |      2.3450 |    7.5944 |      6.1330 |
| 1024 × 512 |   10.0472 |      7.7409 |   12.4815 |     10.2728 |

最大尺寸 CPU p95 仍超过 8.33 ms；这些结果只支持减少 CPU 预滤镜工作，尚不证明端到端性能目标。

参考来源及帧摘要：[Apple manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/apple-219-reference-manifest.json)、[Bootstrap manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/bootstrap-232-reference-manifest.json)。manifest 中的图片名是审查附件名，官方 URL 与 hash 可核对；未把本地附件当作已发布候选截图。

本地原生启动失败：[原始 report](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/local-chromium-environment-failure.json)。当前远端可用设备为虚拟 VGA 显示链路，没有可验证的 120 Hz 面板或物理 input-to-photon 测量设备。原要求保持开放，需真实适用硬件产生独立结果。

两份真实消费者 pin 的检查为只读源码核对，未更换 pin、构建新候选或更改其设计家族；相应 App 运行状态不能由本记录推断。

## Bootstrap 整合验证与第一批原生诊断

Bootstrap 第一次独立工作树生成命令退出 137，stdout/stderr 为空；这个失败保留为资源终态。整合 owner 串行执行相同 `node --import tsx scripts/styles/generate-draft-family-style-tokens.ts` 后退出 0，再运行 `--check` 通过。生成文件增加 5 个从候选源码推导的 Bootstrap tokens，未手工编辑产物。

整合 Bootstrap Button、Surface、Header recipes/navbar/layout/surface、Homepage runtime 共 7 个文件、108 个 Vitest 单元测试通过；专用工作流边界 9 个 Node 测试通过。第二候选的新 native navbar 12 个顶层案例、38 个 viewport/runtime/theme cells 与 pinned baseline 12 个 WC captures 已在上述真实工作流执行；读图仍暴露两项 Docs 缺陷，因此保持后续修复与最终源码重验。

第一候选折射 diagnostic 已取得 64/64 脚本采集帧与 8 条完整序列，`productAccepted: false`。实际读取结果为 38 帧信号不足、22 帧未解析非刚性位移、4 帧解析到；它是 SwiftShader 受控 renderer 诊断，未直接绘制组件前景 glyph。[独立图片与 Apple 参考对照记录](2026-11-22-sprint-6-visible-refraction.md) 保留其窄结论和限制。

## 第四候选的整合源码验证

13 个独立测试文件的整合命令以 pinned pnpm 10.32.1、Vitest 2.1.9、单 worker 执行，454 / 454 通过，耗时 48.99s。它覆盖新增 tone 数学、CPU/GPU 同源 cache、sink/preference、历史/可见折射诊断、prominent plan/metrics，以及 Bootstrap Button/CLI/recipes/motion oracle；[原始报告与 hash](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/fourth-source-validation-manifest.json) 保留。

26 个当前变更文件的 scoped TypeScript 首次准确报告两条 motion duration 类型错误：当前 DOM 声明允许 CSSNumericValue，不能直接写入 number|string 的 JSON trace。修复为 number 原样、其他值保留文本，仍要求实际 animation duration 严格等于数值 100；没有用 parseFloat 把百分比或 auto 转成成功。独立源码审查后同一 scope 再运行退出 0。该结果不代称全工作区类型通过。

Docs 消费修复额外运行 4 个完整关联文件，98 / 98 通过，8 文件 scoped TypeScript 退出 0。Theme runtime 现保留原 header 用途；Search 遵从当前家族；Bootstrap Retry/More 使用其公开 default variant，legacy 命令使用支持的 default/small。旧源码四个有效负控失败分别对应 Theme 浅底、Shadcn 别名、动态 surface 与 legacy ghost/secondary/sm，不以 mock 初始化失败替代反证。

工作流/采集边界 15 / 15 Node tests 与 unmodified kernel generator check 通过。更新的 Navbar native 对实际白色 glyph、透明底/无图、蓝色 gradient 两端对比以及 Search 家族/4px/gradient 单独观测；清理和 page errors 也必须进入最终终态。现有 38 cells 保留，第四候选的实际图仍需重新打开后接受。

## 第四候选原生回读与后续前提修正

[独立原生回读与修正记录](2026-11-22-sprint-6-native-recheck.md)接续 Bootstrap 完整成功、Liquid 主套件 952/953、state-controls 的原 16 个 composition 失败、frame-budget 的跨 profile 控制失败及原性能数据。它保留实际图片、原失败 JSON/hash，以及有界 viewport 校准、独立裸 editor 事件对照和冻结 neutral GPU 控制的责任边界。后续精确 head 的原生复验由 PR #1712 的新回执接续，旧运行的 SHA 与失败不改写。
