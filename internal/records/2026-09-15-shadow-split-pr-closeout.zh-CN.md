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
