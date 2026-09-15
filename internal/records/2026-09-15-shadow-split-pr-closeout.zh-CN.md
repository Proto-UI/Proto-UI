# Shadow split：PR 收尾清单与集成记录

## 授权与范围

用户已确认 S5 人工验收完成，并批准将 spec 增量补齐纳入收尾，完成后提交 PR。此次不新增 S6 功能目标，不提升 draft，不 merge 或发布。验收事实见 [S5 完成记录](./2026-09-15-shadow-s5-manual-acceptance-and-closeout.zh-CN.md)。

原开发分支 `codex/shadow-dom-style-role-record` 保留 75 个阶段提交，最后一个为 `f26ad152`。PR 在独立工作树的 `codex/shadow-split-pr` 上，以核对时最新 main `8f2eba12` 集成原分支；原工作区的无关暂存/未提交内容不带入。原始提交历史不改写。PR 的签署提交是新的集成单元，不冒充已经合入或发布。

## 清单

- [x] 核对主线、分支范围与已有 PR；创建独立集成工作树。
- [x] 调和 5 处主线冲突，保留双方已有语义。
- [x] 明确 WC Adapter 的 Light / direct / split 范围；不重复主线已有 Text Control M/HC 关系。
- [x] 补接 S5 public-dist、S4 closed-paint 和公共 Event router 回归证据。
- [x] 为新增 draft 实体补生命周期理由；严格 CSP 为当前范围外问题，不提升为本次交付前置。
- [x] 整理 README 为当前能力与限制，并标记旧 host-style/full-rebuild contract 的历史适用范围。
- [ ] 完成干净集成检出的类型、spec、构建及相关浏览器回归。
- [ ] 完成独立审阅、记录实际验证与剩余限制。
- [ ] 核对提交、来源披露与 DCO，push 并创建 PR。

## 主线调和

1. WC 模块接线：保留主线 shared modal lock 和 owner document，同时保留 split Portal origin lifetime。Focus entry 保留 composed-tree sampler 与动态可聚焦性观察，补入主线对 hidden input / unassociated area 的排除；没有扩展 scope policy。
2. CLI：保留主线 explicit leading 的 cascade priority，同时保留 Shadow renderer 和同源 recipe。
3. Context：保留 main 对 opaque token 的 null 边界与 SameValueZero 身份语义，同时保留 J1 provider-generation/key 串行重入投递；捕获和投递重查两处均处理 NaN。
4. Rule state lowering：保留 main 的 selector contribution 撤销/重建与 eligibility guard，同时用 role-bearing lowering 保留 provenance。旧测试读取重挂载后的第一个清理 effect 不再成立，改验最终完整投射；并非删除 cleanup。
5. Overlay Test entity：同时保留主线 Module criterion 与 split lifecycle/Adapter anchors。

首轮 focused test 为 77 通过、1 失败（上述旧 effect 顺序假设）；调和后 9 文件 / 79 项通过。43 个公开包构建通过。Spec authoring 首次要求新增 draft rationale 和 canonical blocker 分类；补齐后 authoring 通过，spec fixtures/graph 23 文件 / 150 项通过。以上不是最终全仓验证结论，后续结果追加到本记录。

## 不变的限制

本次没有修复独立 Dialog 快速重开问题 #645，没有扩大任意 CSS / Portal / 原型准入，也不从用户总体验收推断 Safari、Firefox 或真实系统 IME 完整矩阵。性能脚本仍是工程采样，不新增规范性帧预算。

## 独立检查与修复

本地独立检查分别覆盖 spec/文档、Context/Rule 调和和高风险 Runtime/WC 路径。这是提交 PR 前的局部检查，不是 GitHub approval 或完整独立验收。

- CLI README 仍有 F1 阶段“不公开启用”的过时陈述：改为当前显式 object profile 的使用方式；历史 F1 Record 保持阶段事实。
- SHADOW-R1：首次 `onCreated` 设为 absent 时，原生 editor 被提前挂载；在另一个 open ShadowRoot 内，document 隐藏规则无法遮蔽它。改为首次 view commit 才取得 editor attachment lease。Input/textarea 单测与 Chrome 初始不存在→显示→聚焦路径通过，独立 Chrome 另验 hide/remount、value/defaultValue 和 listener 撤销。
- SHADOW-R2：全局排序 flattened targets 会把内层正 tabindex 提前到外层 scope。改为 host/slot scope 内排序后展开；显式负 tabindex host 排除子 scope，非可聚焦且不 delegatesFocus 的 host 不凭正 tabindex 提升优先级。Chrome 原生 Tab/Shift+Tab 为参照，覆盖 slot、正/负 host index、display:contents、隐藏 host/可见子节点，并实际验证 descendant entry 与 trap/loop。
- SHADOW-R3：`onCreated` 抛错时 session 尚未返回，Adapter owner 无法清理已调度的 delay。这是主线已存在的 Runtime 缺口。Runtime 在 post-setup creation 失败时执行 terminal disposal，并保持原始异常；测试验证 canceled scheduler callback 即使被强制调用也无效、旧 handle 失效及每代 cleanup 一次。没有宣称任意更早 setup/onRuntimeReady 异常均已纳入本次修复。

R1/R2 新测试修复前 3 失败；R3 两个 cleanup 分支修复前均失败。修复后 Adapter/Runtime focused 4 文件 / 38 项通过，新增 Chrome 3 路径通过。R2 非可聚焦 host 补充路径也先失败再修复。T 映射接到已有 draft criteria，不修改规范来迁就实现。

## 体积预算

保持 esbuild 0.25.12、ES2020、minify/tree-shaking、external 设置与 gzip level 9 不变：main `8f2eba12` 的 WC root 为 74,834 bytes；首个集成提交 `685ebfe1` 为 82,826；边界修复后为 82,998。仅 WC 门槛由 76,000 调整至 84,000，余量 1,002 bytes，其余 8 项不变并通过。

独立 metafile 核对：首个集成相对 main 增加的 24,839 minified bytes，主要来自 WC Shadow/Portal/focus 17,885、Core role 3,160、Event routing 2,235、Context 874、shared Focus 656；余 29 是其它输出差异。这些不是可相加的 gzip 分项。新增 13 个 WC 和 2 个 Core 输入，没有重复 Runtime、source/dist 双份、CLI/compiler、生成式 stylesheet payload 或额外 prototype family。选择同一个运行时 Adapter 的结果是其 whole-entry 包含可选 split 实现；此次不为压缩数字改变已批准的公开入口。

遵循 [Overlay 预算调整先例](./2026-09-10-overlay-catalog-package-budget.zh-CN.md)，这是本功能范围的实测增量，不是自动允许未来增长。CI 压缩结果需要另行复核，不以本地数值冒充 CI。

## 验证过程中的非语义失败

- 初次整仓回归的 Feedback exact internal-handle 断言与 native focus 接线问题已调和；最终检查仍保留 public token-only 输出与 cleanup/stale 条件。
- S3 历史诊断 fixture 的旧 `def.a11y` 改用 main 已迁移的 `asAccessible()`。
- 大型 squash 内容尚未提交时，Agent tooling 的同步 `git diff --binary HEAD` 超出缓冲；提交干净集成单元后 58 项检查通过，没有借本功能修改 unrelated tooling buffer。
- 后续并行 build 与 CLI 测试出现一次 init 非零退出；冻结 dist 后相同用例通过。新 Chrome 文件未入 index 时 spec evidence 路径检查不认识它；纳入追踪后通过。后续最终回归顺序执行 build 与依赖其产物的测试，避免互相覆盖。
