# 2026-07-20 CLI 精确 release train 安装记录

> Internal record. Not normative. 本文记录 `v0.2.0-rc.0` 发布准备中发现的 CLI 版本串线风险，以及本轮采用的安装与 Quick Start 边界。正式版本规则以 `D-GLOBAL-RELEASE-VERSION-0001` 和 release governance 文档为准。

## 1）发现

Prototype family subpath 合入后，当前 CLI 会生成 `@proto.ui/prototypes-base/button` 等新入口。但 `proto-ui add` 过去只把裸 package name 交给 npm、pnpm 或 Yarn，例如 `@proto.ui/prototypes-base`。

`v0.2.0-rc.0` 使用 `next` dist-tag，而历史 `0.1.x` 仍位于 `latest`。因此用户即使通过 `npx @proto.ui/cli@next` 启动当前 CLI，后续裸安装也会重新解析到旧 Adapter 或 Prototype package，形成“当前 CLI + 历史 package”的跨 release train 组合。旧 package 没有 family subpath export，最终会在真实项目构建或运行时失败。

#307 的 CI 修复已经让隔离 smoke 使用当前 tarball 闭包，但 `--no-install` 只解决了测试环境，不能替代真实 CLI 的安装语义。

## 2）决策

- CLI 读取自身 package manifest 中的精确 version。
- CLI 安装官方 `@proto.ui/*` 依赖时，把每个 package spec 写为 `name@<cli-exact-version>`。
- npm 与 pnpm 使用 `--save-exact`，Yarn 使用 `--exact`，避免 consumer manifest 再把精确安装扩张为 semver range。
- `--no-install` 输出同样的精确命令，使人工安装不会重新落回 `latest`。
- 官网主 Quick Start 永久跟随 `latest`，不会在 RC 阶段切换为 `@next`。
- 独立的 RC Trial 页面固定使用 `@proto.ui/cli@0.2.0-rc.0`，使人工试用记录可复现；`@next` 只保留为便利 channel。

## 3）文档校正

审计原 Quick Start 时同时发现示例使用了 `Button`、`Toggle`、`DialogRoot` 与 `ButtonElement`，但 CLI 的实际 Shadcn facade 导出带有 `Shadcn` 前缀。本轮将完整上手流程迁入 RC Trial，并把示例改为 `ShadcnButton`、`ShadcnToggle`、`ShadcnDialogRoot` 与 `ShadcnButtonElement`，使试用文档与当前 codegen 一致。主 Quick Start 在 `0.2.0` stable 发布前只声明稳定入口与 RC 引导，不让旧 `latest` 执行新 codegen 文档。

## 4）验证边界

本轮验证应覆盖：

- 三种 package manager 的 exact install command；
- official package spec 与 CLI package version 精确一致；
- `--no-install` 输出精确版本提示；
- CLI build 与既有 CLI tests；
- 中英文稳定 Quick Start 与 RC Trial build；
- 当前 tarball consumer smoke 继续通过。

## 5）后续

完成该阻塞点后，阶段 A 的下一项是形成 `v0.2.0-rc.0` release note 与 package BOM，并进行一次不发布的完整 release rehearsal。真实 npm 发布仍必须从 `main` 手工触发受保护 workflow。
