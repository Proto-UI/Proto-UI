# Sprint 2：整合后发现的 Compiler 与消费者回归

本记录接续 PR #1761 的 `5cb80eb937f20982dd7dc8cbc93a90e91d665c31` 全清单执行。原始失败、未执行和资源失败保留原终态；后继测试仅接受自己的源码与环境。这里没有将十五条执行 Issue 整体关闭，也没有把受控的浏览器事件当作物理触摸、笔或真实辅助技术。

## 来源与真正修复

`5cb80eb937` 已保留 main 与原 PR #1732 的真实合并历史。随后 `96d295e90369aeb8ff681010f920c71caf34a8a0` 修正 Presentation receipt 的 `blockSize` 类型、GPUI ControlLabel 的显式 `undefined` 与省略参数等价性，并纠正诊断清单扫描和不逃逸 helper 的 UTF-16 ABI 断言。`9459bb786b2a0e8de1a48f0940ac14eeba2f2733` 接续 Bootstrap 原生退场修复：保留当前接受样本用于反转，在终态退休初始 acknowledgment，防止旧 opacity/block-size 样本影响下一轮。

下一组二十二个源文件的基底为 `9459bb786b2a0e8de1a48f0940ac14eeba2f2733`，经过审查的树为 `8416ba8f5dce8b082c4538100b5b872b4484ec55`。源胶囊逐文件保存原 SHA、新 SHA 和字节数，以下不使用工作区 HEAD 代替实际未提交文件的内容身份。

### Outward JSON 保留实际值来源

旧实现只看缩窄后的类型，可能接收实际对象中的额外 `undefined`、getter 或其他非有限数据。修复将公开事件的类型边界接到既有 `dataBoundaryType`，并在共享 callable 分析中保留实际对象字段、数组元素、别名、返回值和可达 mutation。普通内部值仍使用自己的既有类型规则，没有把所有对象操作变成 JSON 边界。

数组证明包括真实 reduce seed、元素和返回值，零元素与无 seed 的可达路径、可变数组的长度范围，以及 push/pop/shift/分支和宿主回调造成的范围失效。共享对象的 DAG 与环分别处理；隐藏字段不能由结构性缩窄洗掉。实际 getter 不会为了发布数据而被隐式执行，原有 getter 准入限制保持。`absent` 与自有字段值 `undefined` 分开；顶层 void 不代表嵌套 undefined 合法。

宿主回调的固定点按实际 registration 保持稳定，避免同一外部值在分析循环中不断得到新身份。缓存没有按“相同类型”全局合并不同回调；真实错误缓存变异会被四个隔离反例拒绝。

### Rule 按实际调用阶段检查

普通 setup helper 内将 `def` 赋给局部别名时，旧冷 IR 校验误把 helper 的标记阶段当作调用阶段。相反，没有别名的 helper 从 onMounted 调用时，旧实现又漏掉了 Rule 的 setup-only 条件。

结构校验仍要求真实 `def` receiver；普通 helper 的阶段由共享 callable 分析在实际调用点检查。setup 正例、运行期/render 反例和搬运后的冷 IR 使用同一规则。已有 guarded 路径继续保留抛出前、catch 和 finally 的真实效果，不将抛出后的不可达代码当作发生过。

原样 Shadcn AlertDialog action/cancel 与 Drawer trigger/close 的四份 source closure，在五个已实现 Web profile 上的二十次实际 `compileFile` 后继执行均成功；每个原作者输入另外保留 source/cold-IR 校验。原 `5cb80eb937` 清单中的二十条 FAIL 不被改写。

### Vue2 逻辑表达式中的 renderer 来源

Vue2 native child-shape 收集已支持条件表达式，但漏掉 `&&`、`||`、`??` 返回的 setup renderer。现在沿已经准入的两侧表达式及原词法 scope 收集来源，无组件名、路径或包名分派，也没有扩大源语言准入。

七个实际失败转通过用例包含未改写的 Shadcn Select Value 和六个普通 Vue2 生成消费者。消费者保留真实框架 imports、props 更新、默认 slot、节点身份和清理。第一版诊断夹具误用了不存在的 `getInitial`，该次输入失败单独保存，不能冒充有效基线；正确输入的七项基线才是七失败。

## 消费者断言与既有合同对齐

以下八份测试的修正接受了独立只读审查，没有改变相应产品实现：

