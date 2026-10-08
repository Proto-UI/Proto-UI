# 九次 implementation 执行修订与费用准入

日期：2026-10-05。性质：当前用户授权的本地工程记录，不是 Proto 规范、受测结果或付费授权。

## 本阶段状态

本阶段最终目标仍是最多九次受测 dispatch 及逐次结果，不把执行器准备当作实验完成。本记录时新增受测调用 **0/9**，尚无本批模型耗时、真实 usage、实际费用或条件效果结论。只做了本地合成 HTTP 与真实 Chrome 的执行演练及窄范围独立复核；编码/复核代理不是受测者。

没有改变接收器、共同任务、starter、三个条件文档、八条 claims、15 项指标、oracle、Proto 规范或 Round0；没有 discovery、重试、补位、commit、push 或外部发布。当前路线费用准入未满足，结束最小准备后等待用户的具体费用决定，不继续扩展可信度工程。

## 冻结修订

保留原 frozen-v1，manifest SHA-256 为 `93bfa977097698b6c15048a5db33ed8dd606a7ac6ee0a3716cc92aaa298d6be5`。修订目录：

`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-v1/plan/frozen-v1.1`

修订 manifest SHA-256：`6bfc7e984c3c4d53a8676bc116a7d0570f76a4392dcd7e18236eddd940605f9d`。seed 为固定文本 `2026-10-05-tabs-settings-nine-balanced-v1.1` 的 SHA-256：`16597d472e33eea7593cb5f8ea260a3829dc08234dce762d37771068625e94f6`；从十二个 Latin-square 顺序中以确定性、拒绝偏差的选择算法选一次，未按成绩重抽。

| 块  | 位置 1   | 位置 2   | 位置 3   |
| --- | -------- | -------- | -------- |
| 1   | ordinary | none     | proto    |
| 2   | proto    | ordinary | none     |
| 3   | none     | proto    | ordinary |

每条件在每块、每块内位置各出现一次。原 29 个 inventory 文件完整保留；新增父 manifest、execution-config、budget-policy、五个执行相关 source，共 37 个。旧 manifest 的日期、limitations、closedGates 等作为父历史完整保留，不代表本修订已获付费准入；本修订准备日期在 executionConfig.preparedAt。原请求逐字节未改。

新增源码：`scripts/benchmark/participant/nine-plan.mjs`、`nine-plan.test.mjs`、`nine-runner.mjs`、`nine-runner.test.mjs`、`nine-rehearsal.mjs`。运行前检查 digest、当前 source、每条件唯一 packet 和 wire；participant 请求无历史输出、评分反馈、协调器材料或工具。none/ordinary 内容只来自父冻结 allowlist，不把 Proto 上下文或评审材料注入受测者。这证明客户端请求隔离，不认证供应商内部缓存或会话行为。

最小执行器要求独立付费授权绑定修订 hash 和 routeFingerprint。每槽保留 reservation、dispatch-attempt、原始响应、terminal、assembled、assembly provenance、组装 receipt、异常、逐行结果和完整 ledger。独占新目录，不自动恢复；客户端最多九次，零重试、零补位，语义得分不影响追加调用。原始/组装证据 hash 检查不是 OS sandbox 或供应商真实性认证。

## 最小验证

- 最终联合 focused tests：29 passed、0 failed、0 skipped，日志在本轮证据目录 `scoped-tests.log`。
- 保留早期失败：执行器曾把损坏 SSE 中未返回的设置误判为实际设置变化；修复为仅比较双方已报告的非空字段，原 unknown 的新报告值记录基线，不倒推历史。修复后执行器 10/10；没有修改接收器或 oracle。
- 五个新增源码 Prettier check 通过。
- 本地 Node v24.21.0、Chrome v154.0.8037.93；Node22 CI parity 未验证。没有宣称全仓库 conformance 或产品保证。

### 明确标记的合成端到端演练

证据目录：`/Users/yangguangliang/.codex/experiment-artifacts/2026-10-05-noncompiler-value/nine-run-v1/offline-e2e-v1`。

mixed-nine 的九次本地 HTTP 请求逐字节匹配冻结 wire，经原严格接收器、提取器、原 bounded browser oracle 评分。主演练墙钟 61.168 秒；不是模型推理耗时。

