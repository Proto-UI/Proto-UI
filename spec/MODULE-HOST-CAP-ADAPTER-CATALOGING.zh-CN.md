# Module、host-cap 与 Adapter Profile 编目指南

> Spec authoring guide. 本文说明如何把一个 Proto UI 子领域展开为可追踪的 Module、host-cap、Adapter Profile 与 Test 实体切片。它不拥有任何具体协议语义；具体保证仍由适用的 `K-*`、`D-*`、`C-*`、`M-*`、`HC-*`、`A-*` 与 `T-*` 实体拥有。

本指南来自 Props 与 Event 两轮首批编目实践，面向后续 Lifecycle、State、Expose、Context、Feedback，以及更外围的 A11y、Focus、Overlay、Positioning 等领域。

## 1. 编目的目标

Module 编目不是 package 清点，也不是把现有 `cap()` token 换成 YAML。一次有效的编目需要建立一条纵向可验证链路：

```text
knowledge / decision / contract
              ↓
        module ownership
              ↓
      host capability baseline
              ↓
       Adapter profile decision
              ↓
         test conformance
              ↓
 implementation / docs projection
```

这条链路最终应能回答：

- prototype author 能使用哪些语法，处于什么阶段；
- runtime、其它 Module 与特权 `asHook` 能使用哪些更强的内部能力；
- Module 要求宿主提供哪些最小、原子的能力；
- 每个 Adapter profile 支持、拒绝或尚未审查哪些 Module；
- Adapter 以 native、translated 还是 emulated 方式兑现 host-cap；
- 哪些 criteria 已有 executable evidence，哪些仍是 planned 或 open question；
- 实现、测试、旧 contract 与文档相对 catalog 存在哪些 drift。

编目完成度由语义闭环决定，不由实体、package 或 cap token 数量决定。

## 2. 权威边界

开始前先按以下顺序读取信息：

1. `spec/**` 中已有实体、状态、criteria、relations 与 revisions；
2. `internal/contracts/**` 中尚未编目或需要补充解释的遗留契约；
3. `internal/records/**` 中相关的近期方向、已知债务与审查结果；
4. Module、Runtime、Adapter、Prototype 的实现和 executable tests；
5. package README、网站与 workspace 等读者投影。

发生不一致时，不要以“当前代码就是事实”为理由静默改写实体，也不要让旧 contract 覆盖已有实体：

- applicable spec entity 是当前机器治理的真相源；
- 实现与测试是行为证据，也可能是 drift；
- record 保存时间相关观察，不是永久规范；
- README、网站和 workspace 是投影，应跟随真相源更新。

如果语义尚未稳定，使用 `draft`、`openQuestions`、`planned` evidence 或 dated record 保留不确定性，不要伪装成 `active` guarantee。

## 3. 两个展开方向

一次 Module pass 同时使用两个方向，不能只做其中一个。

### 3.1 从语义向宿主展开

从作者可见协议开始，逐层确认所有权：

1. 作者为什么需要这个子领域；
2. 哪些行为属于 portable contract；
3. 哪些能力进入 author facade；
4. 哪些能力只能进入 privileged port；
5. Module 为落地语义真正缺少哪些宿主事实或动作；
6. Adapter 如何将具体宿主翻译成这些 host-cap。

这个方向防止把 React、Vue、DOM 或其它当前实现偶然写进跨宿主 baseline。

### 3.2 从实现向证据回填

从实际 wiring 和测试反向核查：

1. Runtime 是否固定或条件安装 Module；
2. Runtime 在何时消费 facade 与 port；
3. Adapter 实际注入了哪些 cap token；
4. 宿主对象在哪里被归一化或翻译；
5. attach、replace、rebind、detach、unmount、dispose 如何释放资源；
6. 哪些测试真正执行了该行为；
7. 当前实现是否少于、等于或超出 catalog 声明。

这个方向防止编出没有实现依据的理想化实体，也能暴露测试绿但语义未被覆盖的情况。

## 4. 开始一个 Module pass

### 4.1 建立审查清单

先收集以下路径，不急于创建实体：

- 相关 `K-*`、`D-*`、`C-*`、已有 `M-*`、`HC-*`、`A-*`、`T-*`；
- `packages/modules/<domain>/src/{types,caps,create,impl,...}`；
- Runtime 的 Module 安装、handle projection、callback orchestration 与 disposal；
- `packages/adapters/*` 中 owner/view wiring 与 host helper；
- Module、Runtime、Adapter、Prototype 的 contract 和 integration tests；
- 相关 legacy contracts、records、README 与公共文档。

