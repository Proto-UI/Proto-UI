# Sprint 2：最终来源的分发与成本验收准备

本记录接续 [首次干净安装记录](./2026-11-24-sprint2-distribution.zh-CN.md)，对应 #1458 固定分发 / CLI 和 #1055 F6。基底为 `dd0a3861508338ff859358f43cab99ded65563fc`；运行时依赖及 packed 脚本修复为 `baf6561c2e`。本次受最终来源尚未冻结的调度约束，仅完成有界修复与测量器预检，没有重做整个 pinned build、registry 安装或完整成本矩阵。

## 已修正的实际连接

`react-runtime-v1` 的 profile、helper 和 `emitReact` 输出原来分别硬编码 Core / Hooks / React Adapter `0.3.0-alpha.1`；当前这三份实际 public package manifest 均为 `0.3.0-alpha.2`。仅修改 profile 仍会生成旧版本依赖，因此三处元数据一起同步；React 继续为 `19.2.6`。测试分别将三处结果与真实包清单核对，没有把测试中的另一份版本常量当作 oracle。

旧 pin 和已生成 provenance 中的 alpha.1 声明保留原值；新 Compiler 不修改消费者的历史生成文件或 manifest。使用新 pin 时须重新编译原 source，并接受实际生成的新依赖清单。本次不声明 alpha.1 / alpha.2 可静默互换，也未发布或更改任何 public package 版本。

`packed-generated-smoke.mjs` 现在实际使用 `NATIVE_CONSUMER_COMPILER`，显式指定 `react-runtime-v1`，通过 `compileFile` 读取完整 Base Button 文件图，并写入全部支持文件、map、provenance。固定 Compiler 与作者来源必须为同一干净 revision。它沿用真实 packed Adapter 对照和六个独立 Button 检查点，但改为 fresh manifest → lock-only → `npm ci --ignore-scripts`，清除 Node 搜索 / loader 注入，记录完整命令终态、lock、tarball provenance 和实际 installed payload hashes。生成声明、pack 清单和安装版本不一致均拒绝；不能将另一版本的成功算作被声明版本成功。

## 生产成本脚本的边界

已有 1 → 3 个完整 Base / Shadcn / Brutalist Button 的量测继续保留：生成源码、支持源码、esbuild 0.25.12 的 production retained bundle、gzip、实际逐输入路径 / hashes / retained bytes 分开记录。新报告进一步列出相同支持文件路径及 hash 的共享、N=3 新增路径，以及相同内容出现在不同路径的真实 module identities。它没有使用消费者 alias 或改写生成组件，也不把相同内容自动判为非法重复。

React 初始化改为独立的 0 / 1 / 3 module bundles，各在新进程、新 Happy DOM window 中执行。零组件也真实创建 / 卸载 React 根，因此可作为框架自身注册工作的独立对照。导入、挂载、清理三个阶段分别记录宿主 API 调用：EventTarget 添加 / 移除、DOM 创建、支持的 observer 注册 / 断开、样式规则操作。探针先调用实际宿主方法，保持返回值、原回调及其身份，不替换用户回调。

这些是 **成功 API 调用数量**：重复 add 调用仍计两次，once / signal 自动移除不伪装成显式 remove，DOM 方法内部调用另一个被观察方法也分别记录。它们不是唯一存活监听器数、所有 JS 堆分配或内存泄漏证明。每次真实运行先校准两个重复 add、一次实际回调和一次 remove，并校准 DOM / MutationObserver；关闭探针的负控必须失败。时间观测包括探针及框架开销，没有接受性能预算。

完整 family summary 必须成功且保留三家族 × 四目标分母，生成 artifacts 的当前 hashes 必须仍与原 provenance 一致。成本报告在开始和每个阶段保存；SIGKILL 或失败不会得到 `ok: true`，失败前已有结果仍可读。已有报告不覆盖；需要复验时保留旧 attempt，在新的完整消费者副本中执行。

