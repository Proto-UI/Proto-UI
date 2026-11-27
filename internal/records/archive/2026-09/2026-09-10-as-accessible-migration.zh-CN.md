# asAccessible 作者入口迁移

用户已接受在 0.3 main 直接用 `asAccessible()` / `AccessibleHandle` 替代 `def.a11y` / `A11yDefAPI`，无兼容期、无旧入口别名、不回补 0.2。

统一入口返回当前逻辑实例的唯一声明 handle；setup 重复获取不重置声明，单值字段或同 key 声明最后一次生效，tree 按字段合并。声明和保存 handle 上的方法都限 setup，动态值由已有 State 驱动。没有新增 dispose、通用 runtime mutation、多对象创建或 host target API。

A11y 拥有可投影的语义表达，State、Focus、Anatomy、Trigger/Event 和领域模块保留事实、行为与目标解析所有权。调用 asAccessible 不构成完整无障碍认证，也不安装键盘或焦点策略。

本轮基线 e15a5adf。#625 在开始时仍 OPEN；不提前接纳其 opaque ref 或内部 relation mutation port 为公开作者 API。其合入后需要对同一 A11y 模块的增量进行集成复核。action 仍只保留现有声明边界，不声称完整辅助技术执行通路。

历史 Record 和 0.2 发布记录保留原样；当前规范、作者文档、官方原型及测试随新入口迁移。

## 验证进展

- 新 handle、既有 A11y Runtime、Vue 2 heading 定向测试：39 项通过。
- 全量非浏览器测试首轮：455 个文件、2164 项通过；唯一失败为新增 hook source 尚未进入 Git 索引，补入后 catalog evidence integrity 3 项通过。无运行时行为失败。
- 43 个公开包构建中 42 个通过；Shadcn Close Icon 迁移暴露缺失直接 hooks dependency，补齐 dependency、lockfile 和生成 BOM 后，Shadcn 及其 11 包依赖闭包构建通过。
- 完整 workspace/docs types、类型契约、Spec authoring、prototype catalog、公开 manifest、全部九个入口体积预算、release assets、Agent operations 和 public docs 检查通过；重新生成本地投影并通过 Agent doc check。
- 新增 asAccessible 在 authored asHook 中作为 child handle 被记录；旧的 context capture bucket 不是公开语义，依 C-AS-HOOK-0005 对应测试改为检查 child handle 与实际 IR。
- Shadcn 控件真实浏览器回归 5/5 通过，覆盖焦点、Textarea 明暗主题、Checkbox 可聚焦目标和无名 glyph。未运行完整发布/安装消费者 smoke 或全量浏览器矩阵；不将有界浏览器结果解释成完整辅助技术认证。