| 范围 | 实际校准 | 保留的限制 |
| --- | --- | --- |
| Brutalist/Shadcn Checkbox | Root 的既有 `required` capability 和默认 false 进入预期 | Indicator 不因此获得 required；原 Field/readOnly/reset 所有权保留 |
| Base/Brutalist/Shadcn Select | detach marker 立即投射；物理移除继续经过原两帧屏障 | 同一 authored child 在 body/body/root 三个观察点保持身份 |
| Bootstrap Collapsible | 历史 padding 属于内层 content，外层承担裁切高度 | 原 padding 值、正文和外层几何责任保留 |
| ancestor Context 的 Compiler 边界 | 原作者 source 必须先成功；Web 与各原生 profile 分别接受实际诊断 | GPUI 的 operation refusal 与 Qt/Flutter 的 public-profile UNIMPLEMENTED 不混记 |
| Shadcn Select evidence app | 四框架冷导入的整份测试监督限由 5s 设为 15s | 每个交互 `waitFor` 的期限完全不变；这不是产品响应预算变更 |

Bootstrap reversal 的“最后样本 → 接受新目标 → 新样本”改为同一浏览器 task。原先两个 CDP 往返之间可能合法运行另一个离场 RAF，导致把继续运动误认成跳变。新的观察仍要求误差小于 2px、leaving→entering、相同内容与 owner，并保留原所有动画/等待期限。原退场 endpoint 的另行观察与负控按其自己的证据记录接受。

## 实际测试阶段

| 阶段 | 实际结果 | 接受边界 |
| --- | --- | --- |
| JSON/array/host/authority 七文件组合 | 166/166 | Rule 后续增量之前的共同 callable SHA `81ea28d9aa8e6ee49803b9b77f93391e4400d2635df98fdd513b53fb4d8a09c0` |
| Rule 新增原输入对照 | 4 通过、12 失败 → 16/16 | source 和冷 IR，包含真实非法运行期调用 |
| Rule 与既有 scope/render 四文件 | 106/106 | 后继 callable SHA `c7ecf4abc87e80f94fe87faaed54bbe2a354d8e3bbb4231a618185fae934d8ef` |
| Vue2 正确输入 | 0/7 → 7/7 | 六个生成消费者及原样 Select Value |
| Vue2 扩展三文件 attempt 01 | ENOSPC，保留失败 | 不计整组通过；仅清理已停止且可重建的依赖 |
| Vue2 扩展 attempt 02 | 19 项实际通过，74 项仅 pending | `success:true` 没有被当作 93 项执行完成 |
| Vue2 原 74 项单文件续验 | 74/74，实际 exit 0，26.88s | 明确原 argv、1536MiB heap、前后输入 SHA；与另外 19 项分开保存 |
| 六文件 Runtime 校准 | 77/77 | 测试工作树内容绑定，非干净 HEAD 全库通过 |
| ancestor boundary 校准 | 8/8 | 原 profile/operation refusal 分别保留 |
| Select evidence app 校准 | 1/1，约 5.13s | 原两次 5s 超时与 30s 诊断运行保留 |
| 根工作区 TypeScript 首次尝试 | SIGKILL | 不是成功；后继完整类型检查必须有自己的终态 |

原超时文件又在干净 `9459bb786b2a0e8de1a48f0940ac14eeba2f2733` 上按文件顺序执行，未修改原测试期限：Transition timing matrix **19/19**，native Presence presentation **10/10**，native-support migration **77 通过、1 个 capture-old 阶段跳过**。最长 timing case 为 153,171.88ms，仍低于其原 180,000ms 门；Presentation 最长为 19,419.25ms，保留原 30,000ms 门。迁移的旧原件采集只能由固定旧 emitter 执行；当前 verify 模式实际核验已保存的原 CLI component/map/provenance 字节及 hash，没有用新 emitter 重新生成“旧产物”。这 106 项后继通过不覆盖原失败回执，也不等于最终整合树的完整 Compiler 接受。

## 原件

根执行原件为 `evidence/2026-11-24-sprint2-regression-repairs/raw-evidence.tar.xz`，107 成员、321,128 B，SHA-256 `423c93acc655f6122f988777e9dc7f83488a70469745e50aed01006d65680b7d`。逐成员清单保留字节数与 SHA；包括原失败、错误夹具前提、ENOSPC、pending 报告、后继成功、源胶囊及资源清理收据。Rule/full Compiler/library inventory 的较大原件使用独立归档，保持各自来源与分母。

## 仍需在最终树执行

