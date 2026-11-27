# Shadow split：PR #652 首轮 review 跟进

## 范围与依据

用户要求跟进 [PR #652](https://github.com/Proto-UI/Proto-UI/pull/652) 的新进展，沿用该 PR 的实现、验证、提交与推送授权；不包含合并、发布、生命周期提升或自行解决 reviewer thread。

本轮针对 `88f35d2bd8ee7898399525d2b89aa0ae83c479bd`：

- [review comment 4011425517](https://github.com/Proto-UI/Proto-UI/pull/652#discussion_r4011425517) 指出 disposing generation 被重连复用的风险。
- `cyjin-yl` 的 review `5205053941` 要求确定性的 terminal teardown/reconnect 回归，以及同步 DOM move 的 identity 保留证据。
- `D-WEB-COMPONENT-SHADOW-STYLE-0001-K` 与 `D-WEB-COMPONENT-SHADOW-PROFILE-0001-F` 提供既有 draft 方向；本轮不改 criterion 或生命周期。

## 实际复现与证据边界

不能将 review 中“普通 Presence 退场导致异步 terminal teardown”的描述直接视为已证实根因。当前 Runtime 的 terminal `dispose()` 调用 `unmountInternal(true)` / `forceUnmount()`，正常情况下不等待 Presence 退场。

实际可复现的公开路径是：确认断开后，`onUnmounted` 或 `onBeforeDispose` 回调同步将 host 重新插入 document。旧 owner 的清理尚在调用栈内，原 `connectedCallback()` 会重用即将销毁的 owner，随后旧清理使已连接 host 丢失可用 runtime/resources。

另以受控 host-session disposal Promise seam 验证 Adapter 的异步边界：旧清理开始后、Promise 完成前反复 remove/append，或最终保持断开。这个 seam 是确定性测试，不声称普通 Runtime Presence 本来就异步等待。最初三个新增用例在修复前失败，并出现 disposed surface rejection；修复后通过。

## 修复方式

`packages/adapters/web-component/src/adapt.ts` 对 split profile 串行化 terminal disposal 与重连：

1. 在调用旧 owner disposal **之前**设立 gate，覆盖生命周期回调同步重入。
2. 清理期间的 `connectedCallback()` 不创建或复用 owner；重复重连合并处理。
3. 无论 disposal 成功或拒绝，最终释放 gate；另一个 microtask 按最新 connectivity 决定是否建立新 owner。
4. 旧 owner 完整清理后才取得新一代 surface、stylesheet、environment/subscription，避免并存两代争用 host-wide 字段。

没有改 cache identity 或引入并发 generation 置换。同步 DOM move 仍走 terminal teardown 前的 retention 分支；Light/direct 不启用新 gate。未扩展 closed ShadowRoot、Portal 准入、S5 范围或 #645 的独立 Dialog 快速重开问题。

## 新增持久回归

- `packages/adapters/web-component/test/shadow-split-profile.test.ts`：两个真实 lifecycle reentry；两个受控异步 disposal 场景，覆盖最新 props、最终 connectivity、fresh identity、旧 listener/duplicate cleanup 无效、新 subscription 可用。
- `packages/adapters/web-component/test/shadow-closeout.browser.test.ts`：真实 Chrome 的两个 lifecycle reentry；先验同步 move retention，再验新 owner 的 runtime style patch、计算 padding、正几何尺寸、stylesheet/subscription 和终态清理。
- `spec/tests/T-WEB-COMPONENT-SHADOW-STYLE-0001.yaml`：仅补充既有 retention/renewal cases 的实现映射，不增加规范性要求。

浏览器新增证据是 **computed style 与 live geometry**，不是截图或像素级 paint 证明。本地独立检查指出后已收窄 wording。独立实现审阅未发现该 disposal/reconnect delta 的剩余 P1/P2；这是限定范围的本地检查，不是 GitHub approval。

## CI 时限

[CI run 34921570154](https://github.com/Proto-UI/Proto-UI/actions/runs/34921570154) 的 `test` job `104230687191` 被 GitHub 明确以 20 分钟 execution timeout 取消，并非此前用例断言失败：

- 非浏览器 501 文件、2505 项通过（另 3 skipped 文件、34 TODO）。
- 浏览器已有 24/25 suites、102 项通过，最后 S4 paint 尚未回报；此前 browser suite 耗时合计约 782 秒。
- 类型、公开包构建等其它 exact-head checks 已通过。

只将 `.github/workflows/ci.yml` 中 `jobs.test.timeout-minutes` 从 20 调至 30。全部测试、断言、per-test timeout、串行执行和 CI gate 保留；未顺带设计 sharding 或缓存优化。新的 exact-head 完整 CI 仍须在推送后验证，不用本地局部浏览器结果冒充。

## 本地验证

Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83；在隔离集成 worktree 验证，保留原工作区改动。以下是本轮增量的结果：

| 命令/范围 | 结果 |
| --- | --- |
| `vitest run --exclude '**/*.browser.test.ts'` | 501 文件 / 2509 项通过；3 skipped 文件 / 34 TODO |
| split profile + generation + native closeout 定向回归 | 3 文件 / 28 项通过；native 5 项另复跑通过 |
| `node scripts/build/public-packages.mjs --package @proto.ui/adapter-web-component` | WC dependency closure 35/43 public packages 构建通过 |
| `check:types` | workspace 通过，216 Astro 文件 0 error/warning/hint |
| `spec:docs:agent` / `check:agent-doc` | 615 entities 的忽略投影刷新并检查通过 |
| `check:spec-authoring -- --base origin/main` | 24 changed catalog inputs；spec/schema/graph 测试另包含在 full unit run |
| `check:package-budgets` | 9/9；WC 83,060 / 84,000 gzip bytes，不调整预算 |
| `shadow-s4-portal-browser.mjs` | public-dist Light/Split/Mixed/rejected owner cleanup 通过 |
| `shadow-s5-public-browser.mjs` | public-dist/CLI native journey 通过，含 reconnect |
| `check:agent-operations` / runtime test-plan Node tests | 58 / 3 项通过 |
| `check:prototype-catalog` / `check:package-manifests` | 135 P、43 public manifests 通过 |

本轮不重复完整网站静态构建、release consumer smoke 或所有 25 个 browser suites；已有 closeout 与旧 head 的相应证据，新 head 仍由完整 CI 补齐。尚无本轮新增人工验收、Firefox/Safari 或像素级结果。PR 仍需 reviewer 确认与 exact-head CI，不宣称可合并。
