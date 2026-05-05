# 2026-05-03 v0 CLI / Package 发布治理

> Spec. 本文记录 v0 首发前 CLI 和 package 发布治理的诊断结果、修复内容与验证状态。

---

## 1）背景

Proto UI 首发的核心瓶颈是"用户能不能真实跑起来"。CLI 代码骨架（init、add、codegen、registry）已经相当完整，但从未经过完整的发布验证链路：scan → stage → publish → clean environment smoke。

本文记录 2026-05-03 对整条链路的诊断与修复。

**上游决策依据**：[`internal/records/2026-04-23-v0-cli-onboarding-decision.zh-CN.md`](../../../internal/records/2026-04-23-v0-cli-onboarding-decision.zh-CN.md) 确定了 v0 CLI 的形态——`init` 写 `proto-ui/config.json`、`add <host> <component>` 把原型 + adapter 走 npm 包安装并生成 facade（§4.2 多 adapter 配置 / §4.5 React facade 形态 / §4.6 host-prefixed 根 re-export）。本 PR 的 `cli-smoke` 断言就是直接对齐那份决策的 §4.2 / §4.5 / §4.6，让发包链路真的能挡住偏离决策的回归。

---

## 2）诊断结果

### 2.1 CLI 包（@proto.ui/cli）

**状态：健康。**

- 5/5 端到端测试全过（spawnSync 真实执行，不是 mock）
- `--help` / `init` / `add` 命令都能跑
- `release:scan`：`[dist-export] issues: none`
- `release:stage`：build 0 diagnostics，publish dry-run 成功
- npm 已发布 0.0.4
- 代码符合 `internal/records/2026-04-23-v0-cli-onboarding-decision.zh-CN.md` 的决策

**发现的问题：**

- `packages/cli/package.json` 没有 `files` 字段，`test/cli.test.ts` 被发布到 npm
- pnpm lockfile 与 pnpm 8.13.1 不兼容（lockfile 是更新版本写的），需要重生成

### 2.2 其他包

**状态：有阻塞问题，已修复。**

- `release:scan` 报告 30+ 个包有 `exports point to src/*.ts` 警告（误报，stage 会自动重写）
- 3 个包缺少 README（boundary、hit-participation、presence）— 已在 main 的 `5d8f965 docs: align readme surfaces with project purpose` 补齐，**不在本 PR 范围**
- `@proto.ui/module-overlay` 缺失 `@proto.ui/module-boundary` 依赖声明，导致 tsc 编译失败（exit code 2），影响 6 个下游包（runtime、adapter-base、adapter-react、adapter-vue、adapter-web-component）

### 2.3 CI

**状态：发包链路完全没有 CI 验证。**

- `ci.yml` 只有 type-check 和 test，没有 release:scan
- 发包流程（scan / stage / clean-env smoke）只在本地跑，PR 无法挡住打包/发布回归
- `release-packages.yml` 是手动触发的发布 workflow，不替代 PR 验证

### 2.4 CLI 跨平台

**状态：Windows 上 add 命令无法执行 npm install。**

- `packages/cli/src/services/package-manager.js` 和 `src/legacy/cli.mjs` 用 `spawnSync('npm', args)` 不带 shell，Windows 上 npm 是 `npm.cmd` 而不是 `npm`,导致 `ENOENT`
- 影响：Windows 用户跑 `proto-ui add` 全部失败

### 2.5 publish.mjs 退出码

**状态：build 失败不返回非零退出码。**

- `scripts/release/publish.mjs` 在 build diagnostics 非空时只 console.log，进程仍然 exit 0
- 影响：CI 即便接入 `release:stage`,build 失败也无法挡 PR

### 2.6 Lockfile / Prettier 冲突

**状态：lockfile 被 prettier 反复重排,产生 3000+ 行无意义 diff。**

- `.prettierignore` 没有忽略 `pnpm-lock.yaml`
- HEAD 的 lockfile 是 prettier 格式（多行 `resolution:` 块），pnpm 重生成后立刻被改回标准 pnpm 格式
- 影响：每次跑 `pnpm install` 都污染 PR diff

### 2.7 Quick Start 文档

**状态：已在用真实命令，但措辞需要微调。**

- 中英文 Quick Start 已经用 `npx @proto.ui/cli init` 和 `npx @proto.ui/cli add react shadcn-button`
- 但还有"CLI is still converging for v0"的警告，与 CLI 已经能跑的事实不符

---

## 3）修复内容

### 3.1 overlay missing dependency

`packages/modules/overlay/package.json` 补了 `@proto.ui/module-boundary: "workspace:*"` 依赖。这是 tsc 编译失败的根因：overlay/src/create.ts 第 6 行 import 了 boundary，但 package.json 没有声明这个依赖。

