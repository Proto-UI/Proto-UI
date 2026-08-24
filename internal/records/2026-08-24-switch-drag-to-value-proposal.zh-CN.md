# Switch constrained drag-to-value proposal（design-only，non-normative）

日期：2026-08-24

状态：design proposal 草案。本文是短期方向记录，不是 Proto UI 语义来源；不含任何已授权的实现、实体准入或 owner 定案。授权来源：#495 maintainer checkpoint（2026-08-24，guangliang2019）：Switch 作为 `C-MOVE-GESTURE-0001` 的第二消费者验证载体，领域专项设计，不产出通用 `asMove()` / `asDrag()` / drag-to-value API。镜像有界 proposal issue：#498。

## 问题与定位

当前 Switch 只支持点击翻转：root 经 `press.commit` 一次性取反 checked（`packages/prototypes/base/src/switch/root.proto.ts`），thumb 是二态 CSS 切换（如 shadcn thumb 的 `translate-x-0` ↔ `translate-x-[calc(100%_-_2px)]`）。拖动时 thumb 不跟手。

固定基线不提供拖动（shadcn/Radix 同样点击式），因此现状不是 drift。本 proposal 回答 checkpoint 的问题：若要支持"thumb 跟手拖动、释放按阈值提交"，在**不改既有负边界**的前提下，信息通路、仲裁规则与证据如何构成；同时让 Switch 承担 `C-MOVE-GESTURE-0001` 第二消费者验证。

## Authority map（pui-trace 摘要）

- `C-MOVE-GESTURE-0001` + `HC-MOVE-GESTURE-0001`：有界 move session（start / 有序 samples / 恰好一次 end-or-cancel；cancel reasons: host-cancel / lost-ownership / target-detached / target-replaced / disposed）。契约显式排除 drag-and-drop、领域 value、a11y widget semantics。
- 现有消费者：Scroll Area 拖滚（`packages/modules/scroll/src/web/create-web-scroll-host.ts`）——immediate activation、无 commit 语义、无外部 truth owner。
- Switch 语义 owner：Root 独占 `checked` / activation / commit（`P-BASE-SWITCH-*`）；Thumb 零 props/events/focus/a11y ownership（`P-BASE-SWITCH-THUMB-NO-VALUE-OWNER` 等，absence-as-implementation）。
- 受控模式：controlled 时 root 仅 emit `checkedChange`，不本地落位（`P-BASE-SWITCH-CONTROLLED-EMITS-NEXT`）。
- 手势宿主绑定：adapters/base `web-move-gesture-host.ts`，三 runtime runtime modules 已注册。

## 信息通路（candidate）

```
pointer.down on track/root（disabled 抑制，维持现有 pressed 视觉）
  → 绑定 MoveGesture session（axis: horizontal, activation: threshold）
    → 未达激活阈值：行为等同今天的普通按压
    → 达到阈值：gesture activated
        → provisional position = clamp(sample.x − trackRect.left − thumbInset, [0, travel])
          （trackRect 于 session start 时测量一次，host-local；
            输出为中性 progress ∈ [0,1]，经样式投影缝投射为临时 paint output）
    → end：
        由位置+速度阈值计算 requestedChecked
        → 走既有 press.commit 等价的单一请求通道（emit checkedChange / uncontrolled 本地落位）
    → cancel（任一 C-MOVE-GESTURE cancel reason）：
        无请求；thumb 回到当前 checked truth
```

## 六个 checkpoint 重点的设计回应

### 1. Press/tap 仲裁

- Root 保持唯一 activation owner。drag policy 不引入第二个 activation 语义：它在既有 `pressed` 生命周期之上观察 samples，只在**达到激活阈值后**声明"本次按压升级为 drag"，并从该时刻起抑制本次手势的 `press.commit` 翻转路径。
- 纯 tap（未达阈值即 up）走今天完全相同的 `press.commit` 翻转，不进入 drag 决策。
- 实现形态上，policy 与 root 的接合点是"提交请求通道"与"pressed 视觉状态"，而不是新的 pointer 监听面——避免双监听竞争。

### 2. Activation threshold

- 候选定义：沿轨道轴位移 ≥ 一个 host 中立常量（如 4px 等效值）或按住超过短时限后仍移动即激活；具体值留实现校准（见 falsification）。
- 阈值是 policy 常量而非 author prop（首轮）；author 可见的公共面不变。
- 阈值前后的可观测差异只有 thumb 是否跟手；`pressed` 视觉两态皆保持。

### 3. Provisional host-local position

