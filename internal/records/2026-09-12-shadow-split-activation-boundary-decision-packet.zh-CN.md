# Shadow split profile 激活边界决策包

日期：2026-09-12。状态：maintainer decision packet，non-normative。本文承接 `D-WEB-COMPONENT-SHADOW-PROFILE-0001` 的 A1 与 `D-WEB-COMPONENT-SHADOW-STYLE-0001` 的 B1，判断下一步应先建立 private integration seam，还是直接进入 public split object 与 Root role routing。本文不修改公共 API、不提升 draft lifecycle，也不批准 push、merge、publish 或 release。

## B1 已完成结果

本轮新增六个独立 checkpoint：

1. `b26c34e9`：新增 draft Shadow style decision/test entity，固定 v1 artifact 与 `host-color-scheme-v1`；
2. `416a8ae2`：CLI 增加 target-aware Shadow CSS renderer 与 frozen artifact builder；
3. `798df88c`：Web Component Adapter 增加 private subscribable color-scheme source 与 host marker owner；
4. `91137e9c`：Adapter 增加 exact artifact validator 与 owner stylesheet installation；
5. `bb3b6cf9`：补齐 boolean profile 与 package-root public surface 的非干扰证据；
6. `5e5607b9`：把 `T-WEB-COMPONENT-SHADOW-STYLE-0001` 与 passing/planned evidence 对齐。

连同 A1 的既有基础，当前已有但尚未连接到 public Adapter 的 private building blocks：

```text
ShadowOwnerShell
  ├─ ShadowStylesheetOwner
  ├─ ShadowInnerSurface
  ├─ ShadowColorSchemeEnvironmentOwner
  └─ ShadowStyleArtifactOwner

CLI token closure
  → renderProtoShadowStyleArtifact()
    → { kind, version, cssText, environment } frozen value
      → validateShadowStyleArtifact()
        → owner-lifetime <style>
```

CLI 与 Web Component 联合测试曾完整通过 72 files / 439 tests；加入最终 boolean non-interference assertion 后，Web Component suite 单独通过 66 files / 233 tests。`check:types:workspace`、两个 public package build、spec relation/evidence checks、projection、Agent snapshot check 与 prototype catalog check 均通过。尚未运行真实浏览器 computed-style/CSP 测试，也未运行整个 repository 的总测试命令。

## 当前可证事实

### 1. B1 artifact 仍没有 consumer delivery path

`packages/cli/src/services/proto-style-css.ts` 能构造 frozen v1 artifact，但 package root、CLI command 与 preset file output 均未暴露它。现有 style setup 只写 document token CSS、theme CSS 与 import entry。因而当前不能要求 consumer 在 `AdaptToWebComponent` 配置中传入一个由官方工具稳定生成和导入的 artifact。

这不是 validator 缺陷，而是 bundler contract 尚未建立。可能的未来交付包括 generated ESM module、JSON artifact、JS builder export 或 framework/facade 注入；它们在 module format、tree-shaking、escaping、cache key、SSR 与 consumer ergonomics 上不同，不能由 private service filename 偶然决定。

### 2. `getMeta` 与 environment source 还没有组合规则

`AdaptToWebComponent` 当前在 factory scope 选择：

```ts
const getMeta = opt.getMeta ?? createDefaultMetaGetter();
```

该 callback 同时传入 owner modules 与 repeatable view modules。它是 pull-only replacement，而不是按 key 与 default getter merge。B1 private environment owner 则保留一个 subscribable source，并同步维护 host marker。

Public split profile 若同时接受既有 `getMeta` 和新的 color-scheme source，必须决定 `colorScheme` 的唯一 owner。把 `getMeta('colorScheme')` 与 source 都保留会产生两份 truth；从 pull callback 推导订阅又不可行。

### 3. 同步首次提交不需要天然等待异步 artifact

B1 artifact 是调用方已持有的 immutable value，source 具有同步 `get()`。因此 marker、stylesheet 与 inner surface 可以在 first `connectedCallback` 的 runtime/view 初始化之前同步建立。只要首个 public profile 不接受 Promise、lazy loader 或 runtime CSS generation，就没有证据要求新增异步 reveal barrier。

