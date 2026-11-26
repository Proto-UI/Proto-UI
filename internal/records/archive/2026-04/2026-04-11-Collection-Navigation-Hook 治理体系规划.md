# Collection / Navigation / Hook 治理体系规划（Draft）

## 背景

当前 Proto UI 在交互语义层出现三个关键构件：

- `asCollection`：基于 anatomy.order 的结构顺序语义
- `asFocusGroup / asFocusScope`：焦点领域与边界控制（特权钩子）
- `asFocusRoving`（规划中）：基于集合的键盘导航行为

在实践中暴露出以下问题：

1. `asCollection` 被误用为导航基础，导致职责外溢
2. “顺序语义”与“导航语义”未分层，造成设计混乱
3. 一类“非组件但具备稳定交互语义”的 hook 缺乏治理标准
4. Base 包导出物缺乏结构化分类（prototype / behavior / infra 混合）

本规划旨在：

- 明确语义分层
- 约束 asCollection 的职责边界
- 定义导航层抽象（asFocusRoving）
- 建立 hook 的治理与分发策略

---

## 一、核心分层模型

将当前体系明确拆为三层：

### 1. Structure Layer（结构语义层）

代表：`asCollection`

职责：

- 基于 `anatomy.order` 提供结构顺序语义
- 提供 item 的位置属性：
  - index / total / first / last
- 提供集合快照（snapshot）

**不负责：**

- 导航（Arrow key / focus movement）
- active item 管理
- 稳定 identity
- selection

结论：

> `asCollection` 是“结构顺序投影层”，不是“集合行为层”。

---

### 2. Focus Infrastructure Layer（焦点基础设施层）

代表：

- `asFocusGroup`
- `asFocusScope`

职责：

- 焦点边界管理（scope）
- 焦点进入/离开策略
- 焦点约束（trap / containment）
- 底层 focus 能力接入（特权）

**特征：**

- 属于特权钩子（privileged hooks）
- 直接消费 port / host capability
- 解决生命周期 / 时序问题

---

### 3. Navigation / Behavior Layer（行为语义层）

代表：

- `asFocusRoving`（规划）

职责：

- 定义“如何在一组 item 中移动焦点”
- 提供稳定导航行为：
  - ArrowUp / ArrowDown / ArrowLeft / ArrowRight
  - Home / End
  - loop / clamp
  - skip disabled

- 维护 active item 的语义连续性

依赖：

- Structure Layer（顺序）
- Focus Layer（焦点能力）

**不直接暴露：**

- port
- host capability
- lifecycle 细节

结论：

> 该层是“语义决策层”，拥有导航行为的所有权。

---

## 二、asCollection 的治理策略

### 2.1 明确职责边界（必须）

`asCollection` 只允许解决：

- “谁在集合里”
- “当前顺序是什么”
- “我在第几个”

禁止扩展到：

- 焦点移动
- active item
- selection
- 键盘行为

---

### 2.2 语义定位修正

内部定义：

> asCollection = ordered anatomy semantics

建议文档中明确：

- 它不是 data collection abstraction
- 它不提供 identity
- 它不保证稳定成员关系

---

### 2.3 结构约束建议

#### 必须澄清：

- 是否允许多个 collection observer
- rootRole 是否必要
- family + role 的唯一性约束

---

### 2.4 技术债（优先处理）

#### ❗禁止覆写 State.get

当前：

```ts
(state as any).get = () => { ... }
```

问题：

- 破坏 state 语义一致性
- 引入“读时重算”的隐式行为
- 读写来源不一致

替代方案：

- 将实时读取能力放入 expose method
- 或引入显式 derived state 抽象

---

### 2.5 meta 通道治理

当前：

- 通过字符串 exposeKey 传递
- 支持 object / function 双态

问题：

- 协议松散
- 静默失败

建议：

- 明确 meta 为扩展协议
- 统一为 method 形式
- 禁止 silent fallback（调试模式报错）

---

## 三、asFocusRoving 设计原则

