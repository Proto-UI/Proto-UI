# Tabs roving 的 Web 程序化聚焦投射修复

日期：2026-08-12

发布归属：计划随 `0.2.0` 正式版本发布；本修复 PR 不单独修改全局版本或创建新的 release train。

## 试用观察

`0.2.0-rc.7` 发布后试用发现，Tabs demo 的 trigger 无法通过方向键切换焦点。Base Tabs 的 Focus Roving 语义与候选解析都已生效，但 Web Component、React、Vue adapter 会为非当前 trigger 完全移除 `tabindex`。这些 trigger 在 Web 上不是原生可聚焦元素，因此 roving request 能选中下一个成员，却无法把 native focus 应用到该 target。

## 收口

`C-AS-FOCUSABLE-0001-F` 已要求 `navParticipation: none` 只退出自然 Tab 顺序，不得阻止显式 focus request；`C-AS-FOCUS-ROVING-0001-G` 同样要求其余 eligible item 仍可被程序化聚焦。本次修复不改变 Tabs 组件语义，而是让 Focus host capability 显式区分：

- 非 focusable surface 继续不投射 `tabindex`；
- enabled focusable 在参与自然 Tab 顺序时投射 `tabindex="0"`；
- enabled focusable 在退出自然 Tab 顺序时仍投射 `tabindex="-1"`，保留程序化聚焦能力；
- disabled target 继续不可接受 focus request。

Web Component、React、Vue adapter 统一遵守该投射。Base Tabs 与真实 demo renderer journey 增加回归覆盖，验证 ArrowRight 会把 focus 和 automatic selection 从 Account 移到 Password。
