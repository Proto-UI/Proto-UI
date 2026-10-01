# S1 交付与人工验收入口

日期：2026-09-13。状态：implementation / evidence checkpoint，non-normative。

承接 `2026-09-13-shadow-g1-s1-approved-goal.zh-CN.md`。S1 已达到可人工验收阶段：正式 public Adapter、CLI artifact、完整 Badge / Checkbox Root + Indicator 和 demo-matrix 已贯通。以下是工程与 Chrome 自动检测证据，不代替用户人工验收，不提升 draft，不宣称已发布或部署。

## 本轮提交

| Commit | 节点 |
| --- | --- |
| `babae39f` | 记录用户批准的 G1/S1 目标、验收边界与路线授权 |
| `118d69fe` | 正式公开 split 配置、类型、资源/effects/view 接线、失败清理、D/C/T 与实际 Adapter tests |
| `5de10732` | 修复嵌套 host render 后的 runtime callback phase 恢复，补 success/throw 与 controlled Checkbox 回归 |
| `f7ef853e` | 区分首次 activation 和已挂载 owner 的 move update，拒绝样式重放不误清理存活实例 |
| `7807a340` | demo-matrix S1、真实 CLI companion 生成、两种语言接入说明、Chrome 页面与 dist consumer smoke、T evidence |

继续原分支 `codex/shadow-dom-style-role-record`；未 push/merge/publish/release。原有 staged/untracked 文件保持原样，未混入这些提交。

## 人工入口与建议顺序

本地固定入口：`http://127.0.0.1:4321/zh-cn/internal/demo-matrix/#shadow-split-s1`。英文入口同路径替换为 `/en/`。开发服务关闭后，从仓库根启动：

```sh
corepack pnpm@10.32.1 --filter apps-www dev --host 127.0.0.1 --port 4321 --strictPort
```

该命令构建当前 CLI，并从同一 closure 生成 document CSS、`proto-ui-shadow-style.generated.js` 与同 stem `.d.ts`。生成文件 Git-ignored，不手工维护。S1 使用显式 profile-qualified 注册名，未新增官方 Adapter identity，未修改其余 demo 的默认 profile。

建议按页面控件进行四组检查：

1. 观察 Badge baseline 与 Checkbox 外框；切换 tone、主题变量、宽度约束与 slot，比较 Light/split。Checkbox 是完整 Root + Indicator，不是 Root-only 替身。
2. 鼠标与 Tab/Space 切换 Checkbox，检查 glyph、mixed/disabled、checkedChange 数；Enter 不切换，inner surface 不增加焦点目标。Badge/Checkbox colorScheme source 可独立切换，Light 仍用 document source，因此有意不同的 scheme 不要求视觉相同。
3. 分别启用 CSS 干扰、part、surfaceStyle、surfaceClassName，再关闭复原。内部 surface 不被 document selector 直接匹配；slotted 文本仍受 document CSS 影响；类投递不自动导入 document CSS。
4. 同步移动保持 generation；移除并隔一轮再连接增加 generation，Root/Indicator 继续同步且通知不重复。计数来自真实 lifecycle diagnostics，不由页面模拟实例生命周期。

## 本轮确认的集成边界

### Tailwind reset 是 host CSS，不受 Shadow 隔离保护

网站 preflight 从 document 侧清零 host padding/border，覆盖了生成的非绘制性尺寸贡献。未豁免时实测：Badge host 72.25×16、surface 92.25×24；Checkbox host 16×16、surface 18×18。

S1 在页面自己的 Tailwind `base` 层对已注册 split tags 使用 `padding: revert-layer; border: revert-layer`，撤销该层 reset。此后 Badge 内外 92.25×24、Checkbox 内外 16×16。页面没有计算尺寸或复制 token 数值；仍由生成式 recipe 决定 presentation。开关“取消 host reset 豁免”保留失败现象作为显式 escape 诊断，不标成 parity passing。

这沿用 `D-WEB-COMPONENT-SHADOW-PROFILE-0001-I` 的 native host CSS 边界；不是扩大成对任意外部 CSS 的保护。实际消费者也需检查其 reset 所处 layer。可复制接入代码与 CSS 豁免示例在 WC README 和两种语言的 demo-matrix 文档中。

### 失败清理与动态拒绝不能混为一谈

独立检查复现并推动修复两项环境资源问题：subscribe 先保留 callback 再抛错时，旧 callback 必须先失效；unsubscribe 抛错时，marker 恢复和 WeakMap eviction 仍必须完成，不能把 disposed environment 复用于新 generation。

