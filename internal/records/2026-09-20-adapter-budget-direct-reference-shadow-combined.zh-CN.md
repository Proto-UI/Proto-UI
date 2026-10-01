# Adapter 预算：scroll、direct reference 与 shadow split 合并归因（#654 流程）

## 背景

#654 的维护者决定要求数值上限调整是一笔可评审事务。#659 与 #665 已分别记录 shadow split，以及 scroll end-follow + shadow split 的组合预算。随后 #623 与 #625 从各自绿色的旧 base 先后合入；两者组合后的 `main` 已超过 #665 为 react/vue 预留的上限，而待合入的 #652 会进一步形成第三个可加的 eager Adapter 能力切片。旧记录保持当时事实，本记录补充当前三切片的精确合并稳态。

## Canonical 测量

测量形状不变：esbuild bundle + minify + tree-shaking，browser ESM/ES2020，同一 external 边界，gzip level 9。CI 使用 Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12、linux/x64；本地 Node v22.22.1、同版 zlib/esbuild、Windows x64 得到逐字节相同的当前 `main` 产物。

本次增量的共同基线是 `424cc6405049fe74d5bf5f53d428017827c01632`，不是此前记录的 `124f44c9`。该基线已经包含 #661 的 Overlay modal-lock 修复 `650895ec12fca740a9e716f96913d0f5e3963e8d`；`git merge-base --is-ancestor 650895ec12fca740a9e716f96913d0f5e3963e8d 424cc6405049fe74d5bf5f53d428017827c01632` 返回 0。#661 的代码由三个 Adapter 的 eager Module 闭包消费，其体积已计入本次起点，不归入 #623、#625 或 #652 的新增量；本记录不单独估算 #661 相对更早基线的增量。

| 基线 / 中间版本 | 已包含的切片 | react / vue / wc gzip bytes | Canonical package job |
| --- | --- | --- | --- |
| `424cc6405049fe74d5bf5f53d428017827c01632` | 基线，已包含 #661 | 72,930 / 72,632 / 76,100 | [106074715777](https://github.com/Proto-UI/Proto-UI/actions/runs/35509451284/job/106074715777) |
| `040bbd6206a4fe6572ea9ce0ea13ee432f59a196` | 上述基线 + #623 | 75,972 / 75,737 / 79,147 | [106089036711](https://github.com/Proto-UI/Proto-UI/actions/runs/35514877803/job/106089036711) |
| `c473eae3fe6b66354f5e689fcc1d01241946ed7f` | 上述基线 + #623 + #625 | 79,385 / 79,133 / 82,574 | [106089855845](https://github.com/Proto-UI/Proto-UI/actions/runs/35515179875/job/106089855845) |

三个 job 均记录了上述相同的 Linux 工具链、minified bytes 和 SHA-256。`040bbd62` 的 workflow run 后来被取消，但所链接的 package job 已成功完成并输出完整测量；不能把它表述为整个 workflow 通过。下表的“组合”仅列出相对这条已包含 #661 的基线新增的能力切片。

| 对象 | 组合 | gzip / minified / SHA-256 | 当时上限 |
| --- | --- | --- | --- |
| `main@c473eae3` | #623 + #625 | react 79,385 / 301,098 / `a51b2d304fc1b5971804a2e498655b11fa2de7159326758649e8637fc5aad3eb` | 78,500 |
| `main@c473eae3` | #623 + #625 | vue 79,133 / 299,812 / `ea0d8eadf796a25a4a3aa268819a5dcf86cae64bfe5b9defac81038d46315f20` | 78,500 |
| `main@c473eae3` | #623 + #625 | wc 82,574 / 312,928 / `21a724e93dbc6b3b0cf0b3f7dedb4cfec6292b449a0726fc85b902b21e8a8579` | 89,000 |
| #652 merge-ref `b53a2bc6` | #623 + #625 + #652 | react 82,082 / 306,763 / `f89e034e216162aaa4020b0d95660e1d24a00eeb0e5f809683ca0898860e38b8` | 78,500 |
| #652 merge-ref `b53a2bc6` | #623 + #625 + #652 | vue 81,804 / 305,464 / `a9b74ab036fbddb34ddf955950cb756d3e49a243d357ef413be4caeb82a76873` | 78,500 |
| #652 merge-ref `b53a2bc6` | #623 + #625 + #652 | wc 95,936 / 351,703 / `47197dff7c5d72a12ee6e0a12d050af5cdd0d716b29803505c7d2646f3305dc4` | 89,000 |

对应 CI 证据：`main` run `35515179875` / job `106089855845`；[#652 run `35517184826` / job `106095011007`](https://github.com/Proto-UI/Proto-UI/actions/runs/35517184826/job/106095011007)。后者 checkout 与 `git log -1` 输出的完整 commit 是 `b53a2bc670cf363e161fa698c03b4d90aa12aa84`，即将 `5a5b58a79a5f2b26c55f649733cef18872b45000` 合入 `c473eae3fe6b66354f5e689fcc1d01241946ed7f` 的历史测量。`6c5d1613ef45093b49f93dd833c90a8312e4ee7a` 属于 #509 merge-ref，不是这份 Shadow 测量的源码；其三个 Adapter 产物与当时 `main` 逐字节相同，未形成 package 增量。

## 增长归因

- #623 的 scroll end-follow、#625 的 direct-reference transport 与 #652 的 shadow split / composed-tree focus 都通过公共 Module 或 Runtime 进入三个 eager Adapter 根闭包。以已包含 #661 的 `424cc640` 为起点，#623 在 `040bbd62` 的增量为 react +3,042 / vue +3,105 / wc +3,047 bytes；随后 #625 在 `c473eae3` 的增量为 +3,413 / +3,396 / +3,427 bytes。#652 所列 merge-ref 相对 `c473eae3` 的增量为 +2,697 / +2,671 / +13,362 bytes。这些是具体版本之间的 gzip 差值，不把压缩后的体积视为逐文件严格可加，也不把 #661 的既有成本归给后三个切片。
- #625 各自分支 CI 与 #623 各自分支 CI 都基于尚未包含另一切片的旧 base，因此单独绿色不能证明两者合并后的 whole-entry 上限仍成立。
- #652 merge-ref 上除三个预期能力切片外，package manifest、release tarball consumer 和 CLI consumer 检查均通过；未发现测试工具、重复 runtime 副本或无关 Prototype family 进入发布闭包。

## 新上限与余量

- `adapter-react root`: 78,500 → 83,000；相对 82,082 留 918 bytes。
- `adapter-vue root`: 78,500 → 82,500；相对 81,804 留 696 bytes。
- `adapter-web-component root`: 89,000 → 97,000；相对 95,936 留 1,064 bytes。

余量继续落在既往约 0.5–1.5 KB 的范围内。#652 合入前，wc 上限相对当前 `main` 会暂时偏松；这是为了让预算事务保持独立并先修复已失败的 default branch，而不是对未来未归因增长的授权。

## 边界

本变更不解除 whole-entry anti-regression 门的阻断性，不改变测量形状，不扩张公共 API 或运行时语义，不修改 spec 实体。旧记录不回写；后续能力增长仍需新的精确测量、归因和独立评审事务。

同一历史 #652 package job 还记录了 `core root` 6,013 / 6,000 与 `runtime root` 61,580 / 60,000 的失败。只代入本事务的三个 Adapter 上限不会消除这两个失败；本 PR 不调整 Core/Runtime 预算，也不证明 #652 的全部预算通过。#652 后续 head 仍须独立取得对应源码的完整 gate 与 review 证据，不能继承这份历史测量的通过结论。
