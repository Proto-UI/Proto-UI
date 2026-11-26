# Quick-start 首帧取证的加载门闩修复

## 实测失败

- 精确源码：`f91b80c45edc992beb0cdb2e77224a67c9c998a5`。
- GitHub Actions：`https://github.com/Proto-UI/Proto-UI/actions/runs/37616450686`。
- 浏览器任务在页面返回 200 后达到 20 分钟 step timeout；原 artifact `11480368915` 仅含 5 个环境/日志文件，没有首帧 PNG 或用例结果。因此这次不能宣称 10 条首帧断言通过或失败。
- 原 ZIP SHA-256：`5e7c36ff7754b4dbd0016a92cef83ba56d31d21c6a9b7bb4a9717611fb9d0691`。

## 可确定的测试依赖环

测试先暂停可执行模块请求，首帧保存后才释放，但在释放前等待 `document.fonts.ready`。CSS Font Loading 的 FontFaceSet ready 还依赖 document 完成加载。锁定版本的 Playwright `screenshotter.js` 同样在截图前等待这个 promise。这两个等待都可能依赖测试自己的模块释放；任务日志没有更细阶段记录，不能声称它定位到了其中某一个 await。

- 规范：<https://drafts.csswg.org/css-font-loading/#fontfaceset-interface>
- 原生截图接口：<https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot>

## 有界修复

- 门闩前只显式加载当前 9 个被测文字区域实际使用的字体，并在测量中记录和断言 `document.fonts.check`；不省略字体条件。
- 通过 Chromium 原生 `Page.captureScreenshot` 保存原始当前 viewport PNG，避免 convenience screenshot 隐含的全 document 字体等待。没有改图或重建页面。
- 字体/截图等待限时 15 秒；记录每个 precondition 阶段。导航、选择器、样式、字体等前置失败也尝试保存独立原生 viewport 和原始异常，随后原样重抛。
- 保留脚本释放前的逐帧 observer、非空 trace 断言、失败 trace，以及原有 1px 几何和逐字体/paint 相等断言。没有隐藏正文或降低通过标准。

## 验证与剩余项

- 新增 4 条源码约束测试通过。
- workspace/docs 类型检查：535 files，0 errors、0 warnings（7 hints）。
- 本地 Chromium 的既有 socket 权限限制未改变；此次没有再尝试启动。需要在下一精确发布头重跑官方 native workflow，实际首帧视觉连续性仍未验证。
