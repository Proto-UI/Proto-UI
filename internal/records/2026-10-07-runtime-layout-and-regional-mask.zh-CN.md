# Runtime 上下间距与 Proto-based 局部切换遮罩

Finf #872 的新增用户要求：切换 WC 到 React/Vue 时上下间距应一致；以真实 Proto UI 原子组成的示例区域遮罩替换底部临时文字提示，一同进入现有 PR。

## 间距根因与消费层修复

首页 `composeHomepageText` 将独立标签/说明/标题文本的载体声明为 `span`。WC 的载体仍为 custom element，其 Adapter 默认 block；React/Vue/Vue2 则使用未显式声明 display 的原生 span。框架因此引入不同的父字号 line-box strut，尽管布局 gap 不变，上下几何仍有差异。

仅在这些明确的块级文本消费位添加 `surfaceStyle.display: block`。公共 Text、Adapter 默认值及合法 inline 内容均未全局修改。原实现真实四 Adapter 渲染的 display 输入检查为 6 失败、2 通过；相同断言修复后 8/8，通过合法 inline 负边界的最终相关集合为 77/77。扩大集合另有原本的 homepage-showcase 原型数 36/37 两条失败，保留为独立事实，不以本次样式修复改写计数。

## 稳定宿主上的真实原子遮罩

`runtime-loading-mask.ts` 是 Website composition，不新增 homepage 私有 Prototype。它用当前 family 的真实 Surface、Text、Button 构建 scrim、状态卡与动作，始终由独立 WC 宿主渲染，不依赖目标框架下载。各 family 通过既有完整主题解析/应用/watch 获得自身明暗 tokens，不能继承另一体系的文档默认值。

遮罩局限于首页交互示例区域；不创建全页 Dialog、焦点陷阱或 body scroll lock。忙态继续由稳定内容宿主和原有 candidate request gate 表达。面板使用可滚动的 sticky 布局及视口高度上限，不给演示内容设置固定高度，也不引入需绕过 reduced-motion 的动画。原 aria-live 状态保留在 busy 内容外；公共 Text 负责可见文字，避免重复播报。

切换失败保留原 generation，并显示真实 Button 重试。重试开始时将被隐藏 Retry 的焦点交给仍可见 Cancel，完成后只在遮罩仍拥有焦点时返回 Runtime 控件。取消使用新增的 application controller `cancelPending()` 撤销未完成目标，解锁原 generation，不重建已有输入；过期成功/失败仍不能接管页面。异步解锁失败具有可重试的恢复状态；连点取消沿同一 candidate 的锁队列串行恢复，不能提前声称完成。

## 独立审查与保留失败

独立审查发现并复现了缺失 Brutalist 主题、Retry 焦点丢失、异步取消恢复与双取消竞态；均已修复并补回归。最终独立 focused 76/76 通过，审查范围内未剩新的源代码问题。源码、控制器与集成扩展检查、最终 types 和原生证据各自报告，不能混称完整视觉验收。

## 原生证据计划与限制

`runtime-layout-parity.browser.test.ts` 保持同 route/locale/family/theme/font/viewport，在两 family × 1440/390 的首页执行 WC→React→Vue→Vue2→WC，并比较卡片、设置区域、真实文本行框；另覆盖 docs RuntimeBox 与原生文档文字，保留重新引入 inline 的几何负对照。

`runtime-loading-mask.browser.test.ts` 覆盖两 family 的桌面明色、320px/深色/200% 字号/reduced-motion，原生键盘取消、原输入/DOM 保留、真正 family 原子与主题、局部边界和焦点返回。网络延迟/失败是明确的 fixture 输入，不冒充性能测量。失败目标的原地 Retry 仍要求实际浏览器通过；模块失败缓存具有浏览器版本差异，不能从 mock materializer 成功推断。

两套共 12 例登记标准 runtime plan，并由只读 `runtime-switching-evidence.yml` 对精确提交运行、无论成功失败均保留图像/几何/环境。当前本地 Chromium 在正常与已审查提升执行中仍受到 Unix socket 限制；没有绕过限制，没有新 native pass 或截图，旧图也未作为新效果证据。最终 CI、移动端 paint 和网络重试结论仍待实证，Finf 全项验收状态不变。
