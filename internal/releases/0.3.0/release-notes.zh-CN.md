# Proto UI 0.3.0

> Draft release notes。本版本尚未发布；npm package、Git tag、GitHub release、dist-tag 与不可变 snapshot 证据仍属于独立发行步骤。

Proto UI 0.3.0 是 0.3 线的首个稳定版。全部 47 个公开 `@proto.ui/*` package 精确使用这一版本。Stable `0.2.0` 保留既有发行身份。

## 发布的原型范围

- 发布的原型表面限定为 Base、Shadcn、Brutalist 与 Lucide 中已经存在的家族，以及建立在其上的网站与 CLI 表面。Bootstrap 与 Liquid Glass 材料保留在 0.4 线作为 WIP / Exp，不属于本次发行身份。
- 每个已发布原型保持其当前生命周期状态。该发行身份治理 package manifest、发行物料与 catalog 引用，不把单个 catalog 实体提升为 stable admission。0.3.0 生命周期处置逐条记录每个 draft 实体，而不是做整体提升。
- 已发布原型维持当前生命周期状态；本次发行身份治理 package manifest、发行物料与 catalog 引用，并不把单个 catalog 实体提升为 stable admission。

## 相对 0.3.0-alpha.2 的变更清单

- 0.3.0-alpha.2 train 准备了 Control Label 定义与 compiler 修复候选，其 47 package 候选 BOM、本地化说明与 spec snapshot 保留为上一条 alpha 记录。
- 0.3.0 候选 BOM 列出同样的 47 个公开 package，全部为 `0.3.0`，且每一个都与当前公开 package manifest 一致。
- 0.3 线引入的四个 identity 仍缺少 registry bootstrap：`@proto.ui/module-axis-input`、`@proto.ui/module-native-link`、`@proto.ui/module-control-label` 与 `@proto.ui/module-table-structure`。registry 中不存在这四个名字的 npm package，因此每个 identity 仍需各自的 registry bootstrap 与受保护工作流配置才能发布。准备本版本不会创建这些 identity。
- Sprint 2、Sprint 7 与 release-convergence 集成列车已在本次准备之前合入 `main`：CLI 覆盖门禁的跨文件 helper replay、compiler 发布取值重写与其合并后的 view-aware 数据边界、网站 source 归属与 wheel 证据修复，以及 Header scene 隔离与其 runtime 进程归属修复。

## 已知问题与验收状态

- CLI lowered-hook-coverage 门禁尚未全绿。合并后的跨文件 helper replay 把本地失败从 5 项降到 3 项；整树门禁用例与两个 helper 参数用例仍未关闭，作为 0.3 验收欠账继续跟踪。
- 2026-11-24 08:00 UTC 时段的主线 regression cycle 在 coverage-governance reconcile、type-check、compiler GPUI consumer、compiler library inventory、whole-entry package budget、general 与 governance test、若干 browser 分片和两个 representative-features 套件上因既有欠账失败。合并后 main tip 上的 cycle 才是当前权威红灯图；红灯 cycle 不阻止已评审切片的合并，但阻止稳定发布。
- 覆盖率矩阵与 GitHub governance snapshot 由本次准备重绑定到当前 main 候选修订；它们仍是非规范清单，不能单独作为发行验收证据引用。
- 同一批 cycle 中观察到的 Bootstrap 与 Liquid Glass 失败对本版本是 scope-out，不是 0.3 家族的回归。

## 版本与生命周期

公开 package 集合保持全局精确。`@proto.ui/compiler` 仍为私有工具，不进入发行 BOM。0.3.0 生命周期处置记录本版本的每个已知 draft：已评审的 0.3 家族保留为 draft 并点名其未决 activation 证据，0.4 家族带有明确的顺延处置。

8 个 Compiler 契约和 7 个相关测试的处置为 `not-applicable`。目录记录了它们自 0.4.0 起移除，仍保留其 0.3.0 条目。这些条目在 0.3.0 的历史稳定性未知。

## 发布状态

本次准备不发布 package、不创建 `v0.3.0`、不移动 npm `latest` tag，也不激活 `V-PROTO-UI-0012`。package 内安装示例描述的是未发布候选；网站可用性表述继续跟随最后一次已验证的发布。发布需要四个缺失的 registry identity、覆盖最终已评审 package 集合的完整 rehearsal、来自 `main` 的受保护发布，以及独立的不可变证据评审。
