# Sprint 2：共享输入、表单与公开消费者交付记录

本记录冻结共享输入工作分支的 18 个提交，范围为 TextControl selection、OTP、AxisInput origin、Slider Values、Field/Form 和 Select 公开消费者。源码检查、真实框架在源码 DOM 环境中的消费、静态浏览器装配、原生浏览器运行分别记账。记录不修改 Issue 的原条件，也不提升 draft 实体的生命周期。

**本记录的实现与独立源码复审已交付；最终整合源码的 72 条 OTP/Slider 和 36 条 Form/Select/choices 原生旅程尚未取得本记录持有的运行终态。** 已知旧诊断中的受控 OTP 失败保留，修复后的源码结果不能替代它的原生重验。PR、最终整合验收和关联 Issue 的可得进度回填由根执行者统一处理；本文件不声称 PR 已 Ready 或整条 Issue 已结项。

## 1. 固定来源与证据入口

| 对象 | 固定标识 |
| --- | --- |
| 原始基线 | `dc3b184ba10b0de53e40359c52d012b204b2cd01`，tree `513879bf79a93cc9325f5193fa0559e16ea57108` |
| 本路最终实现与公开配方 | `095ecbdde4902941a13032386765dac59ebd7e6b`，tree `216ff7d5c1d639a70889d5f1ea930e1a87bef0fa` |
| 原始分支 | `sprint2/shared-input-20261122`；根分支的 cherry-pick 提交另有标识 |
| 工具链 | Node `24.22.3`；`pnpm@10.32.1`；锁文件 SHA-256 `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8` |
| 冻结对象 | #1132、#1160、#1094、#1096、#793；接续 #1098 的 Slider/OTP。六份原 Issue 快照保存在证据目录 `intake/` |

完整入口：

- [source-identity.json](evidence/2026-11-22-sprint2-input/source-identity.json)：18 个提交、父提交、tree、签署信息，以及 188 个修改文件的 Git blob、字节数和 SHA-256。
- [receipt-index.json](evidence/2026-11-22-sprint2-input/receipt-index.json)：101 份原执行输出的摘要、失败分类、源码绑定限制、对应修复提交；所有原字节以确定性 gzip 保留。
- [evidence-files.json](evidence/2026-11-22-sprint2-input/evidence-files.json)：压缩前后双 hash 与原文件位置。原工作目录中的 intake 回执没有删除或改写。
- [native-status.json](evidence/2026-11-22-sprint2-input/native-status.json)：亲自持有的材料与根执行者观察转述分开，列出未运行的当前矩阵。
- [strict-observations.json](evidence/2026-11-22-sprint2-input/strict-observations.json)：严格类型执行的原会话观察、空 stdout 的限制和 SIGKILL 中断。
- [review-index.json](evidence/2026-11-22-sprint2-input/review-index.json)：五条独立复审发现及其回读；完整独立报告原字节在 `review/`。

`source/changed-files.tar.gz` 保存该实现提交中所有修改文件；`source/commits.mbox.gz` 保存完整的 18 提交补丁与 sign-off，`source/base-to-candidate.patch.gz` 保存基线到该提交的完整二进制安全 diff。它们使原分支的源码在整合时发生 cherry-pick 后仍可审查。

**这些源码归档是复现输入，不是历史测试的追溯补造。** 大部分测试在提交前的工作树运行，当时没有保存完整 dirty tree 的逐文件摘要。索引的 `relatedImplementationCommits` 表示对应修复，不能据此声称该回执在对应干净提交上运行。尤其最后的 232/232 是后来提交为 `42ee3b9` 的实现候选与当时未提交的公开配方；配方后来归入 `095ecbd`。本记录没有为归档重复跑 232 测试或类型检查，也没有把它们改称最终整合 head 通过。

## 2. 原条件如何承接

