# 2026-07-19 全局精确版本治理记录

> Internal record. Not normative. 本文记录 Proto UI 从历史上的 package 局部版本与 spec 编目版本，迁移到全局精确版本 release train 的原因、边界和首个落点。正式规则以 `D-GLOBAL-RELEASE-VERSION-0001`、V 实体和治理文档为准。

---

## 1）背景

在进入 0.2 收口阶段时，仓库同时存在三种没有可靠对应关系的版本事实：

- spec 实体的修订数字已经推进到 0.2.7；
- 根 `VERSION` 与多数 package manifest 仍是 0.1.0；
- npm 上公开 package 分布在 0.1.0、0.1.2 和 0.1.4，且部分公开 package 尚未发布。

这使“Proto UI 0.2”无法唯一回答代码、spec、package 组合与兼容基线分别是什么。尤其当 spec 后续提供 Prototype、Adapter 或其他实现的兼容性检测时，独立的 spec 版本时钟会把额外的映射成本转嫁给使用者和维护者。

## 2）问题

此前的治理倾向于保持 minor 一致、允许 package patch 自治，并允许发布时临时覆盖根版本或只发布单个 package。这种方式降低了局部修复的发包规模，却带来几个问题：

- 相同的“Proto UI 版本”不能唯一确定全部公开 package 的组合；
- spec revision 数字容易被误认为已经发生的产品 release；
- 局部 package 发布可能提前暴露尚未完成验证的跨包状态；
- launch package 产品分层被误用为 npm 发布子集；
- release tag、npm dist-tag、spec snapshot 与 package manifests 缺少同一个治理身份。

## 3）当前决定

从 `0.2.0-rc.0` 开始采用全局精确版本治理：

1. 全部公开 `@proto.ui/*` package 共享完全相同的版本，包括 patch 和 prerelease 后缀。
2. 公开 package 之间的已发布依赖使用精确版本，不使用可自动混合 patch 的范围。
3. package 局部修复进入下一次全局 release train，不再执行真实 `publish-single`。
4. apps、private spec implementation package 与 fixture 不属于全局 npm 发布集合。
5. launch commitment、public advanced、internal/dependency-directed 仍用于产品承诺、文档、smoke 和成熟度排序，但不再裁剪真实发布集合。

首个统一 release train 固定为：

- version：`0.2.0-rc.0`
- Git tag：`v0.2.0-rc.0`
- npm dist-tag：`next`

历史上局部最高的 `@proto.ui/cli@0.1.4` 只表示该 package 的旧发布状态，不构成一个完整的 `v0.1.4` 产品发行，因此不补造全局 tag。

## 4）V 实体

数字版本必须由 `V-*` 实体声明。V 实体提供 release 的规范身份，并至少固定 exact semver、Git tag、npm dist-tag、package policy 和 package scope。

- `draft` 表示 release train 已经进入仓库，但尚未完成真实发布。
- `active` 表示 npm package、Git tag 与 spec snapshot 均已有可验证证据。

根 `VERSION`、公开 package manifests 和 workspace 版本列表是 V 实体的投射。普通实体的 `since`、`until`、deprecation 和 revision version 只能引用已经声明的 release identity，不能自行推进一套 spec 时钟。

## 5）0.2 修订数字迁移

仓库在真实 0.2 release 发生前使用过 0.2.0 到 0.2.7 作为 authoring revision marker。这些数字描述编目工作的先后，不是八次已经发布的产品版本。

本轮把结构化版本字段中的这些未发布 marker 收敛到 `0.2.0-rc.0`。历史 record 中对当时观察到的“0.2.7”仍可保留，因为 record 负责如实记录发生过什么；它不再成为 workspace 可选择的 release version。

## 6）流水线边界

版本治理检查必须验证：

- 根 `VERSION`、全部公开 package 与当前 V 实体精确一致；
- 当前版本有且只有一个 V 实体；
- 0.2 起的新版本引用均能解析到 V 实体；
- launch governance 的 release line 没有漂移。

真实发布只允许从 `main` 使用 workspace profile 运行，并一次处理全部公开 package。工作流不接受临时 version、tag 或 only 参数。prerelease 自动使用 `next`，stable 自动使用 `latest`；只有全部 package 发布完成后才可以创建 `v<version>` tag。

如果 npm 中途形成部分发布，不得宣称完成、提升 dist-tag 或激活 V 实体。恢复仍遍历完整 workspace release set；显式 recovery 模式只跳过 registry integrity 与当前 staged tarball 完全相同的已发布 package，并继续以同一精确版本补齐其余 package。任一 integrity 不一致都会中止流程，registry 状态必须留下记录。

## 7）兼容性边界

全局精确版本把“哪些 package 属于同一次发行”变成可机械验证的事实，但它不自动证明任意 Prototype 与 Adapter 完全兼容。

因此：

- exact version 是受支持组合的必要前提；
- conformance contract、test evidence 和 adapter support matrix 仍负责证明具体能力；
- 后续 V 实体可以汇总这些证据，但不能用“版本一样”替代兼容测试。

## 8）本轮范围与后续工作

本轮建立 `0.2.0-rc.0` 的 draft release identity、schema、CI 门禁、package 对齐、确定性 spec snapshot 与发布入口约束，并完成 37 个公开 package 的全量 build/npm dry-run。staged manifests 的 package version 与内部依赖均精确使用 `0.2.0-rc.0`。本轮不执行真实 npm publish，也不创建 Git tag。

发布前仍需完成：

- 建立 monorepo 外 consumer smoke；
- 让 Quick Start、官网状态与实际安装方式一致；
- 发布成功后核对自动生成的 GitHub release 与 snapshot 证据，并通过后续 PR 将 V 实体提升为 `active`。
