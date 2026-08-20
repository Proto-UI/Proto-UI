# 2026-08-02 Text Control 宿主边界与 #356 补充计划

> Internal record. Not normative. 本记录保存 PR #356 review 后的边界判断与后续切片；稳定语义以 `D-TEXT-CONTROL-PROJECTION-0001`、`C-TEXT-CONTROL-0001` 及其关系实体为准。

## 背景

PR #356 建立 typed static module declaration、Text Control module/host lease、Base Textarea、Brutalist Textarea，以及 Web Component、React、Vue 三 adapter 的完整 Web 垂直切片。贡献者证明了原生文字编辑不需要在完整 authored anatomy 与直接泄漏 native target 之间二选一：Proto UI 可以保留 logical editing protocol，同时由宿主持有复杂编辑引擎。

Review 同时发现，原始 declaration 直接写入 `{ namespace: 'web', localName: 'textarea' }`，把 Web materialization 放进了声称跨宿主的 prototype metadata。三个 adapter 仍共享同一个 Web DOM host，因此只能作为 cross-adapter Web profile 证据。

## 当前方向

- Prototype 静态声明 `plain-text`、`multiline`、`host-owned engine` 等 portable requirement。
- Web adapter 将当前 requirement 解析为一个 `HTMLTextAreaElement`；未来其它宿主选择自己的物理 editor。
- Text Control module 继续拥有 stable controlled/uncontrolled ownership、normalized events、callback sequencing 与 bounded lease。
- selection、cursor、composition、软件键盘、长按 edit menu、selection handles 与系统 copy/cut/paste 默认由宿主 editing session 持有。
- 当前阶段不公开完整 portable selection API，但普通 property patch 与未改变 value 的同步不得破坏 selection/cursor；controlled composition 期间的无关 patch 不得恢复旧 owner value。
- 不为长按交互建立 touch-only Textarea prototype。若未来需要定制 edit menu，应建立 optional host capability，并在不支持时保留系统默认行为。

## Prototype 边界

Base Textarea 是叶子级 multiline editing protocol。Value 与 Placeholder 是同一物理 editor 上的 state/projection，不因可以命名就机械成为 Anatomy part。Label、Description、Error、Clear、Reveal 等具有独立信息通路的结构应在后续 Text Field family 中审计。

`asTextareaRoot()` 在 setup 执行时已经晚于 adapter target selection，因此不能动态注入 static declaration。Authored asHook 改为公开冻结的 `modules` requirements，由 direct prototype 与 styled caller 在 definition 上显式复用；缺失 requirement 继续 fail fast。

## 本 PR 范围

- 修复现有 fake React textarea children 与 rc.7 README review comment。
- 将 Text Control declaration 与 spec 调整为宿主中立语义。
- 增加 selection/cursor preservation 与 controlled composition property-sync coverage。
- 建立 authored asHook static module requirement 的复用与 contract coverage。
- 保持 rc.7 验证表述为 Web host 上的 cross-adapter evidence。

## 后续切片

- 单行 Base Input 与 Enter/submit/input-purpose 语义。
- Text Field Root/Label/Control/Description/Error anatomy。
- Portable selection facts 与 requests。
- Optional edit-menu customization host capability。
- 至少一个非 Web host 或 host-neutral conformance harness，形成真正的 multi-host evidence。
