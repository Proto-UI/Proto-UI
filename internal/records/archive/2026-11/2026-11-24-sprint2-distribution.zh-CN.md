# Sprint 2：固定 Compiler 分发、真实 registry 消费与 watch 所有权

日期：2026-11-24（北京时间）；实际运行时间为 2026-11-23 UTC。执行者：OpenAI Codex，按当前用户补完 Sprint 2 的授权实施。关联：#1458，F11 / F12 / F13；不改变 private、experimental、profile 或 SSR 准入。

## 固定来源与实际修复

起点为主线 `d0eb81d3c61c3d3e93e46c4151e78031273d6116`。源码修复 `9062bc3b3a` 在 watch 首次建立 session 时保留该真实目录的 `dev` / `ino` / `birthtimeMs`。同一路径被另一个真实目录占用后，后续 revision 必须以 `output-conflict` 终止；不再只因替换物仍是 directory 而采用它。符号链接替换仍拒绝。此修复没有修改 parser、IR 或 emitter。

基线上的真实反例先观察到第二次发布错误地返回 `ok: true`，随后才断言失败。修复后完整 CLI、artifact writer 与 watcher 三个聚焦文件为 **59/59 PASS**。原反例和成功日志都保留，不把早期失败改写成成功。

消费验证源码提交为 `4ffc65f2c3d32bcd5d1bd897ab20d9c6f087fb3c`。两个全新输出目录从该干净、完整 SHA 生成相同的九份 pinned artifact 文件，逐字节、逐 SHA-256 比较均一致。Compiler artifact 实际独立执行 `npm ci --ignore-scripts`，仅安装精确 TypeScript 5.9.3；其外部 imports 为 Node built-ins 与 TypeScript。Node 24.22.3、pnpm 10.32.1、esbuild 0.25.12 及完整 source/profile/lock identity 位于[确定性回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-distribution/receipts/pinned-determinism.json)。

## 目标依赖由 manifest 实际安装

`NATIVE_CONSUMER_DEPENDENCIES=registry` 现在可用于原普通消费者、完整三家族 Button 消费者和 pinned plain-Node CLI 旅程。共享安装实现执行以下实际步骤：

1. 创建仓库外消费者，确认没有 `node_modules`；精确核对 manifest 的 runtime/tooling 声明。
2. 使用该消费者独立的 npm 配置和缓存，执行 `npm install --package-lock-only`。
3. 确认生成 lock 没有产生安装目录，再执行 `npm ci --ignore-scripts`。
4. 执行 `npm ls --all --json`，核对实际 package identity、lock、文件字节和内容哈希；拒绝目录 symlink 或越出消费者的 payload。

这次 target registry 路线没有复制现成的 framework payload，没有借 sibling package 的 `@floating-ui/dom`。完整 Button 的 compiler dependency 声明还明确拒绝意外引入该几何依赖。旧 `copy` 模式保留其原来用途与准确标签，没有更名冒充 registry 安装。

| 原普通消费者 profile      | 实际 runtime 声明及安装      | 普通构建与运行结果 |
| ------------------------- | ---------------------------- | ------------------ |
| `react-dom-source-v1`     | `react` / `react-dom` 19.2.6 | PASS               |
| `vue-source-v1`           | `vue` 3.5.31                 | PASS               |
| `vue2-source-v1`          | `vue` 2.6.14                 | PASS               |
| `web-component-source-v1` | 无 framework runtime package | PASS               |

四条均完成 original/consumer-edited 两路普通目标构建与真实框架或 custom-element 挂载、Context、State 与显式更新、view detach/rebind、终态 dispose、失效旧 handle、引入错误后的普通 TypeScript 诊断、历史 provenance/maps 保留与新 executable maps。安装树的实际成员和 payload 哈希在 build/edit/runtime 前后相同。完整收据见[普通消费者回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-distribution/receipts/native-consumers.json)。

这些是 Node / Happy DOM 运行；Vue2 JavaScript component body 沿原脚本保持 `checkJs: false`，其余目标/helper 执行既有 strict TypeScript 检查。没有把它们计为 native browser、物理输入、AT 或全库 differential。Shenko 历史报告中的 React 19.3.1 与这里实际执行的 admitted 19.2.6 分别记账；本轮未为 19.3.1 新增通过记录，也未据它改动 profile pin。

## Plain Node CLI：F11 / F13 及不覆盖边界

固定 artifact 的[CLI 回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-distribution/receipts/pinned-cli.json) 中 15 个实际命令符合各自正例或负例预期：

- 缺失 parent 失败且不创建祖先；调用者预建 parent 后成功。
- 新目录 compile、只读 unchanged diff；已有 output collision 拒绝。
- output root 为 symlink 时，compile 和 diff 均拒绝，历史 provenance 未变。
- 两个实际 CLI 进程并发发布同一新目录，恰好一个成功、一个 `output-conflict`，胜者输出及 provenance 完整。
- 消费者将生成模板 `section` 改为 `article`，read-only diff 报告 consumer modification，再次 compile 仍拒绝覆盖；普通 build 与挂载观察到 `article`。原 provenance 与作者源码 map 保留，新 executable map 包含用户编辑的当前生成源码。

原 immutable watch 旅程获得 revision 1 / 2 成功、revision 3 非法源失败并保留 revision 2 的 `lastSuccessful`、revision 4 恢复；revision 1 字节和独立用户编辑不变。正常 SIGTERM 退出为 143。

