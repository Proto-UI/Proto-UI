# Sprint 6：独立推进 Bootstrap Text 修复

## 已完成的开发子项

按当前用户“让所有 draft 通过推进进度的方式转 ready”的授权，从原 PR #1712 的 `25dddc948f0a05ac8a02bb486cf833d5e90ffb08` 提取已验证的 Text 修复。五个源码、测试及生成器输出文件与独立候选 `e9d6a66e4c42813e42471573543573c3eb5f70b0` 逐字节相等；原来的 Material 解码缓存实验继续留在独立证据分支。

既有 `P-BOOTSTRAP-2-3-2-TEXT-PROJECTION` 已定义标准字号 token 与 rem 缩放。修复恢复这些标准 token，保留 2xl 的 `1.53125rem`（16px 根字号下 24.5px）与 relaxed 的 `2.5rem`。八个输入轴、passive slot、原生语义及选择所有权保持原定义。CLI 继续完整核验公共 export、优先级和整族源码闭包，Base 的 proto 条件依据现存 manifest；官方生成器恢复 draft tokens 以及 main 合入后遗漏的 Brutalist focus token。

- [x] 当前 Text 提取状态已实际通过四宿主旅程 **152/152**，原日志报告该文件用时 9402ms。
- [x] 历史 E9 源码的原受影响组合 **176/176** 已实际通过：Text 152、CLI 14、实际 demo 源检查 10，failed/pending/todo 均为零。该历史完整 JSON 保留，不替换成本轮结果。
- [x] 对当前五路径提取状态进行完整 tracked tree blob 对比：与 E9 的差异仅为两个 Material 缓存产品文件、五个缓存相关测试文件，以及六个旧证据文件；其他源码、配置、package manifest 与 lock 条目全部一致。CLI、prototype、Core、style scripts 和 PrototypePreviewer 的输入清单及 SHA 均已归档。
- [x] 已核对 CLI 的实际输入边界：`renderHostIndex` 和 Adapter registry 生成源码字符串，不执行生成的 Adapter；整族闭包解析选定 family/Base 的 TypeScript 和样式 token。Demo 测试执行纯 recipe/validator，并以文本读取 registry。因此 CLI 14/demo 10 的历史执行有相同 tracked 输入支撑；这里没有宣称它们本轮再次执行，也没有宣称 Material runtime 整体等价。
- [x] 当前官方 Brutalist/draft token 生成、五个文件格式以及 diff 检查通过。全 style preset 的通过证据绑定 E9。本次可选重复全 preset 在读取未改动的 Shadcn 源时取消，实际 exit -15 和日志保留，不计为通过。
- [x] 独立 agent 已读 Text 完整语义补丁、核对原 definition 与 Base props，无阻断发现；最后整文件格式化以 TypeScript 去注释输出逐字节相等证明保留语义。这是源码审查，没有伪造 GitHub APPROVE。
- [x] 原 `61fe25ca` commit、parent、tree、实际作者及单提交 bundle 已保全。原 commit 没有 DCO trailer；本次新提交使用正式 publisher 和实际配置贡献者，不改写原作者或原对象。

## 本轮未完成执行及证据边界

当前独立提取状态的原 176 项组合，在共享设备上达到既有 **1200s wrapper** 后终止，没有产生完整 JSON。原始日志真实包含 Text 152 项通过，但 CLI 14/demo 10 没有本轮终态，因此不能把本轮报告写成 176/176。已确认本轮工作进程退出，保留超时报告和原始日志。历史 E9 的 176/176 与本轮 152/152 分别记录，再以相同输入证明说明历史 CLI/demo 证据适用范围。

默认 5000ms 用例期限、原本已有的两个 CLI 整族闭包 300000ms 用例期限、原生 90s case/150s setup 均未修改。没有追加另一轮宽重检或放宽预算。尝试转本地执行时本地环境不可用，没有取得启动回执，也未把未执行的本地命令算作结果。

## 已实际执行的原生证据

以下原生执行严格绑定 **E9**，不是新提交已经执行的全量证明。Text 的五个受影响文件与 E9 相同；当前 Text 152 的实际运行和 CLI/demo 的输入一致性分别记录，不把 Material 缓存差异隐藏为全 runtime 等价。

[Select/Text 原工作流 45182407693](https://github.com/Proto-UI/Proto-UI/actions/runs/45182407693) 成功，实际 **12/12**：Bootstrap Select 八个主题/宿主场景，以及 WC、React、Vue、Vue2 四个 Text 场景。默认未启用 Liquid WIP，不把未注册的 Liquid Text 算作通过。四份原始 JSON 均记录根字号 16→32px、Text 字号 30→60px、行高 37.5→75px；原生选择、role、tabIndex、运行时控件断言与原限时保留。

实际打开了全部四张 Text 正常字号截图：标题、正文、斜体辅助文字和带下划线的等宽文字层次清楚，当前视口未见截断或重叠，各宿主一致，运行时焦点可见。截图捕获的是恢复后的正常字号，翻倍由原始浏览器测量证明。

[Bootstrap 原工作流 45182439223](https://github.com/Proto-UI/Proto-UI/actions/runs/45182439223) 成功，原始 manifest 已核验：state-controls 15/15、48 张截图、105 个观察；Navbar 38/38 cells、12/12 结果、298 张截图、388 个观察；Button motion 96/96 cells、8/8 结果、112 张截图、216 个观察。四宿主与两主题条件保持，页面、协议及 cleanup 错误数组为空；没有把所有 Bootstrap 截图计作人工视觉审查。

## 保留的性能与父项条件

[E9 原配对工作流 45182375694](https://github.com/Proto-UI/Proto-UI/actions/runs/45182375694) attempt 1 在原 3min 中文字体安装阶段超时：Ubuntu EC2 mirror 的 fonts-noto-cjk 61.2MB 下载未完成。baseline/candidate 均未开始，性能样本数为零。原失败与原预算保持，没有重新 dispatch 或绕过正式 recheck 路由。缓存候选、306/306、负控与源码审阅保留在 E9 专用 ref，尚不并入本次原 PR 提交。

10ms、物理 120Hz/input-to-photon、Apple 对照、原 non-Web/真实应用与物理 IME/AT 等父项条件继续按原定义完成。本次没有关闭父项、声称 release 完成或代替实际维护者给出批准。原 PR 的 Ready 状态此前已经由实际账号设置，本次交付是额外的实际工程进展。

## 原始档案

[证据清单](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-text-ready/manifest.json) 和 [原始档案](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-sprint6-text-ready/validation.tar.gz) 保存历史完整 176/176、本轮实际 Text 152 与 1200s 不完整记录、此前 20 项原回归失败和 174/176 失败、tracked 输入清单及证明、整个 E9 Select/Text artifact、三个原生工作流状态和日志、Bootstrap manifests、原 commit/bundle 与格式保全证明。所有旧失败及可选 preset 取消均维持原样。
