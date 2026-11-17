# 2026-11-18：补齐 Expose 投影刷新修复的公开回归

本记录为非规范工程证据，日期按 Asia/Shanghai；机器观测时间保留 UTC。此次只在两个公开测试文件追加 **7 个案例**，保留原有 **36 个案例**，并增加本记录及其机器证据。产品源码、契约、配置和依赖没有变更。

## 来源与覆盖缺口

基础是已合并的 `0f0955a9d624e0ef5e250f56a0eaa0fc52bbfb53`。产品修复提交 `2ac5e0e8bbde2c6440704702a27bda028432edf2` 已解决 PR1491-EXPOSE-003：同一次显式读取或方法结果同时含原始对象 R 与其旧公开投影 P 时，旧 P 不应覆盖刚从 R 得到的新快照。当前 `exposes.ts` SHA-256 为 `8cfdc91c27a1bbe6095a6013b0cde528e7f6d40b3512012f986e05afefe11686`。

[公开审查记录](https://github.com/Proto-UI/Proto-UI/pull/1491#pullrequestreview-5939853404) 指出，相关私有 9 reader＋2 bridge 用例尚未进入仓库，原工程归档仍绑定修复前源码。共享目录中只恢复了旧的 31 reader 用例与更早的组合证据，没有恢复后来那组私有用例。因此本次明确为**新编写的黑盒回归**，不宣称恢复原 9＋2，也不宣称重现评论另行报告的 64／64。

| 新增公开案例 | 观察边界 |
| --- | --- |
| 4 个 reader 案例：read/result × raw-first/projection-first | 同图中的两条公开 alias 保持同一 P；显式刷新后读取新 scalar/accessor 值、删除旧字段、替换方法，并保留 self-cycle、每次读取一次 getter 和终止后的 callable guard。 |
| 1 个 projection-only 控制 | 只回传 P 时保留其当前合法字段与新增 callable；调用进入正确 owner，原始对象与另一 owner 的投影不受修改；本 owner 终止后拒绝旧 callable，另一 owner 仍可调用。 |
| 2 个真实 React/Runtime/State 桥接案例 | 通过真实 `getExposes()` 与公开方法返回混合图，两个属性顺序均刷新 late State-writing callable；该 callable 能写入实际 State，终止卸载后拒绝调用。 |

原有 array holes/length、symbol/nonenumerable、registry 过滤、nominal identity、view epoch 与 disposal 控制保留在两份完整测试中。测试不检查 `Map`、私有 cache 或产品源码字符串。依据包括 draft `C-EXPOSE-0004/0006/0007/0008`、`M-EXPOSE-0001-H`、`C-STATE-0004-C` 和 `T-EXPOSE-0002`；本记录不提升其生命周期，也不新增 mutable value 自动订阅保证。

## 实际执行

使用 Node 24.22.1、pnpm 10.32.1、Vitest 2.1.9、TypeScript 5.9.3。Runtime 测试按仓库配置运行于 HappyDOM，单 worker、禁止文件并行，`NODE_OPTIONS=--max-old-space-size=1536`。

| 执行 | 实际结果 | 范围 |
| --- | --- | --- |
| 受控旧源码对照 | **3 failed、4 passed、36 unselected**；exit 1 | 在 **0f 隔离工作树中只替换 a23 的 `exposes.ts`**，其余源码、测试、lock/config 输入固定；仅选择 7 个新增案例。不是整个 a23 tree 的重跑。 |
| 恢复合并源码后的完整两文件 | **43 passed、0 failed、0 pending**；exit 0 | reader 36＋React 7；包括全部原有 36 例与新增 7 例。 |
| 最小 scoped types | **2 roots、643 Program files、357 workspace files、0 foreign files、0 diagnostics**；exit 0 | 使用根 tsconfig 原 options 的完整传递 TypeScript Program，耗时 6.091 秒；不是完整 workspace typecheck。 |

旧源码的三个真实失败分别是 raw-first reader read、reader result 与 React result，均实际观察到 stale `1` 而期待 `2`。反向顺序与 projection-only 控制原本通过，未算作产品失败。负对照结束后 `finally` 恢复精确的 `8cfdc91c…` 产品字节，红绿运行期间各自的输入哈希保持一致。

最初派生收据只识别逐案例状态 `pending`，漏计 Vitest 的 `skipped`，把 unselected 错写为 0。原始 Vitest JSON 一直正确记载 36 个未选案例；初版收据和脚本保留，最终收据仅从同一原始 JSON 修正记账，没有重跑或改写失败。最终完整两文件运行没有未选案例。

## 可恢复证据

[机器证据](evidence/2026-11-18-expose-projection-refresh-regressions.json) 保存源码／测试 manifest、精确命令、workdir、环境、逐次输入哈希、真实结果、记账更正，以及带逐成员 SHA-256 的 **30 成员 ZIP**。归档包含红绿日志与原始 JSON、scoped types 原始报告、两版 runner、旧／新产品输入、候选测试、可应用补丁和两份独立审查报告。

测试补丁 `public-regression-tests.patch` 为 **7279 bytes**，SHA-256 `ef3ab68224c7d908a35f5739ad1711437d82f6beca50279a58eeb7e90e709796`。字节定义是归档收据所列 Git 命令的原始 stdout：固定 base、两个测试路径、完整 blob ID、Myers diff、三行上下文、固定 `a/` 与 `b/` 前缀，关闭 external diff/textconv/rename/color，没有输出后处理。已在独立临时 index 上验证可应用到精确 0f base，并通过当前测试树的反向检查。

复现时在精确 0f checkout 应用该测试补丁，将归档提取至新的复现目录，按本地目录调整两个 runner 中的 root/output 常量，并安装对应的 frozen 依赖。归档历史 runner 在 red 和 green 两种模式都会读取 a23 Git 对象；0f 是 squash，仅有 0f 的 checkout 不保证该对象存在。先执行 `git fetch --no-tags --no-write-fetch-head origin a23bf1b24f07742ef8852cda474eff958a4dc845`，并以 `git cat-file -e a23bf1b24f07742ef8852cda474eff958a4dc845^{commit}` 确认，再使用归档中完整记录的命令。旧源码对照是有意的单文件替换；runner 会校验并恢复合并源码。

若旧 Git 对象不可取得，可在独立复现副本中把历史 runner 的旧源码读取行改为读取归档 `exposes-before-repair.ts`，并先校验 SHA-256 `6cacd89777e7e7c88b761643dd7e4c825252fafd5b9e3dcafe1c3d17b2801db8`。这是尚未执行的复现适配建议；原归档 runner、命令和本次结果保持不变，适配后执行应产生自己的新收据。两个测试最终 SHA-256 分别为 reader `421eccaa0b349b69b06ab54fd3d44692d31797575abef24b907036a315ddaf93`、React `f1a3356ded30db56ab978d8dc7822ebcd317f530835622fcc1e59b94b557fc13`。

独立源码／测试及执行证据审查已检查固定哈希和原始结果，无剩余可操作 finding；本记录自身的后续文字审查另有收据。原 105／52 仍归属 a23 修复前源码，不与本次 43 相加。本次没有运行完整 workspace types、native/browser、packed consumer 或原 105 组，也不将基础 main 的其他 CI 或评论中的私有组合结果计入本次验收。
