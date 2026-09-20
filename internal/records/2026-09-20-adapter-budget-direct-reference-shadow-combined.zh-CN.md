# Adapter 预算：scroll、direct reference 与 shadow split 合并归因（#654 流程）

## 背景

#654 的维护者决定要求数值上限调整是一笔可评审事务。#659 与 #665 已分别记录 shadow split，以及 scroll end-follow + shadow split 的组合预算。随后 #623 与 #625 从各自绿色的旧 base 先后合入；两者组合后的 `main` 已超过 #665 为 react/vue 预留的上限，而待合入的 #652 会进一步形成第三个可加的 eager Adapter 能力切片。旧记录保持当时事实，本记录补充当前三切片的精确合并稳态。

## Canonical 测量

测量形状不变：esbuild bundle + minify + tree-shaking，browser ESM/ES2020，同一 external 边界，gzip level 9。CI 使用 Node v22.23.2、zlib 1.3.1-e00f703、esbuild 0.25.12、linux/x64；本地 Node v22.22.1、同版 zlib/esbuild、Windows x64 得到逐字节相同的当前 `main` 产物。

| 对象 | 组合 | gzip / minified / SHA-256 | 当时上限 |
| --- | --- | --- | --- |
| `main@c473eae3` | #623 + #625 | react 79,385 / 301,098 / `a51b2d304fc1b5971804a2e498655b11fa2de7159326758649e8637fc5aad3eb` | 78,500 |
| `main@c473eae3` | #623 + #625 | vue 79,133 / 299,812 / `ea0d8eadf796a25a4a3aa268819a5dcf86cae64bfe5b9defac81038d46315f20` | 78,500 |
| `main@c473eae3` | #623 + #625 | wc 82,574 / 312,928 / `21a724e93dbc6b3b0cf0b3f7dedb4cfec6292b449a0726fc85b902b21e8a8579` | 89,000 |
| #652 merge-ref `6c5d1613` | #623 + #625 + #652 | react 82,082 / 306,763 / `f89e034e216162aaa4020b0d95660e1d24a00eeb0e5f809683ca0898860e38b8` | 78,500 |
| #652 merge-ref `6c5d1613` | #623 + #625 + #652 | vue 81,804 / 305,464 / `a9b74ab036fbddb34ddf955950cb756d3e49a243d357ef413be4caeb82a76873` | 78,500 |
| #652 merge-ref `6c5d1613` | #623 + #625 + #652 | wc 95,936 / 351,703 / `47197dff7c5d72a12ee6e0a12d050af5cdd0d716b29803505c7d2646f3305dc4` | 89,000 |

对应 CI 证据：`main` run `35515179875` / job `106089855845`；#652 run `35517184826` / job `106095011007`。#509 merge-ref 的三个产物与当前 `main` 逐字节相同，证明其 Agent operations 变更没有形成 package 增量。

## 增长归因

- #623 的 scroll end-follow、#625 的 direct-reference transport 与 #652 的 shadow split / composed-tree focus 都通过公共 Module 或 Runtime 进入三个 eager Adapter 根闭包；它们是已审查、职责不同且近似可加的能力切片。
- #625 各自分支 CI 与 #623 各自分支 CI 都基于尚未包含另一切片的旧 base，因此单独绿色不能证明两者合并后的 whole-entry 上限仍成立。
- #652 merge-ref 上除三个预期能力切片外，package manifest、release tarball consumer 和 CLI consumer 检查均通过；未发现测试工具、重复 runtime 副本或无关 Prototype family 进入发布闭包。

## 新上限与余量

- `adapter-react root`: 78,500 → 83,000；相对 82,082 留 918 bytes。
- `adapter-vue root`: 78,500 → 82,500；相对 81,804 留 696 bytes。
- `adapter-web-component root`: 89,000 → 97,000；相对 95,936 留 1,064 bytes。

余量继续落在既往约 0.5–1.5 KB 的范围内。#652 合入前，wc 上限相对当前 `main` 会暂时偏松；这是为了让预算事务保持独立并先修复已失败的 default branch，而不是对未来未归因增长的授权。

## 边界

本变更不解除 whole-entry anti-regression 门的阻断性，不改变测量形状，不扩张公共 API 或运行时语义，不修改 spec 实体。旧记录不回写；后续能力增长仍需新的精确测量、归因和独立评审事务。
