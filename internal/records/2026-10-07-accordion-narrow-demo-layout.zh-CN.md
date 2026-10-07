# Accordion Demo 的窄屏内容布局

## 精确原生失败

`f91b80c45edc992beb0cdb2e77224a67c9c998a5`，Actions `37616450490`，20/25 通过。5 个家族在 320px viewport、200% 根字号、React、中文页、长标题展开状态下失败于原有页面横向溢出 <=1px。Base/Shadcn/Brutalist/Bootstrap/Liquid 分别为 763/323/295/323/323px。原始 PNG、JSON 和日志不改。

查看原图与几何：风格家族的整列宽度被 recipe 底部默认单行 Button 的 min-content 撑开；Base 的列保持窄宽，但作者提供的长连续字符串没有断行机会，内容穿出。API table 的 rect 超过视口不单独证明页面溢出，因为既有文档滚动容器允许局部横向滚动；本次不盲改全站表格。

## 消费层修复

- Recipe 明确单列 `minmax(0,1fr)`，保已有 grid gap 和自然内容高度。
- Accept Button 的作者标签允许自然多行、自动高度、最小宽零和有界最大宽，不禁用输入、不截字、不隐藏溢出。
- 作者提供的长标题与长连续内容使用 anywhere 换行；Base 与所有风格家族保留同一原型语义，不把所有 Text 全局 block，也不改 Content retained hidden 状态。
- native 原断言不变。新增整 viewport PNG、scrollWidth 和 clipping ancestor 诊断，避免把有独立滚动容器的表格误判为新增根因。

## 验证与待验

五家族 recipe 约束旧源码 5 红，修复后与真实四 Runtime Base 嵌套/retained 布局、终态 teardown 和 Base Accordion 合计 40/40 通过。此为源码/真实适配器 synthetic DOM 证据，不证明几何。下一精确发布头须重跑原 25 项，尤其五条 320px/200% 条件；原生通过前不宣称窄屏问题关闭。
