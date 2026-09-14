# expose-state.web-extension.v0.md（中文底本）

> 编目权威：`M-EXPOSE-STATE-WEB-0001`、`HC-EXPOSE-STATE-WEB-TARGETS-0001`、`T-EXPOSE-STATE-WEB-0001`。本文作为可读投影；生命周期与未决问题以实体为准。

> 状态：Draft – v0（实现对齐）
>
> 本文说明 **expose-state 的 Web 平台扩展能力**：将外部 State 句柄投影为 DOM `data-*` 属性与 CSS 变量，以支持 headless 组件场景下的样式驱动与选择器消费。
>
> **定位声明（v0）**：这是一个 **可选的 Web 专用扩展**。其存在不改变 expose-state 的核心语义，仅提供额外的表现层映射。

---

## 0. 范围与非目标

### 0.1 范围（v0）

该扩展在 Web 平台提供：

- 将外部 State 句柄映射为 DOM `data-*` 属性与 CSS 变量
- 可配置的语义名 → 变量名/属性名映射策略
- 与 expose-state 同源的订阅与同步

### 0.2 非目标（v0）

- 不改变 expose-state 的外部句柄形状
- 不提供写入（set）能力
- 不提供跨平台保证（仅限 Web adapter）

---

## 1. 术语

- **Web 扩展模块**：用于将 expose-state 映射到 DOM 的可选模块。
- **NameMap**：语义名到 `data-*` / `--pui-*` 的映射策略。
- **Host Element**：组件实例对应的宿主 DOM 节点。

---

## 2. 依赖与能力注入（caps）

Web 扩展模块依赖以下能力（由 adapter 提供）：

- `HOST_ELEMENT_CAP`：宿主 DOM 节点
- `EXPOSE_STATE_WEB_MAP_CAP`：NameMap（语义名 → attr/css var）
- `EXPOSE_STATE_WEB_MODE_CAP`（可选）：行为开关/策略覆盖

> 缺少 host 时扩展不生效；name map 缺失时使用默认映射，mode 缺失时使用默认策略。可选 mirror target 仅提供 presentation selector context，不复制 owner identity。

---

## 3. 默认映射规则（v0）

### 3.1 语义名 → DOM 名称

默认映射（基于 state 语义名）：

- 语义名 `btn.disabled` → `data-btn-disabled` 与 `--pui-btn-disabled`
- 规则：
  - 去除两侧空白
  - `.` 与空格统一转 `-`
  - 其他非字母数字字符转 `-`
  - camelCase 分词，合并连字符并去除首尾连字符，全部小写
  - official alias 优先使用共享名称表

### 3.2 类型驱动映射

- **枚举型**（`enum`）：仅映射 **attr**
  - `data-name=value`
- **字符串型**（`string`）：仅映射 **attr**
  - `data-name=value`
- **布尔型**（`bool`）：仅映射 **attr**
  - `true` → `data-name`（空字符串值）
  - `false` → 移除 `data-name`
- **离散数值**（`number.discrete`）：映射 **attr + css var**
  - `data-name=value`
  - `--pui-name=value`
- **连续数值**（`number.range`）：仅映射 **css var**
  - `--pui-name=value`

> 说明：连续数值默认不映射到 attr，以避免高频 DOM 属性变更。

---

## 4. 可配置覆盖（v0）

adapter 可以通过 `EXPOSE_STATE_WEB_MODE_CAP` 覆盖默认行为，例如：

- `allowContinuousAttr`：允许连续数值也映射到 attr
- `allowStringVar`：允许 enum/string 映射 css var

该覆盖仅影响 Web 映射表现，不改变 expose-state 语义。

---

## 5. 生命周期与同步

- 映射值必须与 expose-state 同步
- host 丢失、unmounting、detach 和 terminal dispose 撤销订阅、内部映射与后续写入；remount 重放当前值
- target、mapping、mode 变化后旧 DOM artifact 的删除/恢复仍为未决问题

---

## 6. v0 契约测试（最小覆盖）

实现至少应覆盖：

1. bool → attr（true/false 语义）
2. enum/string → attr
3. number.discrete → attr + css var
4. number.range → css var
5. 语义名映射规则（`.` 与空格转 `-`）

---

## 7. 相关契约（非规范性链接）

- expose-state 核心：`internal/contracts/expose/expose-state.v0.md`
- state spec：`packages/types/src/state.ts`
