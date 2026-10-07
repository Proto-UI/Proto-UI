# Shadow split：PR #652 第二轮 review 跟进

## 当前输入与范围

用户要求跟进 [PR #652](https://github.com/Proto-UI/Proto-UI/pull/652)。本轮起点为 `cf94253235c4a07ca2505a65042dd5becb3c7369`，base 为 `8f2eba12c2c980d0f4d92713106e798891738106`；保留原工作区，继续在隔离的 `codex/shadow-split-pr` 集成分支工作。

该 head 的 13 项 PR checks 已成功，包括此前超时的完整 `test`。reviewer 已认可上一轮 owner-generation 修复，旧 thread 被其他参与者 resolved。本轮不重写首轮记录，也不把新问题归为 Presence 异步退场。

本轮读取的主要反馈：

- [4011915353](https://github.com/Proto-UI/Proto-UI/pull/652#discussion_r4011915353)：radio group 被当作多个顺序 Tab stops。
- [4011915360](https://github.com/Proto-UI/Proto-UI/pull/652#discussion_r4011915360)：Template-only token 被错误用于 Root preflight。
- [4011915364](https://github.com/Proto-UI/Proto-UI/pull/652#discussion_r4011915364)：input `type` 变化未使 entry fallback 重投射。
- `cyjin-yl` 的 05:11 UTC review：独立 Chrome radio 证据；Windows 的路径分隔符、POSIX mode 测试假设；尚未确认根因的 15ms text-control 测试失败。

继续沿用用户的 bounded fix、验证、commit、push 与作者回复授权。不包含自行解决 review threads、批准、合并、发布或 draft→active 提升。`C-AS-FOCUS-SCOPE-0002-J` 与 `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-F/K` 的语义不变；T 映射补充真实证据。

## Radio：原生资格与 scope 策略分离

WC sampler 按 DOM tree、form owner、非空 name 判定 radio group，不将 slot/composed placement 误作 native group identity。选中且可 Tab 的成员提供组停靠点；不可用的选中项不阻塞其余合格成员。未选中组首次正向/反向进入采用各自的边缘成员，已聚焦成员保留离开时的位置。

Chrome 还会记住未选中组最后获焦的成员。视图 lease 内以 `focusin` 的实际原生 target 记录弱引用键的顺序信息；cleanup 撤销监听，旧 lease 不得清理新 lease 的观察。它不写 checked、logical focus facts 或作者状态。

独立检查补出两个真实边界，并追加修复与原生回归：

- eligible checked member 在 scope 外时，内部未选中项不应新增 Tab stop；只查询完整原生组资格，返回的 targets 仍限于 scope 内。
- 程序化聚焦到 `tabindex=-1` 的 radio 后，以独立 insertion position 保留顺序位置；不得把它加入 Tab stops。

Focus 通过已有内部 sampler capability 传入自己决定的方向，并解释可选 insertion position；top scope、next/prev、loop、clamp 和默认遍历阻止仍归 Focus。没有新的原型作者 API。

原生测试使用实际 split Adapter、真实 Tab/Shift+Tab、独立的 native/trapped 实例及未改变的 checked 值；覆盖 checked、unchecked、不可用选中项、返回路径、form/tree identity、scope 外选中项与程序化负 tabindex。不是完整 radio/跨浏览器认证。

## Entry：观察资格输入，不猜测完成时间

`modules.ts` 补齐 `type`、`open`、`usemap`、`src` 等现有 resolver 输入。区域含 area 时才观察 document 级 image-map 绑定及相关隐藏变化；区域不再含 area 或 view cleanup 时撤销，不让无关普通 entry 持续全局重采样。

新 Happy DOM 用例在原 `modules.ts` 下 9 项均失败；涵盖正反向 type、details open、image-map 关联及 cleanup。Chrome 另验 Light、direct Shadow、split 的 hidden↔text、fallback tabindex 与实际 Tab 入口。

15ms Windows 报告单独处理：本机观察到 native projection 的 scheduler microtasks 已完成后，parent fallback 仍须等待 Happy DOM MutationObserver task manager。测试改为等待该完成边界，并保留阶段断言；不增加 sleep/retry，也不声称已证明 Windows 那次失败的全部调度根因。

## CLI：只对已知 Root 使用做 Root 准入

source scanning 保留完整 CSS closure，并区分可证明的直接 Template occurrence 与 Root/未分类 occurrence。Template-only tokens 生成普通 Shadow-local CSS，不生成 split Root receipt；同 token 出现在 Root、Rule lowering、runtime patch 或不透明来源时，继续保守 preflight。flat/preset 输入没有目标证据，维持既有检查。

独立检查进一步要求：不得把任意 `.el()` 方法或未知 wrapper 当作 Template 证据。例外必须限定到已识别的 render-builder receiver 和直接、未逃逸的 style expression；间接/不确定形式仍保守处理，不引入通用数据流证明承诺。

Template membership 不提供 runtime Root admission。反例包含 percentage/variable padding、Root 不支持的 selector、共享 token、lowered Rule token 和上代输出保留。普通 Template composed-property CSS 排在基础重置之后；dark host context 采用零 specificity，以保持与 document 的 data condition 覆盖顺序。

Chrome CSS consumer fixture 测量 percentage padding 和 `dark:p-2` / `data-[open]:p-4` 覆盖结果，但显式在 Template DOM child 上绑定 `data-pui-style`。既有 WC 默认忽略 Template style handle 的行为不改变；不将 CSS 生成修复描述为自动 Template runtime 投射支持。

## Windows 测试断言

- Snapshot key 统一为 `/`，补充 `path.posix` / `path.win32` 控制；保留真实文件内容、omission、companion 和 regeneration 断言，不修改产品路径逻辑。
- 替换前采样实际 mode；每次替换后比较原 mode，并在非 Windows 保留精确 `0640` 断言。内容、rollback 与 staging residue 断言保留。
- 本机 macOS 的相关 32 项已通过；没有 Windows 实机复跑，不能由 `path.win32` 控制推断完整 Windows 支持。

## 验证边界

运行环境为 Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。独立审阅是有限范围的本地检查，不是本 PR 的 GitHub approval。新 head 仍需要完整 CI 与 reviewer 确认；不自动继承旧 head 的绿灯。

最终冻结代码后运行并通过：

- `node scripts/build/public-packages.mjs --package @proto.ui/adapter-web-component --package @proto.ui/cli`：构建包含依赖的 36/43 个公开包。
- `corepack pnpm@10.32.1 exec vitest run --exclude '**/*.browser.test.ts'`：503 个文件、2552 项通过；3 个文件 skipped、34 项 TODO。不是完整 `pnpm test` 或全部浏览器矩阵。
- `corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test/shadow-closeout.browser.test.ts`：Chrome 29/29 通过。
- `node scripts/analysis/shadow-split-public-browser.mjs`、`node scripts/analysis/shadow-s4-portal-browser.mjs`、`node scripts/analysis/shadow-s5-public-browser.mjs`：公开 dist / CLI 产物的 S1 交互、S4 portal owner cleanup、S5 native journey 均通过；不把 S4 cleanup 子集称为完整 S4 矩阵。
- `check:types`：workspace TypeScript 通过，216 个 Astro 文件无错误、警告或 hints。`spec:docs:agent` 生成后 `check:agent-doc` 通过。
- `check:spec-authoring -- --base 8f2eba12c2c980d0f4d92713106e798891738106`：24 个变更 catalog inputs 通过。首次调用遗漏必需的 `--base`，以准确 base 重跑后通过，不是 spec 失败被忽略。
- `check:agent-operations`：58 项通过；`check:prototype-catalog`：135 个 P entities / 136 个 declaration files 通过；`check:package-manifests`：43 个通过。
- `check:package-budgets`：9 项通过；WC 为 83,932 / 84,000 gzip bytes，仅余 68 bytes，未放宽预算，应作为后续新增代码的约束。
- 变更文件的 Prettier 与 `git diff --check` 通过。

上述 checks 使用仓库声明的 pnpm 10.32.1。CLI 与全局 build/types 顺序执行，避免 CLI 测试重建 dist 的竞争。独立有限复核确认 renderer 来源与 selector precedence 两项修正；不将协作实现检查视为全 PR approval。

未执行 publish；#645 Dialog 快速重开问题仍独立。未新增 Safari、Firefox、真实系统 IME、Windows 实机或像素截图验收。新 head 的完整 CI 与 reviewer 确认留给推送后的审查，不自动关闭线程。
