# Shadow split S5：交付与人工验收入口

## 状态

S5 已达到人工验收就绪；不是已经完成人工验收，也不是 stable / 发布声明。目标与授权见 `2026-09-14-shadow-s5-approved-goal.zh-CN.md`；原生投射与两项焦点修复见 `2026-09-14-shadow-s5-native-realization.zh-CN.md`。

本地节点：`7f1a9663` 记录批准目标，`47c30cc7` 实现 native surface / bounded recipe / focus ingress / composed entry；本记录随验收场景提交。没有 push、发布或修改独立 #645。

入口：`http://127.0.0.1:4321/zh-cn/internal/demo-matrix/#shadow-split-s5`，英文对应 `/en/internal/demo-matrix/#shadow-split-s5`。

## 已实现的范围

- 官方 Base Input、Base Textarea、Shadcn Textarea 及 Tabs 组合，Light / split / mixed 三列。
- 单一原生 editor 直接位于 open ShadowRoot，同时为 `part="control surface"`。没有额外绘制 div，也没有新的作者 API。
- 复用已有受控/非受控、composition、selection 保留、focus、a11y 与 native leases。普通 commit 不重新插入 editor；view 撤销移除 editor 并撤销 leases；owner stylesheet/environment 保留，终止时统一回收。
- native intrinsic/rows 与精确 `w-full`、`min-h-16` 尺寸 recipe。原生 padding/border 由 editor 自身计入，其他 dimension/aspect token 继续 fail closed；旧 companion 需要重新生成。
- 实际 native focus 只进入一次，避免 Shadow retargeted host 覆盖 `focusVisible`；Tabs entry 查询和观察覆盖 open-composed tree 内原生 editor，避免额外 panel Tab 停靠点。

## 页面集成的真实差异

独立消费页面的尺寸比对通过后，正式页面曾因两套网站 reset 失败：Tailwind `base` 和 Starlight `starlight.reset` 分别影响 Light 原生编辑器，Shadow 内不受这些 selector 影响。检查 CSSOM 的实际 layer 后，在各自原层为 S5 撤销 reset；未复制字体/尺寸数值，也未往 Adapter 增加文档 CSS 推测。Base 保留 UA 外观，Shadcn 继续使用生成式 token。

早期将 Starlight 规则误判为 unlayered 的尝试没有修复问题；最终实现明确使用 `@layer starlight.reset`。这仍是消费者 CSS 集成，不是对任意外部 CSS 的保护保证。

## 已执行的证据

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。本节是本次本地执行结果，不代表已发布包或 Safari/Firefox 结果。

| 检查 | 结果 |
| --- | --- |
| 全部公开包 build | 43/43 通过；后续焦点变更的 WC 依赖闭包 35/43 重建通过 |
| WC 测试（排除无关暂存的 Context integration）、native router、Text Control、CLI Shadow、spec fixtures | 104 文件 / 443 测试通过 |
| `check:types` | 通过，209 个 Astro 文件 0 error / warning / hint |
| `check:prototype-catalog` | 通过 |
| `spec:docs:agent` / `check:agent-doc` | 生成及检查通过；生成快照未提交 |
| `check:agent-operations` | 检查通过，58 测试通过 |
| runtime browser suite registration | 3 测试通过，S5 纳入 shared-server 串行阶段 |
| S5 独立 public-dist / CLI Chrome journey | 通过，bundle 输入断言禁止 packages 源码替代 dist |
| 正式页面 S1–S5 串行浏览器回归 | 6 文件 / 18 路径通过，568.40 秒；包含 S4 关闭后绘制检查 |

主要复跑命令：

```sh
corepack pnpm@10.32.1 build:packages
corepack pnpm@10.32.1 --filter apps-www generate:proto-ui-style
node scripts/analysis/shadow-s5-public-browser.mjs
PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321 corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/demo-shadow-split-s5.browser.test.ts --pool=forks --no-file-parallelism
```

完整浏览器集合为 `demo-shadow-split-s1`、`s2`、`s3`、`s4`、`s4-paint`、`s5` 六个 `.browser.test.ts` 文件。测试期间冻结源文件和生成产物，防止 HMR 重置场景。

没有运行或声称全仓 `pnpm test` 全绿；未把无关暂存改动纳入本任务提交。原有暂存 diff 的 SHA-256 在本节点前保持 `ab75260df9b455fff9069751b7955a74258f5ca4a074c4683c751b74bf7d328f`。

## 人工验收清单

1. 分别在三列输入英文、中文和多行内容；真实系统 IME 下观察候选、确认和取消，不应丢字、重复提交或跳动光标。自动 composition 测试只是协议模拟。
2. 比较鼠标与键盘 focus ring、选区和光标移动。点击上方控制按钮本来就会转移焦点；自动路径另行验证不转移焦点的 props 更新和选区保留。
3. 开启“拒绝受控提案”，Input/Shadcn 的普通编辑恢复已接受值；取消后正常输入。Base Textarea 的脏值不因无关 props/defaultValue 更新被覆盖。
4. 切换 disabled、readOnly、rows、light/dark 和 surface customization；检查真实输入行为、原生大小、主题及定制撤销。
5. 反复切换 Tabs，分别验证默认 view 卸载和 keepMounted；Tab 从选中 Trigger 直接进入 editor，不多停靠 panel。受控值由 Maker 模型保留。
6. 移除并重连：受控值保留，非受控值按新实例 seed 重置，通知不重复。检查 Chrome 和 Safari；Safari 尚无本次自动验收结论。

## 仍然明确不承诺

所有相关 split / Text Control 语义保持 draft。没有 Form、validation、富文本、auto-resize、新 selection API 或 Image View；没有任意 CSS 尺寸等价、closed Shadow 或跨 document 准入。AX 路径验证原型 `ariaLabel` 命名的真实 textbox；外部跨 Shadow `labelledBy` / `describedBy` IDREF 不能据此宣称支持。#645 的 Dialog 快速重开公共修复仍独立，不作为本次已解决事项。
