# S4：自然回缩捕获与页面局部 A/B 实验

日期：2026-09-14。性质：调查进展，不是修复完成或规范晋升。

承接 `2026-09-14-shadow-s4-entry-rollback-investigation.zh-CN.md`。继续遵守其权威映射与范围：不修改作者 API、200ms 时长、slot 边界或生命周期；关闭 conceal 修复 `651277de` 保持不变。

## 首次自然捕获

用户运行 baseline 手动诊断，第一次人工操作即观察到回缩。终端与报告一致：`manual=true`、`syntheticProbe=false`、`candidate-captured`，无 page error 或 capture error。

本机临时证据目录：`/var/folders/p8/rflqkv857nz2vfl44035731w0000gn/T/s4-entry-JsDQN8`。这些路径是本次调查定位信息，不是可移植或永久存储；像素未加入 Git。

- `023.png` 正常，`024.png` 回缩，`025.png` 恢复。空白横带约 510 → 482 → 510px；横带经过圆角附近，不等于精确外盒宽度。
- 回缩画面时间 `1789362570198.3171`；最近状态为 `open=true`、`detached=false`、`phase=entered`、`epoch=1`。
- boundary/surface 的 enter 分别只启动、结束一次，没有第二次打开或 enter 启动记录；两次 end 均记录在 `1789362570188`，elapsed 为 0.2 秒。
- 延后快照时间 `1789362570269`，比异常画面晚约 70.7ms。此时两条动画 startTime 相同、currentTime=200、finished、progress=1、fill=both；boundary scale=1，surface transform=none、opacity=1，二者几何一致。

这把调查重点收窄到入场结束附近的绘制/动画交接，但**不能**把延后快照说成异常帧同时刻的 DOM 状态，也没有证明 Chromium 内部根因。Safari 掉帧仍不是同一回缩的确证。

## 补充自动路径

- 不在入场后移动鼠标到 Switch：8 轮未观察到回缩（`s4-entry-KPs9f1`）。
- 相同路径额外静置 4 秒、点击按住 100ms：5 轮未观察到回缩（`s4-entry-qQqAsF`）。
- 当前原生窗口控制服务启动失败，不能自行重放桌面输入。没有绕过该边界使用其他原生输入方式。

自动阴性结果不能替代人工已出现的自然证据，也不足以证明任何候选有效。

## A/B 入口与实验有效性

`scripts/analysis/shadow-s4-entry-browser.mjs` 新增页面局部候选：

```sh
# baseline
S4_ENTRY_MANUAL=1 node scripts/analysis/shadow-s4-entry-browser.mjs

# 补齐 geometry enter 的显式终点，保留 canonical translate / scale 操作数
S4_ENTRY_MANUAL=1 S4_ENTRY_EXPERIMENT=explicit node scripts/analysis/shadow-s4-entry-browser.mjs

# 独立候选：仅给 Content boundary 添加 will-change: transform
S4_ENTRY_MANUAL=1 S4_ENTRY_EXPERIMENT=layer node scripts/analysis/shadow-s4-entry-browser.mjs
```

候选只作用于独立测试页面，不修改 Adapter、CLI、网站生成产物或用户浏览器配置。`layer` 只是浏览器提示，不保证真正保留合成层。暂不把任一候选合入正式产品。

自动路径另支持 `S4_ENTRY_IDLE=1`（跳过入场后的鼠标移入）、`S4_ENTRY_SETTLE_MS=0..10000` 和 `S4_ENTRY_CLICK_DELAY=0..1000`。报告保存这些参数；Light 不接受 split 候选。

### 已纠正的无效对照

第一版 explicit 仅对 CSSOM 调用 `appendRule`，初始化确认成功后，用户在第二轮捕获回缩（`s4-entry-dpegDQ`，异常后约 20.7ms 才读取快照）。随后自动检查发现：portal 搬迁重新解析样式，首次打开就已经丢失 CSSOM-only 修改。因此该结果是有效的自然回缩证据，但**不是有效的 explicit 候选反证**。没有据此排除候选或修改正式代码。

修正后使用单独 `<style>` 的持久文本与 unlayered 同名 keyframe 覆盖，保留原始 from，仅补齐 to；不修改 Adapter 持有的 stylesheet。每次 boundary enter 启动都检查实验规则仍存在，候选快照也保存实验回执；实验丢失会把报告标记为 `capture-error`，不能混入 A/B 结论。

修正后的三轮自动 portal 开关均有 `experiment-check valid=true`（`s4-entry-eHmVjq`），未观察到自然回缩。修正后的 explicit + 人为 95% probe 仍成功捕获（`s4-entry-dbX5zo`，`syntheticProbe=true`），只证明捕获链路保持敏感。

在实际页面中，默认操作数与一组非默认 canonical translate/scale 操作数的动画结束计算样式，在补齐终点前后一致。这是局部计算样式等价检查，不覆盖任意 Maker transform，也不证明绘制回缩已修复。

## 后续门槛

需要有效人工候选对照，再根据结果选择显式终点、合成层提示或缩减 HTML/CSS 复现。即使某候选暂未复现，也需与 baseline 交替、确认足够实际打开轮次，并回归中途反向、关闭屏障和再次打开。只提交诊断能力与事实记录，不把随机未复现包装成修复通过。