### 3.2 CLI files 字段

`packages/cli/package.json` 加了 `files` 字段，只包含 `bin/`、`src/`（排除 .ts 源码）、`README.md`。test 文件不再被发布到 npm。

### 3.3 README 补充

> 本 PR 不再包含。三个包的 README（boundary、hit-participation、presence）已经在 `5d8f965 docs: align readme surfaces with project purpose` 直接合入 main，不归本 PR。

### 3.4 release:scan 误报修复

`scripts/release/lib.mjs` 第 153 行：改为只在包没有 `src/index.ts` 时才报"exports point to src/\*.ts"。有 `src/index.ts` 的包，stage 会自动编译并重写 exports 指向 dist/，不需要 scan 报警。

### 3.5 Quick Start 措辞微调

中英文 Quick Start 的 caution 措辞从"CLI is still converging for v0"改为"Proto UI is in its early public stage"，与 CLI 已经能跑的事实一致。

### 3.6 CI release:scan / release-stage / cli-smoke 三道闸

`.github/workflows/ci.yml` 加了三个新 job:

- **release-scan**：跑 `pnpm release:scan`，过滤掉 workspace deps 后失败的 issues 直接挡 PR
- **release-stage**：跑 `pnpm release:stage`（= `node scripts/release/publish.mjs --dry-run`），对 34 个包做 tsc + `npm publish --dry-run`，timeout 20 分钟
- **cli-smoke**:`npm pack` CLI tarball,在 `mktemp -d` 干净目录里 `npm install` 真实 tarball + `react react-dom vue`,然后跑 `proto-ui --help / init --yes` 后顺序 `add react shadcn-button / add react base-button / add vue shadcn-button / add wc shadcn-button`(每次都真实 npm install,不带 `--no-install`),断言生成的 `proto-ui/config.json`、`components/{react,vue,wc}/index.ts`、根 `components/index.ts` 内容对齐决策 §4.2 / §4.5 / §4.6,并校验 `node_modules/@proto.ui/{adapter-react,adapter-vue,adapter-web-component,prototypes-shadcn,prototypes-base}` 真的落盘。最后 `npm install --no-save tsx @happy-dom/global-registrator`,把 `packages/cli/test/smoke-render/{react,vue,wc}.mjs` 拷进 SMOKE_DIR 用 `node --import tsx` 跑——三个文件都从 per-host facade(`./proto-ui/components/{react,vue,wc}/index.ts`) import,**避开**根 facade(根 facade 同时 re-export wc 模块,会在 module load 时 `extends HTMLElement` 把 React/Vue 子进程也带崩):
  - **react.mjs**:`@happy-dom/global-registrator` 注册 DOM globals → `react-dom/client` 把 `Button`(shadcn)和 `BaseButton`(base)分别 mount 到容器 → 50ms tick 等 prototype 生命周期挂载 → 取 `container.firstElementChild` 当 host,断言 `tabindex="0"`(focus module 已挂)+ slot 文本 "click" 已 commit;shadcn 额外断言 host class 含 `group/button` 证明 `feedback.style.use()` 把 prototype tokens 真的盖到了 host 上。**不用** `react-dom/server`,因为 v0 React adapter 是 client-only,SSR 只输出空 rootTag(`<div></div>`)。**也不查 `<button>`**:v0 React adapter 的 `rootTag` 默认 `'div'`,prototype 不会 morph rootTag,host 始终是带 button 行为/样式的 `<div>`。
  - **vue.mjs**:同样 happy-dom + `Vue.createApp({...}).mount(container)` + 50ms tick + 同形断言(host 是 `<div>`、`tabindex="0"`、shadcn class、slot 文本)。Vue adapter 也是 client-only + rootTag='div' 默认,所以套同样规则。
  - **wc.mjs**:happy-dom 注册 DOM globals 后侧效 import wc facade,断言 `customElements.get('proto-ui-shadcn-button')` 拿到构造函数、`document.createElement` 返回 `HTMLElement`。

  这一段把 install + grep 之外的"adapter 行为插槽是否真插上(focus module 挂上 tabindex)、原型 feedback.style 是否真 commit 到 host class、slot 子节点是否真渲染、customElements 注册是否真生效"也拦在 PR 上

三个 job 共用 lockfile-version 自适应的 pnpm 安装步骤(lockfile 6.x → pnpm 8.13.1,9.x → pnpm 10.32.1),corepack 拉取 pnpm。

cli-smoke 默认按 "包都已发到 npm" 写,任何 `@proto.ui/adapter-*` / `@proto.ui/prototypes-*` 缺包,`add` 都会以 E404 红掉——这是预期信号,告诉维护者先把包发出去再合 PR。

