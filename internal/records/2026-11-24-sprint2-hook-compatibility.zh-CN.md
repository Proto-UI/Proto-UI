# Sprint 2 / #1154：原 Hook 条件、K 的兼容边界与精确公开来源恢复

执行者：OpenAI Codex；2026-11-24（北京时间）。按当前用户补完 Sprint 2 的授权，本项核对当前实现与原条件、恢复确切已有公开输入，并提出可实施的最小兼容路径。本记录不把提案写成已接受的 API，不改写既有 R1 / R2 / R3 结果。

## 已执行与已恢复

当前 Core 来源与分发子项相同：`4ffc65f2c3d32bcd5d1bd897ab20d9c6f087fb3c`；直接构造观察的 checkout 为仅追加证据的 `a0c112dc4ce805eaa66ff979cf6e8befa5bc9fa4`。调用真实 `declareModule` / `moduleDeclaration` 构造两条声明后：

- `defineHook` 的 caller 没有 own `modules` 属性，`Array.isArray(caller.modules)` 为 false。
- `caller.definition` 仍是传入对象，传入对象的 `name` / `setup` 之后可以修改。
- `defineAsHook` 对照确实公开冻结数组，保留 Z / A 原声明顺序和两个 declaration 引用。

这只是 Core source constructor 的直接观察，没有执行 generic setup、Adapter、packed consumer 或 Compiler；不能据此新增全 K 的通过或替代原 R3 的 installed-package 失败。 [实际观察 JSON](./evidence/2026-11-24-sprint2-hook-boundary/current-core-observation.json) 保留 `fullKAccepted: false`。

从本地已有 Git objects 恢复了公开原提交 `1576544cf0435eb07c478ddcecb35960dcfd0db5` 的七个精确输入：container driver、consumer probe、原 raw fixture、原 type fixture、两语页面和完整 dated record。commit 对应 tree 确认是 `abf6443baf245953b26ba3609b46256836449a9b`。每个成员从指定 blob 读取，保存原 mode、bytes、SHA-256，再从新 archive 逐成员读回。恢复没有访问网络或替换任何原始输入。

[恢复清单](./evidence/2026-11-24-sprint2-hook-boundary/public-source-recovery.json)及 [七成员原始源码](./evidence/2026-11-24-sprint2-hook-boundary/public-source-1576544.tar.gz) 是完整、可读取的有界交付。这个新 archive 为 60,219 bytes，SHA-256 为 `396e816bca1378fc326a4399b602059ad3adc6b0eaefc06a0bfdf515b748e723`。

它**不是**原 13,091-member 私有源码 archive，不能冒用原压缩包 SHA-256 `fd2794add510b12157453eb19ebb63fbd99f91138c68a69c97003888f170877e`。原 `spec/contracts/C-HOOK-0001.yaml` 独立文件也不在该公开提交的 tree 中；其 A–M 完整文字保留于已恢复 dated record 的 `correctionR2.fullGenericConditions`，这不等于原文件及整个原私有环境已经恢复。

## K 与现有语义究竟差在哪里

原 K 要求有效 definition name / setup identity / static Module declarations 不可变，caller 公开冻结 `modules`，调用者在 host preparation 之前显式采用要求；参数不能引入动态要求或 setup-time Adapter 重选。

当前来源给出三个不同层次的事实：

1. [Core 的 HookPrototype / HookCaller / createHookCaller](../../packages/core/src/prototype.ts) 没有给 legacy generic Hook 公开 `modules`。数组冻结和 caller 发布只发生在 `kind === 'asHook'` 分支。caller definition 引用也没有冻结 name / setup。
2. [C-MODULE-DECLARATION-0001-F](../../spec/contracts/C-MODULE-DECLARATION-0001.yaml) 当前只规定 authored asHook 的静态发布和显式复用。该文件为 draft； [D-AS-HOOK-DEFINE-HOOK-0001](../../spec/decisions/D-AS-HOOK-DEFINE-HOOK-0001.yaml) 仍明确 generic authoring API 的关系未决。
3. 四个 Web Adapter 已在 preparation 时读取 prototype 的 Module declarations，Runtime module orchestrator 在 module construction 前形成共同冻结视图。Compiler 的 `parser-module.ts` 可以解析 hook descriptor 的 `modules`； `parser.ts` 当前在到达 hook call 时执行 `addModuleDeclarations(descriptor.modules)`。因而“Core 增加一个字段”还不能单独证明 Adapter/Compiler 都遵守原 K 的显式采用边界。

