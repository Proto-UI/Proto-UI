# Runtime entry 网络失败后的原地 Retry

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## 问题与范围

Finf #872 的既有 native run `37616450610` 中，shadcn、brutalist 两个公共 Retry Button journey 均在一次 `react-runtime.ts` 请求 abort 后等待 React ready 超时。旧工件没有请求计数，不能仅凭旧日志声称已经独立证明浏览器 module-map 因果。旧 `lazyModules` 只清应用层 Promise；浏览器可能继续以相同 URL 返回已缓存的 import 拒绝。

本次只修 Website 已批准的 Runtime acquisition 边界，不更改 Proto 协议、family atom 所有权、projection generation 接管或取消语义。依据是既有运行时切换/区域遮罩需求及 `2026-10-07-runtime-switch-layout-and-mask-followup.md`；其验收状态没有因为源码测试通过而升级。

## 实现

- 维持首次 literal dynamic import，保证现有构建图和懒加载入口可追踪。
- `retryableModule` 按模块共享未完成/成功 Promise；失败保留可见错误，下一次 acquisition 才以增加的 `pui-runtime-retry` 参数重取受控 URL。它不刷新页面、不操作 controller/DOM、不解析异常消息中的 URL。
- Vite 插件只为固定的 11 个来源建立 URL：三种 Runtime entries、三个 Adapter entries，以及 React、ReactDOM、ReactDOM client、Vue、Vue2。开发态使用 Vite 自己转换的受控 import probe AST，避免将 raw CommonJS 文件错误当作浏览器 ESM；生产态使用 Rollup emitted chunk URL，保留完整 namespace exports 和 dynamic-only 边界。
- 重取前校验 HTTP(S) 与页面同源；URL 不能由失败文本或用户输入决定。ReactDOM loader 同时接受优化后 ESM 的 default namespace 和既有 namespace，继续保留 commit/portal/client root API。
- 保留原 `.ts` 一次 abort 注入；新增请求 URL 计数、console/pageerror、无整页导航、失败期间原输入保留及二次失败截图。生产模式通过 bundle graph 的精确 source module 找到同一个 emitted chunk，而不是改换失败目标。
- 既有 exact-head workflow 的 14 个 source-native journeys 不删减；新增生产构建后的 6 个原有 mask journeys，包括两家族 Retry 与取消/迟到完成。没有设置 `--no-sandbox` 或放宽安全边界。

## 已执行证据

验证基线：local `d12c6a299`，独立 worktree；为 docs 验证单独使用已审 Field MDX 十页修复作为先决条件，它不属于本修复增量。

- 合成但按 URL 持久保存失败的 module-map 负控：将恢复分支退回原 URL 后，7 例中 6 红；恢复实现后 7/7 绿。此结果不是原生浏览器证明。
- renderer / runtime loaders / host lease / projection-scope / mask focused：10 files，100 tests 全绿。覆盖晚到任务、取消、回当前 generation、import-boundary lease replacement、实际 React portal/commit APIs 与模块懒加载。
- Vite URL 测试：3/3 绿，含真实 Vite production emitted chunks/exports/lazy edges、dev transform，以及已安装 CommonJS React 三入口经优化后的可执行 ESM。
- `apps-www check`：0 errors、0 warnings（7 hints）。
- 实际 renderer production 编译通过；完整网站第一次在 baseline Field MDX 解析处受阻。纳入独立先决后，client assets 与 363 页生成完成，production bundle graph 检查通过；随后 Pagefind 进程被 kill（137）。限制 Pagefind worker 后，独立 Pagefind 对 339 页/2 语言索引成功，但完整 bounded rerun 又在页面生成中被 kill（137）。因此完整 `docs:build` 仍是失败/待 canonical 环境重跑，不能把局部成功写作全绿。

## 未验证与后续

本机 Chromium 的 Unix socket 限制已在既有工作中确认；这次没有反复无变化启动，也没有新截图或 native pass。接下来由集成人将本增量与 committed-family mask 修复合并，跑同一 exact head 的 source 14 例与 emitted 6 例，检查请求从原 URL 变为同路径新 query，Retry ready、取消后原输入/焦点/DOM 留存以及迟到任务不接管。

11 个显式边界覆盖不等于任意未知 transitive chunk 或任意模块求值错误都已经获得原生恢复证明。产品验收与 Finf 全项状态仍需按实际 native 结果决定。没有替换旧失败工件，也没有使用旧图冒充本版本。
