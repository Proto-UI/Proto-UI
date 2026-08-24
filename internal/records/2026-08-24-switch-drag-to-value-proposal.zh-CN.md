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

## 信息通路（candidate，受 substrate 决策阻塞）

```
pointer.down on track/root（disabled 抑制，维持现有 pressed 视觉）
  → 当前 HC-MOVE-GESTURE 只能立即接受 session（axis: horizontal, activation: immediate）
    → pointerdown 即 preventDefault/capture/start；尚无 pending/threshold 阶段
    → **决策缺口**：必须先定义 immediate Move 与 asTrigger press/tap 的仲裁，或另行批准 D/C/HC/T-MOVE threshold extension
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

### 1. Press/tap 仲裁（未决 substrate gate）

当前 Move host 在 `pointerdown` 立即接受、preventDefault、capture 并发出 start；因此不能保证"阈值以下保持今天 tap 路径"。在任何 Switch implementation 前必须单独选择并批准：

- **路径 A：immediate-session composition**——定义 Move start 后如何保留 asTrigger press、何时将 native pointerup 解释为 tap、如何保证 Move capture/preventDefault 不吞掉 press.commit，以及 drag 后如何抑制双重 toggle；或
- **路径 B：threshold/arbitration extension**——新增 D/C/HC/T-MOVE 语义，使 host 在 pending 阶段不接受/捕获，越过阈值才 start，未越过则把 tap 交回 Trigger。

Root 仍是唯一 activation owner；但在 A/B 被批准前，本文不宣称任一 carrier 已存在，也不授权 Switch implementation。

### 2. Activation threshold（仅候选，不是现有 guarantee）

沿轴位移阈值（如 4px）、时间、速度与恰等阈值的判定都属于上述 gate。它们既不是 `HC-MOVE-GESTURE-0001` 当前 surface，也不是可直接写进 Switch policy 的稳定常量。proposal 只列出需要验证的参数，不绑定 public/API carrier。

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

载体形态保持未决。只有在路径 A（immediate composition）或路径 B（Move threshold/arbitration extension）通过独立 checkpoint 后，才可评估 Switch-domain asHook。本文不再预设 `useSwitchDragPolicy` 能直接消费当前 Move cap 完成仲裁，也不建通用 drag-to-value API。

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