按关系和语义搜索，不要只按预期文件名搜索。一个子领域可能物理分布在多个 package，也可能像 Lifecycle 一样没有独立 Module package。

### 4.2 写一句 ownership statement

在展开 criteria 前，先尝试用一句话描述：

> 这个 Module 拥有什么；明确不拥有什么；它通过什么作者 surface、内部 port 与 host-cap 与外部协作。

如果这句话无法稳定写出，通常说明领域边界仍混合，不宜直接创建多组实体。

### 4.3 区分三类 Module 接口

| 边界 | 使用者 | 典型内容 | 审查重点 |
| --- | --- | --- | --- |
| Facade | prototype author，经 Runtime 投影 | `def.*`、`run.*`、render/read handle | phase、portable semantics、是否泄漏宿主对象 |
| Port | Runtime、其它 Module、特权 `asHook` | sync、bind、dispatch、task、diagnostics、强控制能力 | 权限、策略收窄、callback context、是否误入普通 author API |
| Host capability | Adapter 向 Module 提供 | 当前宿主事实、原子动作、订阅或 lease | host-neutral、原子性、availability、cleanup、失败语义 |

同一个物理 TypeScript interface 可以暂时共置多类能力，但实体 criteria 必须表达语义所有权。物理共置不等于协议归属。

### 4.4 确认安装与缺失策略

对每个 profile 分别回答：

- Module 是 required、recommended、optional 还是 partial；
- 未接入是 reviewed omission，还是尚未编目；
- Module package 已安装但没有使用时，是否仍要求 host-cap；
- 缠绕该 Module 的作者语法在缺失时 fail fast、diagnostic、no-op 还是允许降级；
- 静态或 non-interactive Adapter 是否有诚实省略的理由。

不要从 Runtime 当前固定安装推断所有未来 Adapter 都必须支持，也不要从某个 Module 在 profile 中缺席推断它被明确 omit。

## 5. 设计 host-cap

### 5.1 从缺少的宿主能力开始，不从 token 开始

先问：

> 如果 Module 只保留 portable protocol logic，为了让这段逻辑在宿主发生，它最少需要宿主提供什么事实或动作？

一个 `cap()` token 可能只是实现 helper、组合入口或 Web realization；多个 token 也可能共同实现一个 host-cap。反过来，一段 wiring 中的单个对象也可能混合多个应独立治理的能力。

### 5.2 原子性检查

一个 host-cap 应尽量满足：

- 宿主只需对一个清晰事实或动作负责；
- 不要求不相关的 Module 或 Adapter 能力一起存在；
- 不包含 React component、Vue instance、DOM node、`window` 等单一宿主对象作为 portable baseline；
- availability 与失败语义明确；
- 如持有 listener、observer、subscription、timer 或 native resource，能够返回 disposer/lease 或明确由谁释放；
- replacement、view epoch、unmount 与 terminal disposal 的责任可验证。

如果一个能力可以独立缺失、独立失败或由不同宿主机制兑现，通常应独立建模。例如 Event routing 与 Default Action control 就是两项能力；取消默认动作不能顺便代表 inside/outside classification。

### 5.3 区分通知、数据与调度

不要把相邻事件误写成同一语义：

- invalidation notification 不等于 snapshot delivery；
- snapshot change 不等于 watcher callback 次数；
- watcher callback 不等于 render request；
- registration 存在不等于所有 scope 都需要 binding；
- package 安装不等于每个实例都实际索取 host resource。

Props 的 source notification 与 Event 的 conditional scoped binding 都证明：时序和条件性需要进入 criteria，而不是留给读者从实现猜测。

### 5.4 分开 portable baseline 与当前 realization

可以先建立 host-neutral `HC-*`，同时诚实记录当前实现仍带有平台偏置：

- 在 statement/criteria 中写目标 baseline；
- 在 sources 与 test evidence 中记录当前可验证 realization；
- 在 `openQuestions` 中记录尚未收敛的 API shape；
- entity 保持 `draft`，直到实现与证据足以支撑稳定保证。

Event 的 host-neutral subscription lease 与当前 `EventTarget` getter 之间的差距就是这种情形。不能因为三个 official profile 都是 Web，就把 `EventTarget` 提升为所有宿主的要求。