| 原 Issue | 本路已交付的有界内容 | 仍需独立取得的接受结果 |
| --- | --- | --- |
| #1132 pointer facts | 复用已有有限 pointer 事实；公开 Select 配方和四框架源码消费者覆盖键盘/hover/value 交接；原生 runner 纳入 held-button 跨项、pen、touch cancel、late move、滚动、重开 | 当前源码的三家族四宿主 native；原 nested/portal、单侧撤回、原 `35195a6` 失败图和 Compiler 完整对账仍按原条件保留 |
| #1160 七类表单输入 | 七控件适用矩阵；显式 FieldCheckbox/FieldRadioGroup 三家族；Brutalist FieldSwitch/FieldTextarea；普通 Checkbox/Radio readOnly；受控拒绝、reset、focus、重入修复与公开消费者 | 当前原生矩阵；完整变体/尺寸/主题/字体缩放、group/toolbar、物理 IME/AT 和实验家族原条件 |
| #1094 Form 与关系 | 公开复合 Form、异步 validator、nested Fieldset、CheckboxGroup 提交/reset；实际 Label/Description/Error 关联；显式选择控件通过已有 Field/Form owner 注册 | 三家族四宿主的原生关系、提交和焦点；真实 AT；原 CheckboxGroup 父组、完整家族等未由本配方覆盖的组合 |
| #1096 披露中断 | 对现有 portable owner、presence/受控与中断源码回归进行核对；不重复写第二套披露行为 | 现有 `demo-collapsible-projections.browser.test.ts` 在最终整合源码的 family-specific 浏览器接受；动态内容、反转、卸载、AT 与 #884 原独立条件 |
| #793 Web 偏好 | 保留并检查既有 Web source/Rule 生命周期与隔离检查；没有把已有源码算成新增原生接受 | `apps/www/test/preferences.browser.test.ts` 的真实 mounted preference/forced-colors/材质 fallback；Compiler differential、GPUI、Flutter/Qt 继续独立 |
| #1098 Slider/OTP | 可移植选择/光标事实、真实活动槽；多滑块 origin/lease、拖动与键盘、有限数组 Field；Brutalist Values 六 part、公开三家族配方 | 当前 72 条 native；物理 OS IME、自动填充、AT、适用其余家族和 Compiler 仍独立。Calendar/Date Picker 由根与集合路负责 |

上表用于给原复合条件增加准确的子进度，不删除原 wording。#1178 可以引用本次具体失败及修复归因；一次源码通过不替代它的当前整合回执。父追踪 #1100、#890、#1673、#1323 等由根执行者按对应子条件同步。

## 3. 独立定义与责任层

新增契约、prototype 和 test 实体保持 draft。行为由下面的独立定义约束；本记录仅解释本轮实现和证据。

| 语义 | 定义与责任层 |
| --- | --- |
| 编辑器选择事实 | `C-TEXT-CONTROL-SELECTION-0001`、`C-TEXT-CONTROL-0001`；公共 types、TextControl module、共享 Web host；四 Adapter 使用同一定义 |
| 作者指定输入来源 | `C-AXIS-INPUT-ORIGIN-0001`、`T-AXIS-INPUT-ORIGIN-0001`；AxisInput 将同 Anatomy family 中的有效 part 映射为受租约约束的索引 |
| OTP 活动与 Field 报告 | `P-BASE-INPUT-OTP`、`T-TEXT-CONTROL-SELECTION-0001`；OTP 消费共享选择事实，保留单个 Root value owner |
| 多滑块输入与有限 Field 值 | `P-BASE-SLIDER-VALUES`、`C-FIELD-0001`、`T-SLIDER-VALUES-INPUT-0001`；Base 消费原子输入事实，家族仅投影外观 |
| 显式选择控件 | `P-BASE-FIELD-CHOICES`、`P-SHADCN-FIELD-CHOICES`、`P-BRUTALIST-FIELD-CHOICES`、`T-BASE-FIELD-CHOICES-0001`；普通 Root 仍拥有 canonical value |
| 七控件适用性 | [form-input-applicability.v0.md](../contracts/prototype-base/form-input-applicability.v0.md)；解释显式 Form 入口、readOnly、reset 与命令态的边界 |

### TextControl 与 OTP

TextControl 提供不可变、可为空的 UTF-16 `{ start, end, direction }` 选择事实。缺失、不合法、无有效 lease，或物理候选仍不同于 canonical owner 时，snapshot 的选择事实为空。选择通知本身不修改值。OTP 用这些事实确定活动槽；blur、disabled、readOnly 或未知选择没有活动槽，不能再用 `value.length` 猜测用户正在编辑的位置。

真实受控输入暴露了回调顺序缺陷：物理值已经输入，普通 state/context 刷新却先投影旧 canonical 值，再接受新值，使 caret 从 2 回到 1。`b1033a4` 将编辑回调与 selectionchange 纳入有界观察窗口；同一个旧 canonical 的同步刷新不能覆盖当前物理候选，回调结束后的拒绝恢复仍有界。`14c47f2` 进一步规定真实 owner 变值即退休这个窗口，A→B→A 也不能重新激活旧保护。

