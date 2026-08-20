# Scroll Area composed feedback 家族 session

日期：2026-07-29

状态：非规范性工程记录。稳定语义以 `spec/**` 中的 `D-SCROLL-COMPOSED-PROJECTION-0001` 与 `C-SCROLL-COMPOSED-CHROME-0001` 为准。

## 本轮结论

在 Scroll Area architecture slice 与本地预览之后，维护范围扩展到常见应用场景。第一步先闭合 composed chrome 的被动反馈，不同时引入 Thumb drag。

采用家族级 host projection session：

- Root 通过 JSON-only Context value 建立逻辑 family scope。
- Scroll module 只使用 nearest Context provider identity 作为 module-internal opaque scope token；session、host target 与函数不进入 Context value。
- Anatomy 解析同一 domain 内的 Scrollbar 以及它实际包含的 Thumb，并通过受限 internal port 解析当前宿主 target。
- family session 同时订阅 Anatomy 的结构顺序与 target readiness；React/Vue 等适配器在 claim 已建立、宿主 target 稍后挂载时会刷新同一 attachment，而不是固化第一次解析到的空 target。
- Viewport 的 `asScrollSurface()` handle 通过 setup-only `bindComposedChrome` 声明 scope、family roles 与 orientation expose key。
- Scroll surface host lease 同时接收 normalized facts 和 composed control attachment。Web host 使用 track 本地 geometry 直接更新 Thumb CSS variables、尺寸与 transform；逐帧 scroll 不更新 Context，也不触发 prototype rerender。
- 其他宿主可以使用同一 logical attachment 驱动 native painter/widget，并不要求 logical parts 与 host nodes 一一对应。

## 第一阶段保证

- Thumb extent 与 visible ratio 成比例，并受宿主最小可见长度约束。
- Thumb offset 在可用 track travel 内随 normalized position 移动。
- scroll、surface/content/track resize、orientation/part replacement 可以刷新投影。
- host session dispose 恢复其覆盖的 inline style 与 observer。
- 无 overflow 或无可用 track extent 时不显示占满 track 的伪 Thumb。
- Thumb 仍是被动反馈，不获得 focus、`role=scrollbar` 或 drag guarantee；Viewport 保留宿主原生 wheel、touch、keyboard 与程序化滚动。

## 后续交互阶段

第二阶段将继续在同一个 family session 上增加 pointer capture、Thumb-local press offset、normalized drag request、track page request、wheel forwarding、pointercancel/target replacement cleanup，以及 RTL/reversed-axis 验收。Host 应先执行 request，再通过同一 surface facts 回报位置；Thumb 不维护乐观的第二套 offset。
