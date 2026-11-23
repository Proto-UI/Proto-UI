# Sprint 4：应用 scene 源的整合与独立审查

## 固定源码和实际结果

本记录对应整合提交 `9fff88cf23d4e55375979bc5c68c033e3deaed38`，tree `8f284229ff76e51ec109af2fd8f4d9694a739a35`。该提交把作者的 `27b5429b46fdc31ae94d1f6a1bd37fb1c6a8323c` 接到已整合当前 main 的 Sprint 4 分支。实现范围和未支持目标见 [owned-scene 交付记录](./2026-11-24-sprint4-owned-scene-shader.md)。

- [x] **整合提交的 17 份定向测试文件、245 条断言全部通过，零失败、零 pending。** 实际运行时间为 2026-11-23 20:34:05–20:34:39 UTC。测试选择与清单逐份核对相同，使用 Node 24、pnpm 10.32.1、单 worker 和 1536 MiB 堆上限。命令、原始 JSON、完整日志均保存在 [原件清单](./evidence/2026-11-24-sprint4-integrated-scene/manifest.json) 中。日志里的 esbuild ES2024 警告仍保留；本结果没有冒充严格 TypeScript 或浏览器验证。
- [x] **独立 scene 审查的 48 个控制符合各自预期。** 其中导出名称负例的成功结果是预期拒绝，不是把非法输出编译成功。审查实际运行在作者提交 `27b5429b`；13 份关键源码与整合提交逐字节相同。原审查的执行 SHA 没有改写为本次整合 SHA。
- [x] **旧 owned-pixels 的有限兼容性审查完成。** 非法输入后的恢复、旧帧诊断、device/cleanup 轨迹、生成模板来源和三种 reached-kernel 闭包均保留原件。所审 11 份源码与 lockfile 在作者和整合提交中逐字节相同。诊断数组顺序变化保留为非阻断观察，未添加不存在的排序契约。
- [x] **整合源码的真实浏览器 37/37 功能旅程全部执行并通过。** [Actions 45262028723](https://github.com/Proto-UI/Proto-UI/actions/runs/45262028723) 对三份 fixture 各执行四目标构建，原件见 [148 文件清单](./evidence/2026-11-24-sprint4-browser-first-pass/manifest.json)。旧浏览器 0/28、0/37 的未执行结果仍保留，未被改写。
- [ ] **scene 绘制中、换源后的画面仍需补足独立视觉回读。** 首次成功的八张 scene 图实际拍于 dispose 后，只显示清理后的页面；不能据此接受绘制效果。未配置源的 fallback 图显示保留的可读控件。后继只补原旅程的中间截图，不改断言或分母。
- [ ] **严格 canonical 包预算仍未通过。** [候选 Actions 45262013762](https://github.com/Proto-UI/Proto-UI/actions/runs/45262013762) 为实际 clean/exact-source 6/9；baseline 9/9。工具链、压缩与 external 参数相同，三项超出为 React 149、Vue 136、WC 103 字节； [事实与原件](./evidence/2026-11-24-sprint4-canonical-cost/report.json)尚未决定新上限。
- [ ] **正式独立 GitHub review、合并与原 Sprint 4 总体接受仍分别处理。**

### 首轮归档缺口

- [ ] **首轮上传遗漏的 70 个隐藏生成支持文件需由后继原件补足。** 三份 build manifest 声明 106 个 generated artifacts，首轮只上传其中 36 个；`.proto-ui` 下的 inline 22、static-data 22、scene 26 个文件被上传器默认过滤。已为隔离的证据目录显式启用隐藏文件上传；首轮 148 件原件保持不变，不宣称完整交付 106 件。

## 独立审查的范围

| 控制组 | 符合预期 | 执行边界 |
| --- | --: | --- |
| source 异常、重入、借用清理、颜色转换、scope 撤销 | 11/11 | 实际 controller，记录型 physical presenter |
| 移出后回到同一 light/shadow scope | 2/2 | 实际 controller 与相同 immutable frame |
| Runtime/native factory 生命周期及获取时重入 | 9/9 | 实际 Runtime sink 和生成的 native owner |
| 同轮失效后释放 held decode | 8/8 | 实际 publication/retirement，GPU 与 decode 受控 |
| scene factory 重入更新为 owned-pixels | 2/2 | 实际 sink、snapshot 与 ordinal validator |
| source-kind 切换、cleanup 重入/抛错、非法及旧输入 | 4/4 | 实际 sink 资源所有权 |
| 四个 native profile 的导出名称控制 | 12/12 | 4 正例、8 预期拒绝，独立语法检查 |

复核保留了六项 scene 问题的原始发现、失败或静态来源及修复后结果。第一次 factory 获取重入问题来自静态审查，没有补造原始红测。publication 的旧 decode 控制在 MutationObserver 尚未交付时执行；跨 Document adoption 的物理拒绝与后续设备清理阶段分别记录。这些结果不提供物理 GPU、浏览器交互或硬件性能证明。

## 可重放原件

- [scene 审查说明](./evidence/2026-11-24-sprint4-scene-independent-review/review-notes.md)、 [复现说明](./evidence/2026-11-24-sprint4-scene-independent-review/REPRODUCE.md)、 [稳定结果](./evidence/2026-11-24-sprint4-scene-independent-review/stable-review-result.json)、 [整合源码对照](./evidence/2026-11-24-sprint4-scene-independent-review/integration-source-equivalence.json)。原件包 `originals.tar.gz` 的 SHA-256 为 `46ae21f18a4d7508ff6e68c61c95ebb9c376906049f04f8aa040c07469e9103e`。
- [旧 pixels 有限审查](./evidence/2026-11-24-sprint4-owned-pixels-review/record.json)及其 [逐文件清单](./evidence/2026-11-24-sprint4-owned-pixels-review/manifest.json)。原件包 `owned-pixels-review-27b5429.tar.gz` 的 SHA-256 为 `7fb2a6c24b87105160bdc8c41944226627e67f02a12533cafe97bdb86cc1c8ed`。

原始记录中的机器路径用于忠实保留执行来源；解包后的相对文件名和 manifest 用于回读。目录中的未压缩说明及 JSON 是便于审阅的格式化投影；逐字节原件保存在归档中，原始 SHA 清单对应归档成员。格式化投影没有改写原件的来源或执行 SHA。未将任何审查署名解释为 GitHub APPROVE，也未代理原 IR10 作者签署 DCO。

## 原 Issue 边界

该整合只支持 #1143 的已声明 Web scene / owned-pixels / copy / tint 子集与 #1089 对应的纯源及独立消费者组合。C/HC/T 定义保持 draft。其他 Presentation 输入族、shader 操作、非 Web GPU 与原完整消费者范围仍按其原条件接受。

#891–#894 的公共语义和原私有 IR10 候选分开；#913–#915 的原包读取、原作者授权/DCO、精确共享定义版本及 13 层真实公开 base/head 没有被本记录替代。原 TS2322 和独立合法 annotation 对照的区别继续保留。
