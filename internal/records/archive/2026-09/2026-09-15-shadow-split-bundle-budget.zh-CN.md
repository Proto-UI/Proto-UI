# Shadow split：PR #652 gzip 预算跟进

## 失败与测量边界

[CI run 34936410085 / public_package_build](https://github.com/Proto-UI/Proto-UI/actions/runs/34936410085/job/104275210919) 对 PR head `0a50c1675fac9eec61fd2b37cb1fa3c57326d0c5` 的检查失败。43 个公开包构建与 43 个 manifests 已通过；首个失败是 WC root 的 **84,030 / 84,000 gzip bytes**，其余 8 项预算通过。同一 head 的完整 `test` 成功，不是编译或行为断言失败。

CI checkout 的 merge commit 为 `8027b30b541e24840e2478f15a5d9066c4970eb6`；其 tree 与本地 head 同为 `87d0d5c0acb982c0d94212b3e11e38b01a21aae4`。之前本机测得 83,932 bytes 的记录是真实历史测量，但 68 bytes 的余量不足以覆盖运行时压缩差异。

本轮在同一 macOS arm64 工作区使用两份 Node 22.23.2：

- 本机 Homebrew Node：zlib `1.2.12`，WC 为 83,932 bytes。
- 从 `nodejs.org/dist/v22.23.2` 下载并按官方 `SHASUMS256.txt` 校验的 Darwin arm64 发行包：zlib `1.3.1-e00f703`，WC 为 84,030 bytes，全部 9 项 gzip 数值均复现 CI 日志。

两者 esbuild 均为 0.25.12，9 项 minified 产物的 SHA-256 全部相同。WC 的原始大小为 316,075 bytes，SHA-256 为 `61abb5ff905bfc0fbdcdff1ddaa40c4d7bb4f420b6ed66c3f191b994116a943e`。同一份产物在两份运行时中压缩后得到不同大小，说明不能仅凭 Node 版本号认定 gzip 测量环境等价。此对照不是本机执行 Linux CI，也不声称从旧 CI 日志读取到了其 zlib 版本。

## 调整范围

用户批准小范围优化、核对测量环境并更新当前 PR。最终仅对 `packages/modules/focus/src/create.ts` 的重复配置告警逻辑做表驱动去重；保留显式字段顺序、key 的 debugLabel/id 表示、旧 `scope.roving.*` 标签、未定义值与相同值处理，以及原配置合并、setup 限制和后续动作。未改焦点采样、radio 资格、pending request、view lifetime 或样式准入逻辑。

`scripts/analysis/package-budgets.mjs` 保留原来的 9 个入口、全部预算、esbuild 选项和 gzip level 9。报告增加 Node、zlib、esbuild、平台、架构和各 minified 产物 SHA-256；JSON 保留 `.results`，现有 monorepo snapshot 消费路径不变。后续可区分产物变化与压缩环境变化。

尝试过的 WC class ownership 和 recipe error helper 去重减少了原始代码，但没有改善 gzip；已完整撤回，不作为本次交付内容。

不修改 spec 语义、实体生命周期或支持范围；现有 Focus 测试文件继续由原 T 映射覆盖。新增的配置诊断断言用于证明优化兼容性，不是新增作者语法。

## 结果与验证

官方 Node 测得 WC **83,820 / 84,000 bytes**，相较失败值减少 210 bytes，剩余 180 bytes；Homebrew 为 83,720 bytes。两者新的 minified 产物仍完全相同：314,107 bytes，SHA-256 `6e4d92c7287fe8e488e7e8794ce163358b7c00d2b7f7606e55cbe4ca50fe69f1`。两份运行时的 9 项预算均通过。180 bytes 仍是偏小的余量，不是恢复了最初约 1 KB 的空间，更不是后续增长授权；后续新增行为仍须重新测量。

冻结代码后的本地验证使用 pnpm 10.32.1、Node 22.23.2、Chrome 152.0.7977.83：

- 新配置诊断断言在原实现与优化后均通过；两份 Runtime suites 共 34 项。原预算失败在官方运行时可复现，优化后通过。
- Focus center、Runtime Focus/roving、WC sampler/entry observer 聚焦回归：5 文件、53 项通过。
- `node scripts/build/public-packages.mjs`：43/43 公开包通过。
- `corepack pnpm@10.32.1 exec vitest run --exclude '**/*.browser.test.ts'`：503 文件、2554 项通过；3 文件 skipped、34 项 TODO。
- `corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test/shadow-closeout.browser.test.ts`：29 项通过。
- `node scripts/analysis/shadow-split-public-browser.mjs`、`node scripts/analysis/shadow-s4-portal-browser.mjs`、`node scripts/analysis/shadow-s5-public-browser.mjs`：S1、S4 portal cleanup 子集和 S5 公开 dist / CLI 产物回归通过。
- `check:types`：workspace TypeScript 通过，216 个 Astro 文件无错误、警告或 hints。
- `spec:docs:agent` 生成后 `check:agent-doc` 通过；`check:agent-operations` 58 项通过；`check:package-manifests` 43 项通过。变更文件格式与 diff 检查通过。

未新跑本地完整浏览器矩阵、Windows、Safari、Firefox、系统 IME 或人工截图验收。推送后的新 head 仍须取得 CI 和独立 reviewer 确认；未合并、批准、关闭 review thread 或发布。
