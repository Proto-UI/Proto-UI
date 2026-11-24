# Sprint 7：已执行实验的源保留恢复与当前验证

本记录补充 [Sprint 7 执行交付](2026-11-24-sprint7-execution-delivery.md)，恢复当时已经执行、独立审查并提交，但尚未进入第二个整合载体的实验成果。它不改写原始实验报告、失败、时间、样本排除或冻结摘要，也不把本轮载体准备写成新的参与者实验或设备验收。

## 来源与整合边界

原始提交为 `4e5e50e159573a627d5e75037b23513ad8f5f164`，父提交为 `d0eb81d3c61c3d3e93e46c4151e78031273d6116`。本轮在独立 checkout 上，以 `8b052eb9cdb707ab7a4c8b7660c9442a7e3ee489` 为固定主线基准，执行真正的无冲突双父合并，得到 `b69f195e706af286c162dbd808d56fa5c076a7e9`；原始提交的作者、提交者、签署和历史都由第二父保留。

源合并 tree 为 `acba1d91555093786477c61049e7011ee015c187`。普通提交 hook 与后续确切范围重放之后，再次逐个比较原提交改变的 **116 个路径的 Git mode 和 blob，全部相同**。独立 peer `/root/s2_consumer` 也检查了原 116 个 index 对象。完整逐项结果见 [源保留回执](evidence/2026-11-24-sprint7-experiment-recovery/source-preservation.json)。本记录及本轮回执作为独立后继提交追加，不混入原实验输入。