### 3.7 CLI Windows spawnSync fix

`packages/cli/src/services/package-manager.js` 和 `src/legacy/cli.mjs` 给 `spawnSync` 加了 `shell: process.platform === 'win32'`(用 `isWindows` 变量挂语义)。Windows 上 `npm` 是 `npm.cmd`,不带 shell 时 Node 找不到 PATH 上的 .cmd shim。

为什么不直接 `spawnSync('npm.cmd', ...)`:Node 18.20+ 出于 CVE-2024-27980 缓解,在 `shell: false` 下禁止跑 `.cmd`/`.bat`,会抛 `EINVAL`。`shell: true` 是官方推荐的兼容方式。npm 包名字符集受限,没有 shell 注入风险。

### 3.8 publish.mjs 退出码

`scripts/release/publish.mjs` 末尾加了:

```js
if (failedBuilds.length > 0) {
  process.exit(1);
}
```

之前 build diagnostics 非空只是 `console.log`,进程仍 exit 0。这意味着即便 CI 接入 `release:stage`,build 失败也无法挡 PR。修了之后 release-stage job 才真正能起到 gate 的作用。

### 3.9 .prettierignore 加 pnpm-lock.yaml

`.prettierignore` 加了一行 `pnpm-lock.yaml`。原因:HEAD 的 lockfile 是 prettier 格式(多行 `resolution:` 块),pnpm 重生成会切回标准 pnpm 格式,产生 3000+ 行无语义 diff。lockfile 是机器生成的二进制级文件,本来就不该走 prettier。

### 3.10 lockfile 重生成

`pnpm-lock.yaml` 用 pnpm 10.32.1 重生成(lockfile 9.0 必须配 pnpm 10),只增量加入 `@proto.ui/module-overlay` → `@proto.ui/module-boundary` 这条 workspace 依赖。仓库 `packageManager` 字段声明的还是 pnpm 8.13.1,与 lockfile 9.0 不匹配——这是预先存在的不一致,**不归本 PR 治理**(参见 `feedback_no_unrelated_fixes`)。CI 的 lockfile 自适应步骤已经能正确 fallback 到 pnpm 10。

### 3.11 release-packages.yml 同步 corepack pin

`.github/workflows/release-packages.yml` 的 "Setup pnpm (corepack)" step 之前与 ci.yml 的四个 setup block 漂移:只跑 `corepack enable`,没跑 `corepack prepare pnpm@"${PNPM_VERSION}" --activate`,也没设 `COREPACK_ENABLE_PROJECT_SPEC=0`。现在补齐到与 ci.yml 完全一致(line-for-line)。

为什么要修:`scripts/release/publish.mjs → scripts/release/lib.mjs:285 / lib.mjs:356` spawn 裸 `pnpm`。没 `--activate` 时,这些子进程会落回 `package.json#packageManager`(pnpm 8.13.1),但 lockfile 是 v9(需要 pnpm 10.32.1)。结果就是 PR 的三道闸是绿的,但真正 manual 触发 `release-packages.yml` 走 stage/publish 的时候,跑的 pnpm 版本与 PR CI 不一致,可能再次踩 lockfile-与-工具版本不匹配。

为什么之前没修:本 PR 早期把 corepack pin 加到 ci.yml 的 PR-gate 链路上时,以为只有 PR CI 跑 release 脚本;后来维护者 review 指出 `release-packages.yml` 也走同一个 lib.mjs spawn 路径,需要同样的 pin。

### 3.12 vue transition test 去 flake

`packages/adapters/vue/test/previewer-transition-command.demo.test.ts` 之前用固定 `flushFrames(N)` + `expect(getStateLabel(host)).toBe('X')` 推进每一步状态机断言,本地 ~40% flake。flake 来源是 demo 通过 `MutationObserver` 把 `data-transition-state` 属性变化映射成 `stateLabel.textContent`,但 happy-dom 的 MutationObserver 回调派发不与 rAF/microtask 边界对齐,造成 attr 已经变了但 label 还没刷出来的中间态。

改:不再读 demo 的 stateLabel,直接读原型 host 上的 `data-transition-state` 属性(状态机 source of truth);`flushFrames(N)` 换成 `waitForState(host, target, maxFrames=32)` poll-until-match。本地 50/50 通过,full test suite 仍是 574 passed。

---

## 4）验证状态

本地全链路模拟（pnpm 10.32.1，Node 20）：