新写入的 style criterion N 一度把“effect 失败”笼统写成 owner teardown，与先前 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-K` 的“保留上一份完整投影”冲突。已在首次提交前澄清 N 为 initialization/initial-effect failure rollback；成功挂载后的非法 patch 继续同步拒绝并保留完整投影与实例，不改变原已批准语义。`f7ef853e` 进一步修复 move callback 重放非法 patch 时误进入初始化清理的路径。

### 真实受控交互暴露了共用 Runtime 缺陷

页面 `checkedChange` handler 同步 `setElementProps` + `update` 后，原型继续执行 Context/a11y 同步时，Light 与 split 都报 `expected=callback actual=unknown`。根因是 kernel `renderOnce` 无条件把阶段改回 unknown，并在 render 抛错时泄漏 render phase。

修复保存进入前阶段，并在 finally 中恢复。符合 `C-CORE-SYNTAX-0002-E/F` 与 `C-STATE-0010-F/G`，不修改 Checkbox 协议、不延迟页面 handler 来隐藏错误。最低层测试覆盖 nested render 成功/抛错、返回 callback 后合法 state mutation，以及回到 idle 后仍拒绝 mutation；公开 WC 测试覆盖两种 profile 的真实受控更新。

## 验证结果与范围

环境：Node 22.23.2、pnpm 10.32.1、本机 Chrome 152.0.7977.83。

- `node scripts/analysis/shadow-split-public-browser.mjs`：真实 S1 页面完整 journey 通过，22 个对照阶段；包括首个 rAF Checkbox 内外 16×16、Badge/Indicator geometry、tone/主题/受限布局/slot、pointer/Tab/Space/Enter/disabled/mixed、逐实例 scheme、隔离/part/raw paint/class/reset 复原、同步 move、terminal cleanup/reconnect 及浏览器 ARIA snapshot。页面无未捕获错误。取消 reset 豁免属于预期 mismatch 诊断。
- `node scripts/analysis/shadow-split-public-consumer.mjs`：真实 `dist` package exports + CLI companion，明确检查无 repository source alias；Chrome 完整 Checkbox composition、16×16 geometry、pointer update 与 cleanup 通过。前置为 `build:packages` 与网站 artifact generation。
- 原有 `demo-matrix.browser.test.ts`：4/4 通过，包含全部既有 demo/Adapter mount、320px/390px 无溢出与 Base Dialog focus。运行时使用 `PROTO_UI_BROWSER_BASE_URL=http://127.0.0.1:4321`。
- 最终 WC 全套 + runtime phase guards：75 files / 288 tests passing；spec evidence integrity：3/3 passing。
- 更广的 `vitest run packages/runtime/test packages/adapters packages/cli/test packages/spec/graph/test/catalog-evidence-integrity.test.ts`：253 files，1100 passing、1 failing、34 todo。唯一 failure 是此前 F1 已记录的原有 staged `packages/adapters/vue2/test/catalog-conformance.test.ts:89` keep-alive method identity；该文件未修改/提交。故不声称整个广域命令绿色。后续 move guard 以最终 WC 全套及 Chrome 重跑验证。
- `build:packages`：43/43 public packages 成功；最终 move guard 后另外重建 WC 及其依赖。
- `check:types:workspace` 通过；`apps-www exec astro check`：195 files、0 errors/warnings/hints。类型检查曾与 CLI suite 重建 dist 并行而报临时文件缺失，串行重跑通过；Astro check 与 dev cache 同时使用曾触发 Vite 504，重启服务后消失，非组件通过证据。
- 三条既有 private Chrome 脚本 runtime/prototypes/input 重跑通过：14 dynamic pairs、8 prototype pairs 与 Root input journey；仍保持它们原有 private evidence 范围。
- workspace dataset / Agent snapshot 重生成；prototype catalog、Agent doc、Agent operations/contributor skills 检查通过，Agent operations 58 tests passing。生成投影未提交。
- 一次独立 bounded local review 加 follow-up：环境失败修复、kernel phase restoration、retained-owner guard 与页面 lifetime 未遗留具体 finding；follow-up 30 tests passing、1 historical superseded probe skipped，guard 后又跑15项 public tests。不是全分支/正式 PR approval；无 canonical live PR input，formal disposition 为 ABSTAIN。独立 review 没有替代主线程的真实 Chrome 与 package evidence。

未跑完整仓库 release-oriented `test` 或静态 website production build；未验证其它浏览器引擎、真实 screen reader、严格 CSP/nonce、native text/image、Dialog/portal 或任意 raw CSS metrics bridge。无这些支持声明。

S1 的阶段性目标为“可通过正式交付路径人工观察并验收”，不是全面稳定化。下一步应收集用户对实际效果的人工反馈；新原型准入、更强 reset/任意 CSS 兼容或 lifecycle promotion 需要各自后续范围，不由本记录自动授权。
