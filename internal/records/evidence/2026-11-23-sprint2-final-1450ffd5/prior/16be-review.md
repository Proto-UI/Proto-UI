# Sprint 2 独立源码审查：16be 阻断记录

状态：**存在两个未解决阻断；不能将本候选作为 Ready 或 clean APPROVE 依据。**

## 范围与身份

- PR：Proto-UI/Proto-UI #1716。
- reviewed head：`16be2a37d3375c4c03b8c118d81bc021b5f669f6`。
- base：`b715b8a6d08c2c79417272c8d4ca9254984feadb`。
- 原 PR head：`4a11517171aa0a019c4bcbd2314c779e25f21de5`。
- 独立审查者：Agent `<INDEPENDENT_REVIEW_AGENT>`；未实现、修改任何本次产品源码。独立探针和本记录只写 control 目录。
- 操作分支：pui-dev / pui-review，human-assisted，current-user。已阅读 AGENTS、spec/README、contributor-agents、atomic-lowering-completion、pui-review 和 visual-evidence。
- 这是实际源码及执行观测的本地审查记录，**不是**已验证 canonical v5 / v2 review packet，未提交 GitHub review，也没有 GitHub APPROVE。最终公共 PR body/comments、平台权限和新 head 尚未封存，不能填写假 digest。

## S2-FINAL-001 — P2 / high confidence / OPEN

**位置：** `packages/prototypes/base/src/checkbox/root.proto.ts`，resetValue 的约 235–265 行；重点是 `indeterminateChange` 返回之后到 `checkedChange` 之间的 continuation。16be source blob：`201d8a541b47dcb65834166f9202e23468d6a367`。

**现象：** 受控 Checkbox reset 在 mixed 回调里已经接受一个新的 canonical checked owner 值，仍会继续发出旧 reset 的 checked baseline 提案。一个正常接受提案的 owner 随即把刚确认的新值覆盖回旧 baseline。ordinary Checkbox 和显式 FieldCheckbox 都复现；checked A→B→A 同步 owner 序列也不会退休旧提案。

**Authority：**

- `spec/prototypes/P-BASE-FIELD-CHOICES.yaml`，draft，`P-BASE-FIELD-CHOICES-VALUES`：canonical 值与受控拒绝的所有权。
- 同文件 `P-BASE-FIELD-CHOICES-RESET`：reset 只能提案 creation baseline，不能强迫受控 owner。
- 同文件 `P-BASE-FIELD-CHOICES-LIFETIME`：重入的新请求退休旧 continuation；退休回调不能发出 trailing proposal。
- `P-BASE-CHECKBOX-ACTIVATION-FLIPS-CHECKED` 已明确 activation mixed callback 中 checked owner 变化及 ABA 退休、mixed-only confirmation 保留提案。它提供当前一致的 owner 边界参照，**其字面范围是 activation，不能冒称它已经直接定义 reset 条款**。必要的 reset 文字澄清应伴随修复保留 draft 生命周期。

**独立最小执行：**

1. 通过真实 Runtime 创建 ordinary Checkbox 或 FieldCheckbox，受控 `checked=false`、`indeterminate=true`；保存 creation baseline。
2. 在实际同 owner portable `key.down` Event 回调内调用真实 `resetValue`，不从外部非法 execution phase 调用。
3. `indeterminateChange` owner sink 同步调用 `session.controller.applyRawProps`，提交 `checked=true`。
4. 回调内立即读取暴露的 canonical `checked.get()`，实际为 `true`。
5. 返回旧 reset；16be 仍发出 `checkedChange({checked:false,indeterminate:true})`。
6. 普通接受 checked 提案的 sink 将 canonical checked 改回 false。第一处违约是第 5 步过期提案，不是测试伪造 owner 或仅 raw props 还未生效。
7. ABA 变体在第 3 步按序提交 true 再 false；两个 canonical 读取均确认生效，但旧 checked 提案仍出现。

| 情况（每种同时覆盖 ordinary / FieldCheckbox） | 预期 | 16be 实测 |
| --- | --- | --- |
| 普通 reset | mixed 和 checked baseline 两个合法提案完成 | pass |
| mixed-only confirmation，checked 未改变 | 保留 baseline checked 提案 | pass |
| mixed callback 提交新的 checked owner | 不再发出旧 checked 提案，新 true 保留 | fail；旧 false 提案覆盖 true |
| checked owner A→B→A | 旧 continuation 单调退休，不因值相等复活 | fail；仍发旧 checked 提案 |