第一个载体 [#1757](https://github.com/Proto-UI/Proto-UI/pull/1757) 已由最终 head `ccc635e6fdad7ec474bf617ad6b2f1e8c9fc8b2a` 合入，merge 为 `27a7c6a4f4e66621f9e33468b913f99c07c9299e`。它承载 #745、#746、#1147 与 #754 的相应范围；本次恢复的是随后四项实验和 #1151 的生产回读。后续主线另有前进，不能把上述固定基准称作始终最新，也不能由它推导其他 Sprint 的整体验收。

## 四项实验实际提供的结果

以下结果属于原已执行实验，本轮核对其来源与保留证据。原条款并未要求比较必须出现优势；有限样本中的平局、负面结果和不确定结论均保留。

| 原条目 | 可回读的执行结果 | 接受边界 |
| --- | --- | --- |
| [#734](https://github.com/Proto-UI/Proto-UI/issues/734) 三路径知识价值比较 | 成熟库、知识辅助和无知识路径各 3 份初始 Tabs 实现，另各 1 份预定维护；9 份初始与 3 份维护观察均通过共同的 22 项观察。实际校准、错误 oracle 的修正、早期浏览器启动失败和知识引用修正均有保留。 | 这是一批有限受控开发比较；未观察到正确性优势，不支持统计优越性或一般生产结论。参见 [知识比较报告](2026-11-24-sprint7-knowledge-comparison.md)。 |
| [#749](https://github.com/Proto-UI/Proto-UI/issues/749) 确定性与生成式投射 | 同一 React Button 支持范围内，3 份实际 Compiler 产物与 3 份干净生成式交付均通过 10 个共同检查点和 5 个真实手势。最终 oracle 有 3 个合法与 10 个无效控制；原来源不匹配和曝光样本被保留并排除在正式样本外。 | 二元正确性未显示差异；源体积、Space 激活边沿和未知 provider seed 等限制有明确记录。不得外推为 native mixing 或整个库的 parity。参见 [Button 比较报告](2026-11-24-button-projection-comparison.md)。 |
| [#750](https://github.com/Proto-UI/Proto-UI/issues/750) 无内部 onboarding 的真实消费 | 两次真实 consumer 尝试均留下 9 项生产页面观察。consumer-02 保有完整原始单调时钟，是唯一严格样本；consumer-01 的计时尾段丢失，保留为补充行为证据。consumer-02 有 1 次样式信息缺口、5 项修改，其中 1 项修改生成源码，未使用替代路径。 | 支持该限定任务的可消费性；不支持“零源码阅读”“零修改”或总体易用性。不能把第一位消费者的记录器损失改写成消费者失败。参见 [真实消费报告](2026-11-24-generated-button-consumption.md)。 |
| [#751](https://github.com/Proto-UI/Proto-UI/issues/751) 边际成本趋零情景 | 预先声明的成本假设使用同一批 Tabs 数据；三路径各 3 次均在首次观察达到固定停止条件，因此没有人为补造修复循环。没有可用的确定性 Tabs 路径时，明确排除该路径。 | 复用 #734 数据，不是独立第二批实验；假设消去的成本不等于真实账单为零。有限任务的结论偏弱，长期维护与未来价值仍未测量。参见 [压力情景报告](2026-11-24-sprint7-zero-marginal-cost-study.md)。 |

[#1151](https://github.com/Proto-UI/Proto-UI/issues/1151) 的原生产修复来源是 DCBot #5 的已合入提交 `37d252f92cfeb5713b82b4e0002f375e9c02b2d9`。原回读核对四份既有报告的 GET-only 内容匹配、部署 source/image/binary 关系和计时器恢复；队列失败及 pending 数据也保留。该 Issue 原已关闭，本轮不能通过重新关闭制造新的部署事实。参见 [生产回读报告](2026-11-24-sprint7-dcbot-production-readback.md)。

恢复这些交付没有接管完整 Harness、Inspector、Tree 或其他活跃 owner 的工作。原 [#1150 批次账本](2026-11-24-sprint7-idle-batch-review.md) 中当时的未合入状态保持历史原文。最终第二载体的公开 PR、真实平台评审、merge、合入后观察和原 Issue 条款读回，应由实际执行该动作的回执补充；本记录不预先宣布这些动作完成。

## 公开载荷的范围核对

本轮仅检查原 116 个改变路径，没有重新导出整个设备目录。对九个根归档及其嵌套内容递归读取，共检查 **7,967 个文件条目、177,870,052 字节**（包括重复的嵌套压缩表示），没有发现路径越界、ZIP CRC 错误或精确凭据模式命中。[逐项字节清单](evidence/2026-11-24-sprint7-experiment-recovery/publication-payload-audit.json.gz) 保留路径、大小和摘要（gzip 无损表示，解压字节与原清单相同，见 [压缩绑定](evidence/2026-11-24-sprint7-experiment-recovery/publication-payload-audit-archive.json)）；[范围审查](evidence/2026-11-24-sprint7-experiment-recovery/publication-scope.json) 按每个根归档说明来源、用途与边界。

这项判断同时依据内容范围，不只依赖字符串扫描：

- 三种去重 TASK 全文分别是固定 Button、Tabs 和偏好保存实验任务；它们是预定研究输入，未包含私人会话导出。
- 保留的 218 个命令数组与 130 种去重输出属于实验源码读取和编辑、固定依赖安装、构建、局部 fixture 观察、公开 GitHub 回读或定向生产核验。旧环境中的浏览器启动失败仅含该次命令的诊断和临时 Playwright profile 参数，没有归档 profile 目录。
- 全部 319 个 `trace.network` 请求均为 HTTP `127.0.0.1`；各 fixture 的端口保留在原 trace 中，汇总只按 scheme/hostname 分组。检查 JSON、JSONL、trace 元数据和网络头，没有发现非空 cookie、私有 profile 或登录状态载荷。24 处 `authorization` 字段均为普通研究或证据目录的授权范围说明，均不是 HTTP 凭据。
- 已实际查看 Button、偏好设置和 Tabs 各一张原生产截图，内容为匿名固定 fixture；这不等于逐帧视觉审查所有图像，也不代表新执行了浏览器观察。
- DCBot 回执仅保留公开 source 引用、聚合计数、内容指纹、source/image/binary 摘要、计时器状态及日志字段/模板计数。原始私人生产报告、整份设备日志和 Discord 用户、消息或媒体标识没有嵌入；私人原件仅留下大小与摘要绑定。

上述范围核对未发现无关私人载荷。它不改变此前禁止整包公开设备目录的边界，也不替代外部平台的实际准入。已经公开的原件可直接链接；本轮没有设备调用、CI dispatch、浏览器登录或外部写入。

## 当前验证与保留的非成功

验证使用原锁文件对应的已有依赖目录，未声称执行新的全量安装。`package.json` 与 `pnpm-lock.yaml` 在原实验基准和当前固定主线基准之间相同。所有命令和原输出见 [验证目录](evidence/2026-11-24-sprint7-experiment-recovery/validation/)。下表的执行结果绑定源合并 tree `acba1d9…`，追加记录的检查另行标示。

| 检查 | 本轮结果与解释 |
| --- | --- |
| `check:public-docs` | 源合并 tree 的命令 exit 0；原报告中因不完整 sparse checkout 缺失文档而失败的结果仍原样保留。追加本记录后的两次同一 checker 分别使用 768 MB 和 384 MB heap 约束，均 exit 137 / Killed，未得到诊断性断言；两次原输出分别保留，不能称追加记录的全仓检查已通过。后续由实际整合环境取得该检查终态。 |
| 5 个限定实验/benchmark 测试文件 | 106 项，102 pass、4 fail，exit 1。四个失败均在未修改的 #748 discovery fixture 冻结时先命中 `benchmarks/interaction/README.md` 摘要不匹配。 |
| #748 冻结绑定的独立静态核对 | Peer 实际计算全部 35 个 source/prompt 绑定；在原 d0、原 4e 和 main 8b 三处都有相同 **5 处**既存漂移：README、两个 Select prototype、一个 Select spec test 和 `base/test/select.test.ts`。四个行为测试先停在 README guard，因此不能把问题说成只存在一处。没有改写原 manifest、历史 hash 或失败状态。见 [独立绑定核对](evidence/2026-11-24-sprint7-experiment-recovery/discovery-binding-audit.json)。 |
| `check:agent-doc` | canonical tsx CLI 在 checker 启动前因 IPC Unix socket `EPERM` 失败。首次直接导入尝试 exit -9，原因未确定；后继以 `node --max-old-space-size=768 --import tsx` 运行同一 checker，exit 0。没有修改 checker 或断言，也没有把首次 -9 解释成已证实 OOM。 |
| `check:agent-operations` | 完整命令终态 exit 1：1,054 项中 1,051 pass，3 个测试文件进程级失败，未给出可定位的具体断言。validator 和 41 项 skill/39 项 leaf 检查通过。不能称为整套通过。 |
| 上述 3 个文件的串行限定重跑 | 已尝试 `--test-concurrency=1 --test-reporter=tap`，仅保留 15 字节 TAP header，未产生终态回执。会话恢复时 process id 已不可用，peer 未观察到这三个文件的活动进程。退出码、已执行断言数及实际 timeout 触发均未知；记录为 interrupted/terminal unavailable，不替换完整首轮失败。见 [中断处置](evidence/2026-11-24-sprint7-experiment-recovery/validation/agent-operations-isolated-interruption.json)。 |
| 维护脚本语法与格式 | 5 个 `.mjs` 的 `node --check`、1 个 Python 文件的 AST parse，以及改变路径的 Prettier 检查通过；原冻结 evidence 排除规则保持不变。 |
| #749 保留证据核对器 | 实际重跑原核对器副本，仅改变仓库/输出位置和本轮 reviewer 标识，未改断言。1,693 个源文件、1,254 个源码/Compiler 输出引用、6 个 trace、60 张 PNG、24 个响应体均通过；gzip/xz 解压后字节相同，errors 为空。原未保留的 12 个 JS trace 响应体仍只按原报告的 dist/请求/服务端摘要边界说明。见 [重核回执](evidence/2026-11-24-sprint7-experiment-recovery/button-retained-recheck.json)。 |

普通 Husky 源合并提交实际运行了 `lint-staged`。Prettier 阶段完成后，初次 `git add` 因本 checkout 的 sparse 定义排除了证据路径而报告错误，但该工具返回 0，提交确实生成；[初次输出](evidence/2026-11-24-sprint7-experiment-recovery/source-merge-commit.stderr.log) 保留此事实，不能写成第一次所有 hook 阶段成功。随后只将本轮六个证据目录纳入独立 checkout 的 sparse 定义，并用同一个 `lint-staged` 对确切 `8b052… .. b69f195…` 改变范围重放，全部阶段 exit 0。重放后原 116 个 mode/blob 仍完全相同。没有关闭 hook、跳过格式检查或修改冻结证据。

追加回执首次格式处理在新生成的 2.44 MB 机器清单处报告 SIGKILL；原因未被确定。该清单随后以无损 gzip 保存，原大小和 SHA-256 单独绑定，其他维护文档与 JSON 继续接受相同格式工具检查。此包装调整没有改变任何原研究载荷或原 116 个文件。

本轮结果支持已执行实验成果的源保留交付和进一步独立整合审查。它不填补整套 agent-operations 的三处失败原因、不把 #748 的既存冻结问题消失化，保留追加记录后 public-docs 的两次 exit 137，也不把研究证据的恢复等同于七个 Sprint 的全部产品验收。
