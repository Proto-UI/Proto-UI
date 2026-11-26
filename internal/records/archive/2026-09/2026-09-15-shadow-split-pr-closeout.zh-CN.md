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
- [x] 完成干净集成检出的类型、spec、构建及相关浏览器回归。
- [x] 完成本地独立 scoped 检查、记录实际验证与剩余限制。
- [x] 核对提交、来源披露与 DCO，准备获准提交的 PR 材料。

本清单关闭于 PR 提交前；实际 push/PR 收据、CI 和独立合并审阅以平台记录为准，不以本地检查冒充已经合入或发布。

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
- S3 历史诊断 fixture 的旧 `def.a11y` 改用 main 已迁移的 `asAccessible()`。Standalone runner 还需要从 Base 已声明的依赖解析 hooks public export，不能假定 apps-www 有直接 hooks 依赖；补充 hooks/dist 与无 package source 输入断言后，独立准入及 hiding-axis 路径通过。
- 大型 squash 内容尚未提交时，Agent tooling 的同步 `git diff --binary HEAD` 超出缓冲；提交干净集成单元后 58 项检查通过，没有借本功能修改 unrelated tooling buffer。
- 并行 build 与 CLI 测试时观察到一次 init 非零退出；冻结 dist 后相同用例通过，没有将该观察升级为已证明的产品根因。CLI 测试自身也会重建 dist，与 workspace typecheck 并行时出现过 TS6053（dist 声明在枚举后消失）。最终按 build→unit→types/docs→browser 顺序通过。新 Chrome 文件未入 index 时 spec evidence 路径检查不认识它；纳入追踪后通过。

## 最终验证结果

运行环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。运行时代码冻结于 `d711a8aa`；之后仅有 S3 diagnostic public-export 解析和本收尾记录变更。

| 检查 | 实际结果 |
| --- | --- |
| `vitest run --exclude '**/*.browser.test.ts' --pool=forks --maxWorkers=4 --minWorkers=1` | 最终 501 文件、2,505 项通过；3 个 skipped 文件、34 个既有 TODO |
| Spec fixtures/graph | 初轮 23 文件 / 150 项通过；最终全部纳入上述 unit pass，包括新增 T 路径完整性 |
| `build:packages`；最终 WC dependency closure build | 43/43 public packages；最终 WC closure 35/43，含原生 ESM smoke |
| `check:types` | workspace 通过；216 Astro 文件 0 error/warning/hint |
| `docs:build` | 240 页通过，主题/token/Shadow companion 使用生成器刷新 |
| `spec:docs:agent` / `check:agent-doc` / `check:spec-authoring -- --base origin/main` | 615 entities 的忽略投影已更新；24 changed catalog inputs 通过 |
| `check:prototype-catalog` / `check:package-manifests` | 136 declaration files、135 P；43 public manifests 通过 |
| `check:package-budgets` | 9/9 通过；WC 82,998 / 84,000 gzip bytes |
| `check:agent-operations` | 最终 58 项通过 |
| release version/assets、style preset/variant order/component presets、type contracts | 全部通过；未执行 publish |
| public-doc tests / release tests | 16 / 52 项通过 |
| S4 detector + shutdown + runtime test plan Node tests | 8 项通过，含关闭 page/browser 的证据保存；最终 test plan 另复跑 3 项通过 |
| `prettier --check` / `git diff --check` | 通过 |

浏览器证据分两轮明确记录，而不是笼统声称全仓 browser matrix：

1. 干净集成后的 S1–S5 + Demo Matrix：7 文件 / 22 条路径全部通过。
2. R1–R3 修复后，新增边界 + 受影响 S3/S4/S4-paint/S5：5 文件 / 12 条路径全部通过。S3 覆盖双语、Light/split/mixed 与两种 keepMounted；S4 保留完整 Dialog 交互与 sampled closed-paint；S5 覆盖双语原生编辑场景。
3. 最终 `node scripts/analysis/shadow-s3-admission-browser.mjs` 和 `node scripts/analysis/shadow-s5-public-browser.mjs` 均通过。前者包含 14 组 admission 和 hiding-axis 诊断；后者断言 public-dist/CLI 生成输入并复用真实 Chrome native journey。
4. 高风险实现的独立检查关闭 SHADOW-R1/R2/R3；最后另外执行的 5 个 Chrome probes 验证非可聚焦 host 与 delegatesFocus 区别。Spec/docs 复核确认 draft/identity/criteria 未扩张；S3 diagnostic 的独立 bundle 检查有 304 inputs、0 package source inputs。

未在本地重跑所有既有网站浏览器 suites，因此不声称完整 `pnpm test` 已通过；未复验全部 Safari/Firefox、真实系统 IME、发布 tarball 全消费矩阵或 CI。以上局限不从 S1–S5 人工验收或 Chrome 的通过结果中推断消失。CI、spec 独立审阅和合并决定仍属于 PR 后续门禁。

## PR 收据与首轮 CI 跟进

[PR #652](https://github.com/Proto-UI/Proto-UI/pull/652) 已由授权的 `codex/shadow-split-pr` 提交至 main，初始 head `e77036c5`。DCO、docs preview、public package build、release-stage、React consumer 与 CLI smoke 在该 head 上通过；这些不是后续 head 的 CI 结论。

首轮 `type-check` 在干净检出出现两个 TS2307：S3/S4 fixture 引用的 ignored Shadow companion 尚未生成，而 `check:types` 先执行 workspace，再进入会生成产物的 docs check。本地先构建过，因而没有捕获此前置顺序问题。

把集成工作树中对应的 JS 与声明文件临时移到可恢复备份后，原 workspace 检查重现同样两个 TS2307。随后仅在顶层 `check:types` 前显式调用既有 `apps-www generate:proto-ui-style`；生成器重建真实 companion 后，完整 workspace + 216 Astro 文件类型检查通过。没有手写替代 artifact、放宽类型或改变 Runtime/spec 语义。此修正以签署提交追加到同一 PR；新 head 的 CI 仍需平台复核。