**影响：** 合法的受控 owner 回调可以丢失较新的值；Field composition 共享该 Base owner，因此相同过期提案可影响 canonical Field 值。这里实测的是 Runtime/canonical 状态，不将它夸大为已观察的原生浏览器或 Form 提交 UI 故障。

**原因（源码推断，与测量区分）：** `syncOwner` 对 checked 的真实变化累加 `checkedOwnerEpoch`；activation 会检查该 epoch，但 reset 的 `live()` 只检查 run/view/operation。controlled owner 更新不一定改变 operation epoch，所以旧 reset 仍被视为 live。

**修复要求：** 在 reset 入口捕获并检查 checked owner revision，跨 pressed、publication/report、mixed callback 等同步边界保证新 owner 能退休旧 work；不能用“任意 props 回调都取消”的规则破坏 mixed-only confirmation 正控。修复由另一个 Agent 在新 worktree 执行，本 reviewer 不参与产品实现。

### 可重放证据

control 根目录：`<REVIEW_EVIDENCE_DIR>`。

- `independent-checkbox-reset-16be-r5.mts`：最终 8-case 独立可执行探针。
- `independent-checkbox-reset-16be-r5.json`：4 positive pass / 4 retirement fail，`ok:false`；JSON 已独立回读。
- `independent-checkbox-reset-16be-r4.mts/.json`：6-case 与 immediate canonical ownerReads。
- `independent-checkbox-reset-16be-r3.mts/.json/-run.json/.log`：首次合法触发的 6-case 实测；脚本 SHA256 `00b9599d1a78d77da4cba619b1d7413aa77ca4732a0efe6f9cef2b547b21da6d`，2026-11-23 12:48:08–12:48:09 UTC。
- r3/r5 过程正常 exit 0 表示完成观测输出，**不表示产品断言通过**；结果以 JSON 中逐 case `passed` 和 `ok:false` 为准。
- r1 是 expose 调用 execution-phase fixture 错误；r2 是将 DOM keydown 误用于 portable key.down 的 fixture 错误。两者原始文件/日志保留，明确不计产品失败。

运行环境：Node v24.22.3，tsx，`TSX_TSCONFIG_PATH` 指向冻结 16be checkout 的 `tsconfig.workspace.json`；探针导入实际 Runtime 与实际 Checkbox/FieldCheckbox 原型。宿主是可观测 synthetic event host；不是 physical OS / native browser 验收。

运行命令的产品路径仍冻结在 `<S2_16BE_CHECKOUT>`。复审修复时只改变 checkout/source/output 绑定，不改变这 8 cases 的预期。保留旧候选目录避免把新实现混入旧红证据。

## S2-FINAL-002 — P2 / high confidence / OPEN

**位置：** `packages/compiler/test/text-reset-native.test.ts`，16be 第 163、167 行的两个 `mockImplementation((type, listener, options) => ...)`。16be source blob：`463eb858059680facb3ab0488b471c1ba09db5f1`。

**观测来源：** root 取得 exact-head hosted run `45175883003` 的 terminal receipts，报告 workspace-types 的 TS2345 仅这两处；本 reviewer 已独立读取这两处实际源码，未把“收到 CI 结果”描述成自己重新执行 types。原 artifact `14819274257`，root 校验 ZIP SHA256 `63ad30b629db85451d076d47f0aee094bd28535c5d7df2926dd277d3af5900ae`。

**原因与影响：** 这里实现签名把第三个 options 参数推成必需，不能满足 EventTarget 的 optional 参数调用签名，导致当前必需 workspace types 阶段失败。功能执行通过不替代类型 gate。

**预期修复：** 让 add/remove 的第三参数以真实 EventTarget 对应类型保持 optional（分别 AddEventListenerOptions / EventListenerOptions，含合法 boolean 分支）；不使用 any/cast 掩盖不匹配，不改测试 assertion。需要新 head 实际 workspace types 绿结果。

## 本轮已实际审查的源码范围

