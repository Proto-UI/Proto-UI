# Portal 继承方向：先保留可判别的原生基线

Finf [PR #872](https://github.com/Proto-UI/Proto-UI/pull/872) 的 Select 投影静态检查指出潜在宿主问题：真实消费者在 RTL author 容器内，popup 经 renderer portal 投射到 LTR body 后可能丢失继承 direction。四 Web bridge 当前只保存 logical ancestry；这一源码观察尚不是浏览器复现，因此本增量不先修改 host 实现。

`HC-OVERLAY-PORTAL-0001-A` 与 `C-AS-OVERLAY-0001` 约束此宿主投射、renderer ownership 与保留实例边界。本次是在该边界上调查用户要求的 Web 继承方向保真度，不以探针结果擅自准入 draft 或推断所有 CSS 继承属性都已保证。

## 八个真实页面配对

- 使用现有 Shadcn 首页 Select，而非尚在开发的 Bootstrap/Liquid Select，避免把新风格构造错误混入公共宿主故障。
- 四 Web runtime × 两种 body direction。Runtime preference 只用于启动 fixture；真实 Select 使用原生 pointer/keyboard 激活。
- 配对条件依次是 owner/body 同方向控制、打开期间 owner 改成相反方向、关闭后重新打开、打开期间恢复同方向。
- 原生 `getComputedStyle` 同时观测 Trigger、popup 和所有 option，检查 popup 真实离开 author 容器。截图和 geometry 在任何方向断言前保存；原始失败不会因为第一个 expect 而抹掉后续配对证据。
- dir 属性是公开 DOM author 输入，不注入坐标、computed style、Select owner state 或伪造控件。

标准 runtime plan 新登记文件；独立只读 Actions 工作流运行完整八例并在失败时保留截图、来源 SHA、浏览器/字体环境与 JSON 结果。它不替代标准 CI 或既有 scrollbar/RTL 断言。

## 当前边界

本地已有 Chromium 启动在受限执行与已审查提升执行中均因 Unix socket 权限失败的实证；不通过改启动安全策略绕过。当前仅完成 source/type/工作流检查，原生基线等待精确提交上的 CI。只有确认 matching control 正常而 opposite owner 条件失败后，才修正公共 Web host 的 direction projection，并补 dynamic direction、author override、cleanup、provider replacement 与 reparent 的适用回归；不把 DOM 细节塞进 portable Prototype。
