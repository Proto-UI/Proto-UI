# Shadow split：PR #652 与文档主题订阅主线调和

日期：2026-09-15。本轮将 `main` 的 `a3095552a04456270e031db465436c09c61068d1`（合入 #653）合入 #652 的 `5c9fee0343b3b3762a2d758d1481fc3ea68166da`。用户授权冲突跟进，并将 Adapter 体积预算作为独立讨论；未授权本轮提高预算、批准或合并 PR。

## 冲突与处理

实际文本冲突仅位于 `packages/adapters/web-component/src/adapt.ts` 和 `spec/adapters/A-WEB-COMPONENT-0001.yaml`。

- 保留 split 的 `ownerGetMeta`、Effects routing、`attachView` 失败回滚和 owner-lifetime resources。
- 保留主线默认 getter/source 的精确引用，向既有 boolean profile 的 owner/view 接线传递同一组对象；custom `getMeta` 不配接默认 source。
- split 使用 retained environment getter，明确不构造、传入默认文档 invalidation source。不能只替换 source 的 getter 引用来绕过 identity 校验：显式 split source 与 document 的变化来源可能不同。
- Adapter spec 合并两侧的 Test relations，并保留主线新增 Module/Host Capability/criteria/revisions。不提升 lifecycle，也不新建 profile identity。

边界由 draft `C-RULE-COLOR-SCHEME-0001` C/D/G/H/K/L、`M-RULE-META-0001` 和 `HC-COLOR-SCHEME-INVALIDATION-0001`，以及 draft `D-WEB-COMPONENT-SHADOW-STYLE-0001` E/I/K、`D-WEB-COMPONENT-SHADOW-PROFILE-0001` F 共同约束。文档主题的新增响应保证仍限于默认同文档 Light DOM 域；此次调和不把任意 split mixed Rule、custom/subtree 或跨文档语义加入新保证。

`shadow-split-profile.test.ts` 新增三条共存路径：default source、explicit source、explicit source + custom base getter。每条验证 Light 的实际 token 更新、split marker/meta 同源、精确 owner/view pair、view absence/remount、terminal teardown/reconnect。内部引用断言只证明接线；happy-dom token 断言不冒充 browser paint。临时模拟“丢失 Light view source、误向 split 传递 document source”的错误合并时，三条均按预期失败；恢复后该 suite 共 23 项通过。未把 source change 后 split mixed Rule 的即时更新作为新增保证。

## 预算仍未通过

用官方且已校验的 Node 22.23.2 Darwin arm64（zlib `1.3.1-e00f703`）、esbuild `0.25.12`，保持原 9 入口、build options、gzip level 9 和全部上限，调和后 WC 为 **84,491 / 84,000 bytes**，超出 **491 bytes**。相较同一运行时的调和前 83,820 bytes，增加 671 bytes；不是编译失败，也不是浏览器/npm 限制。其余 8 项通过，React root 为 74,793 / 75,000，Vue root 为 74,509 / 75,000。

之前的压缩环境对照、Focus 去重和 180-byte 余量见 [前一轮预算记录](./2026-09-15-shadow-split-bundle-budget.zh-CN.md)。本轮没有删减任一侧能力或修改预算来制造通过结果。预算策略需要单独讨论；冲突消除与 PR 达到合并条件是两回事。

## 本地验证

环境：Node 22.23.2、pnpm 10.32.1、Chrome 152.0.7977.83。除预算使用上述官方运行时外，工程检查使用本机 Node。

- `node scripts/build/public-packages.mjs`：43/43 公开包构建通过。
- `corepack pnpm@10.32.1 exec vitest run --exclude '**/*.browser.test.ts'`：510 文件、2,593 项通过；3 文件 skipped、34 项 TODO。
- `corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test/shadow-closeout.browser.test.ts apps/www/test/color-scheme.browser.test.ts`：2 文件、37 项真实浏览器测试通过。涵盖 29 项 closeout 边界和四 Adapter 的 8 条主题/首帧流程。
- `corepack pnpm@10.32.1 check:types`：通过，220 个 Astro 文件零错误、警告、hints；在 unit run 完成后再次串行验证通过。
- `node scripts/analysis/shadow-split-public-consumer.mjs`、`node scripts/analysis/shadow-s4-portal-browser.mjs`、`node scripts/analysis/shadow-s5-public-browser.mjs`：S1 Checkbox/Indicator、S4 portal cleanup 子集、S5 原生编辑器公开 dist/CLI 路径通过，未回退到 package source alias。
- `check:spec-authoring -- --base a3095552a04456270e031db465436c09c61068d1`：24 个 changed catalog inputs 通过；`spec:docs:agent` 后 `check:agent-doc` 通过；`check:prototype-catalog`、43 个 `check:package-manifests` 通过。
- 第一次 `check:agent-operations` 在读取合并带入的未提交 binary diff 时触发 `spawnSync git ENOBUFS`。未修改检查脚本或丢弃证据，待保存本地合并提交后以干净工作区重跑；此时不将它记为通过。

本轮未执行完整 `pnpm test`/全部 browser suites、全站构建、Windows、Safari、Firefox、OS IME 或新人工验收。新 head 的 CI 与独立 review 必须重新确认；没有关闭 review threads 或执行 PR merge。