这仍需要 ordering 与 rollback evidence：invalid artifact、invalid source 或 subscription failure 必须在 view attach 前失败，并撤销已创建的 owner resources；不能留下半初始化 marker、style 或 surface。

### 4. Owner lifetime 可以复用现有 Custom Element generation，但尚未接线

现有 `createViewEpochOwner()` 区分 repeatable view detach 与 terminal owner disposal；同步 DOM move 在 microtask 确认前不会终止 instance。B1 resources 应属于同一个 Custom Element generation：

- first connection 前、view attach 前同步建立；
- view not-present、repeatable remount 与同步 DOM move 时保留；
- terminal runtime unmount 完成后反向 dispose；
- terminal reconnect 创建新 generation 与新 subscription；
- 初始化中途失败时立即 rollback。

当前 `_invokeUnmounted` 只调用 runtime owner 的 `dispose()`，尚未组合 B1 resource cleanup。直接把 resources 放进 constructor 会让从未连接的 element 持有 document/media subscription，因此不推荐。

### 5. Root routing 仍然阻止 public split activation

当前 Root `feedback.style` applier 指向 host，或 text/image 的既有 physical surface。Stable inner surface 尚未进入 `HostSurfaceProjection` 或 `commitWebComponentChildren()`。

已编目的 267 个 Root token 中：

- 190 个 canonical surface；
- 55 个 canonical placement；
- 4 个 composite；
- 18 个 unresolved，并对应 99 个真实 Root call site。

若全部移到 inner surface，placement intent 会失去外部布局作用；若全部留在 host，internal visual style 仍得不到 Shadow isolation；若 Adapter 自行猜测 composite/unresolved target，则违反 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001`。因此 public split profile 不能只靠 B1 artifact 与 inner surface 直接激活。

### 6. CSP 与真实浏览器 paint 仍是明确缺口

当前 physical carrier 是 `<style>.textContent`。严格 `style-src` 是否需要 nonce、constructable stylesheet 在目标浏览器与 CSP policy 下是否可用、nonce 是 Adapter option 还是 host integration input，均未治理。B1 tests 运行于 jsdom，只验证 DOM、selector text、resource lifetime 与类型，不证明 computed style、FOUC、CSP 或跨 realm 行为。

## 决策 C：下一步激活边界

### C1. 先建立 private split-resource coordinator（推荐）

新增一个不从 package root 导出、也不接入 `WebComponentAdapterOptions` 的 coordinator，把已经验证的四项资源组合成一个可回滚的 owner：

```ts
type ShadowSplitResources = {
  surface: ShadowInnerSurface;
  getMeta(key: string): unknown;
  dispose(): void;
};

createShadowSplitResources({
  host,
  shell,
  artifact,
  colorSchemeSource,
  baseGetMeta,
});
```

该 slice 同时批准以下内部组合语义：

- `colorScheme` 是 split environment 的 reserved meta key；coordinator 对该 key 返回 retained source 的当前值；
- 既有 `getMeta` 继续处理其它 key，其 replacement/fallback 行为不因 split work 改写；
- 初始化顺序为 source validation/marker、artifact validation/stylesheet、inner surface，任一步失败都反向 rollback；
- resource creation 保持同步，首个测试 profile 不接受 Promise/lazy artifact，因此暂不增加 reveal barrier；
- dispose 反向、幂等，view epoch 不调用它；
- coordinator tests 使用直接 artifact value，不建立 CLI/public delivery name；
- `<style>` 继续作为内部 carrier，不在该 slice 声称 strict-CSP support。

优点：先把最容易产生 lifecycle leak、双 truth 与半初始化状态的组合边界做成可执行事实；以后 public object normalization 只连接一个 owner，而不是在 `adapt.ts` 同时拼装四个 helper。它不迫使现在选择 bundler format、nonce API 或 unresolved Root token policy。

缺点：新增一个暂时只由测试调用的 private seam；在 public profile 获批前，它仍不是用户可用能力。为避免成为永久 dead abstraction，应在 packet 中明确后续 admission gate，并在 public 方向放弃时删除它。

### C2. 直接设计并激活 public split object

一次性决定：

- `shadow` object 的最终字段名；
- artifact package/export/file format 与 CLI output；
- explicit source 与 `getMeta` coexistence；
- CSP nonce/carrier policy；
- first reveal；
- Root surface/placement/composite/unresolved routing；
- Template commit、slot、native text/image、focus、event 与 a11y 的 split behavior。

优点：可以更快得到真实 consumer integration。缺点：把尚未独立验证的 delivery、style IR 与 host lifecycle 绑定成一个公开 API；任何一项不成熟都会迫使 object shape 或 compatibility policy返工。当前不推荐。

### C3. 在 B1 停止，优先完成 Root role semantics

暂停 Web Component split integration，先解决 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` 的 placement channel、explicit role、composite 与 Template handle open questions。等 role-aware IR 可进入 Runtime/Adapter 后，再回到 public Shadow profile。