| 范围 | 实际审查内容与结论边界 |
| --- | --- |
| TextControl | core selection 数据、module impl/web、compiled dom helper，reset 与 selection 同一 lease、queued callbacks、stale listeners、controlled candidate 窗口；除上列测试签名未发现新阻断 |
| reset 回归测试 | main 原 20 cases 保留；snapshot 增加 host selection，8 新测试检查 queue/listener/cleanup/reentrancy；未发现削弱旧断言 |
| 网站 cascade / browser42 | unlayered Sidebar override 删除精准；Brutalist radius 对 bank；settled Tabs 等待真实 animation/rAF；唯一截图序号；旧功能断言保留；未发现测试掩盖失败 |
| DatePicker / Calendar / Popover | request root/session 因果捕获，State/Context/outward reentry，proposal-delivered gating，open session accepted transition；未发现新阻断 |
| Field / choices / OTP | canonical reports、queued report cancellation、explicit compositions、reset/lifecycle、真实 selection 派生；发现 S2-FINAL-001 |
| VirtualList / Tree / DataTable | model exclusive lease、retire/reconnect、窄错误识别、column filter AND、table/row passive ownership与公开排序/选择；已读主要 diff/实现，未发现另一个已确认阻断 |
| Slider Values | Root/Track/part 源码差异、AxisInput origin与logical session、group Field report/focus/reset；未产生已确认新增 finding；shared adapters 仍做补充阅读 |
| Compiler | parser/Rule lexical capture/IR/target需求/native async/style/React/Vue2/Vue3/WC相关实质差异；未观察 component-name 或 source-path 业务分派；这不是宣布 compiler 全面完成 |
| 验收 runner/workflow | 当前 runner 与原4a字节一致；完整 inventory 304=292 browser+12 Node/HappyDOM；各 stage 留失败/未跑；不把 public build/styles/types混入304 |
| 历史记录保留 | 已阅读独立 text/compiler/field/collections/website/queue 相关审查与修复关联；按当前 source hash 匹配范围复用，旧失败不删除、不当新候选失败或通过 |

尚未逐字读取每一历史 gzip 或所有非语义性 archive；不能将文件清单或历史报告数量称作源码完成度。大量历史证据的作用是保留链路与既有结论，不等于新 head 执行。

### 已排除的源码疑点

对 compiler module alias / setup local shadow 做真实 `parsePrototype` 最小探针：有无 shadow 都被当前 admitted grammar 以 PUI1004 拒绝，没有生成错误 IR。结果 `independent-scope-probe-16be.json` 保留；**不列为 defect**。

## 执行证据与未完成边界

- 独立执行：上述 Checkbox r3/r4/r5 与 parser scope probe。
- 独立读取 owner-run `text-validation-16be2a37-20261123/manifest.json`：reset28 + selection20 + support-plan25 = **73/73**，五次 exact-head/clean 检查、前后四源 hash 一致。这是 owner-run readback，不冒称 reviewer 自行运行73。
- root 最新传回：hosted 原 **304/304** 功能 PASS、site100 PNG，同时 workspace-types FAIL。完整 ZIP 尚未由本 reviewer 下载解包，不越过出处。
- **100 PNG 不等于已完成独立视觉验收**。site Tabs 40 图=8 cases ×初始+4 shortcut变化；最后第五次按钮切换有断言无capture，不能称每次动作都有图。
- 16be 已发现有效缺陷，即使304绿也不 Ready；修复必须在新 HEAD 复验相关及原定必需 gates。
- 非原生 pinned/CLI/watch/ordinary family/冻结 Shenko 双lane/Verdant 与 supplemental Tabs9+Code4 是单独范围，不得混入304。等待 acceptance_audit 的实际终态。
- #1488 B/C/D、fallback unsupportedProfile 与 #1154 双语 Hook 的独立视觉要求不能由 browser 功能 pass 替代。
- 旧环境负控8/8的原 raw 已丢，旧 artifact linking12 未终态；不计本轮执行通过。
- DCO、license/source disclosure、平台身份与 repository permissions、existing reviews/threads、canonical v5 digest、实际GitHub disposition仍须终态核对。不存在 self-approve 或伪造 platform approve。

## 下一步

在隔离修复候选上独立阅读最小 diff，原样重放 r5 正反例，并读 required types 与 original acceptance 的新 head receipts。之后将本记录中的 finding 标为 resolved/open，封存真正的 canonical 输入与 validated packet。此记录只证明 16be 的真实阻断与已完成审查，不提前给新候选下结论。
