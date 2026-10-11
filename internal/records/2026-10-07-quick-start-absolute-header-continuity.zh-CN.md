# Quick-start 首帧的绝对页头布局

## c316 原始证据与独立问题

精确源码 `c316481ab18007601e47d7e298f3729456c2cb22`，首帧 Actions `37634782414`：10 条中 9 条通过。React / 390px / dark / cold 的四个 transition frame 横向溢出为 0、10、10、0px。正文九个目标在第一处 10px 变化时几何不变；旧 trace 没有记录越界元素，不能因此宣称已定位它的具体节点。

另亲看该条件的 first-frame/hydrated 原 PNG：SSR Header 先展示 Runtime 第二行，增强后移入菜单，标题与全文整体上移约 89px。旧 oracle 只比较相对标题的正文坐标，把共同位移抵消了；这不是首帧连续性通过的充分证据。

## 消费层修复与更强取证

文档 Header 服务端将唯一 Runtime 偏好 owner 放入原生 details，保持无 JS 可打开；紧凑模式从第一帧就是与增强后相同的一行布局。桌面增强时移动同一个 owner 到显式宽屏位置，销毁恢复作者的原生位置。没有复制控制器、隐藏正文、禁用交互或设置统一占位高度。

紧凑 PageFrame 的 CSS 初始 Header offset 改为真实单行 3.5rem，后续仍由原 ResizeObserver 反映实际高度。主页的已有初始 owner 不变。

每帧新增 Header 绝对矩形、标题 viewport/document 坐标和 scroll 位置检查，仍使用 1px 精度，并用负控覆盖“正文相对坐标完全相同但全页一起移动”、单独滚动及无效测量。旧 10px 横溢出断言保留，失败 frame 额外保存具体元素、scrollWidth、透明度与 staging/inert 归属。新 no-JS 路径检查原生菜单打开后唯一偏好 owner 可见。

## 验证边界

针对发布 c316 的原样源，新 Header startup/位置负控实际出现 3 红；候选 Header ownership、Surface/Select 生命周期、布局源约束和首帧几何/门闩检查通过。原像素和红日志保持不变。

联合 types 由 integrator 在当前 heavy 检查时段完成，本工作树没有再占用重检查。没有重试本地 Chromium socket 限制。必须在新精确头重跑全部 10 条官方 native 用例；约 89px 布局修复和仍待具体定位的 10px 过渡溢出分别判定，不能只看最终 hydrated 的 0px。

依赖：先应用 native-evidence-trigger-closure.patch；本包将该首帧 workflow 路径扩为 quick-start-first-frame*.ts，以覆盖新共享几何 oracle。