| 槽               | 接收                  | 可评分 | 新功能 | 回归 | 完整指标 | 全通过 |
| ---------------- | --------------------- | ------ | ------ | ---- | -------- | ------ |
| block-1-ordinary | completed             | 是     | 6/6    | 9/9  | 15/15    | 是     |
| block-1-none     | completed             | 是     | 4/6    | 9/9  | 13/15    | 否     |
| block-1-proto    | invalid-deliverable   | 否     | —      | —    | —        | 否     |
| block-2-proto    | completed，host error | 否     | —      | —    | —        | 否     |
| block-2-ordinary | completed             | 是     | 6/6    | 9/9  | 15/15    | 是     |
| block-2-none     | failed，损坏 SSE      | 否     | —      | —    | —        | 否     |
| block-3-none     | completed             | 是     | 6/6    | 9/9  | 15/15    | 是     |
| block-3-proto    | completed             | 是     | 4/6    | 9/9  | 13/15    | 否     |
| block-3-ordinary | completed             | 是     | 6/6    | 9/9  | 15/15    | 是     |

这些是预设正负控制、wrapper、host-error 与接收失败 fixture，**不是条件实验**。两项语义负控制都在 horizontal-wrap、vertical-wrap 失败。host-error 控制保留观察到的十五条 pass，但整体不可评分，不能记作 15/15 的有效结果。完整 15 向量、每槽 participantMs/workerMs/totalMs、原始合成 usage 在 `mixed-nine/ledger.json` 和 `RESULTS.md`。

四个停止控制分别为：中断 2 dispatch/7 未运行；合成 100ms transport deadline 2/7；返回身份变化 2/7；参考费用阈值 1/8。100ms 只用于合成探针，不改变真实单次 180s。全部保留失败与未运行行，没有重试或补位。usage 是明确编造的 fixture counters，不是 model token；本地 HTTP 次数不计作受测样本或实际 inference。所有演练 participantProviderCalls=0；测试认证字符串未进入证据文件。

独立复核依据和最终结论存于本轮 `review-minimal/`；最终 source、freeze、HTTP/Chrome evidence 的复核与初步 source-only verdict 区分，不把初审当执行批准。

## 具体路线与当前费用风险

只读本地 CC Switch 元数据及一次无认证的 `/v1/models` inventory GET，没有 inference。观察存于本轮 `route-metadata.json`、`model-inventory.json`；不是账单或执行约束认证。

- 客户端：`http://127.0.0.1:15721/v1/responses`。
- 当前 provider：`yvxi`，upstream：`https://doesvm.icefish-exponential.ts.net:8453/v1`，不同于旧 Round0 NewAPI 路线。
- 当前本地日/月 USD limit 均 null；gpt-6.1-sol 未找到本地 model_pricing 行，cost multiplier=1.0；不能据此推断免费、已知单价或账单上限。
- proxy max_retries=3，auto_failover=0；不更改设置。最多九个客户端 dispatch 不能认证最多九个 upstream invocation，内部重试及其计费来源 unknown。
- catalog 显示 gpt-6.1-sol 可用及 default_reasoning_level=high；不把 inventory 默认值当本批实际生效参数。
- frozen request：model=gpt-6.1-sol、stream=true、max_output_tokens=8192、store=false、tools=[]、tool_choice=none；temperature/top_p/reasoning/service_tier/seed 未发送，返回不到的默认值 unknown。

USD1 仍是**参考 envelope**。参考费只按历史条件费率（input USD2/M、cached input USD0.10/M、output USD10/M）计算；这些不是已核验的 yvxi 本批价目。累计参考值达到 USD1 后只停止未来调用，当前调用可能越过该值；输出上限有效执行未确认，取消不证明 upstream 停止，超时不界定金额。真实单价、真实已扣费用与硬金额边界均未知；不能承诺本批实际费用≤USD1。

已可执行的边界：最多九次客户端 dispatch、零客户端重试/补位/新 discovery、不新充值、单次请求 180s、批次 30min dispatch window、raw response 4MB、deliverable 1MB、browser 60s；缺/无效 live usage、reported output>8192、身份/已报告设置变化、route/source/wire drift、uncertain receipt、browser deadline/evidence/cleanup 异常与参考阈值按预先政策停止后续调用。它们是调用/资源/证据边界，**不是实际金额上限**。

## 需要的用户决定与结论限制

付费前需要用户明确接受：当前 yvxi 路线没有可信 USD1 实际金额界限、单价与内部重试计费未知，在上述可执行调用/资源/停止边界下最多九次探索；否则须先提供有可信金额限制的路线。既有实验目标、旧路线许可和离线合成授权都不能替代这次费用风险授权。凭据只可在未来 transport 认证时短暂使用，不写 evidence、config 或 grant。

不可变模型版本、默认参数、内部缓存及 upstream retry 只记录可得证据与 unknown：它们限制精确可复现性、运行独立性和成本解释，不因认证不了全部供应商行为额外阻止明确授权的有界探索。实际已报告身份或设置变化触发冻结停止政策。九次尝试将是九个样本，15 项检查不是 135 个样本；失败和不可评分不删除；n=3/条件只作本批探索性描述，不推断因果、显著性或 Proto 规范稳定保证。
