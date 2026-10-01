# S4：显式入场终点候选与诊断关闭收尾

日期：2026-09-14。性质：有人工对照支持的修复候选；不是 Chromium 根因定论或规范晋升。

承接 `2026-09-14-shadow-s4-entry-natural-capture-and-ab.zh-CN.md`。权威仍为 draft `D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001` S/T 与 `D-WEB-COMPONENT-SHADOW-STYLE-0001` Q；不修改作者 API、Root role 分类、200ms 时长、生命周期或关闭 conceal 屏障。

## 有效候选对照

- 原版 Split 有 `JsDQN8` 自然回缩捕获；没有第二次打开或重复 enter 启动，异常发生在动画结束附近。
- CSSOM-only 版本会在 portal 搬迁后失效，其捕获不能作为候选反证；详见前一记录。
- 改为持久样式覆盖后，用户反馈 Split 约百次开关未复现，同页未修改的 Mixed 仍偶发。该命令只覆盖 Split 的 Content，不能误以为 Mixed 已获得修复。
- 针对 Mixed 单独加入同一覆盖，用户反馈约 80 次未复现。本机报告 `s4-entry-6oTeZ8/report.json` 保存了 3533 个采样、78 条有效实验校验，epoch 范围 1–79，candidate=null，无 page/capture error。
- Mixed 报告状态为 `interrupted`，来源是关闭窗口时保留的 `streamed-partial`，不是完整最终日志。人工次数与可用校验数分别陈述，不把 78 条校验写成完整 80 次机器证明。

上述临时目录均位于本机 `/var/folders/p8/rflqkv857nz2vfl44035731w0000gn/T/`，不是永久或可移植附件。此前 Split 的数次窗口关闭丢失了内存报告，约百次来自用户观察，不虚构对应采样。

## 实现落点

`packages/cli/src/services/proto-style-css.ts` 为 split geometry enter 补齐 `to`，不改 paint 动画、退出关键帧、动画时钟或 document/collapsed renderer：

```css
to {
  transform: var(--pui-split-rest-transform, none);
}
```

`--pui-split-rest-transform` 从同一个 canonical transform declaration 生成，保留相同 token selector/condition、translate 与 scale 操作数；每个 boundary 重置，嵌套 Root 不继承父级终点。没有 transform token 时保持底层 `none`，不引入新的静止变换声明。字段是私有 recipe 数据，不是作者 API 或 v1 artifact ABI 字段。

原生测试也纠正了一项假设：Chrome 的 `fill: both` 在底层终点为 `none` 时仍可保留单位矩阵插值，Light 原版同样如此。不能要求计算值必须为 `none`；测试比较原版隐式终点与新显式终点的真实矩阵及 fixed 后代定位，确认没有借修复改变现有行为。

工程判断是：显式描述既有最终几何，规避本场景在隐式终点附近观察到的回缩。证据不足以命名 Chromium 内部缺陷，也没有证明 Safari 掉帧与它同源。不加入全局 `will-change`、强制重绘、延长动画或特判浏览器。

## 诊断工具修复

直接关闭页面/浏览器原先会让 `page.waitForTimeout` 抛错并丢失全部内存报告。新增有界事件流镜像与关闭后的收尾，保留已收到的状态/像素采样，标为 `interrupted` / `streamed-partial`；无法取得的最终快照不伪造。已发现候选在读取快照前记录，快照失败仍保留候选画面并标识 capture error。

`scripts/analysis/shadow-s4-entry-shutdown.test.mjs` 在真实 Chrome 中分别关闭页面和浏览器；改动前两例均失败，改动后两例均保留报告。它只证明诊断留存，不证明动画修复。

## 验证边界

- CLI 新增显式终点/同条件来源/非 split 不变断言，改动前失败、改动后通过。
- `shadow-s4-entry-endpoint-browser.mjs` 验证 0/40/120/200ms 原生几何与 opacity、条件 scale 更新/撤回、嵌套 Root 重置、无 transform 的原版对照及 portal 搬迁后的终点规则。它不是自然回缩复现。
- `shadow-s4-admission-browser.mjs` 保留 Light/split/mixed 的中途反向、中心、slot 随动、命中和动态尺寸检查，增加 Mask 原有单位矩阵结果的跨模式检查。
- 通过正式 CLI 生成网站 companion，不手改生成产物。最终仍需区分临时覆盖候选的人工观察与无覆盖正式生成产物的验收。

该节点的完成门槛包括相关 CLI/Adapter 测试、类型检查、完整 S4 公共路径、portal teardown、关闭闪回像素回归及正式生成产物的最终对照；未经这些证据，不标记整个目标完成。

## 全量验证暴露的测试集成遗漏

首次 `pnpm test` 的并行单元阶段错误纳入了 S1–S4 的五个浏览器套件。它们未登记到 `scripts/test/runtime-test-plan.mjs` 的共享服务/串行阶段，各自启动网站并构建 CLI，实际出现 CLI dist 导入缺文件与五个 browser afterAll 60 秒超时。该轮自行结束，退出码 1，不能视为通过。

已登记五个 Shadow 套件，并加入目录与登记集合对照的 Node 测试（先失败、后通过），不扩大到其他无关测试。修正后的单元阶段没有 browser/CLI 构建错误：2098 项通过、19 项失败，本机 JSON 为 `/tmp/s4-endpoint-unit-report.json`。

其中 Dialog controlled dismissal 的三项测试只等待微任务便要求 portal 归位，与既有 `651277de` 的绘制关闭屏障不一致。改为等待实际 parent 与滚动锁恢复，不修改 Adapter、关闭时序或原有结果断言。专项三例及六例 conceal 单元测试通过。

另 16 项失败落在工作区原有暂存测试：`packages/adapters/vue2/test/catalog-conformance.test.ts`（1）、`packages/modules/context/test/catalog-boundary.test.ts`（10）、`packages/modules/scroll/test/context-scope.test.ts`（5）。本轮未修改这些测试或它们的 Runtime/Context/Scroll/Vue2 实现；不将它们混入 CSS 修复，也不宣称全量测试通过。

本轮已执行的专项结果：CLI+K1 266 项通过；`check:types`（含网站 206 文件检查）通过；S4 admission 42 帧、完整公共路径三模式各 15 次请求、portal 清理四模式、关闭像素 24 路径/369 帧通过。浏览器串行回归与正式产物人工复核继续单独记录，不用上述窄范围结果替代。

## 最终结果

随后复用 `http://127.0.0.1:4321`，以 `--no-file-parallelism` 运行五个已登记的 Shadow browser suites：5 文件、16 项全部通过，含 S1/S2/S3、S4 中英文完整路径及 S4 关闭像素回归，未再发生 browser afterAll 超时。

用户刷新正常 demo-matrix S4 页面，不使用任何 `S4_ENTRY_EXPERIMENT` 覆盖，对正式生成产物中的 Split 与 Mixed 进行人工复核，明确反馈“没有复现回缩或关闭闪回”。这与先前临时覆盖候选的约百次/80 次观察分别成立。

本场景修复已通过正式产物人工验收及上述专项机器验证；目标按节点本地提交后收尾。原有 16 项 Context/Vue2 测试失败继续作为独立遗留项，未因本场景验收而被免除。Chromium 内部根因与 Safari 单独掉帧的解释仍未确定，不扩展本次结论。