另有两条真实 CLI watch 旅程，分别把原 session 移走后在原路径放置新真实目录和指向外来目录的 symlink。触发后均得到 fatal `output-conflict`、exit 1；外来 `consumer.txt` 及目录内容未变，移走的原 revision 字节相同。这是按实际发生的替换顺序获得的验证，不声称文件系统的所有对抗性竞争窗口均已穷尽。

## 三家族当前真实失败保留

固定 `4ffc65f2c` 的完整 Base / Shadcn / Brutalist Button × 四 Web 旅程：

| Profile | 实际终态 |
| --- | --- |
| React | 三家族 compile、registry 安装、普通 build / mount 全通过 |
| Vue3 | Base compile 成功；Shadcn compile 报 `PUI1999`：`Checked Context subscription requires a key declaration`；Brutalist 未执行，整个 Vue3 组未安装或运行 |
| Vue2 | 三家族 compile、registry 安装、普通 build / mount 全通过 |
| WC | 三家族 compile、registry 安装、普通 build / mount 全通过 |

按原 12 个 family × target 消费分母，是 **9 个完整成功，1 个实际 compile 失败，2 个未获完整消费者执行**；不是 12/12。仅按四个脚本分组则为 3 PASS / 1 FAIL。该错误已交回当前 emitter 整合 owner，后继成功必须绑定修复后的确切来源，不能修改[本轮失败回执](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-distribution/receipts/release-families-first.json)。普通 Vue3 Context 消费者本轮已成功，不足以消除完整 Shadcn 组合中的失败。

## 可重放命令与证据

在干净 `4ffc65f2c3d32bcd5d1bd897ab20d9c6f087fb3c` checkout 中：

```sh
corepack pnpm@10.32.1 install --offline --frozen-lockfile --ignore-scripts
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/cli.test.ts packages/compiler/src/artifact-output.test.ts packages/compiler/src/watch.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
node --import tsx scripts/compiler/build-pinned.ts --revision 4ffc65f2c3d32bcd5d1bd897ab20d9c6f087fb3c --output /tmp/proto-pinned-current
```

在 artifact 目录完成其 `npm ci --ignore-scripts` 后，回到该 checkout 分别运行：

```sh
NATIVE_CONSUMER_COMPILER=/tmp/proto-pinned-current/index.js NATIVE_CONSUMER_DEPENDENCIES=registry node scripts/compiler/pinned-cli-smoke.mjs
NATIVE_CONSUMER_COMPILER=/tmp/proto-pinned-current/index.js NATIVE_CONSUMER_DEPENDENCIES=registry node scripts/compiler/release-family-smoke.mjs
NATIVE_CONSUMER_COMPILER=/tmp/proto-pinned-current/index.js NATIVE_CONSUMER_DEPENDENCIES=registry node scripts/compiler/native-consumer-smoke.mjs
node scripts/docs/check-public-docs.mjs
```

实际输出路径、命令参数、stdout/stderr、status/signal 和每份 consumer lock 保存在 [证据目录](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-distribution/README.md)；以上 `/tmp` 路径是复现示例，实际运行目录保持在原回执中。`check-public-docs` 真实成功。所有新归档逐成员解压读回并与原始内容哈希核对；清单包含每个保留成员的 mode、bytes、SHA-256 或 symlink target。仅排除可从已保留 lock 重装的 `node_modules` 与网络缓存。

生成源码、executable bytes、dependency payload、进程内单次观测及内存快照分别保留在原普通消费者 `costs.json` / `timing.json`，没有合并为 bundle 性能结论，没有宣称 production retained bundle 或 input-to-photon 接受。

原 #1458 F11/F12/F13 完整接受、Vue3 family 修复、最终整合 head 与独立接受仍需分别记录。本次没有远端写入、registry 发布、版本升级或关闭 Issue。

## #1055 F6 成本边界对账

现有 `scripts/compiler/release-family-costs.mjs` 只能接受 `summary.ok === true` 的完整普通家族消费者结果，再对同一安装内的 Base Button（N=1）和 Base / Shadcn / Brutalist Button（N=3）执行 esbuild 0.25.12 的真实 browser ESM production bundle。它分别保留生成源码、helper 源码、retained output、gzip、support retained bytes、逐输入 hashes 和 metafile；目标依赖进入 bundle。当前旧来源的 Vue3 family 尚失败，所以没有绕过该 guard 用失败 summary 量成本。

原 F6 的 text-watch 17.2 KiB、counter-press 110.7 KiB、三探针 224.5 KiB、Adapter 562.6 KiB 是同一 `excluding-React` 边界的历史报告。Issue 原说明仍记原 fixtures / captures 尚未公开；现有 Button 输入和依赖边界不同，不能据此宣称复现、更正或取代那四个数字。原始任务及构建参数须可读后，才可按同边界重放并诊断实际重复 module 身份。

现有初始化段仅对已 import 的 production React，在 Happy DOM 各观察一次 1 / 3 owner 的 mount、真实 framework flush、dispose、Root 清空及旧 handles 退休。它不是 allocation / registration 数量、稳定的冷热分布、预算接受或 Adapter 比较。后续可用最终整合家族 green 的同一安装运行成本脚本，取得新来源的有界数据；原完整项目级去重、全部适用目标、初始化分配 / 注册预算和 cleanup / Context / Focus 反例继续独立保留。
