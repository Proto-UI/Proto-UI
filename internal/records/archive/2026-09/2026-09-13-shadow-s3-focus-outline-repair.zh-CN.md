# S3 人工验收：重复焦点轮廓修复

日期：2026-09-13。状态：修复与机器验证完成，可再次人工验收。Non-normative 工程记录；不提升 draft，不代替修复后的人工验收。

## 发现与边界

用户确认 S3 人工交互基本正常，唯一发现是 split Switch 同时显示蓝色原生焦点轮廓与灰色自定义 ring，并授权修复。

依据 draft `C-HOST-SURFACE-PROJECTION-0001` C/D/E：保持一个视觉 surface，focus target 不随 surface 自动迁移，拥有的投射必须可以撤销和重放。现有 Shadcn Switch、Checkbox、Button、Tabs Trigger/Content 明确声明 `outline-none`。CLI 将它编译为 `outline: 2px solid transparent; outline-offset: 2px`，并非字面上的 `outline: none`。

Light DOM 的焦点与样式落在同一节点；split 的透明 outline 落在内部 surface，真实焦点仍在外层 host，后者遗留 UA `outline: auto`。独立 Chrome 原生 Tab 复现了 host 的蓝色 auto 1px 轮廓。新增 S3 断言还在修复前捕获了 Tabs Trigger 同类失败。这不是 macOS 独有的必然行为，也不是产生了两个实际焦点 target。

## 修复

`packages/cli/src/services/proto-style-css.ts` 的 split renderer 仅为明确的 `outline-none` 生成同条件 host `outline: none`。复用既有 token membership、state/meta/pseudo 条件 selector，因此撤销 token 或条件失效会同时撤销 host 抑制。

- 保留 surface 的原有透明 outline 和 ring 绘制；不把透明 outline 再复制到 host。Chromium forced-colors 会禁用 box-shadow 并让透明 outline 可见，复制将再次形成双重轮廓。
- 无显式抑制、只有 ring、或只有嵌套子 Root 声明抑制时，不关闭父 Root 的原生焦点提示。
- 不改 core application role、focus target、作者 API、slot 所有权或 Light/既有 collapsed Shadow renderer。
- 不为 S3 加页面 CSS 补丁，也不将其它 outline token 自动解释为 `outline-none`。
- 不改变 artifact ABI。已有消费者需要重新运行原来的 CLI companion 生成命令；apps-www 的 `generate:proto-ui-style` 已实际运行。生成文件保持 Git-ignored，不手工修改、不提交。

## 证据

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。

- 修复前：`packages/cli/test/shadow-split-style.test.ts` 新用例失败；公开产物 S3 旅程在 `split/trigger-b/no duplicate host outline` 处以 `auto !== none` 失败。
- 修复后：CLI/WC/Focus 联合 89 文件、560 测试通过；包含 CLI 真实生成、既有 collapsed profile、WC 生命周期及 Focus 集成。
- `node --import tsx scripts/analysis/shadow-split-focus-browser.mjs`：正常与 forced-colors 模拟均通过；真实原生 Tab、无抑制与 ring-only fallback、嵌套子 Root 样式边界、runtime patch/clear、rule on/off、view 重显、移除与新实例重连。断言同时检查 host outline、surface outline/box-shadow 和实际 activeElement。
- `node scripts/analysis/shadow-s3-public-browser.mjs`：公开 dist + 真实 CLI companion，Light/split/mixed × L1/keepMounted 完整旅程通过。共用 `shadow-s3-journey.mjs` 新增 host 无重复轮廓与 surface ring 检查，demo-matrix 测试也使用这些断言。
- Spec graph/关系 7 文件、13 测试通过；完整 workspace types 与 Astro 202 文件检查通过；agent operations 58 项通过；prototype catalog 与重新生成的 Agent snapshot 检查通过。
- 页面联合回归（466.94 秒）：S1 5 项、S3 中英文 × 两种 view 策略 4 项完整通过；S2 4 条交互断言通过但 suite 收尾 hook 在 60 秒超时，该联合命令退出 1，不能标成整体通过。运行期间没有并行网站生成器或 Astro check。
- 随后复用独立启动的 `4321` 服务单独重跑 S2：4 项全部通过、收尾正常，命令退出 0（73.85 秒）。这次重跑未改测试、未放宽断言或超时；没有据此宣称已修复或根因定位测试收尾的偶发现象。清理本批超时遗留的临时测试服务器；`4321` 服务保留供人工复验。

联合命令：

```sh
corepack pnpm@10.32.1 exec vitest run packages/cli/test packages/adapters/web-component/test packages/modules/focus/test --pool=forks --no-file-parallelism
corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts apps/www/src/content/docs/zh-cn/demo-shadow-split-s3.browser.test.ts --pool=forks --no-file-parallelism
PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts --pool=forks --no-file-parallelism
```

证据自检曾发现最初的 descendant fixture 使用了未配置 resolver 的 Template Style，实际没有绘制其 token；将样例换为真正声明并绘制 `outline-none` 的嵌套原型，并增加子 surface 样式断言后，重新完整运行专项脚本通过。未将无效样例作为最终证据。

## 保留限制

forced-colors 仅是 Chromium 的 outline/box-shadow 回归模拟，不是完整高对比度视觉等价、操作系统设置、其它浏览器或读屏器验证。用户尚未确认本次修复后的人工结果。

没有运行全仓 `test`，不宣称全仓绿色。保留无关暂存与未跟踪文件，不处理此前记录的无关 Context catalog baseline；仅按既有本地节点提交授权收口，不进行远程写入、发布或合并。