OTP 的 Field 接入明确使用 Root canonical-change：受控拒绝、规范化后无变化不冒充接受；真正接受变化、blur、manual 各按自己的路径验证。这个有界规则没有改写通用 TextControl/Field 的候选编辑契约。通用 FieldControl 仍可在拒绝编辑后验证保留的 canonical 值，并等待普通框架的 owner commit；由此解决公开 Vue/Vue2 配方中的延迟，未靠隐式强制接受值处理。

### AxisInput 与 Slider Values

可选 `originRole` 只暴露当前同 family 已拥有 part 的 `originIndex`，不暴露 raw target 或原生 pointer id。作者选用 origin 后，未知/失效来源 fail closed。当前 contact 固定来源，成员顺序、ownership、target 或生命周期改变使其退休，capture 释放一次；被子节点拒绝的 down 不由祖先重新夺取。

Slider Values 据此区分 Thumb 抓取与 Track 定位。偏离中心抓取保留初始值与归一化 delta；Track 选择最近可编辑 Thumb，等距遵循已有顺序；disabled/readOnly 与失效 origin 不降级成 Track 操作。Field 消费有限同质 `number[]` 的防御副本，混合、稀疏、NaN/Infinity 仍拒绝。连续同栈 accepted 更新按定义报告最终 canonical 批次，焦点、请求回调同步卸载会停止旧续体。

Compiler owner 独立实现 TextControl selection 与相关 native helper。**`asAxisInput` 在当前 Compiler admission 仍明确 unsupported**；本路没有嵌入 Slider 业务分派，也没有把 Adapter Slider 通过写成 compiled Slider 完成。

### 显式表单组合

FieldCheckbox 和 FieldRadioGroup 调用已有 Base semantic setup 的显式 `fieldBinding` 入口，各只有一个 value owner。普通 Checkbox/Radio 即使位于 Form 祖先之下也不会自动注册。Checkbox 提交 boolean；indeterminate 只是显示态，不替代 checked 的 required 判定。Radio 提交 string，required 的空串依既有 Field 有效性处理。

readOnly 保留焦点、Radio 漫游和 Label focus，但不产生值提案；disabled 还影响可聚焦成员与 Form 提交值。`Fieldset` 继续只负责其已有 disabled/组关系，不新增 `readOnly`。公开配方将 readOnly 写到三个 Field，将 disabled 写到嵌套 Fieldset。Button 经 FormSubmit/FormReset 发出命令，Toggle 的 active/pressed 是命令状态，不自动变成 Form 字段；Input 的纯文本范围不扩张成文件或任意原生 input bypass。

reset 使用创建时 canonical 基线，后续 default 不改变基线。受控 reset 是普通请求，拒绝保留值及 dirty；readOnly 不阻止明确 reset。选择控件批量 onChange 的定义与现有 Switch 连续 accepted 报告不同，后者的非去重测试原样保留。Radio 组内焦点转移不是 blur，reset/policy 退休旧焦点任务后按新事实同步，之后真实离开仍可触发 blur 验证。

## 4. 实际源码结果与保留的原失败

下面的数量都来自各自回执，存在重叠，**不能相加为本轮独立测试总数**。完整迭代、过滤数量与原诊断见 receipt-index 和压缩日志。

