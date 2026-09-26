# S5 原生 surface 与焦点实现节点

承接 S5 approved goal，保持全部相关实体为 draft；不改 #645。

## 实现选择

- 原生 input/textarea 直接成为 `part="control surface"`，不创建第二个绘制 div。普通 commit 保持 editor 身份，view detach 移除 editor 并撤销 leases，不清空 textarea defaultValue；owner stylesheet/environment 保留。
- 私有 native `l1` receipt 保持 v1 artifact ABI，旧 companion 在注册前明确拒绝。当前尺寸 token 只准入 `w-full`、`min-h-16`，其他尺寸/aspect fail closed；原生 intrinsic/rows 由浏览器提供。Native 使用 block boundary，editor 自身计入 padding/border，不套用 div grid stretch/负 margin recipe。
- 现有原型与作者 token API 不变，Image View 继续拒绝。跨 Shadow 的外部 IDREF 不因本次 admission 自动工作；本次 AX 证据采用原型 `ariaLabel`。

## 浏览器发现并修复的两个焦点卡点

1. 原生 focus/blur 原先从 editor bridge 注入 router，同时 Shadow composed focus 在 host 再次触发监听。第二次事件的 target 被 retarget 为 host，使逻辑 `focusVisible=false` 覆盖原生 editor 的 `:focus-visible=true`。现在 router 为 WC native editor 直接绑定 focus/blur；其它 host 事件仍在原 boundary，默认 Adapter 路由不变。没有停止原生 focus 传播，也没有派发伪造 focus。
2. Tabs entry resolver 原先仅 query Light DOM，不能发现嵌套 Shadow editor，错误保留 panel tabindex=0。现在复用 S4 同 document/open-composed-tree 采样，原生 editor 是 entry descendant；entry observer 同时订阅现有 open roots，并在结构变动后更新观察集合。native disabled、移除和重挂载会更新 fallback，terminal dispose 撤销 observer。

复现与修复证据：`shadow-s5-public-browser.mjs` 新增 native focus-visible 与 Trigger→Tab→editor 断言，曾分别失败；修复后 Chrome 152.0.7977.83 通过。DOM 层增加精确事件身份/单次 ingress/撤销，以及 Shadow 内 editor eligibility 更新测试。

Happy DOM 将无 tabindex 属性的原生 button/textarea 的 tabIndex 报为 -1，而 Chrome 为 0。两处原有 entry fixture 显式模拟 Chrome 的默认 native property，未在生产代码新增推测性 focusability fallback。该差异不作为浏览器保证。

## 已执行证据与后续

- 公共包构建 43/43 通过；焦点修复后 WC 依赖闭包 35/43 重建通过。
- Native surface/entry、既有 focus、CLI native recipe 定向测试 24 项通过。
- 独立 public-dist/CLI Chrome 场景通过：三列尺寸、单次 valueChange、受控拒绝、非受控编辑、selection、composition 协议模拟、rows、主题、customization、disabled/readOnly、Tabs keepMounted 两模式、原生焦点入口、AX 单一命名 textbox、终止重连。
- catalog 检查与 Agent snapshot 生成通过。
- 完整 WC 定向包回归首次为 335 通过、2 项 Happy DOM native fixture 失败，已按上述原因修正；最终重跑与正式页面结果在交付记录登记。

本记录不是最终 S5 验收完成证明。正式页面、S1–S4 回归、真实系统 IME 与 Safari 人工验收仍待后续节点；禁止将 synthetic composition 当作系统 IME 证据。
