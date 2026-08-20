---
title: 'Adapter 贡献指南暂缓发布'
description: '当前已有的证据、可以推进的有界 Adapter 工作，以及为何仍不发布通用作者流程。'
---

Proto UI 当前不发布通用 Adapter authoring tutorial。0.2 已交付执行架构与第一批 reviewed profile slice 现在已有文档，但 catalog 有意保持 partial，并不存在可以让贡献者通过类比新增 Adapter 的稳定 public SPI。

请先阅读聚焦的架构指南：

- [Runtime 架构](/zh-cn/build/runtime-architecture/)解释 `RuntimeSession`、commit ownership 与 host handoff。
- [Host Caps](/zh-cn/build/host-caps/)解释 capability token、wiring、target projection 与 resource lifetime。
- [模块与扩展架构](/zh-cn/build/module-extension-architecture/)解释 facade/port/dependency ownership 与固定 Runtime Module set。
- [兼容性](/zh-cn/reference/compatibility/)只报告 Web Component、React 与 Vue official profile 当前已经审计的 relation。

这些页面描述当前事实，但合在一起仍不能定义完整的新 Adapter recipe。

## 为什么通用流程仍然暂缓

Official Adapter profile 按 Module slice 逐步编目。未列出的 Module 属于 uncataloged，不代表支持或不支持。Lifecycle ownership、capability omission strategy、host target role 与 executable conformance 都必须针对具体 target 决定。现有 Web implementation 是证据，但 Web-specific routing 与 framework mechanics 不能自行定义 cross-host architecture。

因此本文不会：

- 把当前 Web Adapter structure 描述成稳定 cross-host SPI；
- 从 package dependency 推断完整 Module support；
- 把 uncataloged fallback 或 host wiring 当作保证；
- 承诺 dynamic Runtime Module registration；
- 鼓励通过 Prototype-specific patch 修补 Adapter parity。

## 可以推进的有界工作

有经验的贡献者可以在 Issue 已经写清以下内容时实现 Adapter parity bug：

- 适用的 `C-*`、`M-*`、`HC-*`、`A-*` 与 `T-*` 实体；
- semantic 或 translation owning layer；
- profile 与 target runtime/version range；
- 跨 Adapter 不得改变的行为；
- focused Runtime/Module 与 Adapter evidence；
- 明确的 implementation authorization。

新 Adapter proposal 仍属于 maintainer-guided research。有效 proposal 可以整理 host capability inventory、诚实的 support/omission decision、lifecycle/target ownership 与最小 feasibility evidence，但不会自动授权 production Adapter PR。

## 什么会解锁完整指南

一个可信 exemplar 至少需要：

1. 一组完整的 Module facade/port 与 Host Capability owner；
2. reviewed profile `supports`、`omits`、`provides` relation；
3. 可执行的 attach/rebind/reset/dispose responsibility；
4. 已解决或明确记录的 implementation/catalog drift；
5. target-specific commit、event、projection 与 diagnostics behavior；
6. 能区分 portable semantics 与 host mechanics 的 conformance evidence。

在此之前，请通过[参与贡献](/zh-cn/build/contribute/)选择 Prototype、docs、demo、Module slice 或 bounded bug，并用[契约与测试](/zh-cn/build/contracts-and-tests/)设计 evidence。
