# Sprint 2 接续：当前主干、TextControl 退休与导航圆角

本记录由 OpenAI Codex 按当前用户“推进 Draft 的真实进度直到 Ready”的授权形成。它记录本次有界实现及本地验证；原 304 项浏览器／普通消费者队列、截图独立审读和原 Issue 子项回填以之后 PR #1716 的同源码执行回执为准。

## 候选与修复责任

原 PR 分支为 `sprint2/0.3-semantics-consumers-20261122`，原 HEAD `4a11517171aa0a019c4bcbd2314c779e25f21de5`。本轮正常合入 `main` 的 `b715b8a6d08c2c79417272c8d4ca9254984feadb`，保留原提交、父关系和签署，不重写已发布历史。唯一文本冲突位于 compiler 的 DOM 支持模板；其余主干改动由正常 Git merge 保留。

TextControl 同时保留主干的 `resetValue` 和 Sprint 2 的真实、可空 selection 快照／物理编辑观察。每次 reset 或 detach 都退休旧 text listener lease，清除该 lease 的待处理 selection 和 observation。回调在重入 reset 后不得继续向旧监听者发送输入，也不得在 finally 中复活旧观察窗口。受控 canonical 值仍属于原 owner，selection 来自实际 host，不硬写到字符串末尾。原 reset 测试继续使用完整 `toEqual`，仅把新增 selection 字段纳入真实 host 的精确快照。

Brutalist fallback Sidebar 的 group summary 与 leaf link 原先共同被网站的无层级 `border-radius: 0` 规则覆盖；“两者相等”因此未发现错误。本轮删除这两个 Sidebar 选择器，让既有 `sidebar.css` 的 `--site-brutalist-radius`（5px）重新负责对应表面。原 desktop 和 mobile 场景加入四角都为 5px 的断言，保留 32px／44px、高宽一致、四点真实 native hit、disclosure 和焦点条件，以及原 60 秒 case 期限。

历史上下文曾报告一个不可读取的独立修复对象 `6b6b2dd0`。本轮未获得该对象，未把此修复描述为 cherry-pick；实现直接依据当前源码和既有 token 定义完成。

合并后公开 Base manifest 及 CLI 家族 preset 生成物漂移，使用仓库官方 generator 重新生成；没有手写生成内容或放宽 check 模式。

## 已执行验证

下列结果由本轮独立工作树的真实日志写入；失败和同期限受控复跑分开记录，不拼接成不存在的单次通过结果。

- TextControl reset + selection：2 文件、40/40、0 skip，保持原断言及 case 期限。
- 原 Sprint 2 队列负控：5/5，缺失／重复／选中但 skip 等回执仍不能成为完整验收。
- 网站 source checks 初次：3 文件、36/38；Vue retirement 与 WC escaped portal 两项在原 5000ms 期限超时。原命令、完整 case IDs 和 failureMessages 均保留。
- 同一网站清单受控复跑：3 文件、38/38、0 incomplete；逐项核对全名与初次清单一致，未调整 case 期限、断言或源测试选择。
- 官方 public build：47/47；网站样式生成成功；workspace types exit 0。
- Base manifest 官方同步后 check：47/47；全部家族 preset 官方生成后原 check:styles:preset exit 0（含原 motion palette 检查）。重建 CLI 及后续 workspace types 均 exit 0。
- 原 304 项 native／普通消费者队列在本候选上尚未运行，网站同源码 84 份预期捕获尚未独立接受；本地数据不代替这两项。

正常提交格式化之后，原 TextControl 40 项与网站 source 38 项合并复验为 **5 文件 78/78、0 skip**，逐项 case ID 与前两组相同；当前格式化后的 history 三文件原控制也 exit 0。各组计数有重叠，不能相加为 native 验收数。

全部 staged whitespace 检查首先报告主干原始 `bundle-verify.stdout.log` 第 4 行尾空格；已核 index blob 与 `b715b8a6` 的原 blob、工作树字节完全相同。保留该原始 stdout 及首次失败，只排除此一冻结原件后，其余全部 staged 路径检查 exit 0。正常 commit hook 保留。

完整原件以 gzip 保存，解压字节和包文件 SHA-256 在 [source-binding.json](evidence/2026-11-23-sprint2-readiness/source-binding.json)；初次失败与后续复跑分别保存。

TextControl 合并的实际 diff 另由 fresh-context compiler Agent 只读审查；其回报没有阻塞发现，明确检查了 text epoch／lease、重入 reset、retirement 清理、受控 candidate 与完整 snapshot。该本地源审不是 GitHub 平台 APPROVE，也不替代后续 native 验收。

## 原验收继续

原入口仍为 `.github/workflows/projection-family-evidence.yml` 的 `scope=sprint2`，实际 runner 为 `scripts/analysis/run-sprint2-consumers.mjs`。保留 13 阶段和 304 项原清单：292 browser + 12 Node/HappyDOM；独立套件失败后仍收集其余终态，拒绝重复／缺失／选中但 skip 的 case receipt。后续仅在这个 PR 的已发布精确候选上执行，不以综合分支或原 303/304 结果代替。

网站原 42 场景的功能回执与 84 份最终静态捕获分开审读；Tabs B、Sidebar C、Hero D 及双语 Hook 的 visual 接受需要实际 PNG、同源码 sidecar、locale／viewport／theme／interaction scope，不能只读 computed geometry。CJK 字体环境和 fallback 的实际 theme 必须按捕获记录核对。

#1488 的有界 S2 C 功能与 B/C/D visual 子项、#1154 的双语 Hook visual 子项在最终证据完成后回填。完整 Hook 13 项、物理 OS IME、辅助技术、非 Web／真实 Harness／两冻结 App 未覆盖路径、完整历史接受与实验家族仍属于各原 Issue 的具体条件，不因本 PR Ready 自动接受。原失败、原 source pins 和已经获得的历史进度均保留。

本记录不授予合并、发布、部署或规则变更权限。

## 继承的冻结档案格式化修复

首次本地正式 publisher 的回执与提交对象保留；它不证明冻结档案字节未变。此前格式化已改动主干历史记录，所以追加修复恢复上述 10 份档案的 b715b8a6 原 blob，并在 .prettierignore 按现有精确归档规则逐路径排除，正常 hooks 保留。没有重写已有提交或改变历史接受结论。

实际 getFileInfo 确认这 10 个新增路径忽略，两个产品源码控制仍可格式化；再次执行正常 Prettier 后原字节保持。全部受保护历史和 protocol 档案的工作树与索引 blob 已逐一匹配主干；完整清单和 SHA-256 在压缩原始回执。原 21 项 history 控制、1697 对象 audit check 和 public-docs 检查已重新执行；ready 仍按预期以 1 退出，1697 个决定没有被冒充为接受。该修复没有改变先前 78 项源码验证的产品子树；原 304 项消费者及截图仍待最终分支执行。详见 formatter-recovery.json 及原始日志。