| 检查项 | 状态 | 备注 |
| --- | --- | --- |
| type-check | ✅ | 0 errors / 0 warnings,86 files |
| test | ✅ | 158 文件 / 574 通过 / 34 todo / 3 skip |
| release:scan(过滤 workspace deps) | ✅ | 全部 none |
| release:stage(34 包 tsc + dry-run publish) | ✅ | 全部 diagnostics 0 |
| CLI 端到端测试(5/5) | ✅ | spawnSync 真实执行 |
| CLI npm pack(排除 test) | ✅ | 20 文件 |
| Clean-env smoke(`mktemp -d` 干净项目) | 🟡 待发包 | smoke 默认按"包已发"写,真实 npm install 4 次 add(react/vue/wc × shadcn/base 全覆盖),最后通过 `tsx` + `@happy-dom/global-registrator` + `react-dom/client` / `Vue.createApp().mount()` / wc 侧效 import 跑真实渲染器烟雾——React/Vue 都走 happy-dom 客户端挂载(v0 adapter 是 client-only,SSR 只输出空 rootTag),且不查 `<button>` 而是断 host(rootTag 默认 `'div'`)上的 `tabindex="0"` + shadcn `group/button` class + slot 文本,因为 v0 adapter 不会 morph rootTag,prototype 通过 feedback.style 把 button 形态盖到 host `<div>` 上。本地用 `--no-install` 变体过过,facade 内容对齐决策 §4.2 / §4.5 / §4.6,5 个 `@proto.ui/*` 包真实落盘断言已加;CI 第一次跑要等维护者把 `@proto.ui/{cli@next,adapter-react,adapter-vue,adapter-web-component,prototypes-shadcn,prototypes-base}` 发到 npm 才能绿 |
| Windows spawnSync npm | ✅ | shell:true 修复后 add 命令在 win32 可跑 |
| publish.mjs build 失败退出码 | ✅ | 改为 process.exit(1) |
| ci.yml YAML 语法 | ✅ | 5 jobs 全部解析成功 |
| release-packages.yml YAML 语法 | ✅ | 1 job 8 steps,Setup pnpm block 与 ci.yml line-for-line 一致 |
| vue transition demo test | ✅ | 50/50 通过,改读 `data-transition-state` 属性 + `waitForState` poll |

---

## 5）修改文件清单

发包治理 / CLI 修复:

1. `packages/modules/overlay/package.json` — 补 boundary 依赖
2. `packages/cli/package.json` — 加 files 字段
3. `scripts/release/lib.mjs` — scan 误报修复
4. `scripts/release/publish.mjs` — build 失败时 process.exit(1)
5. `packages/cli/src/services/package-manager.js` — Windows spawn shell 修复
6. `packages/cli/src/legacy/cli.mjs` — 同上,legacy CLI 同步修复

文档:

7. `apps/www/src/content/docs/en/start-here/quick-start.mdx` — caution 措辞微调
8. `apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx` — 同上
9. `docs/superpowers/specs/2026-05-03-v0-cli-package-governance-design.md` — 本 spec

CI / 仓库基础:

10. `.github/workflows/ci.yml` — 加 release-scan / release-stage / cli-smoke 三个 job
11. `.github/workflows/release-packages.yml` — 同步 ci.yml 的 corepack pnpm activation block
12. `.prettierignore` — 加 `pnpm-lock.yaml`
13. `pnpm-lock.yaml` — 用 pnpm 10.32.1 重生成,新增 overlay→boundary 依赖

测试基础设施:

14. `packages/adapters/vue/test/previewer-transition-command.demo.test.ts` — 去 happy-dom MutationObserver flake

---

## 6）后续事项

合 PR 前,维护者必须先发包(否则 cli-smoke 会以 E404 红掉):

- `@proto.ui/cli` 新版(包含 files 字段 + Windows spawn 修复,例如 0.0.5)
- `@proto.ui/adapter-react`、`@proto.ui/adapter-vue`、`@proto.ui/adapter-web-component`(含 transitive `@proto.ui/*` 依赖)
- `@proto.ui/prototypes-shadcn`、`@proto.ui/prototypes-base`(含 transitive `@proto.ui/*` 依赖)

已收口,**本 PR 不做**:

- 仓库 `packageManager` 声明的 pnpm 8.13.1 与 lockfile 9.0 不一致(预先存在的问题,CI 自适应步骤已 cover,留给后续治理)

后续可做:

- CI release-stage / cli-smoke 在 GitHub Actions 上首次跑要观察是否真过(本地 release-stage 全过;cli-smoke 等维护者发包之后才能首次绿)
- 发包后扩展 cli-smoke,把更多复合组件(switch/tabs/dropdown/dialog/hover-card)拉进 add 序列,把组件级回归也拦在 PR 上
