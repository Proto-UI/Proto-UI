# Focus 编目与 Entry Adapter 漂移修复

日期：2026-09-08。基线：Trigger commit `aa62c195`。本记录为非规范工程上下文；正式方向由 draft spec 实体持有。

## 编目

新增 `M-FOCUS-0001`、`HC-FOCUS-TARGET-0001`、`HC-FOCUS-ENTRY-0001`、`T-FOCUS-0002`，补齐四 Adapter 有界支持与提供关系。Target HC 表达逻辑 target、当前 view、资格、请求与 readiness；Entry HC 表达独立的 region delegation 与 fallback 投射。既有 Event default-action capability 继续服务 keyboard navigation，不创建重复能力。

Focus 组合 State observed facts 与 Event，使用共享 FocusCenter 仲裁 logical ownership、roving 和 scope。Collection 不是强依赖；selection 和 A11y policy 不迁入 Focus。本次不提升实体 lifecycle，也不调整 A11y 作者 API。

## 已复现漂移

依据 `C-AS-FOCUS-ENTRY-0001-D/G` 与 `D-FOCUS-ENTRY-DELEGATION-0001-C`，有合格后代的 descendant-first region 应委派真实 target，容器只在需要 self fallback 时进入顺序导航。新增真实框架 fixture 在 React、Vue3、Vue2 上失败：三者缺少 Entry resolution/projection cap，fallback 将容器错误设为 Tab target。Web Component 同样 fixture 通过。

将原 Web Component 的 entry resolution 提取为 Adapter-base helper，保持既有 Web 候选策略，再补齐三个 Adapter 的 capability wiring。没有在 Prototype 中绕过问题，也未扩大 Core API。

## 证据与保留边界

四 Adapter 共同覆盖 descendant entry、container fallback、entry disable、logical roving membership、navParticipation none 仍可程序化聚焦、owner facts 切换、disabled request 拒绝以及 fresh owner。已有 Runtime/Module 测试负责 singleton/setup 限制、pending/rejected request、retained view、scope gating/restore 与 deferred roving entry；相关 Tabs、Button、Dialog 消费者纳入验证。

当前 FocusCenter 用 HTMLElement document order 排序且为共享单例。非 Web order protocol、跨 document focus domain policy 留在 `M-FOCUS-0001-Q-PORTABILITY`，不通过本轮编目暗中固定。DOM 模拟测试不代替真实浏览器 Tab 顺序、布局、portal 与辅助技术验收。

后续按 roadmap 进入 Boundary 与 Hit Participation；需要设计决策时再暂停。