- 会话开始测量一次 track 几何；期间只消费 sample delta/position，不做每帧 DOM 测量。
- provisional 输出是中性 progress（0..1）或像素偏移，经**样式投影缝**（如 CSS 自定义属性 / data attribute，具体形式归 Adapter，沿 `P-SHADCN-TEXTAREA` 中"attribute lowering 归 Adapter"的先例）成为临时 paint output。
- Thumb 的 styled 规则继续由 checked 驱动端点位姿；拖动中的连续位姿来自投影缝，两者不冲突：checked truth 未变，端点样式不切换。
- 不写 context/anatomy/State；Thumb 的零 ownership 边界原样成立。

### 4. Commit/cancel

- End 决策（candidate）：`progress > 0.5` 或释放速度方向明确越界 → requested = 对应端点；否则回到拖动前 checked。
- 提交恰好一次：uncontrolled 直接 `checked.set(next)`；controlled 仅 `emit('checkedChange', { checked: next })`——与 `press.commit` 现行双分支一致，复用同一事件语义。
- Cancel（host-cancel / lost-ownership / target-detached / target-replaced / disposed）：不发请求，无 toast/诊断噪音之外的副作用；thumb 以普通过渡回到 truth 位姿。
- Escape/outside-cancel 是否纳入首轮：候选纳入 pointer.cancel 即可覆盖的路径，键盘 Escape 取消列为可选增强。

### 5. Controlled truth 回退

- Controlled 下请求被 owner 拒绝（`checked` prop 未变）→ thumb 回到当前 checked truth；**永不乐观本地落位**。
- 回退动画与取消相同（普通过渡），不需要新机制；这正是 Scroll 无法验证、而 Switch 能提供的"外部 truth owner"保证。

### 6. 单次 activation

- 不变量：每次 pointer 手势至多产生一个 toggle 请求。tap → 恰好一个（现行路径）；activated drag → 至多一个（end 时）；cancel → 零个。
- 升级为 drag 后必须吞掉底层 click/press.commit 翻转，防止"拖完又翻一次"的双重 toggle。该不变量列为首要单测断言。

## 键盘与 a11y（不变量）

Space/Enter 激活路径、focus 管理、`aria-checked`、role 全部不动。拖动是纯指针增强；键盘用户行为零变化。这也是"Thumb/Root 负边界不重排"的自检：所有新增逻辑都在 root 内部或其 policy hook，Thumb 仍是 presentational。

## 载体形态（candidate，checkpoint 裁定）

倾向：**base switch 域内的专用 asHook**（如 `useSwitchDragPolicy`，消费 `HC-MOVE-GESTURE-0001` cap），随 `P-BASE-SWITCH` 域演进；不建通用 drag-to-value module/API。理由：checkpoint 明确禁止预设通用原语；且第二消费者的职责恰是验证 Move substrate 够不够用，而不是立刻抽象它。

## 跨宿主假设与 fallback

- MoveGesture 本就是 host-mediated（web-move-gesture-host 已注册三 runtime）；policy 只消费中立 samples。
- 无手势宿主能力的环境：fallback 到今天完全一致的点击式行为（策略整体 opt-in）。
- 非 Web 宿主的 geometry/采样由各自 binding 提供；本 proposal 不假设 scrollTop 类 Web 特权。

## 可执行证据与 falsification

- **首要不变量单测**：tap 单次翻转；drag 到底释放恰好一次请求且无额外翻转；五种 cancel reason 全部零请求回 truth。
- **threshold 边界**：恰好等于阈值视为未激活（或激活，二选一定死后锁死测试）。
- **controlled 回归**：owner 接受 → 新 truth；拒绝 → 回旧 truth 且无中间落位。
- Browser journey（三 runtime）：拖动中 thumb 连续跟手（paint output 断言）；释放按阈值落位；拖动中指针离开/系统取消回弹；键盘 Space 行为逐字节不变。
- **falsify「Move substrate 充分性」**：若 policy 必须绕过/扩展 `C-MOVE-GESTURE-0001` 的任何保证（例如需要多指、hover 采样、session 内 geometry 变更），即为 substrate 缺口证据，回报 Move 契约修订而非在本域内 hack。
- **体感校准类**（只能实现后定）：阈值像素值、速度曲线、是否需要 iOS 式 overshoot（首轮显式 out of scope）。

## 只能由实现验证的结论

阈值/速度参数体感；provisional paint output 的投影形式（CSS var vs data attr）在三个 adapter 下的实际表现；与 pressed 视觉的时序协调细节。

## 下一步

本 record 与镜像 issue 一并提交 maintainer checkpoint。授权边界不变：不实现、不出公共 API、不建实体、不动 #377。若方向认可，implementation Issue 另立。