### 3.1 核心语义

> 基于集合的稳定焦点导航行为

---

### 3.0 工程约束（补充）

行为层 hook 与 author-facing hook 在工程实现上应遵守以下规则：

- 默认依赖公开语义面，不直接读取内部 `port`
- 若运行期只读查询确有必要，应优先推动公开 `run` API 收敛为 runtime-only，而不是回退到特权读取
- 不假定宿主线程模型，不以 `queueMicrotask` 或同类调度手段维持行为正确性
- 不依赖 host 事件冒泡/捕获语义维持行为正确性
- 允许读取跨平台的规范化事件数据，例如键盘 `key`
- 避免直接从 `event target` 读取宿主细节；如确有必要，必须在契约与实现注释中显式记录

结论：

> 行为层可以消费 runtime 语义，但不应消费宿主偶然性。

---

### 3.2 必须引入 stable identity

禁止：

- 使用 index 作为唯一定位

必须：

- 每个 item 提供稳定 id（或内部生成）

导航流程：

1. 当前 activeId
2. 在当前 order 中查位置
3. 推导 nextId
4. 移动焦点

---

### 3.3 职责范围

负责：

- active item 状态
- moveNext / movePrev
- 边界策略（loop / clamp）
- disabled item 跳过
- 插入删除后的连续性

不负责：

- DOM focus 实现细节（交给 focus 层）
- order 计算（交给 collection）

---

### 3.4 API 约束（建议）

应避免：

- 过度配置化
- 暴露底层细节

倾向：

```ts
asFocusRoving({
  orientation: 'vertical' | 'horizontal',
  loop?: boolean,
  skipDisabled?: boolean,
})
```

---

## 四、Hook 治理模型

### 4.1 分类

#### 1. Infrastructure Hooks（基础设施）

- asCollection
- asFocusGroup
- asFocusScope

特点：

- 低层能力
- 可能特权
- 不直接作为推荐交互

---

#### 2. Behavior Hooks（行为协议）

- asFocusRoving

特点：

- 稳定交互语义
- 跨组件复用
- 官方推荐

---

#### 3. Prototype Hooks（组件内行为）

- 特定组件私有逻辑

特点：

- 不对外作为通用协议

---

---

## 五、Base 包导出策略

### 5.1 Base 的重新定义

> Base 包不仅承载基础原型，也承载官方标准交互协议（behavior）

---

### 5.2 导出结构建议

```
base/
  prototypes/
  behaviors/
```

示例：

```
base/behaviors/asFocusRoving
```

---

### 5.3 准入标准

一个 hook 进入 base，必须满足：

1. 跨多个原型成立
2. 语义稳定，可文档化
3. 有明确行为边界
4. 官方希望生态收敛
5. 不暴露底层能力

---

## 六、契约治理

### 6.1 强制规则

所有 Base 导出的协议实体（包括 hook）必须：

- 有契约文档
- 有契约测试

---

### 6.2 契约内容应包含

- 行为定义
- 输入约束
- 边界行为（插入 / 删除 / disabled）
- 非目标（explicit non-goals）
- 与其他模块的协作语义

---

## 七、执行路径

### 阶段 1（立即）

- 明确 asCollection 文档边界
- 标记其“非导航”属性
- 禁止继续向其添加导航逻辑

---

### 阶段 2（短期）

- 设计 asFocusRoving
- 引入 stable identity
- 实现最小导航模型

---

### 阶段 3（中期）

- 建立 behavior hook 分类
- 将 asFocusRoving 纳入 base/behaviors

---

### 阶段 4（长期）

- 扩展行为协议库：
  - selection
  - typeahead
  - composite navigation

- 建立统一协议测试体系

---

## 总结

- asCollection：结构语义，不负责行为
- asFocusRoving：行为语义，拥有导航所有权
- hook ≠ 工具函数，部分 hook 是协议实体
- Base：不仅是组件库，也是交互协议库
- 治理核心：按“语义地位”而非“代码形态”划分维护标准
