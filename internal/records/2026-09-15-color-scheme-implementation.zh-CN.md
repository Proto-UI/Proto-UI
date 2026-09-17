# 默认文档 colorScheme 实施与证据

日期：2026-09-15。公开基线：`8f2eba12c2c980d0f4d92713106e798891738106`，`0.3.0-alpha.0`。

本次实施承接 [#644 的 S1–S8 接受与实施授权](https://github.com/Proto-UI/Proto-UI/pull/644#pullrequestreview-5194863702)。#644 已完成提案，本次交付独立实现。语义由 `C-RULE-COLOR-SCHEME-0001`、`M-RULE-META-0001`、`HC-COLOR-SCHEME-INVALIDATION-0001` 及关联的 Rule / Adapter 实体表达；本记录只保留实施观察和验证边界，不晋升 lifecycle。

## 已实现的路径

- 默认 Web 文档 source 复用原 resolver，按 root dark、显式 light、system 的顺序读取；首订阅连接 observer/MQL，最后释放拆除。同一加载模块中的 Document 共享服务，批次按最终有效值去重。
- Rule Meta 从原始 authored IR 判断资格，要求 source/getter 引用配对，仅在 alive/mounted 时持有一份租约。新租约先订阅再重新求值；unmounting、reset/mismatch 和 disposing 使旧 generation 失效。
- `RulePort.requestStyleReevaluation()` 复用原 evaluator 和唯一 Feedback contribution，不直接同步或派发 Props、不写 State、不请求 Proto structural update。正常框架 presentation 与 Props/Focus 同步继续工作。
- 四个 Adapter 在适配类型创建时构造默认 pair，并在 owner/view wiring 中传递精确引用。显式 custom getter 不接默认 source。

新增保证仍限于默认 getter、同文档 light DOM、无中间局部主题标记。Shadow / 跨文档 / nearest-subtree 等价、通用 reactive Meta 和 Transition 重计时不在本次范围。#652 的 Shadow source 与 #578 的 Website scope 没有并入本实现。

## 从失败到通过

修改产品代码前，在本基线重跑原有 22 个浏览器 journey：四运行时的 Destructive Button 在切换为 dark 后仍保留 `/10` 配方，交互后才变为 `/20`；逆向转换也延迟。新增 Runtime 回归先在实际 Feedback 输出处失败：主题变更后缺少预期 token，随后随 owner/bridge 实施通过。

新的浏览器夹具位于 `apps/www/test/fixtures/color-scheme/`，使用真实 React、Vue 3、Vue 2 和 WC Adapter，以及真实 Shadcn Button、Checkbox、Switch、Textarea、Dialog 和 Base Transition。样式由现有 CLI 的 Shadcn theme/token 生成函数提供。App 只提供布局、原生编辑器字体/颜色继承和测试控制；没有为产品改写配方或克隆组件 DOM。

| 证据 | 观察边界 |
| --- | --- |
| Source 7 项测试 | 优先级、有效值去重、惰性共享、独立释放、迟到/旧 pending 失效与缺平台能力。 |
| Runtime 12 项测试 | 完整 Plan / patch / suppress、既有 extension 顺序、Props 输入边界、reader override、全部 Rule 被 lowering 后的资格、lease/reset/terminal 与当前 Effects。 |
| 四 Adapter 16 项 happy-dom 测试 | 使用真实框架接线验证 token、节点与 setup identity、custom sampled、初始 detached / remount 及 Props 并发；不冒充浏览器 paint。 |
| 四个完整 Chromium 流程 | 无交互主题转换的精确配方、原生用户草稿保持、Checkbox/Switch 选中状态、同文档 portal、leaving、Props 正常同步及资源释放。 |
| 四个初次 dark Chromium 流程 | 记录前 12 个 animation frame 中实际可见的六个 surface；验证其首帧及后续采样始终采用正确配方、没有 pending reveal。 |
| 框架生命周期 | React StrictMode、Vue 3 / Vue 2 KeepAlive、WC 同步 move 和完成 terminal disconnect 后的 reconnect。每个页面活动时只有一组根主题 observer/MQL，全部 consumer 销毁后两者均为零。 |
| 同 epoch 物理目标替换 | 真实 Runtime + WC commit / Effects / owned-token applier 重绑到新的 HTMLElement，重用既有 template，epoch/render/Runtime commit 计数不变，后续主题只写新目标。这不等于逐一认证所有 Adapter 的任意内部 target replacement。 |
| Transition | 四框架在 180ms leave fallback 已排队后切换主题及 reduced-motion，旧计时仍完成；后续 reduce enter 使用零时长 fallback，before/after 事件与 presence 保持。 |

原始结果：[WC](./evidence/2026-09-15-color-scheme/wc.json)、[React](./evidence/2026-09-15-color-scheme/react.json)、[Vue 3](./evidence/2026-09-15-color-scheme/vue.json)、[Vue 2](./evidence/2026-09-15-color-scheme/vue2.json)。同目录的 `*-initial-dark.json` 保留初始 frame 序列。资源计数包装原生注册/释放操作，不改 preference、回调或投射结果；归零断言发生在还原包装之前。

已逐张查看本次生成的 17 张截图，保留四运行时的明暗配对，以及 WC 的选中控件、portal 和物理替换截图。例如：[React light](./evidence/2026-09-15-color-scheme/react-light.png)、[React dark](./evidence/2026-09-15-color-scheme/react-dark.png)、[选中控件](./evidence/2026-09-15-color-scheme/wc-checked-dark.png)、[portal](./evidence/2026-09-15-color-scheme/wc-portal.png)、[物理替换](./evidence/2026-09-15-color-scheme/wc-surface-replacement.png)。其余截图可由同一测试重新生成。

## 保留的范围反例与既有缺口

四框架均保留了 reader/selector 的反例：root light 下，局部 dark marker 可使默认 Textarea 出现 input tint，但默认 reader 仍为 light；constant-dark custom reader 不会使无 dark marker 的 Textarea 自动取得该配方；局部 light 也不建立截断 root dark 的 nearest-theme 语义。这些是兼容边界证据，不是新增支持。

视觉检查还暴露了既有 React / Text Control 默认值投射差异：逻辑 value 已接纳 `defaultValue`，但 React 后续 `updateTextarea` 将未声明的原生 defaultValue 写为空，初始化 DOM value 随之为空。当前与公开基线、StrictMode 开/关、默认 source / 显式默认 getter 的八组实际浏览器对照都相同；新 source 未引入它。[对照摘要与基线 blob](./evidence/2026-09-15-color-scheme/react-textarea-baseline.json)保留了该结论的范围。

主夹具保留 uncontrolled 配置并记录初始差异，再通过真实编辑器输入草稿、blur 后验证主题变化。诊断的 48 次 native/logical 草稿对照与主矩阵均保留输入。本次没有将这个初始化问题记为修复，也不据此宣称完成全部 Text Control / IME 验收。

## 复现与工程验证

```sh
corepack pnpm@10.32.1 exec vitest run apps/www/test/color-scheme.browser.test.ts
```

浏览器测试会启动隔离端口/cache 的 Vite fixture，输出原始 JSON 和截图到日志给出的临时目录，结束时清理 browser/server。它已加入完整 Runtime 测试计划。环境为 Node 22.23.2、pnpm 10.32.1、Chromium 152.0.7977.83，viewport 1100×1400。

完整 `corepack pnpm@10.32.1 test` 已通过：468 个非浏览器测试文件、2,228 项测试通过，另有原有 3 个 skipped 文件 / 34 项 TODO；19 个浏览器测试文件、90 项测试通过；发布脚本 52 项测试通过。完整类型检查含 202 个 Astro 文件，零错误、警告或提示；43 个公共包构建、43 个 manifest 和全部 package budget 检查通过。WC gzip 为 75,655 / 76,000 bytes，未提高预算。Spec 23 个文件 / 150 项测试、authoring、prototype catalog 和 Agent projection 检查通过。

首次完整测试在 Agent assessment helper 读取超过 1 MiB 的未提交 binary diff 时触发 `ENOBUFS`，尚未进入产品测试。将同一候选保存为本地签名提交、保持工作区干净后，原完整命令通过；没有修改该工具或跳过检查。独立本地增量审查为 partial / ABSTAIN：资源释放、首帧/目标替换和实际配方三项证据缺口已在声明范围内解决，React 初始化差异已归因于基线。该审查不替代平台 review 或稳定化准入；所有新实体保持 draft。

## PR 审查后的订阅者异常隔离

[#653 审查](https://github.com/Proto-UI/Proto-UI/pull/653#discussion_r4012842045)指出，较早订阅者抛错会中断共享 source 的广播，使后续正常订阅者收不到主题变化。新增回归先复现正常订阅者调用次数为零；修复仅在逐订阅调用处隔离异常，继续原批次中仍活动的订阅，并将每个原异常分别在 microtask 中重新抛出。没有吞错、聚合或重试订阅者，也不扩展其它模块的异常策略。Source 测试由 7 项增至 8 项，相关 Source / Runtime / 四 Adapter 共 36 项 focused 测试通过。

原 8 项真实浏览器 case 重跑通过，并复看四运行时的暗色截图。额外 Chromium 检查中，两个抛错订阅者在 dark、light 两轮变化分别进入原生 `pageerror` 通道，共四个预期错误；后续正常订阅者两轮均收到通知，等待 CSS 过渡完成后的 WC Button 分别为 `/20`、`/10`，全部释放后 observer/MQL 归零。完整类型检查、43 个包构建、manifest 和 budget 再次通过，WC gzip 为 75,664 / 76,000 bytes。

修复后完整 `corepack pnpm@10.32.1 test` 通过：468 个非浏览器文件 / 2,229 项测试、19 个浏览器文件 / 90 项测试、52 项发布脚本测试；原有 3 个 skipped 文件 / 34 项 TODO 保留。独立增量审查未留下未解决问题，结论仍为 partial / ABSTAIN。
