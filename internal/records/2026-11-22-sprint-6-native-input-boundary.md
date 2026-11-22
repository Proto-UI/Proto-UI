# Sprint 6：DPR 原生输入边界与完整 CI 接线

本记录是实际观察和本轮修复的来源，不修改规范，也不将 PR Ready 等同于全家族接受、平台批准或合入。

## 第六候选的真实终态

执行源码 `7871a8da3967ae4bb29cd50c655860cf87d374c0`，tree `1a08b265b1062dd2a44ccf9c2fcaa8bc1aaa9bdb`。

- [Bootstrap 45030435352](https://github.com/Proto-UI/Proto-UI/actions/runs/45030435352) 成功：八部分 15/15，Navbar 38/38 cells（12 native tests），Button motion 96/96 cells（8 native tests）；基线 12 cells 是实际采集，不冒充家族一致性通过。494 张原 PNG 与四份 manifest 已逐 hash 回读，独立审查实际图片。正式 preset 检查成功，140 条 Navbar 白色焦点与 30 条普通 Search semantic ring 保留。
- [完整 Liquid 45030339064](https://github.com/Proto-UI/Proto-UI/actions/runs/45030339064) 的主 material/library **958/960**，两条 DPR 等待失败；独立 controls **94/94**、31 个原生场景完整。16 裸 editor/组件 composition trace 和 16 脚本 end 负控保持区别，不能称物理 OS IME。八个 prominent/hover 分区成功，但 96 optical pairs 中仍有 8 inconclusive 和 32 diagnostic-only。两种 diagnostic 的 `productAccepted` 仍为 false。
- [frame 45030247951](https://github.com/Proto-UI/Proto-UI/actions/runs/45030247951) 的五个选中原生 case **3 passed / 2 failed**；另一个未选 diagnostic 不计通过。239 个 ZIP member、CRC 和 hash 全部回读。GPU 84 个字节案例、9 个 integration steps、program-clear 旧失败/新恢复、source-progress 和 release/theme 有界结果分别保留，均不能覆盖两条失败。

两套主原生执行都在原 **20000 ms** 联合检查处失败：light 的实际 DPR 为 2，四 source canvas 仍为 CSS/bitmap 466×172、revision 不增长；dark 的实际 DPR 仍为 1，revision 同样未增长。旧 `self-optical` dataset 不能接受这个过渡。

同次 frame candidate 的 listener→held-commit p95 为静态 **12.500 ms**、动态 **39.965 ms**；event timestamp→commit 为 **12.805 / 45.405 ms**。相同配置的本次 baseline listener p95 为 **11.700 / 44.370 ms**。保留各次结果，不能从单次波动声称持续改善，更没有完成 10 ms 或物理 120 Hz。

## 独立裸浏览器诊断

[诊断 run 45033871906](https://github.com/Proto-UI/Proto-UI/actions/runs/45033871906)，源码 `0a8d1c366ee68b298467126fa95375b88101b3fc`，tree `9850d86b71daf39696a6217aa592d2bc72ac45ad`；这是独立诊断分支，没有修改 PR 原有 frame 门槛。

实际 Chrome **157.0.8103.78** / Playwright **1.58.2**，三个固定 case 全部采集完成、cleanup 无错误，`productAccepted:false`。脚本没有 Proto-UI import、合成事件、源重画或测试内修复。静态 canvas 刻意保持 320×160，不把它的固定 bitmap 记成产品失败。

1. Playwright viewport 与 single-CDP 两个控制中，仅在相同 1100×1000 viewport 设置 DPR 2，实际 `devicePixelRatio` 和新建 media query 读数改变；两次 RAF 和另一个固定一秒观察窗内，没有新的 window/visual viewport resize、MQL change 或 ResizeObserver callback。这里只记录固定观察窗，不能推导永久不通知。
2. 第三个 case 中，viewport、full-page、oversized locator 三种 Playwright 截图都把另一 CDP session 的实际 DPR 2 恢复为 1。随后原 session 以完全相同参数再 set 2，命令成功但实际 DPR 仍为 1；clear 后重新 set 才恢复为 2，并产生真实 viewport 通知。
3. 完整协议日志把两 session、命令和响应、三个 PNG 原始字节逐项关联。不能用假定的 CDP 成功回执替代页面实际状态。

固定官方实现核对：[Chromium EmulationHandler](https://github.com/chromium/chromium/blob/157.0.8103.78/content/browser/devtools/protocol/emulation_handler.cc) 的同参数缓存和未启用 metrics 时 clear 的 no-op，以及 [PageHandler](https://github.com/chromium/chromium/blob/157.0.8103.78/content/browser/devtools/protocol/page_handler.cc) 的截图恢复路径，与上述原生观察一致。监听对象自身的 `MediaQueryList.matches` getter 会更新其比较值，所以诊断只读取新建、无 listener 的 query；真正注册对象通过原生 change event 取值，避免观察干预。

原始 [artifact 14758902459](https://github.com/Proto-UI/Proto-UI/actions/runs/45033871906/artifacts/14758902459) 的 ZIP 为 **190374 bytes**，SHA256 `4b0b2cccf342d3c2030cc43d8673b96fba6ed96da36e8f177376fbca71b67f52`。完整协议日志为 **1145549 bytes**，SHA256 `6541924cb64f6c13ef0a1954d7fa65bbff74b8ebe19fe43b44c233c820fa9e2f`。原 ZIP 同步保存在 [native-dpr-diagnostic.zip](evidence/2026-11-22-sprint-6/native-dpr-diagnostic.zip)，保留五个原件和三张原 PNG；未生成或修改图片。Actions 原保留期 30 天。

## 修复的责任层与验证边界

本次修复输入注入和证据截图的 ownership：先在自建 CDP session 认领完整 DPR 1 metrics，再执行 clear/set 事务；DPR 2 截图由同一 session 采集，并核对截图前后的实际 DPR、viewport、source bitmap/geometry、consumer revision、quality/source 完全相同。每个主题在 finally 独立清理 metrics 和恢复 viewport，cleanup 错误另存，原失败异常不被覆盖。截图等待有五秒上限；超时不声称取消了浏览器命令，出现时该 case 失败，后续读数须保留其影响边界。

原三个质量等待的物理尺寸、revision 增长、source/quality 和 **20000 ms** 门槛不变。此次 native 输入覆盖的是最终 CSS viewport 相同的完整 metrics 事务；**它不验证纯 DPR 无通知路径、真实跨显示器迁移或物理输入**。独立 producer 27 个单测仍是逻辑通知/清理证据，不能替代原生结果。本次没有进一步修改 producer，没有 idle polling，也没有发送合成 resize 或直接重画。

另外修复 `quality` implementation 的显式 union 返回类型，使原两个 overload 与 TypeScript 契约一致。针对 producer、其单测和 native runner 的真实 `tsc --noEmit` 已通过；不把第六 head 完整 CI 的 TS2394 改写成通过。修改后的原生结果仍待实际执行。

## 专用套件归属

完整 CI 45030540222 实际发现，三个 Bootstrap suite 和 Liquid controls 被登记到普通共享服务器分片，但这些 suite 依赖专用环境且拒绝共享 server，因而触发意外 skip。修复把四套唯一地归入既有 production owner；完整 production cycle 新增 Bootstrap workflow 调用，Liquid full owner 继续原调用。原 native 文件、条件开关和总入口的 unexpected-skip 失败门槛均不变。

真实定向负控旧源码 6 项失败；修复后 8 项通过（含 owner/遗漏/恒 false 调用负控），关联 26 项及既有完整 runtime Node 134 项通过。134 项执行后又加强了 test-only 断言，并重新执行受影响 8 项；不把后一次结果写成完整 134 重跑。新 CI 的实际调用仍须回读。

## 原范围和正在处理的其他失败

完整 CI 的全部失败继续按其原命令、源码、入口与实际结果保留。固定基线 [45034808725](https://github.com/Proto-UI/Proto-UI/actions/runs/45034808725) 绑定 `dc3b184ba10b0de53e40359c52d012b204b2cd01`，用于同配置不同 runner 的实际对照；本记录写入时仍在执行。不能只因测试文件未改就称历史失败。

Liquid Accordion 的 Finf 实例真实触发 `source-overlapping-content`：完整 contact paint 范围与前一个 Item 的实际 border/content 相交。保留安全 guard 和原光学断言；公共 reservation 定义尚为 draft，不能用页面特例或任意大间距伪装完整能力。Number Field 的 20 个 family/host uncontrolled 路径保留 trusted-end 失败，20 个 controlled 路径尚未到达，另随 #1098/#1178 追踪。

#1467、#1149、#1148、#1053、#1050、#1049、#799 的原完整条件不删。全家族逐 part、Apple 已渲染参考、物理 120 Hz/10 ms、IME/AT、Compiler 与各非 Web 路线继续独立接受。shenko 是真实 Harness App，OpenGreendam/verdant 是另一真实消费者；本 S6 没有执行或迁移这两个 App，也不覆盖 S4 已有的独立 App 结果。PR Ready 仅表示当前分支可进入审查，不解除原 CI 红灯、批准、主线整合或发布条件。
