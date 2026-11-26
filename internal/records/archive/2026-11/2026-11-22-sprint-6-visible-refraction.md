# Sprint 6: 第一候选 visible-refraction 独立审查

## 结论与来源绑定

这份实际 Actions 产物提供了同一候选 shader 的受控渲染与 offset-zero 对照，可支持“部分固定输入确实产生可见背景弯曲、脚本状态回到 rest 后恢复相同像素”的窄结论。它没有完成 #1050 的整项产品光学接受，也没有给 #1053 的 120 Hz / 10 ms / 物理 input-to-photon 提供通过证据。不能把 64 个成功采集的帧写成 64 项光学验收通过。

- 实际运行：[Actions 45013196978](https://github.com/Proto-UI/Proto-UI/actions/runs/45013196978)，artifact `14750083907`。
- 候选 head：`9b6448e339a474bca6a8fbaae4ad8c24c522a84c`；tree：`e03d3e6ddbd4141a90adc06a84768a67bdd18a18`。
- 干净 patch SHA256：`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
- 下载 ZIP SHA256：`37707199f7927232a40bba62dc1074f930658a1091f1bf19e8b6b1a5e8510a81`。
- `results.json` SHA256：`7f569bc26a45ba1781a27ca25ea2adc93729758bd76f2c45a95a0886d0f1fd3e`；`sequence-index.json` SHA256：`eb50e2d19f13123f860655cce35cc51b5767927987e185c5fdd1498773a52f55`。
- Chrome `157.0.8103.78`、Node `v24.22.3`、DPR 1；实际 renderer 是 ANGLE / Vulkan / **SwiftShader Device (Subzero)**。这是原生浏览器执行，但不是硬件 GPU 或实际 120 Hz 显示链路证明。
- 最终状态为 `collected-native-diagnostic`，`productAccepted: false`；计划/执行 64/64，8 条脚本序列完整。

审查者只读源码、manifest 与真实图片，未参与被审实现、未修改产物、未执行另一个重型浏览器矩阵。

## 实际观察到的内容

已实际打开 light-button 的 structured rest / held / strict-warp-off、archived held，以及 dark-submit 的 structured rest-before / held / strict-warp-off / release / rest-after 图片。下列文件名均在该 artifact 的 `visible-refraction-diagnostic/` 内。

| 对照 | 已目视的事实 | 可以支持什么 |
| --- | --- | --- |
| `light-button-structured-held-baseline-context.png` 与同 held 的 `strict-warp-off` | 正常 shader 下蓝色 pill 内的网格线有弯曲，offset-zero 图中对应线较直。小尺寸下边缘和光照差异有限。 | 当前输入/几何下存在 shader 采样偏移的可见效果；不能单凭视觉量化全区域位移。 |
| `dark-submit-structured-held-baseline-context.png` 与同 held 的 `strict-warp-off` | 宽 pill 的弯曲更容易辨认，正常路径中央及侧部网格呈连续弧形；对照保留模糊及 tint，线更直。 | 独立 offset-zero 对照有区分力，结果不是仅用整面换色或 blur 是否存在来作判断。 |
| `dark-submit-structured-rest-before / held / release / rest-after` | held 的形状更宽，release 退回，rest-after 与 rest-before 外观一致；manifest 的材料 readback hash 也相同。 | 这组指定脚本输入的可重复渲染和恢复。它不证明真实 pointer event、owner lifecycle 或物理按键松开后的时延。 |
| `light-button-archived-held-baseline-context.png` | 背景条纹及文字透过 pill 后被染色、模糊。 | 存档源背景进入当前 shader。背景中的文字不是组件前景 label，不能把它的模糊当作前景可读性失败。 |

normal render 的文件名 `baseline` 是当前候选的普通渲染模式，不能理解成另一旧源码的 A/B。`archived` 指存档背景输入；产物明确将旧 source head `2b8757f4516da60d3a3b31e9ec4df7401b3d3195` 作为输入来源，不声称执行了旧候选 shader。

## 自动对应分析的实际终态

| 终态 | 帧数 | 解释 |
| --- | --: | --- |
| `insufficient-spatial-signal` | 38 | 可接受轨迹不足，无法据此确认或否认非刚性位移。 |
| `no-resolved-nonrigid-displacement` | 22 | 该匹配策略在本帧未解析到满足其判断的非刚性位移；不是全域不存在的证明。 |
| `resolved-nonrigid-correspondence` | 4 | 局部匹配有解析到的非刚性差异，仍受覆盖范围与不确定度限制。 |

例如 dark-submit / structured / held 接受 12/88 轨迹，非刚性 RMS 为约 4.022 CSS px；其中 edge 仅 1 条，而 interior 为 11 条。light-button / structured / held 的 9 条计划轨迹全部未接受，不能从那张视觉图补写数字通过。light-submit / archived / held 接受 40/88，RMS 约 0.831 CSS px，仍属于 `no-resolved-nonrigid-displacement`，应保留原终态。

匹配用完全不透明的 9×9 CSS px patch，最外侧 0–4 CSS px rim 明确未测；`fullShapeAbsenceProved: false`，`appearanceThreshold: null`。这些结果不能自动确认完整边缘厚度、整块玻璃的视觉品质或 Apple 等价。8 条序列的 `restRestored` 与 `isolatedSourceTranslation` 均为 true，但这是 renderer 序列完整性，不是产品交互验收。

## 与官方 Apple 参考的有限比较

官方参考为 [WWDC25/219 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) 已实际下载和目视的渲染帧。原 SD 视频 SHA256 为 `1104a39b374f50e4c856af8a2a0d96171a6911afdab81dd22b74b64902122b62`，960×540、约 29.97 fps。URL、时间点和逐帧 hash 另见 `apple-219-reference-manifest.json`。

| Apple 参考 | 本次候选可比较的事实 | 尚缺的接受证据 |
| --- | --- | --- |
| 3:10：沙丘边界通过玻璃区域仍可辨，有内部位移、边缘厚度及清晰播放符号。 | 结构网格对照显示候选存在背景弯曲和颜色传递。 | 此 artifact 的 context PNG 是合成背景加 material canvas，**不是组件截图**，没有前景 glyph。清晰 label/icon、完整边缘厚度与真实背景连续性仍需要实际组件图。 |
| 3:46–3:51：held contact 有局部白亮及压陷。 | 当前 held 相比 rest 有形状/局部采样变化。 | 已查看的小尺寸图没有足够证据确立同样的局部白亮反馈；不把外形变宽等同于完整 contact 视觉，也不凭这些图片宣布其不存在。 |
| 17:16 / 17:20：prominent tint 仍保留背景明暗结构，前景浅色图标清楚。 | 候选蓝色 tint 中仍可辨别网格线。 | 色调、背景、形状、尺寸和捕获方式都不同，不能作像素级或阈值等价判断；原 full-domain tint/contrast 失败条件仍需独立完成。 |

Apple 17:08 的平面洋红画面是教学对照，不作为目标。Apple 视频自身约 30 fps，也不承担本项目高刷新率证明。

## 不能从这份产物推出的结论

1. `sourceAdmissionProved`、`componentInteractionProved`、`preferenceAdmissionProved` 均是 false。内部脚本直接给 renderer source、uniforms 和接触状态，没有走四 Web host 的实际 owner 输入与偏好生命周期。
2. `scriptTimestampMs` 0/50/120/180/240/360/420 是逻辑时序；实际帧之间的 wall-clock 采集间隔远大于这些数字。不能据此报 120 Hz、10 ms、release latency 或 input-to-photon。
3. 前景对比 uniform 是材料输入，并不在 material-only PNG 内绘出真实组件 glyph。前景可读性、辅助技术、真实消费者 shenko / OpenGreendam/verdant 均未由此验证。
4. 没有同一环境上旧源码和新源码的端到端 A/B；这次普通 shader 与 offset-zero ablation 的对照不能替代性能 baseline/candidate。
5. 这份候选 head 早于后续 Bootstrap 整合和新增 Liquid state-controls。最终 ready 审查需要绑定最终 head，并明确此份记录属于哪一中间候选。

可把此记录回填 #1050 / #1149 / #792 的“受控折射诊断取得实际终态”对应子条件，不能关闭原全部验收条件。

## 保全的原始机器记录

[完整 results](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/visible-refraction-results.json.gz)、[sequence index](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/visible-refraction-sequence-index.json.gz)、[artifact manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-22-sprint-6/visible-refraction-artifact-manifest.json.gz) 保存实际下载 JSON 的原始字节（gzip）。图片仍在上列 Actions artifact，不能从文件名推断通过。
