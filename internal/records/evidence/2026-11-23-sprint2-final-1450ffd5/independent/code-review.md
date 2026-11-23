> **归档范围提示（2026-11-23 13:56 UTC）：本文件仅审查并验证历史候选 `1450ffd549bce8da636f2ccd45044aff5121e6ad`。** 实际 [PR #1716](https://github.com/Proto-UI/Proto-UI/pull/1716) 已并行推进至 [`9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`](https://github.com/Proto-UI/Proto-UI/commit/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42)，GitHub PR 回读的更新时间为 `2026-11-23T13:54:21Z`。下文原记录中的“最终”均指当时的1450候选。其源码结论、275/275、独立8/8、304/304和types结果不能自动归到9d；新head需要差异审查与自己的验收收据。原报告正文原样保留，后附按时间追加的实际验证记录。本文件不声称当前PR已全部验收或获得平台APPROVE。

# Sprint 2 最终提交的内部独立代码审查

## 结论

**审查提交：`1450ffd549bce8da636f2ccd45044aff5121e6ad`。在下述实质源码范围内，未发现仍未修复的阻断性代码问题。**

本轮发现的 S2-FINAL-001 已通过原独立复现关闭。S2-FINAL-002 的两处测试签名错误已修复，原 TS2345 诊断不再出现；**完整 workspace types gate 尚未通过**：隔离工作区随后因缺少生成样式模块退出 2，正式流水线正在提供包含前置构建/生成的最终验证。

本记录可以作为 Ready 流程的内部独立源码审查材料。它不单独证明整个 PR 已满足所有验收条件，不是 canonical clean review packet，也不是 GitHub APPROVE。最终 304、非原生消费者、实际视觉和其他规定检查仍须取得真实终态；不能借本记录降低原条件或替代平台独立身份。

## 精确对象与独立性

- 仓库与 PR：Proto-UI/Proto-UI #1716。
- reviewed HEAD：`1450ffd549bce8da636f2ccd45044aff5121e6ad`。
- reviewed tree：`15e67863a668e5e7a09af69731fd9c4c668ff9f1`。
- 修复前父提交：`16be2a37d3375c4c03b8c118d81bc021b5f669f6`。
- PR base：`b715b8a6d08c2c79417272c8d4ca9254984feadb`。
- 原 PR head：`4a11517171aa0a019c4bcbd2314c779e25f21de5`。
- Reviewer：独立审查 Agent，fresh context 独立源码审查；未实现本 PR 产品改动，也未实现本轮三文件修复。
- reviewer 的写入仅为项目证据目录中的独立探针和报告。没有发布 GitHub review、Ready 操作或其他外部写。
- 采用 pui-review 的 authority、scope、反证、失败保留及出处纪律，审查深度为 cross-domain semantics；本轮依当前任务只提交内部报告，不伪造不存在的 canonical input、validated handoff、prior chain 或已发布 packet。

### GitHub 与设备的交叉绑定

已独立读取 [实际提交](https://github.com/Proto-UI/Proto-UI/commit/1450ffd549bce8da636f2ccd45044aff5121e6ad) 和 `16be… → 1450…` compare。GitHub 返回 ahead 1 / behind 0 / total commits 1，merge base 为 16be，恰三个修改文件：

| 文件 | additions / deletions | 核对 |
| --- | --- | --- |
| packages/prototypes/base/src/checkbox/root.proto.ts | 4 / 3 | owner epoch 保护与 publish 返回后重新校验 |
| packages/prototypes/base/test/notification-retirement-lifecycle.test.ts | 103 / 0 | fixture setProps 与 12 新 cases；原有内容无删除 |
| packages/compiler/test/text-reset-native.test.ts | 12 / 8 | 仅两处 optional DOM options 类型及相应格式 |

GitHub 上的完整 patch 与已独立审查的工作区 diff 一致。GitHub commit 返回真实 Codex 作者/提交者和 sign-off 文本；这只是实际元数据，不把文本 sign-off 当作 DCO check 通过或平台独立批准。

最终 reviewer 探针实际在设备 Git HEAD 1450、tree 15e678 上执行。脚本在执行前后断言 HEAD 相等、全量 `git status --porcelain` 为空、三份源文件 hash 相等。GitHub immutable SHA 与设备相同，未把 dirty tree 的运行冒称为正式 head 运行。

## Findings 的最终处理

### S2-FINAL-001 — P2 / high confidence / RESOLVED

**位置：** `packages/prototypes/base/src/checkbox/root.proto.ts`，原 16be 的 resetValue 第 238–263 行，关键旧 live 条件第 243 行与 mixed callback 后第 256 行；当前修复在同一入口捕获 checked owner revision。

**Authority：** draft `P-BASE-FIELD-CHOICES-VALUES`、`-RESET`、`-LIFETIME`（`spec/prototypes/P-BASE-FIELD-CHOICES.yaml`）：canonical 所有权、只提案 creation baseline、重入新请求退休旧 continuation。既有 `P-BASE-CHECKBOX-ACTIVATION-FLIPS-CHECKED` 的 checked-owner/ABA 规则提供一致性参照，其字面范围是 activation，不冒称它原本就直接定义 reset。

**原观测与影响：** controlled checked=false / mixed=true 的 reset 发出 indeterminateChange；合法 owner callback 同步提交 checked=true，立即读 canonical checked 确实已为 true；旧 reset 随后仍发 checkedChange(false)，正常接受提案的 owner 因而把新 true 覆盖回 false。ordinary Checkbox 与 FieldCheckbox 均复现。checked false→true→false 的 ABA 也会留下旧提案。

**预期：** 新 checked owner 应退休旧 reset 的后续提案；ABA 不能让旧 continuation 复活。只确认 mixed、checked 没改变时，原 checked baseline 提案仍应完成。

**修复及源码判断：**

- reset 在 pressed 清理及其他同步回调之前捕获 checkedOwnerEpoch。
- live 条件同时要求 run/view/operation 有效及 owner revision 相等。
- publish 返回之后再次检查 live，覆盖 Context 同步回调在 publish 内更新 owner 的情况。
- 使用单调 revision，能够辨别 ABA；不把无 checked 变化的 props refresh 或 mixed-only 确认误当成新 checked owner。
- 原 uncontrolled reset、disabled/readOnly 下允许 reset、creation baseline、报告取消和原 lifetime 保护不被改写。

**独立复验：** 原 r5 的八个 behavioral cases 保持逐字节一致；仅替换 checkout/output 路径并增加真实绑定元数据。最终 1450 提交上 8/8 PASS，详见下节。新 owner 的 canonical true 保留、无旧 checked 提案；ABA 无旧提案；两类正控保留。这关闭了原 finding，而不是通过删断言或放宽期望消除红结果。

### S2-FINAL-002 — P2 / high confidence / SOURCE FIXED；完整 types gate 待终态

**位置：** `packages/compiler/test/text-reset-native.test.ts`，原 16be 第 163/167 行，当前 callback 参数在约 164/170 行。

**Authority / gate：** 当前验收 runner 的独立 workspace-types 阶段与项目类型约束；Vitest 运行通过不替代 tsc。

**原观测：** exact 16be hosted run 45175883003 和真实本地非原生 pipeline 均报两个 TS2345；spy callback 的第三参数被要求必传，不能满足 EventTarget 的可选 options 调用签名。

**修复：**

- add 使用 `options?: boolean | AddEventListenerOptions`。
- remove 使用 `options?: boolean | EventListenerOptions`。
- 不加入 any、cast、ts-ignore 或删改测试 assertions；listener 计数、真实 add/remove 调用保持原逻辑。
- 这些真实可选类型与 DOM API 合法调用一致。当前 tsc 的原两个 TS2345 已消失。

**保留的失败：** 修复树的一次 `check:types:workspace` 实跑为 exit 2 / 211.4405 秒。reviewer 已独立读完整短日志，只剩：

- `scripts/analysis/fixtures/shadow-s3/admission.ts(5,42)`：缺少 `proto-ui-shadow-style.generated.js`，TS2307。
- `scripts/analysis/fixtures/shadow-s4/dialog.ts(14,42)`：同一生成模块缺失，TS2307。

这是缺生成先决条件下的失败运行，不能标成完整 types PASS。正式 head 的完整前置流水线必须完成后，才能关闭验收 gate。旧 signature 缺陷与这个剩余验证状态分开记录，不把生成缺失伪报为另一个已确认产品源码 defect。

## reviewer 的最终直接执行

### 八-case 可重复 probe

观察时间：**2026-11-23T13:22:20.623Z**。Node v24.22.3，tsx，实际修复 checkout 的 workspace tsconfig，真实 Runtime 和 Checkbox/FieldCheckbox setup，synthetic event host。

```sh
timeout 8s env TSX_TSCONFIG_PATH="$PROTO_UI_CHECKOUT/tsconfig.workspace.json" "$NODE24" --import tsx "$REVIEW_EVIDENCE_DIR/independent-checkbox-reset-1450ffd5-r5.mts"
```

上述公开命令仅把设备路径参数化：PROTO_UI_CHECKOUT 指 exact-head checkout，NODE24 指经验证的 Node v24.22.3 可执行文件，REVIEW_EVIDENCE_DIR 指原 probe 所在证据目录。内部原命令已真实执行；路径脱敏没有改变本文记录的任何原始文件 hash。这里披露原执行的等价路径表示，原probe保留其原始字节；跨机器复验使用下方已提交的公共测试入口。

工具 exit 0，随后回读 JSON：`ok:true`，8/8 passed。原 red probe 以正常 exit 0 写出 `ok:false`，因此本 review 依据逐 case 结果，不以进程成功代替断言成功。

| 两个原型均执行的场景 | 16be 原观测 | 1450 实测 |
| --- | --- | --- |
| ordinary reset | 合法 mixed + checked baseline 提案 | 保持两提案；pass |
| mixed-only confirmation | checked 未变，baseline 提案有效 | 保持该提案；pass |
| mixed callback 新 checked owner | 旧 false 提案覆盖新 true | 仅 mixed 提案；checked=true；pass |
| checked ABA | 旧 checked 提案继续出现 | 无旧 checked 提案；pass |

### 三份产品源的实际 hash

| 文件 | SHA256 |
| --- | --- |
| checkbox/root.proto.ts | 4167b55452680d76451ef731142c01e8a12561cce01c7481d135421a741f6dd4 |
| notification-retirement-lifecycle.test.ts | 412c9661cdfea6ad9d1bf9133c155999a36c3bd8e018bac10d52a37988c45626 |
| text-reset-native.test.ts | e894522b8fd97366a739f29ed66f37d48e0e3b4bb3253599f05aa25b6829fa4d |

### 最终独立 probe 的归档 hash

| 文件 | SHA256 |
| --- | --- |
| independent-checkbox-reset-1450ffd5-r5.mts | fb4842aa23b2b1369b95a658ee3e194a244b8213df9fa1bda4dd89529a9a1925 |
| independent-checkbox-reset-1450ffd5-r5.json | bdc22803025d8ff38e8c856fa0174d0609fcd9765857168d429c029555c2ebef |
| independent-checkbox-reset-1450ffd5-r5.log | 090e4277ebba1431da30cf3b2fd6ef85dc2c97c363615c15bce520af9f3e84e3 |

以上 hash 由 reviewer 直接调用设备 hash 工具取得。

边界：此 probe 验证同步 Runtime/canonical 状态和真实原型 continuation。它不证明 physical OS input、所有 Adapter、辅助技术或整个原生浏览器验收。

## 其他已独立读取的执行证据

### 最终 head 上的新 275/275

已独立完整读 `final-validation-1450ffd5-20261123/manifest.json`：

- expected/actual HEAD 1450、tree 15e678；前后 clean。
- 8 份输入源码 hash 前后完全相同，包括两个产品源和六个测试文件。
- 2026-11-23 13:23:49–13:25:12 UTC；Vitest exit 0 / 82.4456 秒。
- **275 passed** = notification lifetime 158 + checkbox 8 + Field choices 36 + reset native 28 + selection consumer 20 + native support plan 25。
- JSON SHA256 `c78d7a2110b66a2040bf6d8f7f001e39ef44cf90027a3c98677cf1c4e3d23dec`。
- raw log SHA256 `71835fd332b2dd0a6ab3144351a903e7d51e40cfbc2925b19f1fc9c22137f67f`。
- manifest 由执行方生成，reviewer 做了独立读取；不冒称 reviewer 自行运行了275。
- 已独立读取 raw log 开头与尾部：实际 Vitest 最终显示6个文件、275个 tests passed；ES2024 target warnings保留。一次尾读遇设备更新提示后，后续重读已成功；本公开副本追加此项核对，未改动任何原执行文件或其hash。

这是一轮实际新执行，不把历史 73、230 和当前 275 相加。此前73与230有28个 reset 重叠。

### 新回归的旧实现反证

已独立读 `checkbox-repair/red-receipt.json` 和实际新增测试：

- 执行时 Checkbox 产品仍为旧 SHA256 `3f87192f5d62c15c3c2b1c96e54fe9e48ddbe65a8f6a065fd50b3bdb292073f3`，前后未变。
- 新12 cases：4 正控 passed / 8 缺陷场景 failed，Vitest exit 1。
- 其他146 cases 因 testNamePattern 被跳过，不把它们计为这轮执行。
- 对照修复树的四文件230/230已独立读 receipt，并由最终 head 的275实跑覆盖相应范围。
- 12新cases包括 ordinary/FieldCheckbox、mixed 新 owner、ABA，以及 pressed 清理阶段的新 owner/ABA；断言 canonical reads、回调确实触发、提案精确序列和最终值。

## 主要源码审查覆盖与判断

### TextControl 与 compiled helper

实读 core selection 声明、module impl/web 和 native support dom helper 的实质变更；对照 draft TextControl/reset/selection criteria。reset、detach 和 dispose 退休旧 text lease；selection target/document listener 与 edit listener 使用同 lease；排队 selection 回调检查当前 lease/root/readiness；reset 后旧 listener/queue 无法对新 host 继续生效。

controlled candidate 窗口只保留 host 观察，不把 candidate 当 owner 接受。未变化 owner refresh 不覆盖活动候选；显式 owner A→B→A 仍退休旧观察。physical value 与 canonical 不同的 selection 返回 null，保持既有 UTF-16 selection 约定。未发现本轮新增阻断。

原 main 的20个 reset tests 断言保留，snapshot 增加 selection，新增8个 queue/listener/cleanup/reentry 检查；最后的 options 修复没有改变这些断言。最终275包含完整28 reset、20 selection和25 support plan。

### Field、choices、Textarea 与 OTP

实读 explicit FieldCheckbox/FieldRadioGroup/FieldSwitch、control binding/report helper、Textarea 与 OTP 的实质变更。Field/Form 没有变成第二个 value owner；ordinary Checkbox/Radio 不因祖先发现自动注册 Field。延迟 change report 在当前 canonical 状态上取样，reset/policy/lifecycle 取消旧报告和 focus work。新 readonly 策略保留适用的焦点语义，disabled 仍退出相关参与。

OTP 使用真实 TextControl selection 推导 active slot；未知、模糊、失焦或不可编辑状态不伪造活动槽。这里发现的唯一确认新增阻断为 S2-FINAL-001，已按上文关闭。

### Calendar / DatePicker / Popover

实读 request 起点捕获、State/Context/outward 回调边界、accepted completion 和 open-session 变更，以及相关独立历史审查。request/root/open session 在回调前绑定；completion 等待 proposal 已向外完整交付；较旧/重复完成不能关闭新的会话。读取当前 provider 状态处理 queued notifications；只在 accepted false→true 时建立新的 open session。未发现新的已确认阻断。

### Collections 与生命周期

实读 VirtualList model/web/root 的 exclusive lease、attach 失败释放、generation 先退休、observer/listener/view 清理；旧 retained 回调不接管新 host。Tree 的 live required-context 错误仍是错误，避免广泛 catch 把真实 context failure 当作无 owner；关系、方向和 collapse focus 的边界已查看。DataTable 的 column/global filter AND、selection/page/sort 及 passive Table 继承实现已查看。没有确认另一个阻断。

### Slider Values 与共享输入

实读 Root/Track/part、数值 pointer quantization、group Field report/focus、origin roles、AxisInput module 和 Web AxisInput/MoveGesture host 的实质变更。Track 保持输入/capture owner，Thumb 不增加第二个 pointer owner；起点关联使用同 owner 的公开顺序，再由 host 观察实际 composed path。active session 的 origin 变化、target replacement/detach 与 policy/lifetime 变更触发退休。Root value owner 与 display、proposal/session history 保持区分。

这不宣布整个 Slider、所有 host 或所有数值域已完成；draft criteria 与既有受限诊断边界保留。当前所读差异没有确认新增阻断。

### Compiler 与 CLI

实读 parser/static-loop/builtin shadow、module lexical capture、resolved-props、Rule meta vocabulary/plan、IR validation、target demand、native async/style observer、React/Vue2/Vue3/WC 等相关差异。未观察到以组件名、源码路径或具体业务识别结果分派 lowering 的新增实现；CLI 静态 registry 映射和 compiler build identity 是明确的数据/构建边界，不作为 runtime 业务分派。

对一次 module alias/local shadow 疑点执行了独立 parsePrototype 正反例：有无 shadow 都被现有 admitted grammar 用 PUI1004 拒绝，没有错误 IR 生成。该疑点不是 finding，原 probe 结果保留。这里不宣称 compiler 全面 conformance。

### Family 投影与网站

实读 family Field/Slider/DataTable 共享视觉 setup 和 Base hook 继承，未见通过第二个行为 owner 制造展示状态的新增逻辑。

网站审查覆盖 Sidebar cascade、site native content/theme lease、recipes、Hero 与 Tabs 普通 host 示例，以及 browser42 的实际变化：

- unlayered square-chrome override 精确移除 Sidebar anchors/summary，使 authored Brutalist radius 与增强后的 public Surface 一致。
- 测试不仅比较两行彼此相等，还把实际四角 radius 与 family bank 比较，防止“两边都错”为0px仍过。
- Tabs 等待真实 animation settle 和 rAF 后再采样，没有取消动画、注入CSS或用固定睡眠制造通过。
- 原 selection/focus/node/panel identity/disabled 等断言保留；每次 capture 有独立步骤序号，重复profile访问不覆盖旧图。
- native disclosure、实际 hit geometry、滚轮 takeover、输入归属和后续帧位置断言仍在。
- 42 cases 期望100图；Tabs40图为8 cases×初始+4 shortcut变化。最后第五次按钮切换有断言但没有capture，不称每个动作都拍到。

**源码检查不代替实际视觉验收。** 本 reviewer 尚未完成最终100 PNG逐图视觉判断；它仍由实际视觉审查材料覆盖，不能由功能 PASS 代替。

### 验收 runner 与保留边界

完整读取实际 `run-sprint2-consumers.mjs` 与 workflow 相关 diff。固定 inventory 为304：292 browser +12 Node/HappyDOM。public packages、styles、workspace types 是另列阶段，不能混入304。失败、跳过、未跑和 timeout 收据保留，shared prerequisite 失败不被写成后续 pass；明确 kill-group deadline，避免旧任务与下一重任务无边界重叠。

读取相关独立 compiler/text/field/collections/website/queue 记录及后续 repair correlation；只按实际当前 source 相符范围使用历史信息。没有把1200余个总文件或 archive 数量当成审查覆盖度，也未盲读每份 gzip。主要实现差异经过源码审查；历史失败与未跑条件仍保留。

## 保留的历史结果

- 16be 的原 r5：4 positive pass /4 retirement fail；r3/r4 canonical read 证据保留。
- r1 的 execution-phase 和 r2 的错误事件名属于 reviewer fixture 错误，原日志保留；不计产品失败。
- 16be 的73/73、304/304功能 PASS 与 workspace-types TS2345 FAIL 分开归档；它们不是新head的终态。
- 16be 非原生 pipeline 已有双 pinned build/determinism、真实 npm ci、CLI、ordinary/family profiles 等成功项目，但总流程因真实 types 失败而 FAIL，不能把其未执行 Apps/补充项写成通过。
- 旧环境 TextControl lease 8/8 负控 raw 已丢、旧 artifact-linking12 未终态，不能计为本轮执行成功。
- 本轮新 Checkbox 12-case red/green 证据与上述失去 raw 的旧 TextControl 负控是不同范围。

## 尚需终态核对的原验收条件

1. 最终 head 的完整 hosted run：[45183604935](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935)。本报告封存时只收到同head已dispatch的真实状态，未取得终态，尤其不能预判 workspace types 或304成功。
2. 独立的非原生 pinned/CLI/watch/ordinary family、冻结 Shenko双lane、Verdant 实际消费者与 supplementary Tabs9+Code4，按原任务范围分别核对真实执行。它们不在304分母内。
3. 实际最终输出的独立视觉判断，含任务原有 #1488 B/C/D 与 fallback unsupportedProfile、#1154 双语 Hook 等要求；不得用 browser 功能通过代替。
4. Ready 普通协作的实际 validation/provenance/DCO/权限/当前未解决 review 条件，由当前收据核对。这个内部 source verdict 不产生 GitHub APPROVE，也不豁免任何真实 in-scope finding。

未发现需要由用户重新决定的产品方向。当前缺口是实际验证终态与证据，而不是让用户补交截图、填写表格或重复授权。

## 公开源码中的复验入口

已提交的[生命周期回归测试](https://github.com/Proto-UI/Proto-UI/blob/1450ffd549bce8da636f2ccd45044aff5121e6ad/packages/prototypes/base/test/notification-retirement-lifecycle.test.ts)提供无需内部绝对路径的12个对应回归用例。独立八-case probe与作者新增12-case测试的执行出处和数量仍按上文分别记账。

在安装好锁定依赖的1450 checkout内，可重放该公共子集：

```sh
corepack pnpm@10.32.1 exec vitest run packages/prototypes/base/test/notification-retirement-lifecycle.test.ts --maxWorkers=1 --minWorkers=1 --pool=forks --testNamePattern='reset mixed callback|reset entry checked owner'
```

## 归档索引

以下使用证据文件的相对名称。公开副本移除了设备私人路径；原始内部报告、执行材料和原 hash 保留。

- 初次阻断：`independent-final-review-16be-r1.md`。
- 初次源绑定：`independent-final-review-16be-source-binding.json`。
- 未提交修复树复审：`independent-final-review-repair-r1.md`。
- 原始 red：`independent-checkbox-reset-16be-r5.mts/.json`。
- 未提交修复树 green：`independent-checkbox-reset-repair-r5.mts/.json/.log`。
- 最终 head reviewer 8/8：`independent-checkbox-reset-1450ffd5-r5.mts/.json/.log`。
- 作者运行 red/green/patch/types：`checkbox-repair/`。
- 最终 head275/275：`final-validation-1450ffd5-20261123/manifest.json`、`vitest.json`、`vitest.log`。

如后续只补验证收据且产品/测试树不变，可补充验收终态而保留本 source verdict；任何新的实质源码、测试断言、authority 或 scope 改动应按实际差异再审，不能沿用本结论覆盖未审修改。

## 平台状态补充（2026-11-23 13:43 UTC 独立核对的快照）

这段是公开证据副本的追加记录；上面的源码结论与原控制目录中的报告字节不改。它记录实际平台状态，不把 Ready 标签、规划检查或跳过状态当作完整验收结果。

- GitHub [Ready 时间线事件 37012490109](https://api.github.com/repos/Proto-UI/Proto-UI/issues/events/37012490109) 显示，`cyjin-yl` 已于 `2026-11-23T13:28:14Z` 将 PR 标为 Ready。该操作由实际平台 actor 执行，本 reviewer 和本次整理没有执行 Ready 转换。
- [Codex bot 评论 7102584307](https://github.com/Proto-UI/Proto-UI/pull/1716#issuecomment-7102584307) 于 `13:28:24Z` 报告代码审查额度已用尽。这是未能运行自动审查的限制，不能算作完成代码审查或代码 finding。
- 本次读取 [PR reviews API](https://api.github.com/repos/Proto-UI/Proto-UI/pulls/1716/reviews?per_page=100) 得到空数组，没有 GitHub review，更没有平台 APPROVE。
- [1450 的 check-runs API](https://api.github.com/repos/Proto-UI/Proto-UI/commits/1450ffd549bce8da636f2ccd45044aff5121e6ad/check-runs?per_page=100) 中，DCO、`test-plan`、`public_package_plan`、`lockstep-check`、`ci-config-audit` 成功；`sprint2-consumers` 仍为 `in_progress`，其余 19 个返回条目为 `skipped`。跳过条目不能计作执行通过，规划检查也不代替实际构建与测试。
- [1450 的 commit status API](https://api.github.com/repos/Proto-UI/Proto-UI/commits/1450ffd549bce8da636f2ccd45044aff5121e6ad/status) 返回 Vercel `failure`，原因原文为 “Deployment rate limited — retry in 24 hours.”，更新时间为 `13:24:09Z`。旧 16be 的部署成功不能充当当前提交的部署结果。
- 最终 [hosted run 45183604935](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935)、非原生消费者与实际视觉验收在这个快照中没有被宣布通过。后续终态应独立追加，并保留这里的时间顺序。

来源是本 reviewer 实际读取的 raw REST 响应。上述链接为可复查出处；状态可随平台继续执行而变化。这段仅更新平台事实，不构成 canonical clean packet、完整验收结论或 GitHub APPROVE。

## 最终 hosted 终态补充 — S2-FINAL-002 CLOSED

**后续于 2026-11-23 13:48 UTC 独立回读：最终 HEAD 1450 的完整 hosted workspace types 已通过，S2-FINAL-002 的验证缺口关闭。** 本节更新上文封存时仍 pending 的相应条目；旧本地 TS2307 和旧 16be TS2345 原记录完整保留。

本 reviewer 实际读取了最终原始 `receipt.json` 的 source、13 个步骤及终态，重新计算其 SHA-256，并读取 `workspace-types/run.log`。收据绑定 HEAD `1450ffd549bce8da636f2ccd45044aff5121e6ad`、tree `15e67863a668e5e7a09af69731fd9c4c668ff9f1`、clean source 与 Node `v24.22.3`。public packages 和 styles 先成功；workspace types 在 `13:29:14.177Z` 以 code 0、timeout false 完成，原日志只有实际 tsc 调用，无 TS2345 或 TS2307 诊断。13 个阶段最终均为 passed / code 0 / timeout false；总收据于 `13:44:20.689Z` 记为 passed。

[最终 hosted job](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935/job/137723420016) 的 GitHub check-runs 回读也确认 `completed / success`，head 完全一致，完成时间 `13:44:25Z`。原始收据 SHA-256 为 `447048497f3d8b0793a939dfca0b350522b6de3ca760717ef2c326e482ccdd9f`。

本 reviewer 还实际回读主任务的 `reconciliation.json` 和 `download-receipt.json`：对账记录为 304/304 = 292 browser + 12 Node/HappyDOM，逐套 distinct case IDs 与先前原始 304 inventory 一致；public packages、styles、workspace types 三个准备阶段不计入304。100 张 site PNG 已产生，但图片数量不等于独立视觉通过。这里复核实际对账材料，不声称本 reviewer 自己重新运行了整个 hosted suite。

[原始 artifact 14823732540](https://github.com/Proto-UI/Proto-UI/actions/runs/45183604935/artifacts/14823732540) 的下载收据记载 ZIP SHA-256 `273454fef6331bebdc8b110699db3b8ffba885d4f1b29f3daac6576289220667` 并核验成功。原件相对定位为 `hosted-1450ffd5-45183604935/extracted/receipt.json`、`extracted/workspace-types/run.log`、`reconciliation.json` 和 `download-receipt.json`；这些 hosted 材料由本次证据集的组装者另外加入，未被本轮路径脱敏程序重复处理。

更新后的独立代码结论：S2-FINAL-001 已关闭，S2-FINAL-002 的源码与完整 hosted types 验证均已关闭；已审源码范围没有未修复阻断。更广的消费者、全局 types 与实际视觉验收仍按各自真实终态判断。本节不改变 Vercel 当时的 rate-limit failure，不产生平台 APPROVE，也不宣称所有原验收条件均已满足。