| 主题 | 原失败 | 修复后的实际源码结果 | 对应变化 |
| --- | --- | --- | --- |
| selection 与四 Adapter | 初轮 5 失败；共享选择/Slider 迭代中的失败全部保留 | `selection-second.json` 135/135；后续 OTP/callback 独立继续修复 | `e2ef558`、`bb1bb30` |
| 多滑块与 Field | `axis-values-final.log` 29 失败/186 通过；一次 49 测试虽通过但仍有 3 条 unhandled Anatomy 错误 | optional Field 103/103、Values/Field 53/53；干净 Slider 输入 49/49 | `8a4afae`、`91ec753` |
| Slider 同步卸载与 OTP 拒绝 | Track focus dispose 2 失败；OTP Field 3 失败；后续 121 测试首次仍有 3 失败 | `shared-input-reviewed-final-2.log` 121/121 | `dcf20f5` |
| 受控候选/光标 | 6 条源反例失败；A→B→A 另 6 条失败 | 原 caret 集合 138/138；owner 反转集合 117/117 | `b1033a4`、`14c47f2` |
| 普通 Field 编辑报告 | 108 集合 1 失败；名为 final 的 126 集合仍 1 失败 | 延迟报告 49/49、Textarea 17/17、controlled consumers 54/54 | `3bf60f1` |
| 公开 Form 四框架 | 8 失败/4 通过 | `form-recipes-four-hosts-2.log` 12/12 | `3bf60f1` |
| reset/edit 回调重入 | 第一版 6 失败属 callback scope 夹具错误；合法 Runtime 反例实际 4 失败/2 正控 | `field-reset-reentry-final.log` 202/202 | `3d5e556` |
| 公开 Select | 初轮 3 个 React 用例未等到实际打开后的 refs | 最终源码消费者 12/12 | `abbc6a8` |
| 显式选择控件与 ownership | 原继承集合 8 失败/204 通过，另有 3 个跨 owner callback scope 异常 | `field-choices-reviewed-final.log` 212/212 | `e16e820` |
| 公开 choices | 首轮 12 失败包含非法 Fieldset.readOnly 与源码 CSS 前提；第二轮 12 失败为实际缺少 Switch reset | `field-choices-public-recipes-third.log` 12/12 | `ebbfc57`、`095ecbd` |
| 独立复审 001–003 | reconnect 2 红；mixed callback 4 红/2 正控；blur/reset 6 红/3 正控 | `field-choice-independent-review-fixed.log` 265/265 | `ebbfc57` |
| 独立复审 004 | focused subscriber 重入 2 红/3 正控 | `field-choice-final-public-review.log` 212/212 | `3693622` |
| 独立复审 005 | reset 入口 lease 3 红/3 正控 | `field-switch-entry-lease-review-fixed.log` 232/232，来源限制见第 1 节 | `42ee3b9` 与当时的公开配方 |

### 基线失败与夹具改正

Date Picker 的四条 `Date Picker host selection stops retired Day listeners` 原断言在干净基线来源的原源码、原测试上仍失败，回执为 `datepicker-dc3b184-baseline-red.log`。本路没有修改 Calendar/DatePicker 实现或这份测试的通知顺序 oracle。根执行者随后另行修复 `3bd5bcf`；那份实现、106/106 和独立复审属于根路记录，不能算作本路曾经的通过。

Number Field 的四条退休夹具也在原基线复现。原夹具让 composition 保持 active 却期待 commit，与既有定义冲突。修正只让反例使用 controlled value 0、未接受的非 composition 草稿 2，保留 outward valueChange 后退休必须停止旧 commit 的原断言。Number Field 产品代码没有为这组测试改变。它不是物理 OS IME 的证据。

原 `shared-s2-scope.log` 是 312 通过/2 失败，不能说成整组通过：Bootstrap Field 使用自己的已治理 invalid ink，原测试误期望通用 `border-destructive`；另一个旧负例把本轮已独立定义为合法的有限 `number[]` 判作不合法。两项按对应定义修正，保留源失败。具体 raw 名称中有 `final` 的文件仍以实际摘要为准。

## 5. 五条独立复审及回读

评审者 `/root/collections` 没有提交被审实现。它对真正的 Runtime 或 Web Component Adapter/源码 DOM 环境执行了独立反例，并回读修复；这是独立本地源码复审，不是虚构的 GitHub APPROVE，也不是原生浏览器接受。

| 发现 | 实际问题 | 修复与回读 |
| --- | --- | --- |
| 001 | controlled Radio 卸载后 owner 改为 b，重连仍保留 a | `ebbfc57` onMounted 同步最新提供值，保留创建基线；评审者在 `3693622` 回读通过 |
| 002 | mixed=false 回调已接受 checked=true，旧 activate 又按新值取反发 false | `ebbfc57` 用 checked owner revision 退休旧第二阶段，纯 mixed 确认正控保留；原 payload 反例回读通过 |
| 003 | reset 后旧 queued blur 又把 touched 改回 true | `ebbfc57` 使用独立 focus generation，按当前事实 sync；三家族原 3 红及 3 baseline 正控变 6/6 |
| 004 | no-op requestValue 的 focused 订阅同步 dispose 后仍读终态；或新 owner 决定变成旧反向提案 | `3693622` 保留原 no-op intent 并复核 view/operation/value revision；原三种退休回读通过 |
| 005 | reset 清 preview 时回调更新 owner，旧 reset 在回调后才取 epoch 并反转新值 | `42ee3b9` 在 reset 入口固定 intent/view；自身 Axis cancel 正控继续完成，新 owner/ABA/nested reset 退休旧 intent；原 2 例回读通过 |