原 R3 的非空数组断言是有效的历史目标检查。它确实失败，其后的顺序、引用、字段和冻结断言尚未执行。不能改成比较两个 undefined、使用 `Object.isFrozen(undefined)`，或改测 `defineAsHook` 来获得名义上的 K green。

## 最小可实施兼容路径

下面是实现提案，并未在本次提交中改变 API。

### 可单独实施的静态声明增量

若 owner 接受为**现有 legacy Hook** 增加静态声明能力，可将改动限制在当前机制内：

- 给 `HookPrototype` 增加可选的 `readonly PrototypeModuleDeclaration[]`，给 `HookCaller` 增加只读、非 writable / configurable 的 `modules`。
- 对 generic caller 使用既有 `freezeModuleDeclarations` 的数组副本、顺序保留和 duplicate-ID 拒绝；`declareModule` 的真实 token / config 规则仍由原 substrate 负责。不根据 setup 参数或 hook 名称合成 declarations。
- 调用者明确写 `definePrototype({ modules: useX.modules, setup() { useX(...); } })`。对 host preparation 而言，仅 setup-time 调用不能改变已经选定的宿主。
- 将原 static probe 保持不变，增加有声明 / 无声明 / 重复 ID / caller 显式复用的对照，并在真实 TextControl / ImageView / NativeLink preparation 路径上验证采用发生在 module construction 之前，以及缺失或不可用要求的原拒绝。
- Compiler 同源输入也必须分别验证显式采用与只在 setup 调用的控制。当前自动 collect 与原 K 的关系需要由对应 definition owner 决定；不能凭两边都能编译就判定一致。

该增量可避免立即改变 `mode`、`configure`、`api.store`、单个 options 参数或 RenderFn-or-void 的现有行为，但只交付 K 中的 declaration surface 子条件。

### 全 K 还需要的有效定义冻结决定

有两种可实现方式，兼容性不同：冻结传入 definition 的 `name` / `setup`，或捕获不可变有效定义快照并清楚定义 `caller.definition` 的身份。当前 `caller.definition === input`，而 caller 执行时读取该输入；直接换成副本会改变身份，直接锁原属性则改变后续赋值行为。没有现成的已接受决定授权把其中任一方式隐称既有契约。决定后要覆盖外部 mutation、equal-name distinct definitions、alias、重复 construction，并保持 ordinary asHook / privileged Hook 自己的语义。

### 完整 generic 迁移不能通过猜测参数个数完成

原 C / D / L 要 typed argument tuple、raw typed `value`，并拒绝 `mode` / `configure` / `api.store`。当前 official `useOpenState`、`useEscapeKey` 和 `useTypeaheadNavigation` 真实依赖 legacy options / API，前两者还使用 configurable mode。 `useTooltipTrigger` 也经由当前 `defineHook` 安装。

应先确定 generic 定义版本与 legacy migration 路线，再同时迁移官方消费者、Core types/runtime、Compiler 与独立消费者。根据 setup function 的 arity 或某个返回值外形自动猜测 legacy / generic 会使原 typed tuple 的第三个参数与 legacy API 混淆，不构成可接受兼容策略。只完成上面的 modules 增量也不能据此声称 C / D / L 已完成。

## 原 A–M 条件逐项保留

下表为当前源码对应和下一执行点，不是新增 13 条产品 pass/fail。原每条全文仍以恢复包中的 dated record 为准；本次没有缩小任何一条分母。