## 6. 编目 Adapter Profile

Adapter profile 是翻译实现身份，不是 Contract 的替代品。每次只编目一个已审查的 Module slice。

### 6.1 `supports.modules`

只有在以下内容共同明确时才增加正向 support：

- Module role：required、recommended、optional 或 partial；
- 当前 profile 的适用 platform/runtime/framework range；
- 对应 host-cap 能被忠实兑现；
- executable Adapter evidence 存在，或明确标为 planned；
- 已知 limitations 没有被 support 声明掩盖。

### 6.2 `omits.modules`

只有经过审查的结论才能写入 omission：

- `unsupported`：宿主不能忠实满足；
- `not-applicable`：该能力对宿主产物没有意义；
- `deferred`：明确延后并保留原因。

未出现在 `supports` 或 `omits` 中只表示 uncataloged。局部切片不得伪装成完整 support matrix。

### 6.3 `provides.hostCaps`

为每项 capability 声明兑现角色：

- `native`：宿主直接提供等价语义；
- `translated`：Adapter 进行归一化、路由或语义翻译；
- `emulated`：Adapter 以替代机制模拟，并需要明确 fidelity 边界。

无法忠实满足的 capability 不得因为 wiring 中有一个同名 token 就列为 provided。

### 6.4 宿主差异应停在哪里

Adapter 可以保留：

- React props、Vue props/attrs、Web attributes/properties 的分类；
- DOM native listener、delegation、portal owner 与 concrete target；
- framework commit/update scheduling；
- 宿主专属 optimization 与 escape hatch。

这些差异进入 Module 前必须被归一化到 portable snapshot、payload、logical scope、request 或其它 cataloged baseline。

## 7. 建立 Test 实体与 evidence

### 7.1 从 criteria 写 case

每项关键 criteria 都应能对应一个可观察 case。优先覆盖：

- facade/port surface split；
- phase boundary；
- required/optional 与 conditional availability；
- Adapter translation；
- resource replacement、rebind 与 terminal cleanup；
- host-independent request 到 host projection；
- 与相邻 Module 的 ownership boundary。

### 7.2 从 case 映射 implementation

`T-*` 的 `implementations` 需要说明：

- 真实存在的 path；
- evidence kind；
- `passing`、`planned` 等状态；
- `required` 与否；
- 实际消费哪些 cases。

使用 `verifies.*.anchors` 绑定精确 criteria。只写一个宽泛测试文件路径，不能证明文件内覆盖了所有 anchors。

### 7.3 不要把 source inspection 当成 passing conformance

看到 Adapter source 调用了某个宿主 API，只能说明实现意图。除非测试真正注入 capability、触发行为并断言结果，否则应：

- 标记为 `planned`；
- 增加共享 conformance helper/test；
- 或降低该 evidence 的 claim。

Event Default Action 首轮发现三个 Web Adapter 都调用 `preventDefault()`，但没有测试真正验证可取消 DOM Event；补齐共享 Adapter Base test 后，`T-EVENT-0003` 才从 planned 更新为 passing。

### 7.4 Schema test 不等于行为 test

Adapter profile schema test 可以证明：

- relation 字段存在；
- profile metadata 与 package range 一致；
- anchors 和 entity graph 合法。

它不能证明 Adapter 真的完成 snapshot translation、event routing、cleanup 或 host action projection。行为仍需 Module、Runtime 或 Adapter executable tests。

## 8. 处理编目发现的 drift

编目不是只写 YAML；它会主动发现 implementation、test 与 projection 偏移。先分类，再决定是否本轮处理。

### 8.1 适合立即修复

- 已有 criteria 明确要求、改动局部且有直接回归测试的行为错误；
- 已实现但缺少关键 executable evidence 的能力；
- stale README、legacy contract 或诊断名与当前实体直接冲突；
- terminal cleanup、旧 subscription/listener 未释放等资源问题；
- test claim 超出测试实际证明范围。

行为修复与 catalog baseline 尽量分开提交，使审查者能区分“定义边界”和“修复 drift”。可观察错误类型或诊断变化也适合独立提交。

### 8.2 应先留下设计问题

- 会改变 facade、port 或 host-cap 公共 shape；
- 需要定义跨宿主 portable subset；
- 涉及 Module ownership 迁移；
- 需要新的 runtime module-selection 或 omission policy；
- 当前证据只来自单一宿主，无法证明 baseline 的普适性。

