# Accordion public Runtime 路径与原生红测恢复

- 范围：Finf [PR #872](https://github.com/Proto-UI/Proto-UI/pull/872)；从已保存的第五批 source/budget head `86f2c0c52e370d703665028d8ef5cef45f0685a0` 继续。
- 原生基线：head `1d166ee703d2653cc32109dec914c31ae28bd869`、[run 37536707942](https://github.com/Proto-UI/Proto-UI/actions/runs/37536707942)、[artifact 11447935388](https://github.com/Proto-UI/Proto-UI/actions/runs/37536707942/artifacts/11447935388)。25 个旅程实际 12 过、13 失败；原红测保留。
- 2026-10-07 恢复时，先前仅本地保存的 `0d84d4381d41c0519d1ef5ab72168cd8202b70dd` 无法从 GitHub 的 commit 或 tree API 读取。本次按现存源码与原始日志重新实现其可验证的必要部分，不把本次内容称为原 commit 的逐字恢复。

## 已确认的故障

Bootstrap 2.3.2 与 LiquidGlass 尚未声明 Select projection，而四个双语 Accordion 页面默认打开 family preview toolbar。十个相关旅程在等待不存在的 combobox 时失败。此处复用第五批 Collapsible 的既有选择：这两组页面明确关闭 family toolbar，读者通过 Demo 外的站点 Header 选择四 Web Runtime；窄屏先打开真实站点菜单。没有添加冒名 family Select，也没有通过测试脚本直接修改 Runtime preference。

另三个 320px / 200% text 旅程实测页面横向溢出：Base 763px、Shadcn 323px、Brutalist 295px。它们是独立可见布局失败，不能被 toolbar 路由修正自动标为通过。

## 证据设计

- 保留 20 个 family/runtime 旅程与 5 个中文窄屏旅程。
- 公开 Header 路径仍复用原 `selectRuntime` 的 renderer、唯一 passive surface、真实框架 owner 和 11 个展开控件检查；只将其只读 readiness 部分提取为 `waitForPreviewRuntime`。
- 320px / 200% text 在严格断言之前保存实际失败截图与只读 DOM geometry，包括根横向溢出、元素边界、white-space 与 overflow 属性。失败时可以定位真实内容，而不会丢失截图。
- 页面横向溢出阈值仍为 1px；长标签不得纵向裁剪。没有提高容差、隐藏内容、强制点击隐藏控件或直接注入 owner state。
- 本地未提交截图必须明确记录 `sourceDirty`，不能伪称已发布 head 证据。最终发布后仍需精确 head 的原生 CI 和截图。

## 验证与未完成

恢复后的静态 diff 检查通过；DemoSpec、4 个双语公开路径和 browser journey source controls 共 19 tests 通过。首次新增路径断言因 Happy DOM 的 URL 根路径解释失败，改为既有 root-relative 文件读取后全绿。锁定依赖恢复过程中曾出现执行环境的 `automatic approval review was cancelled`；暂停了重复安装，并交由唯一集成者在收到明确原文授权后恢复共享安装。该信息不能推断为用户拒绝或取消整个开发任务。

本地原生执行保留了三个环境失败阶段：Astro telemetry 不可写配置路径、跨 checkout 的共享 node_modules symlink 引发 Astro CSS metadata 路径错误，以及最终 Chromium 的 Unix socket 权限限制。前两项分别由明确的临时 XDG 路径、冻结锁文件 offline/ignore-scripts 本地链接恢复解决，后者在已审查的提升执行重试后仍出现 `socket() failed: Operation not permitted`。实际页面预热已 HTTP 200，但 25 个原生旅程都未进入执行，不能计为产品红测或绿测；未弱化浏览器安全限制，也未降低断言。

最终需要提交后的精确 head 在原生 CI 上执行全部 25 旅程，读取新增失败截图和 geometry 后修复实际溢出。后续完整 family Select 引入时，工具栏优先的测试会自动走页面所声明的真实控件；显式 `data-projection-toolbar=false` 才走 Header。本次临时页面说明可在该真实投影同时引入时移除。

新原生旅程、布局定位、实际修复和最终 head 的 CI 尚待完成；此记录不声明 Accordion 或九维矩阵已经验收。
