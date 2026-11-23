# Sprint 6：WC prominent-tint 四个真实失败的独立分诊

## 结论

第一候选的四个失败都是 **pastel 背景下 tinted 正样本的明暗响应幅度不足**。实际源、当前渲染与截图绑定通过，neutral 正控通过，opaque 负控保持零响应，因此不能将它们记作环境故障、采集无效或无信息源。原门槛保持不变。

这份结果尚不能证明完整旧版端到端是否也失败。本轮 CPU prefilter 的像素变化已用失败 artifact 中的实际输入排除：从原提交和候选提交提取各自预滤镜函数，对四个失败 pair 的八份 source PNG 执行，逐份 260624 字节的输出均完全相同。此检查只覆盖 CPU 预滤镜，不代替旧版浏览器/owner/timing 运行。

## 绑定与原始产物

- [Actions run 45013196978 / WC job 137179795866](https://github.com/Proto-UI/Proto-UI/actions/runs/45013196978/job/137179795866)。Vitest：4 failed / 101 passed，8 个测试文件中 1 failed / 7 passed，退出 1。
- candidate：`9b6448e339a474bca6a8fbaae4ad8c24c522a84c`；tree：`e03d3e6ddbd4141a90adc06a84768a67bdd18a18`；干净 patch SHA256：`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
- artifact：`14750853650`；ZIP SHA256：`2ffbe4dfa2711642839bf72b06c3422ef5217c50caa96373288b3d0d715fc0c3`。
- `prominent-tint/results.json` SHA256：`2677167794014f0a78e5f8d90885e509947c73d9f7110e04011474fb853c6a4a`。
- Chrome `157.0.8103.78`，Node `v24.22.3`；真实页面 `/en/test/liquid-glass-prominent-tint/`，本 job 为 WC。
- 失败位置：`demo-liquid-glass-prominent-tint.browser.test.ts` 的 `classification.status !== 'failed'`；不是启动、timeout、invalid-control 或预期负控失败。

## 冻结指标与四个失败

`liquid-toggle-detail-metrics.ts` / `liquid-prominent-tint-metrics.ts` 保留既定工程门槛：4 CSS px cell、至少 16 cells；每帧 encoded-sRGB luma span ≥8；空间相关 ≥0.70；梯度 cosine ≥0.60；source-change output delta RMS ≥4；delta correlation ≥0.70；变化超过 4 code 的 cells 比例 ≥0.25；前景对比 ≥4.5。chroma 仍只是 diagnostic，不把它改成通过或失败的替代门槛。这些是原工程诊断规则，不是 Apple 容差。

| 失败 pair | tinted cells | tinted luma span，phase 0 / 1 | tinted delta RMS | changed-cell fraction | 原失败原因 |
| --- | --: | --: | --: | --: | --- |
| WC light Button text | 28 | **7.68159** / 10.42936 | 6.00091 | 0.678571 | phase 0 `insufficient-detail-amplitude` |
| WC light Button icon-only | 29 | **6.66578** / 8.41704 | 4.98355 | 0.551724 | phase 0 `insufficient-detail-amplitude` |
| WC dark Submit text | 281 | **7.81705 / 7.16956** | **3.14316** | **0.249110** | 两帧幅度不足；pair `insufficient-source-response` 及 `insufficient-changed-area` |
| WC dark Submit icon-only | 341 | **7.87223 / 7.52243** | **3.20684** | 0.275660 | 两帧幅度不足；pair `insufficient-source-response` |

四组 tinted 的空间、梯度及 delta 相关性都在原门槛以上，支持“响应与源相关，但被压得过弱”的定位。不能将 dark Submit text 的 0.249110 四舍五入成 0.25 通过，也不能为了现有 7.x span 放宽 8 的门槛。

| 对照事实 | 结果 |
| --- | --- |
| Neutral positive control | 四组全部 `passed`，其 luma span、source response 和变化面积足够，提供独立的可辨源对照。 |
| Opaque negative control | 四组 output luma span 与 delta 均为 0，保持应有的 `failed`，是有效负控；不是四项产品失败的原因。 |
| Source information / ROI | 原 source span 均超过 8，source delta 均超过 4；cells ≥16；全不透明。没有把欠信息源或边缘/字形计成通过。 |
| Receipt / snapshot | 八个 tinted 帧 `readinessError:null`、`binding:true`、`sourceStillCurrent:true`、`screenshotBinding:true`；source revision 8→9，frame 相应前进。 |
| Material admission | quality `self-optical`、reason `rendered`、profile `pui-regular-style-tint-contact-5`。这是已经准入的 optical 输出，不能改称显式 opaque fallback。 |
| Foreground safety | 八个帧记录的 foregroundBackingContrast 最低 6.11694，dark Submit 两帧约 14.22195 / 14.44592；本次失败并非 4.5 对比护栏，但不由此宣布全域/全库对比完成。 |

## 实际图片审查

实际打开了 `wc-light-button-text-pastel-0-tinted-context.png` 与 `wc-dark-submit-text-pastel-0-tinted-context.png`。与前一份 scripted renderer 诊断不同，这些 context 是实际组件周围的浏览器截图：可见 Continue / Submit 的白色前景文字。

Light Button 的文字清楚，背景斜纹可透过染色区域辨认，但明暗较弱；dark Submit 呈很深的蓝色，背景斜纹与文字结构在内部很弱。这个目视结果与数值幅度失败一致。它不足以量化每个边缘、确认 Apple 等价或代替整套视觉审查。

- light Button text context PNG SHA256：`dcfd3b6f745b767e866d99a0f821cee1c31c2ff993e12ebf99e14c2d348c9498`。
- dark Submit text context PNG SHA256：`d8f78c20ad13c7eeeb77c2e38a51baa986461a0f27fa3d169222436ae96be278`。

## 与本轮修改的关系

`dc3b184ba10b0de53e40359c52d012b204b2cd01` 与第一候选之间，style-tint profile、program-inputs、contact profile 和原 prominent/detail metrics 均无修改。原本 profile 5 的 tone/contrast 映射与门槛继续执行。

为了具体排查 CPU 优化，用 Pillow 只读解码 artifact 中四个失败 pair 的八份 source PNG。每份 source 像素 SHA 均与 receipt 一致。分别从两个精确提交的 `program.ts` 提取完整 `prefilter` 声明，经过已安装的 TypeScript 转译后调用，在原 358×182 尺寸上逐字节比较：八份均为 **0 / 260624 byte mismatches**。完整哈希记录为 `tint-wc-failed-source-prefilter-equivalence.json`。没有运行浏览器、修改 repo、放宽任何条件或使用人工生成的替代背景。

该事实排除了本次滑动窗口造成这些源的预滤镜像素差异；它不是整个旧源码路径已经成功重现失败的结论。image decode/publication 的时序等其他路径没有在这项纯函数检查中重演。

## 终态与下一步

本 job 的行为统计独立为 12 passed / 0 failed，光学 classification 为 6 passed / 4 failed / 2 inconclusive / 4 diagnostic-only / 0 invalid-control。四个失败 journey 都在第一个 pastel pair 抛错，之后 gray-boundary 与 chromatic-regions 共 24 个 control slots 被准确标成 blocked，不能把它们算作成功。修复后需补齐这些原 workload。

下一责任层应先核对当前 style-tint tone 映射、受保护的前景 luminance budget 和真实源响应如何一起满足原条件；不在 fixture 挑背景、增大控件、纳入标签/边缘、改变匹配区域或阈值。任何修改须同时保留完整前景对比、源准入、偏好/fallback、负控以及 release/cleanup，并在精确新 head 上重跑原四-host 范围。当前独立结论为 **产品光学 gate 未通过，保持开放**；是否属于旧问题，需另有源绑定 baseline 实际运行证明。