共享 callable 与 source proof 的修改必须接受最终树的完整 Compiler 清单、全库 profile 清单和真实分发消费者，不能由这些聚焦修复代替。Base Collapsible 原 OOM 已有快速、明确的 PUI1007 后继，仍是未准入能力；其 setup-only binding guard 保留，没有删原型源码来制造成功。原私有 Hook archive、Module declaration 兼容决定、真实硬件/AT 和平台接受仍按各原 Issue 的原条件处理。

## 后继：完整类型与原生 endpoint 检查

二十二文件修复实际通过支持的 publisher 提交为 `8bf1bef48c7bae707c842ece3d3db90084c4d60b`；四文件后继为 `6b6462b526094cee9d3fa385332162c384624e3e`，树 `5af3a2253899f35c54545142be5ccce7c88730af`。两次提交均使用真实 Codex 作者/提交者及其本人的 sign-off，没有替原作者补签，也没有提供 GitHub 独立 APPROVE。

完整 workspace 首次在 8bf1 上实际返回七条 TypeScript 诊断：一个不可达的 record 比较、一个测试遍历的结构 cast、三个测试函数不应返回 IR，以及两个缺少正常生成 shadow-style 文件的导入。前五处只作类型正确性修正，保留全部 source/cold-IR 断言；随后实际执行仓库的 `apps-www generate:proto-ui-style`，没有伪造生成声明。

后继生成在 2026-11-23 22:56:32 UTC 以 exit 0 结束，完整 `tsc -p tsconfig.workspace.json --noEmit` 在 22:57:45 UTC 以 exit 0 结束，未改 tsconfig。两份修正源码前后 SHA 完全相同，分别为 `d293c99b4071de2663e17d077b39369cf31ad5cec0ad98dec3bf467d23471389` 与 `f08e3a30433ea0b3305d88b205b617cdaf5eca6316060b93c5c937ad811a704d`；原 JSON array 全文件又实际通过 55/55。最初 SIGKILL 和此次七诊断的红色阶段仍各自保留。

Bootstrap 的原近零 RAF 代理不是 endpoint 合同本身。新检查保留原至少三个实际中间高度帧、350ms authored duration、520ms 观察和 1000ms guard，另在同一 physical Content 上透明转发实际 native `setProperty`：记录零高度真正写入、原生几何为零、节点/文档/祖先可见性、实际 owner 轨迹以及之后的隐藏/移除顺序。不能由 close 之前的零、旧节点或替代节点的零、退休前又写回正值来满足条件。

第一版 observer 在热样式写入中调用 DemoRuntimeApi 的公开 getter，意外触发该 API 的同步 update；该 observer 发生重入并受控终止，没有完成其变异用例。此失败属于观察器，未被记作产品失败或成功。第二版热路径完全不调用 Runtime API，仅使用原生 DOM/CSSOM；owner 在原有 trace 的可见离场阶段核对。实际六个消费者/44 个断言均成功：正常 observe 被接受，五个实际发生的错误变体均被拒绝，分别为 skip-zero、detach-before-zero、zero-on-replacement、ancestor-hide-before-zero、late-positive-idl。它们都没有 case/page/cleanup 错误。

这五个错误变体仍会满足旧代理：都具有 near-zero RAF、至少十九个中间高度，以及最终零高度/hidden。因此新的检查补到了旧检查会漏过的实际错误；没有通过简单放宽数字来消除旧失败。正常 owned release 清空 block-size/overflow 的顺序依既有 acknowledgment→semantic settlement→release 契约接受，空值释放与正值覆盖分开。零点的强制 layout 是观测成本，这份证据不宣称帧预算、持续物理 rasterization 或任意外部 writer takeover 已接受。

Bootstrap 整段 104 payload 原件包为 `bootstrap-raw-evidence.tar.gz`，2,880,047 B，SHA-256 `1e01ef9f22b03ac20eccdd8b56c26cb25efab9ee2b2ce774e159d432567882b1`，包含旧 38/40、39/40、注册 pair、Vue 单例原生轨迹、observer 首次失败和第二次 6/44 后继。六个校准消费者不被改写为一次完整四宿主 40/40；完整新 driver 的执行仍须有自己的终态。

视觉回读已实际查看原 quiet-02 的 React Collapsible、WC Accordion、Vue2 Collapsible 三张 light/desktop 原图：框线、内容内边距、六行文字和分隔关系可见且没有截断。该三图判断不扩展为全部主题、尺寸、运行状态或辅助技术接受。