| 原条件 | 当前源码事实与尚需完成的接受 |
| --- | --- |
| A：逻辑调用者所有权 | 当前 caller 使用 active setup / capture context；仍需独立证明 effects、resources、lifecycle 属于 caller，且没有新增 subject / root / private runtime domain。 |
| B：definition identity | Runtime 的 `instances` / trace 去重目前按 name。原目标要求 logical caller + construction identity，alias 共享、同名不同 construction 独立；需要单独 generic identity 路线，不能改坏现有 asHook 名称规则。 |
| C：typed tuple 与求值顺序 | 当前公开类型是单个可选 options，setup 第三参为 API；原 fixture 的 required tuple 为 seed / increment。必须先完成版本与迁移决定，再实跑参数表达式顺序、第一次引用传递与重复调用仍求值。 |
| D：raw value | 当前 setup 走 `normalizeAsHookRender`，只接收 RenderFn / void；原 typed raw `value`、函数值不自动渲染及 readonly binding 不是这条现有路径。 |
| E：真实 capture | 现有 `endCapture` 从实际 def registrations 形成捕获。全 methods / event keys / removable disposers、Module conflict 与顺序仍需按原断言接受，不能从 returned object 反建。 |
| F：borrowed / nested State | 现有 state projection 和 nested capture 是可定位实现；原 direct/nested 边界、equal-name construction、借用 authority、顺序与不扁平化需要与新的 generic identity 一起接受。 |
| G：phase / authority | 当前有 setup guard；原 callback/render/lifecycle、正常参数表达式与 retained method 的 phase / capability / lifetime 组合仍需全矩阵。 |
| H：失败与重入 | 当前 register 在 setup 完成前放入实例，复用路径可以取 `result ?? {}`；原 initializing / failed、递归拒绝、第一次异常及 result-completion unwind 需要独立 generic 状态机和反例，不能用空结果标为 ready。 |
| I：生命周期清理 | 当前捕获资源由既有 caller / Module 所有者管理；仍需将物理 detach/rebind、setup-only removal、terminal disposal、作者取消任务和旧回调分开接受。 |
| J：只读 trace | 当前 trace 有只读视图但按 name 去重；原 construction identity、每次 invocation / reuse / failure 与同名区分尚需随 B/H 完成。 |
| K：静态声明与 preparation | 本次实测 generic modules 缺失；上面的最小声明增量、有效定义冻结决定、显式采用和不可用能力分别接受。 |
| L：旧元数据迁移 | 当前 legacy API 与官方消费者继续使用 configure / API store；不能单改拒绝分支破坏它们。保留 ordinary asHook no-arg / render / projectHandle，以及 collection privilege 的独立决定。 |
| M：同源独立实现 | 原 unchanged raw/type fixture 已恢复；仍需同一冻结定义下 Adapter 与 Compiler/target 各自独立接受，再组合。实际拒绝继续保存；不靠删 statement、弱化输入或名字特判获得通过。 |

## 私有原件的剩余恢复路径

公开七成员现已可直接取回；其原 blob IDs 与哈希在 recovery JSON 中。原完整 archive 仍须从原保管位置取得，并校验已记录的压缩包 SHA、member manifest、Git tree、hidden membership 和 modes。历史已知位置为 `/workspace/worktrees/release03-issue-1154-wave-20261111`、 `/workspace/worktrees/compiler-core-default-slot-20261010` 和 `/tmp/p1154-1111/criterion1154-main-b252-run01` 等；本环境中没有这些目录。这些字符串是恢复线索，不是有效下载链接，也没有证明其他设备上不存在原件。

原 DCO、独立审查、R1/R2/R3 红色原件、完整 source/archive、原两个复合 Issue 条件、13 条验收及真实非 Web/目标消费者仍按各自事实保留。本记录不关闭 #1154。

## 有界设备来源检查

对 `doesvm-3f08` 的已知旧工作目录 `/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono` 做了只读、有界查找。[原始调用结果](./evidence/2026-11-24-sprint2-hook-boundary/device-archive-search.json)保留成功、访问边界、超时和连接失败，SHA-256 为 `e0c65c96c79da9ef91133ecd23ff744d022a36b91f91d80688671b1a6ceba254`。

- 成功读取该工作目录、`evidence`、`sprint2`、`evidence/s2-s3`、`evidence/s2-s3/short-batch-1`、`evidence/sprint12-final-d039-20261123`、`evidence/continuation-root-4deb` 和 `compiler-reconcile-r1` 的一级名称。没有在这些列出的成员中发现原 Hook archive。
- `evidence` 内限定两层的 `*/*1154*` 没有文件；`*/*hook*` 命中普通 Git hooks / 格式修复记录。`*/*archive*` 的相关命中经读回为 11 月 23 日八个 Sprint 2 证据目录的原字节格式恢复提案，没有宣称原 13,091-member Hook 源码归档。`sprint2/internal` 的两层 `1154` 命中已公开的 dated record，不是新的原件。
- 原 `/workspace/worktrees/release03-issue-1154-wave-20261111`、`/workspace/worktrees/compiler-core-default-slot-20261010`、`/tmp/p1154-1111` 被设备 relay 拒绝为 `path escapes root`。没有绕过这个访问边界，也不能据此记为“路径不存在”。
- 首个两层列名 shell 调用超时；随后 `source`、Issue 引用的 `archive-scope-review.md` 精确路径及旧根两层名称匹配发生连接失败。这些未取得结果的请求不构成否定证据。

因此本轮仍未恢复原压缩包、原 member manifest 或 R1/R2/R3 的执行文件。完整公开七成员已经恢复的事实保持有效；本次未作全设备扫描、未修改远端文件，也未拿新压缩包替换原 archive 身份。