优点：先解除 public activation 的最大语义阻塞，避免 private coordinator 暂时无 consumer。缺点：B1 的 lifecycle composition、single-truth meta 与 rollback 风险继续没有集成证据；Root role work跨 Core、Runtime 与所有 Adapter，规模显著更大。

## 推荐

推荐 C1，然后再次停在 public activation gate。

原因是 B1 已证明各个资源单独成立，但尚未证明它们作为一个 Custom Element generation 能保持原子性。C1 只收敛 Adapter-owned information path 与 lifecycle ordering，不扩大 author syntax、public option 或跨 Adapter semantics；它也是在 Root role 设计继续推进时可并行保留的低风险基础。

## C1 后仍需独立决策的内容

### Public artifact delivery

后续优先比较：

1. generated ESM artifact module：运行时 shape 明确、可直接 import，但需处理 `.js`/`.mjs`、types 与 bundler compatibility；
2. JSON artifact：静态、可缓存，但 JSON import 语法与 CSS text ergonomics 因工具链而异；
3. package-root runtime builder：最易调用，但把 token closure 与 CSS generation带入 app build/runtime boundary，可能扩大 CLI package职责。

不建议 CSS raw import + caller 手工包装，因为它重新失去 generator/ABI 关系。

### CSP policy

Public MVP 必须明确选择“暂不保证 strict CSP”或“以 nonce/受支持 carrier 提供可执行保证”。在真实浏览器 CSP journey 之前，不应从 constructable stylesheet 的存在推断兼容。

### Root application role

Public activation至少需要：placement 写 host、surface 写 inner surface；composite 的拆分规则与 unresolved 的 fail-closed/explicit-role policy仍需独立批准。`tw.surface` / `tw.placement` 或其它 author API 不由 C1 批准。

### First reveal

若 public delivery 保持 static eager artifact，推荐不增加异步 barrier，只要求 resources-before-view ordering。若引入 loader/Promise，则必须重新打开 reveal readiness 与 failure UI 设计。

## C1 的最小提交序列

若 maintainer 选择 C1，建议继续：

1. private meta composition helper：reserved `colorScheme` 由 source owner提供，其它 key 委托既有 base getter；
2. private resource coordinator：原子 create、reverse rollback、stable identity 与 idempotent dispose；
3. owner-generation harness：证明首次 view 前完成、view epoch/move 保留、terminal generation 释放与 reconnect renewal，但不增加 public option；
4. 更新 `T-WEB-COMPONENT-SHADOW-STYLE-0001` 的 integration evidence；
5. 形成下一份 public delivery + Root routing decision packet并停止。

## 可证伪 evidence

- base getter 的非 `colorScheme` key 保持原值，`colorScheme` 只来自 retained source；
- invalid source/artifact/subscription 在 surface/view commit 前失败，ShadowRoot 不残留 owner resource；
- first attached view 之前 marker、style 与 surface 已同步存在；
- not-present/repeatable remount/synchronous DOM move 不重建 owner resources；
- terminal teardown 取消 media/document/source subscription，并移除 style、surface 与 Adapter-owned marker；
- reconnect 后得到新 generation，旧 listener 不再写 host；
- boolean profiles 与 package exports 仍无变化。

## 当前最小人工决策

请选择 C1、C2 或 C3。推荐 C1。

选择 C1 只授权 private meta composition、resource coordinator 与 owner-generation evidence；它不授权 public `shadow` object、CLI artifact command/export、Root role routing、`tw.surface` / `tw.placement`、strict-CSP guarantee、async artifact/reveal、draft lifecycle promotion、push、merge、publish 或 release。