评审者最早一版 004 fixture 缺少一次性订阅保护，递归重挂直到 exit 137。其修正后的合法 probe 才隔离出实际 disposed-owner 缺陷；前者留作夹具错误，不能作为产品反例。独立证据完整归档由评审者提交到 `internal/records/2026-11-22-sprint2-collections-review.zh-CN.md` 及对应 `evidence/2026-11-22-sprint2-collections-review/field/`。

评审者也核对了 `095ecbd` 的全部公开配方、文档和 runner delta，并独立生成实际 Tailwind CSS，未报告新 finding。原报告的最终字节已在本归档保留；评审者的源码 review 与原生 pending 边界不变。

## 6. 公共入口、文档、严格检查

三家族的 FieldCheckbox/FieldRadioGroup 和 Brutalist FieldSwitch/FieldTextarea 都有真实 package export、网站模块注册和公开配方。Base package 的发布文件清单补齐实际需要的 helper；家族投影保留既有包分发策略。新增同家族 parts 复用 Base ownership，未引入隐藏 input 或宿主 form forwarding。

CLI 的映射由编译器消费者 owner 另行提交：`f4da740` 承接 Brutalist Values 六 entry，`3ea9e34` 承接 Brutalist FieldTextarea，`1ce6695` 承接本轮七个选择控件入口及既有遗漏的 Base FieldSwitch/Base FieldSelectTrigger。这些 `sourceOnly` 四宿主 facade 的结果不意味着原子编译器已支持完整 Field/Axis 协议；干净安装闭包归根整合验收。

本路现有回执包括：

- `field-choices-catalog-final.log`：1,011 declaration files、1,401 static entries、466 cataloged P entities；479 个既有 debt file，没有为新入口增加 debt 豁免。
- `field-choices-spec-delivery-final.log`：1,299 entities、0 issues；所有新实体的生命周期与 planned native 条件保留。
- `field-choices-authoring-final.log`：相对原基线检查 24 个改动的 catalog 输入。
- `field-choices-public-docs-final.log`：305 条双语主路线、4 个 library inventory，stable 0.2.0 与 workspace 0.3.0-alpha.2 区分保留。
- `textcontrol-public-package-typefix.log`：修复 Web lease `read()` 非空返回类型后，仅该执行选择的 **4/47** 公共包完成；它不是全部 47 包通过回执。

严格类型检查三次先前 exit 0 的会话观察按其当时候选单列；空 stdout 本身不构成通过证据。`field-choices-reset-types-final.log` 明确是 SIGKILL：没有完整类型终态，原因未知，不能推断为 OOM。随后取得串行 exit 0 的是后来的候选执行，不能改写原中断；它又早于 004/005，最终整合 workspace types 仍由根队列承接。

早期 catalog 的 tsx CLI 因本地 IPC socket EPERM 失败；后续使用已有 `node --import tsx` 入口执行检查。这个命令入口调整与 Chromium sandbox 无关，没有放宽浏览器安全边界。

## 7. 原生旅程与真实 CSS 前置

| runner | 冻结矩阵 | 观测内容 |
| --- | --- | --- |
| `scripts/analysis/sprint2-input-browser.mjs` | Base/Shadcn/Brutalist × WC/React/Vue/Vue2 × 6 = **72** | OTP 与 Slider 各 owner 分支独立终态；真实键鼠、受控拒绝/接受、选择事实、geometry/capture、Field/reset 与清理 |
| `scripts/analysis/form-select-recipes-browser.mjs` | 三家族 × 四宿主 × `form`/`select`/`choices` = **36** | 实际公开 DemoSpec，不是私有替代页；异步校验、新旧请求、提交/reset、Label/IDREF、touchcancel/reopen 与选择控件 ownership |

Form/Select 的原 24 条保留，choices 新增 12 条。choices 实际检查 readOnly 仍有 focus/roving 而无提案、受控拒绝和接受、mixed/required、提交值、嵌套 disabled、省略字段、reset、挂起的旧 consumer 回应以及回调内真正 keyed owner replacement。Select 将 CDP touch 的 implicit capture 导致没有投递与消费者明确拒绝分开，late-move 协议报错也单独保留，不能将“无投递”描述为组件已验证拒绝。

