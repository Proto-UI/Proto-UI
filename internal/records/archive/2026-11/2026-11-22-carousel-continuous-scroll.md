# Carousel 连续滚动与响应式视口

## 需求与边界

本记录对应用户明确提出的三个缺口：连续拖动/滚动、吸附、响应式多项视口。此前的实现只在手势结束且超过阈值后切换一次索引，非当前 Slide 使用 `hidden` 从布局移除；这无法形成可拖动的连续内容条，也不能用单项索引覆盖多项视口。

本次先在 `P-BASE-CAROUSEL` 定义等尺寸项目、实际容量、已提交索引和结束吸附，再实现 Base 行为与各家族继承。Web 测量、滚动位置、RTL 原生偏移仍在通用 Scroll host 中处理。没有添加 Carousel 专属编译器分支。

## 上游参考

已于 2026-11-22 阅读官方 Embla v8 文档：

- [Slide Sizes](https://www.embla-carousel.com/docs/v8/guides/slide-sizes)：项目沿滚动轴排列，布局尺寸驱动滚动计算；尺寸变化后重新计算吸附点。
- [Options](https://www.embla-carousel.com/docs/v8/api/options)：轴、方向、吸附、末端约束和循环是分别定义的选项。

这些资料用于区分能力边界。当前 Shadcn 源文件保留 `shadcn-ui/ui@3d98900e` 的样式参考，不引入 Embla runtime。本切片实现等尺寸项目、末端对齐与两端索引循环；不同尺寸项目、惯性动画、无缝无限循环和自动播放没有被描述为已经实现。Bootstrap 历史转场也保留为独立外观边界。

## 已定义并实现的所有权

- Root 继续拥有 `index/defaultIndex`、`indexChange` 和 `requestIndex`。增加 `slidesPerView`（默认 1）与 `minSlideSize`（默认 0 逻辑宿主像素）；实际 `visibleSlides` 和 `maxIndex` 根据 Scroll 可见比例计算。
- Viewport 通过 Axis Input 接收归一化接触变化，每个有效样本都请求实际滚动，松手或原生滚动静止时提出最近吸附索引。中间预览不改已提交索引；拒绝受控提议时回到原索引，接受时使用新的索引。
- Slide 参与完整连续布局。其 `current` 表示已提交吸附项，`hidden` 按实际视口交集变化，通过不可见及无障碍树投射撤出屏外交互，不使用原生 `hidden` 或 `display:none` 破坏内容条长度。
- 所有家族共用这套行为与等项基准。Shadcn 去除覆盖 Base 响应式尺寸的 `basis-full`；五个真实文档配方请求两项和 180px 最小尺寸。
- `C-SCROLL-AXIS-SYNC-0001` 明确新增独立 callback-only `sync({axes})`，保留 setup-only `configure`，保留宿主 facts 权威、同一 logical identity 和当前 lease。通用 Web host 统一 RTL 负偏移，并允许普通 split system surface 使用横向、纵向或双轴。反向 flex 流和垂直 writing-mode 不在此有界规则内。

## 验证证据和限制

`carousel-continuous.test.ts` 通过真实 Runtime/Web Component Adapter 组合 Base、Shadcn、Brutalist、Bootstrap 2.3.2 与 Liquid Glass，覆盖松手前位移、最近吸附、原生滚动静止、受控拒绝/重复请求/同步及延迟接受、多项末端约束、触摸取消、捕获丢失、禁用、轴切换、视口改变、卸载与 RTL/纵向输入。模型测量由测试显式提供，不能替代真实浏览器布局与物理输入验收。

`web-scroll-axis-direction.test.ts` 验证 LTR/RTL 各类请求、原生位置事实、RTL end-follow/键盘离开、composed Thumb 映射和 split surface 退役。`impl-spec.test.ts` 增加 callback 门禁、无变化不更新、detach 后记录下次轴、初始 facts 重入变轴等案例。已有 Scroll host/bound-host 用例保持通过。旧 Carousel 控制测试发现的 defaultIndex 早期收窄回归已经修复；取消与父 provider 提前退役的顺序也有覆盖。

证据映射见 `T-BASE-CAROUSEL-CONTINUOUS-0001`。真实浏览器多 Adapter 验收由本 PR 集成记录单列；GPUI/non-Web、全辅助技术和独立稳定准入没有被本记录中的 DOM 模型测试认证，相关实体继续保持 draft。
