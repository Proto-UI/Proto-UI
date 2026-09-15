# Root style application-role classifier 第一阶段实施记录

日期：2026-09-12。状态：implementation checkpoint，non-normative。本文记录 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` 首个无集成切片的实际实现与 inventory 结果；稳定语义仍由 spec entity 及其 lifecycle 决定。

## 本次边界

本次只增加 Core 内部的 `tw` token application-role classifier 与对应测试，不把 role 接入任何既有 style pipeline：

- 未修改公共 author syntax 或 `StyleHandle` shape；
- 未修改 token validation 与现有 `:` 禁令；
- 未修改 semantic merge、Rule/runtime patch 或 style export；
- 未修改 Web physical CSS、Web Component Adapter 或其他 Adapter projection；
- 未从 Core public barrel 导出 classifier。

实现与证据路径：

- `packages/core/src/spec/feedback/application-role.ts`
- `packages/core/test/feedback/application-role.test.ts`
- `spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml`
- `spec/tests/T-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml`

## 已实现 vocabulary 与 provenance

Classifier 返回原始 token、application role 与 role provenance：

```ts
{
  token: string;
  role: 'surface' | 'placement' | 'composite' | 'unresolved';
  roleSource: 'canonical' | 'fallback' | 'unresolved';
}
```

当前 rule order 为：

1. 已知歧义 exact token 与 family 返回 `unresolved`；
2. 已知 outer display 与 inner formatting 复合 token 返回 canonical `composite`；
3. 已知 external-layout family 返回 canonical `placement`；
4. 已知 appearance 与 internal-formatting family 返回 canonical `surface`；
5. 未识别 extension token 返回 `surface`，但 provenance 保持 `fallback`。

负值前缀只用于 canonical family 比较，返回值始终保留未经改写的原 token。Classifier 不解析 role qualifier；例如包含 `surface:` 的输入仍作为未知 token fallback，不意味着公共 grammar 已接受该语法。

## Prototype token inventory

本次复用现有 `collectProtoStyleTokens()`，扫描以下目录并合并去重：

- `packages/prototypes/base/src`
- `packages/prototypes/shadcn/src`
- `packages/prototypes/brutalist/src`

为避免把已经 lowered 的 selector/state variant 当作 application-role token，本次统计排除了所有包含 `:` 的 token。其余 267 个 token 的分类结果为：

| role         | token 数 |
| ------------ | -------: |
| `surface`    |      190 |
| `placement`  |       55 |
| `composite`  |        4 |
| `unresolved` |       18 |

当前 inventory 中没有走 `fallback` provenance 的 token。这只表示三套官方原型库的当前扫描闭合，不表示第三方 extension token 不需要 fallback。

18 个 unresolved token 为：

```text
-translate-x-1/2
-translate-x-px
-translate-y-1/2
-translate-y-px
hidden
overflow-auto
overflow-hidden
overflow-x-hidden
overflow-y-auto
pointer-events-none
relative
scale-[0.98]
translate-x-0
translate-x-5
translate-x-[calc(100%_-_2px)]
translate-x-px
translate-y-px
will-change-transform
```

`will-change-*` 与 transform family 一起保持 unresolved，因为它所预告的 physical effect 可能属于 surface animation，也可能属于 placement；不能独立于对应 transform role 进行稳定分流。

## Inventory 限制

`collectProtoStyleTokens()` 面向样式产物闭包，会收集 Root `feedback.style`、Template node style、Rule intent 及可静态解析的共享 token。它目前不保留“这个 token 来自 Root 还是 Template node”的 provenance。因此上述 267 个 token 是第一阶段 Root role 审计的保守上界，不是经过证明的 Root-only inventory。

这个限制不影响 classifier-only 切片的兼容性，因为 classifier 尚未进入任何运行路径；但在 role-aware merge 或 Adapter translation 前，必须建立 Root-only provenance 或等价的可执行证据，避免用 Template token 的存在错误扩大 Root projection 语义。

## 下一阶段门槛

在实现 stable inner surface 或 Shadow-local style delivery 前，仍需至少完成：

1. 把 Root-only token 来源与 Template node style 分开编目；
2. 逐组裁定 18 个 unresolved token，或定义 split profile 的 fail-closed eligibility/diagnostic；
3. 决定 `placement` 是否继续属于 Root style IR，还是进入独立 channel、Module 或 Host Capability；
4. 定义 composite display 与 geometry 在 collapsed/split target 之间的等价 translation；
5. 为 stable owner shell、render surface、stylesheet lifetime 与 reveal barrier 建立独立 Adapter spec/test slice。

在这些门槛前，本次 classifier 只作为 vocabulary 与 inventory 工具，不应被解释为 Shadow DOM Adapter 已具备 style 分流能力。