静态装配发现仅加载 prototype token CSS 不足以呈现公开 DemoSpec 的 className：Base Checkbox 的 `size-5`、Select item 的 `block` 等真实消费者样式必须存在。`form-select-recipe-css.mjs` 编译实际网站 Tailwind stylesheet 及配方字面候选，嵌入实际 DM Sans/Geist 字节供无 asset server 的 fixture 使用。回执记录 Tailwind 4.2.2、365 candidates、555,880 字节 CSS、每个输入与输出 hash。它补齐真实前置，不以测试专用几何值替代产品样式；CSS 编译仍不证明 native 输入或视觉通过。

运行前置与独立入口：

```sh
corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style

PUI_CHROME_EXECUTABLE="$CHROME_PATH" \
PUI_EVIDENCE_DIR=.tmp/sprint2-input-native \
node --import tsx scripts/analysis/sprint2-input-browser.mjs

PUI_CHROME_EXECUTABLE="$CHROME_PATH" \
PUI_EVIDENCE_DIR=.tmp/sprint2-form-select-native \
node --import tsx scripts/analysis/form-select-recipes-browser.mjs
```

原生 runner 需要正常构建的公共包、安装的真实框架依赖和根整合中集合路提供的 `collections-source-inventory.mjs`；本路没有复制该 inventory。诊断可用 `PUI_BROWSER_FAMILIES`、`PUI_BROWSER_RUNTIMES`、`PUI_BROWSER_KINDS` 缩小范围，诊断不能代替完整矩阵。`chromiumSandbox: true`，唯一保留的启动参数为 `--disable-dev-shm-usage`。输出保存源 hash、实际 native receipt、截图与逐 entry 终态。

### 已知 native 失败与当前未验

根执行者观察到其整合来源 `f5de205` 的 Base/WC 六例诊断：5 通过、1 失败。失败是 controlled OTP 的普通接受 owner 输入期望 `5678`、实际 `5786`，据根观察 `pageErrors=[]`。远端原 report 在 `/home/ezra/proto-ui-sprint2-20261122/evidence/native-r2/input-diagnostic/report.json`，截图名为 `base-wc-input-otp-controlled.png`。

**本路没有拿到、读取或 hash 那份原 report；根亦确认无本机 raw 副本。** 所以机器记录标为 parent-observed，而不是伪造本路持有的浏览器证据。这个失败引出的真实 caret 源反例已由 `b1033a4`/`14c47f2` 修复，当前 native 重验仍单独开放。

本机 Chromium socket EPERM，远端 Desktop Commander 随后明确月额度耗尽，未重试或重连。根另用已存在的 GitHub 托管队列承接最终矩阵。该运行未来应追加来源与实际终态，不应改写本记录初版的 pending。CDP composition/touch 即使通过，也不能记作物理 OS IME、真实硬件 touch 或辅助技术验收。

## 8. 提交索引与下一接受动作

| 原提交    | 交付                                                     |
| --------- | -------------------------------------------------------- |
| `e2ef558` | TextControl selection 与 OTP 实际活动槽                  |
| `bb1bb30` | selection-before-input 的候选保留                        |
| `8a4afae` | AxisInput authored origin lease                          |
| `91ec753` | Slider Values 输入、Field 与 Brutalist 投影              |
| `e63d469` | 72 条 OTP/Slider 原生 runner                             |
| `92dbc8a` | 依既有定义修正 Bootstrap invalid ink oracle              |
| `dcf20f5` | Slider interrupted owner、latest batch 与 OTP Field 报告 |
| `6efeb9d` | Web TextControl 非空 read 类型                           |
| `3bf60f1` | 普通 controlled Field 报告、Textarea、嵌套 Form 公共配方 |
| `b1033a4` | edit callback 中保留物理候选与 caret                     |
| `14c47f2` | canonical owner 变更退休候选窗口                         |
| `3d5e556` | Field reset/edit 回调重入退休                            |
| `abbc6a8` | 公开 Select 与 Form/Select 24 条原生入口                 |
| `e16e820` | 显式 FieldCheckbox/FieldRadioGroup 及七控件适用边界      |
| `ebbfc57` | Switch reset 与独立复审 001–003                          |
| `3693622` | 独立复审 004 focused 通知重入                            |
| `42ee3b9` | 独立复审 005 reset 入口 lease                            |
| `095ecbd` | 公开 choices 12、原生合计 36、双语文档与真实 CSS 装配    |

根执行者下一步应在最终整合源码完成已排队的严格检查和逐场景原生回读，失败按其定义与责任层继续修复；随后把已完成的开发子条件与仍未满足的 release/AT/跨平台条件分别回填。源码与原公开配方的开发工作已可审查，原历史证据、完整发布接受和父追踪不由这个记录提前宣告完成。