原 F6 的 text-watch **17.2 KiB**、counter-press **110.7 KiB**、三探针 **224.5 KiB**、Adapter **562.6 KiB** 是 `excluding-React` 的历史输入与边界。本脚本的 Button / including-target-dependencies 边界不同，未复现、改写或替换那四项结果。原输入、同边界独立对照、完整项目级去重与 negative controls、全目标注册 / 分配预算仍需各自接受。

## 本地实际验证

详细收据见 [receipts.json](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-final-consumer-gates/receipts.json)。

| 验证 | 实际结果与范围 |
| --- | --- |
| 真实 manifests 对 emitted dependency 的修复前对照 | 1 个失败：生成仍为 alpha.1，而实际清单为 alpha.2；不是伪造的输入拒绝 |
| `targets.test.ts` + `output.test.ts` | 17/17 通过；包括 profile/helper/实际 emit 版本和原 create-only 交付行为 |
| 真实 Base Button compileFile + alpha.1 pack manifest 负控 | compile 成功；真实 alpha.2 dependency 与 pack 不符，明确拒绝；尚未开始 npm 安装 |
| 宿主探针校准 / 关闭探针负控 | 通过；真实宿主的重复 listener 添加不改变实际一次回调行为 |
| production React 零组件根 runner 预检 | 通过，stderr 为空；只校准测量程序，未执行生成组件，未作最终 Compiler 来源接受 |
| 失败 family summary 的成本门 | exit 1、零测量行、`ok: false` 的收据保留；第二次执行拒绝覆盖原收据，字节未变 |
| 语法、`git diff --check`、public docs | 通过；public docs 回读 workspace alpha.2 与 307 双语 primary routes |

packed 脚本预检中自己的两次真实失败也保留：第一次误把输出 profile string 当作对象；修正后第二次暴露 `emitReact` 的独立旧版本声明。修复后才取得上述预期版本拒绝。零组件预检的依赖是已有精确 package payload 的新目录副本，**不是新 registry 安装证据**。归档保留 copied package hashes，未把工具校准写成 #1458 的完整分发成功。

[49 成员归档](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-final-consumer-gates/preparation.tar.gz) 大小 105,271 B，SHA-256 `522c163639f55cd46c178d0015a54bd801f5b16b6598006cfbd1909551712f97`；[逐成员清单](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-final-consumer-gates/preparation.manifest.json) 的 bytes、mode、SHA-256 均已解压读回核对。可重装的 `node_modules` / registry cache 未放入归档。完整 final registry / cost execution 字段仍为 false。

## 最终来源冻结后的一次执行集合

以下命令是准备好的执行集合，不是已经取得的最终回执。`S2_HEAD` 必须是干净 checkout 的完整 HEAD，`S2_GATE` 是专用的新目录；不要将新 evidence 写入被 pin 的源码树。

### 1. 创建并检查固定 Compiler

```sh
corepack pnpm@10.32.1 install --frozen-lockfile --ignore-scripts
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/targets.test.ts packages/compiler/test/cli.test.ts packages/compiler/src/artifact-output.test.ts packages/compiler/src/watch.test.ts packages/compiler/test/output.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
node --import tsx scripts/compiler/build-pinned.ts --revision "$S2_HEAD" --output "$S2_GATE/compiler"
node --import tsx scripts/compiler/build-pinned.ts --revision "$S2_HEAD" --output "$S2_GATE/compiler-repeat"
diff -rq "$S2_GATE/compiler" "$S2_GATE/compiler-repeat"
```

先比较尚未安装时的全部 artifact 文件，再在 `S2_GATE/compiler` 目录执行 `npm ci --ignore-scripts --no-audit --no-fund` 和 `node cli.js --build-info`，记录实际 package / lock / TypeScript 安装。随后回到同一干净 checkout。

### 2. 仅声明依赖的普通消费者与 CLI

```sh
NATIVE_CONSUMER_COMPILER="$S2_GATE/compiler/index.js" NATIVE_CONSUMER_DEPENDENCIES=registry node scripts/compiler/pinned-cli-smoke.mjs
NATIVE_CONSUMER_COMPILER="$S2_GATE/compiler/index.js" NATIVE_CONSUMER_DEPENDENCIES=registry node scripts/compiler/native-consumer-smoke.mjs
NATIVE_CONSUMER_COMPILER="$S2_GATE/compiler/index.js" NATIVE_CONSUMER_DEPENDENCIES=registry node scripts/compiler/release-family-smoke.mjs
```

