# Monorepo 构建与体积优化复盘（2026-07-26）

> 本记录保存一次 P0–P2 优化前后的可复查数据与工程取舍。它是时间相关的观测，不改变 spec 语义。优化前摘要见 `internal/records/2026-07-26-monorepo-optimization-before.json`，优化后完整快照见 `internal/records/2026-07-26-monorepo-optimization-after.json`。

## 范围与方法

- 环境：Apple M3 Pro、18 GB、Node 20.19.4、pnpm 10.32.1。
- build：已有依赖安装、warm cache、不清空构建缓存，连续运行三次取中位数。
- gate：`check:types` 与 `test` 各运行一次。
- npm payload：对 37 个公开包运行 `npm pack --dry-run --json --ignore-scripts`。
- bundle：esbuild 0.25.12、browser ESM、ES2020、minify、tree shaking；第三方依赖 external，内部 `@proto.ui/*` 依赖按入口传递打包。
- 优化后可通过 `pnpm analysis:monorepo --benchmark --out <path>` 重复采集同一组数据。

## 结论

本轮完成了全部六项任务：Lucide 单图标边界、npm 文件白名单、可重复分析快照、重型文档页减重、拓扑感知 CI，以及 37 个公开包的纯 JavaScript 可发布构建。

最关键的改善是：37/37 公开包现在都有 `dist/*.js` 与 `dist/*.d.ts`、package-local `build`、原生 Node ESM import smoke 和与 release staging 一致的产物；Lucide 单图标 gzip 从 119,273 B 降到 1,560 B；npm payload 中测试文件从 1,031,558 B 降为 0；两个最重文档页面的原始 HTML 分别下降约 61% 和 63%。

## 前后数据

| 指标                            |         优化前 |       优化后 |   变化 |
| ------------------------------- | -------------: | -----------: | -----: |
| 有 build script 的 workspace 包 |         4 / 44 |      39 / 44 |    +35 |
| 有 build script 的公开包        |         4 / 37 |      37 / 37 |    +33 |
| 全部公开包构建                  | 不存在统一命令 |     36.954 s |   新增 |
| CLI build 中位数                |        1.050 s |      1.132 s |  +7.8% |
| Types build 中位数              |        0.747 s |      0.833 s | +11.5% |
| Workspace app build 中位数      |        2.031 s |      2.085 s |  +2.7% |
| Docs app build 中位数           |       19.575 s |     18.729 s |  -4.3% |
| `check:types`                   |       18.371 s |     20.072 s |  +9.3% |
| `test`                          |       25.172 s |     27.297 s |  +8.4% |
| Lucide `icons/x` gzip           |      119,273 B |      1,560 B | -98.7% |
| Lucide root gzip                |      635,689 B |    635,443 B | -0.04% |
| npm tarball 合计                |    1,066,097 B |  1,090,690 B |  +2.3% |
| npm unpacked 合计               |    8,588,642 B | 10,243,733 B | +19.3% |
| npm 测试文件                    |    1,031,558 B |          0 B |  -100% |
| Docs dist 总体积                |   21,341,845 B | 18,395,384 B | -13.8% |
| Docs web assets gzip 合计       |    3,661,028 B |  3,598,186 B |  -1.7% |
| Demo Matrix 英文 HTML           |    1,505,613 B |    585,968 B | -61.1% |
| Lucide Gallery 英文 HTML        |      876,223 B |    325,935 B | -62.8% |

CLI、Types 与顶层 gate 的小幅增长来自新增的 manifest 扫描、构建产物验证和依赖闭包保证；它换来了此前不存在的 JavaScript-only 发布保证。npm unpacked 体积增长则主要来自 Lucide 同时发布 JavaScript 和声明文件。tarball 仅增长 2.3%，同时移除了全部测试 payload，因此这是本轮明确接受的发布兼容性取舍，而不是未识别的回归。

## 拓扑与更新频率

workspace 拓扑保持 44 个包、209 条生产内部边、14 条 dev 内部边、0 个环；spec 快照保持 395 个实体与 1,580 条关系。构建选择使用生产依赖的反向消费者闭包，并补齐构建目标所需的上游依赖；根 manifest、lockfile、build/release 脚本或 workflow 变化会选择全部公开包。

优化后 30 天更新最频繁的十个 workspace 包如下。由于本轮统一修改了 37 个公开 manifest，多数公开包相对优化前自然增加一次变更，这不会改变高频区域的整体排序。

| 包                                | 30 天 commits | 90 天 commits |
| --------------------------------- | ------------: | ------------: |
| `@proto.ui/prototypes-base`       |            60 |            77 |
| `@proto.ui/prototypes-shadcn`     |            49 |            56 |
| `@proto.ui/runtime`               |            49 |            70 |
| `@proto.ui/adapter-react`         |            41 |            54 |
| `@proto.ui/adapter-web-component` |            38 |            51 |
| `@proto.ui/adapter-vue`           |            37 |            51 |
| `@proto.ui/core`                  |            37 |            47 |
| `apps-www`                        |            32 |            61 |
| `@proto.ui/cli`                   |            31 |            47 |
| `@proto.ui/adapter-base`          |            26 |            33 |

## 结构性变化

1. `scripts/build/public-packages.mjs` 成为公开包唯一构建入口，按拓扑编译 ESM 与声明、重写 Node ESM 相对扩展名、验证 exports，并执行不带 TS loader 的 import smoke。
2. 37 个 manifest 由 `sync-public-manifests.mjs` 统一维护 `dist` exports、`files`、`build` 与 `prepack`；release staging 复制同一份已验证 `dist`，不再维护第二套编译路径。
3. Lucide 的 shape renderer 与全 registry renderer 分离，固定图标入口不再传递引入 1,695 个图标。
4. Lucide Gallery 首屏只服务端渲染 120 个图标，完整目录以紧凑 JSON 留在页面并按搜索/分页创建卡片；Demo Matrix 每个 demo 只挂载一个可切换 adapter 的 previewer。
5. CI 先计算受影响公开包图；无公开包影响的 PR 可跳过 package release stage 与隔离 consumer，`main` 和手动触发仍全量运行。
6. `package-budgets.mjs` 固化代表性 gzip 上限；当前九个入口全部通过。

## 验证结果

- 37/37 公开包全量构建、export 校验与 Node ESM smoke 通过。
- 37/37 release stage 与 `npm publish --dry-run` 通过。
- `check:package-manifests`、`check:package-budgets`、`check:types`、`test`、Astro check 与 docs build 通过。
- 最终 benchmark 的全部 15 个 build 样本与两个 gate 样本均为 exit code 0。
