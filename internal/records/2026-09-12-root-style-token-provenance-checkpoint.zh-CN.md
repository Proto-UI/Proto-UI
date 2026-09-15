# Root style token provenance checkpoint

日期：2026-09-12。状态：implementation checkpoint，non-normative。本文记录 `collectProtoRootStyleTokens()` 建立后对第一阶段 application-role inventory 的复核结果，不改变 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` 的 draft lifecycle 或任何 Adapter guarantee。

## 改动

`packages/cli/src/services/prototype-style-tokens.ts` 新增只读分析入口 `collectProtoRootStyleTokens(root)`：

- 只收集位于 `feedback.style.use(...)` 调用中的 author-side `tw` token；
- 同时覆盖 setup 与 Rule intent；
- 复用现有静态字符串、template literal、imported constant 与条件值解析；
- 不收集 Template node 的 `style`；
- 不生成 Rule Web selector variant；
- 不替代或改变 `collectProtoStyleTokens()` 的完整 physical CSS closure 行为。

对应测试用同一个 Prototype 同时声明 Root setup style、Rule intent style 与 Template node style，证明 Root collector 只返回前两类，而原 closure collector 继续包含 Template token。

## Root-only inventory 结果

扫描范围保持为：

- `packages/prototypes/base/src`
- `packages/prototypes/shadcn/src`
- `packages/prototypes/brutalist/src`

三套库的 Root-only token union 仍为 267 个：

| role         | token 数 |
| ------------ | -------: |
| `surface`    |      190 |
| `placement`  |       55 |
| `composite`  |        4 |
| `unresolved` |       18 |

没有 token 进入 unknown-token `surface` fallback。

该结果与此前完整 closure 排除 `:` variant 后的统计相同。原因不是 Root collector 混入了 Template style，而是当前四处直接 Template style 使用的 token，也至少在另一处 Root `feedback.style` 中出现。因此 union 数量未下降，但 provenance 结论得到加强：当前 18 个 unresolved token 都确实存在于 Root style，不是 Template-only 噪声。

18 个 Root unresolved token 仍为：

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

## 边界与后续用途

当前入口提供 token 集合级 provenance，不提供逐 token 的 source file、Prototype identity 或 call-site record。它要求 `tw(...)` 出现在 `feedback.style.use(...)` 的调用子树内；如果未来作者先构造完整 `StyleHandle`、再仅以 identifier 传入 `.use(...)`，还需要增加 handle-level data flow。当前三套官方原型库没有这种 Root authoring pattern。

下一步需要建立 unresolved token 的 Prototype/call-site usage matrix。只有知道 transform、visibility、overflow、pointer participation 与 containing-block intent 分别出现在哪些 Prototype 和 Rule 中，才能判断：

1. 哪些 family 能获得 canonical role；
2. 哪些 family 需要显式 role；
3. 哪些行为已经由 positioning、visibility、scroll 或 event domain 拥有；
4. Shadow split profile 是否需要先以 eligibility diagnostic fail closed。

在该 usage matrix 形成前，不应把这 18 个 token 自动投射到 host 或 inner surface。