这类问题进入 `openQuestions` 或 dated record，不应作为“顺手修复”混入首轮编目。

### 8.3 应留给下游 Module pass

如果偏移的最终所有权属于尚未编目的相邻 Module，应先在当前实体声明边界，再交给后续 pass。例如 Event package 物理共置的 Expose Event registry/emit bridge，应由 Expose 编目决定最终所有权，而不是在 Event pass 中提前重构。

### 8.4 先排除版本与分支误差

当“刚修过的问题”再次出现时，先确认：

- 修复提交是否真的是当前 `HEAD` 的祖先；
- 本地分支是否落后于远端；
- 当前测试是否包含当时新增的回归断言；
- 现象是本轮变化、历史覆盖，还是修复从未进入当前分支。

这能避免把分支同步问题误判为 Module 下游回归。

## 9. Props 与 Event 的对照经验

| 主题 | Props | Event | 可复用结论 |
| --- | --- | --- | --- |
| Author facade | setup declaration/watch；runtime read | setup registration；runtime callback dispatch | facade 必须按 phase 拆开，Runtime 负责正确投影 |
| Privileged port | host sync、direct apply、task consumption | internal listener、bind/unbind、dispatch、redirect、default action | 强能力不得因为物理共置进入普通 author API |
| Host-cap | current raw snapshot + invalidation | scoped translated binding；独立 default action | 从 Module 缺少的宿主能力建模，不照抄 token |
| Adapter ownership | 原始 props/attrs/property 分类 | native event mapping、route owner、concrete target | 宿主差异停在 Adapter，Module 消费归一化结果 |
| Conditionality | invalidation 后由 runtime sync 重读 | 只为实际 registration scope 索取 binding | 通知、使用与资源要求不能混为一谈 |
| 第二入口 | `applyRaw` 是 controller port，不是 host-cap | Expose emit 是相邻 outward channel bridge | 相邻入口需要明确 ownership，不因复用 kernel 合并实体 |
| Portability debt | pull/subscribe/direct-push future modes | `EventTarget`、DOM listener options | 当前 Web 实现可作为 evidence，不能自动成为 portable baseline |
| Evidence drift | WC direct apply test 不证明 source invalidation | source 调用 `preventDefault()` 不证明实际 projection | case 必须与测试真正执行的行为一致 |

## 10. 推荐的纵向编目步骤

对下一个 Module，按以下顺序推进：

1. **范围记录**：写明本轮 owner、non-owner、已知相邻领域和不处理项。
2. **Contract map**：确定满足、依赖、解释和引用哪些现有实体。
3. **Module entity**：形成 ownership statement，并为 facade、port、安装策略、lifetime 写 criteria。
4. **Host-cap entity**：从宿主最低能力建模，检查原子性、portable baseline 和 cleanup。
5. **Runtime trace**：核实安装、projection、callback、sync、commit 与 disposal 时机。
6. **Adapter slice**：逐个 profile 审查 supports/omits、provides role、target range 与 limitations。
7. **Test entity**：建立 criteria → case → implementation → anchor 的证据链。
8. **Drift triage**：立即修复局部错误；把 API/ownership 问题留在 open question 或 record。
9. **Projection refresh**：更新必要 README/legacy contract，生成 workspace 与 Agent projection。
10. **独立审阅**：检查局部 slice 没有暗示完整 support matrix，也没有把 draft 当 active guarantee。

不要先一次性创建所有 `M-*` 与 `HC-*` 再回填内容。Props/Event 已证明，小而完整的纵向 slice 更容易暴露 schema、证据和 ownership 的真实需求。

## 11. 特殊情况：没有 Module package 的领域

领域重要不等于必须拥有 `M-*`。Lifecycle 当前没有独立 Module package，它是 Runtime 与 Adapter 之间的执行协议：

- instance lifetime；
- repeatable view epoch；
- commit completion 与 update revision；
- host binding enable/disable；
- detach、unmount 与 terminal disposal。

Lifecycle 应通过 Contract、Adapter Profile 与 Test 形成纵向链，不应为了目录对称性创建空 Module entity。后续 Module 的 resource ownership 应引用 Lifecycle 骨架，而不是各自发明一套生命周期。

同理，只有在存在 coherent semantic owner 时才创建 Module entity；package、目录或 token 的存在本身不构成理由。

