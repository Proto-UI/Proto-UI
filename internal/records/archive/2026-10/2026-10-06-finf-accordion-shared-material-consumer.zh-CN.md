# Accordion：显式共享材质 consumer 增量

本记录承接 `2026-10-06-finf-accordion-family-source-stage.zh-CN.md`，不改写原 source-stage 的历史状态。

## 精确依赖

- 原 Accordion source tree：`5ae22e28034217c51d4039478f4c7037a6cfc271`。
- 共享 material schema + Runtime/Rule 候选 tree：`46ddc3817e62b824224008019f4b3c90a0c06912`（含 f426e2a5 Runtime/schema 与共享 alignment 修复）；bounded source review 已执行，稳定/native 准入仍未完成。
- 两者无冲突组合的验证基线 tree：`f6d3f4c763745c425150c2f861b1f1df358f5527`，共同历史 base 为 `15d864de54210c2eebc4f4b2fec6235324989989`。
- 增量只包含 LiquidGlass Accordion Trigger、三项 Runtime 测试、对应双语文档及 spec/test mapping、本文；不包含另一份共享 kernel/transport 修改。

## 行为选择

只有 Trigger 交互表面声明 v2 `rounded-rect` / style geometry、`in-app-backdrop` slot，以及 style-resolved fill/foreground fallback。两个互斥 Rule 消费 Base 自己的 pressed=false/true，提交一个 `liquid-glass` 候选的 rest/pressed deformation；不在下面叠 static material，不根据名字推断 button profile，不暴露底层 optical model 参数。

Item、Heading、Content 等继续保持 opaque/readable presentation。没有把每个 atom 都变成叠层光学表面。宿主缺少共享 visual sink 时保留 `bg-background` / `text-foreground` fallback 与 `material-host-unavailable` 诊断；不会用 `adaptive-blur` 静默替换显式 LiquidGlass。

## 实测与限制

- 三项真实五-part Runtime fixture 通过：rest/press/release/disabled 的唯一候选；missing-host 诊断与 opaque style；detach/remount 的新 view epoch、pressed reset 与 terminal release。
- 与 Base25、四 Web Adapter80、Compiler9、共享 Runtime9 合跑，初次126/126通过；随后真实 frame 的更强 alignment 断言在旧 f426 上揭示 text-start 被当作 text color 丢弃。共享 owner 修复后，保留 alignment + foreground 双强断言，再连 Core21 回归共147/147通过。
- `check:spec-authoring --base 15d864de...`：含共享候选在内31个changed inputs通过。
- workspace types 无本增量新增错误；仅共同 frozen base 的 Focus center.test.ts 184/209 reason推断错误仍在。
- 初次 fixture 因未提供 asTrigger capability 被正确拒绝；补齐正常 hostcaps 后执行。初始material frame可暂为空，测试断言全程最多一个候选与settled状态精确匹配，不伪造初始paint承诺。

以上是可执行 author/Rule/Runtime consumer 证据，不是 Web optical self-renderer、native input、实际截图、OS accessibility 或 GPUI paint 的证明。host provider实现、精确集成head CI以及既有25个原生旅程和真图仍未完成；不得勾完整 family。