分别保留完整实际输出目录与所有终态：CLI 的 parent 契约、compile/diff/user edit/collision/symlink、两个真实并发 writer、watch 非法源保留最后成功版、恢复、取消、实际目录和 symlink 的 session replacement；四个普通 native-profile 的生成 / 安装 / 普通构建 / 更新 / 清理；三家族 × 四目标的完整作者 Button 消费。旧每个成功结果保持其原作用域；最终新来源必须有自己的回执。小样本或未执行组不能冒充全分母通过。

### 3. 接入实际 public packed Adapter 对照

若本轮已经有同来源的 canonical 全量 public pack，可直接复用其 tarballs，无需重新 pack。若仅为此对照打包，读取 `scripts/release/lib.mjs` 的实际 manifest 图，从 Core / Hooks / React Adapter / Base 四个种子沿 dependencies、peers、optional internal edges 求完整闭包，再将完整名称列表传给 canonical `publish.mjs --pack --only`。当前只读闭包为 40 个 public package；`--only` 自身不替调用者补齐依赖。默认 workspace pack 为 47 个 public package。

```js
// 在 repository root 用 node --input-type=module 执行；process.argv[2] 是新的 release 输出目录。
import { getAllPackages } from './scripts/release/lib.mjs';
import { spawnSync } from 'node:child_process';
const packages = new Map(getAllPackages().map((pkg) => [pkg.name, pkg]));
const queue = [
  '@proto.ui/core',
  '@proto.ui/hooks',
  '@proto.ui/adapter-react',
  '@proto.ui/prototypes-base',
];
const selected = new Set();
while (queue.length) {
  const name = queue.shift();
  if (selected.has(name)) continue;
  const pkg = packages.get(name);
  if (!pkg || pkg.isReleaseExcluded || pkg.manifest.private) throw new Error(name);
  selected.add(name);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dependency of Object.keys(pkg.manifest[field] ?? {})) {
      if (dependency.startsWith('@proto.ui/')) queue.push(dependency);
    }
  }
}
console.log(JSON.stringify({ selected: [...selected].sort() }));
const result = spawnSync(
  process.execPath,
  [
    'scripts/release/publish.mjs',
    '--pack',
    '--only',
    [...selected].sort().join(','),
    '--out-dir',
    process.argv[2],
  ],
  { stdio: 'inherit' }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
```

这里只调用 `--pack`，不发布 registry。实际 canonical pack 成功后：

```sh
PACKED_DIR="$S2_GATE/release/tarballs" KEEP_PACKED_CONSUMER=1 NATIVE_CONSUMER_COMPILER="$S2_GATE/compiler/index.js" node scripts/compiler/packed-generated-smoke.mjs
```

这条是显式 runtime-backed 的对照，仍保留 Proto Runtime / Adapter；不能把它与四个 source profiles 的原生输出混记。六个 Button 检查点仍只是 Happy DOM 合同与轨迹对照，不是原全库 Adapter parity、浏览器、AT 或平台接受。

### 4. 同一成功安装内量成本

```sh
node --test scripts/compiler/host-cost-observer.test.mjs
node scripts/compiler/release-family-costs.mjs "$S2_FAMILY_SUMMARY"
```

`S2_FAMILY_SUMMARY` 使用步骤 2 实际打印的 `RELEASE_FAMILY_EVIDENCE` 中的 `summary.json`。四目标 × 1/3 的八个 retained bundle，以及 React 0/1/3 三条新进程终态全部保留；无 accepted baseline / budget 时保持 null，不靠 job success 补造批准。成本脚本只消费已生成 artifacts，不再次调用 Compiler 或依赖安装。

本批没有 GitHub 远端写入、Issue 关闭、registry 发布或全 Sprint 完成声明。最终来源固定、上述实际 full execution 和独立接受继续由整合 owner 承接；原失败和未测条件随本记录一并保留。