## 12. 常见误区

- 把一个 package 等同于一个完整 Module semantic slice；
- 为每个 `cap()` token 创建一个 `HC-*`；
- 把当前 Web helper、DOM type 或 framework object 写成跨宿主 baseline；
- 从 package dependency 或 wiring 名称推断 Adapter 已支持某 Module；
- 把 profile 中未出现的 Module 当成 implicit omission；
- 用 Adapter identity 代替 portable Contract；
- 用 source path、README 或测试文件名代替 criteria 与 anchors；
- 把 planned evidence 写成 passing；
- 因为所有当前 official Adapter 都是 Web，就声称任意 future Adapter 都必须提供同一对象；
- 为追求数量创建空实体或完整矩阵占位；
- 手工修改 `spec-workspace.json` 等 generated projection；
- 重写旧 record 让历史看起来更一致，而不是新增记录或提升稳定结论。

## 13. 完成检查表

一个 Module slice 至少应通过以下检查：

### Ownership

- [ ] 一句话 owner/non-owner statement 清晰；
- [ ] facade、port、host-cap 分界明确；
- [ ] 相邻 Module bridge 或物理共置没有被误判为语义所有权；
- [ ] required/optional/partial 与缺失策略已说明。

### Host capability

- [ ] 从宿主最低事实/动作建模，而非从 token 清点；
- [ ] 没有把具体宿主对象提升为 portable guarantee；
- [ ] availability、failure、replacement 与 cleanup 可解释；
- [ ] 当前 realization debt 通过 draft/open question 保持可见。

### Adapter Profile

- [ ] 每个正向 support 都经过真实 wiring 与行为审查；
- [ ] `provides.hostCaps` 的 native/translated/emulated role 诚实；
- [ ] omission 与 uncataloged 没有混淆；
- [ ] profile target/runtime range 与 package metadata 一致；
- [ ] 局部 slice 没有伪装成完整 matrix。

### Evidence

- [ ] 关键 criteria 有 `T-*` cases；
- [ ] cases 映射到真实存在的 executable path；
- [ ] anchors 只声明测试实际证明的行为；
- [ ] source inspection 没有冒充 passing conformance；
- [ ] replacement、rebind、detach、unmount 或 disposal 等 lifetime 规则有证据。

### Drift 与投影

- [ ] 发现的偏移已分类为立即修复、设计问题或下游 pass；
- [ ] applicable entity 与 legacy contract/README 不再直接矛盾，或 gap 已记录；
- [ ] generated projection 通过 generator 更新且未手工编辑；
- [ ] catalog、types、focused tests 与必要 workspace checks 已通过。

## 14. 验证阶梯

按变更风险逐级运行，不要求每个纯文档改动都执行整个仓库：

```sh
# 格式与静态差异
corepack pnpm@10.32.1 exec prettier --check <changed-files>
git diff --check

# 相关 Module / Runtime / Adapter focused tests
corepack pnpm@10.32.1 exec vitest run <focused-test-paths>

# Spec schema、relations 与 graph
corepack pnpm@10.32.1 exec vitest run packages/spec/fixtures/test packages/spec/graph/test

# Workspace 与 Agent projections
corepack pnpm@10.32.1 workspace:generate
corepack pnpm@10.32.1 spec:docs:agent
corepack pnpm@10.32.1 check:agent-doc

# 适用时的全工作区检查
corepack pnpm@10.32.1 check:types:workspace
corepack pnpm@10.32.1 check:prototype-catalog
```

生成命令与 `--check` 命令需要顺序执行，避免检查在生成完成前启动而产生假性 stale failure。

## 15. 后续推荐顺序

Props 与 Event 已跑通首条编目工作流。基础层建议继续按以下顺序：

1. Lifecycle：先补 Runtime → Adapter execution conformance，不创建空 Module；
2. State：验证纯协议、instance-owned、无直接 host-cap 的 Module；
3. Expose core：先 outward registry，再处理 Expose State 与 Expose Event bridge；
4. Context：验证 logical instance identity 与 parent resolution；
5. Feedback：验证 mixed resource ownership、view replay 与 commit/flush；
6. 完成基础组合验收后，再进入 A11y、Focus 与其它外围 Module。

每一轮都应复用本指南的纵向 slice，而不是等所有领域审查完成后再一次性建立 Adapter support matrix。
