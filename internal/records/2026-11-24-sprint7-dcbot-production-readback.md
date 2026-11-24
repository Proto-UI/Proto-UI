# Sprint 7：DCBot 生产部署与真实回读

对应 [#1151](https://github.com/Proto-UI/Proto-UI/issues/1151)，父项 [#1092](https://github.com/Proto-UI/Proto-UI/issues/1092)。原 source key 是“将修复部署到生产并回读确认（DCBot）”。本记录补齐真实外部交付证据，不把 2026-11-22 的延期关闭当作完成证据，也不扩展为整个 bot 队列的健康接受。

Agent 按当前用户“补完 Sprint 7”的请求执行。下面使用 UTC；北京时间为 UTC+8。生产回读发生在 **2026-11-23 19:26:37–19:26:52 UTC**，暂停计时器的恢复发生在 **19:52:06–19:52:07 UTC**。

## 实际版本与部署

| 对象 | 实际读回 |
| --- | --- |
| 修复 PR | [Proto-UI/dcbot#5](https://github.com/Proto-UI/dcbot/pull/5)，2026-11-22 11:32:46 UTC 已合入 |
| 被审查候选 head | `f66f969d1ce23e8c5455057f42855ae5e0ec53d0` |
| 合入、生产 source HEAD、镜像 revision、部署 ref、mirror main | `37d252f92cfeb5713b82b4e0002f375e9c02b2d9`，五处一致 |
| 构建 source tree | `4f14502a2d0c8ebd6cd08b5868c068084e09c187` |
| 实际运行镜像 | `sha256:1173bfdedce959b99951617f9b2d52a1f226624afc100e31cd18d8619669e103` |
| `/proc/1/exe` SHA-256 | `33d413222056b8af367c2823df6ac9f439b703a61adb69190a139d831f995663` |
| 容器启动 | 2026-11-22 11:34:23.298231141 UTC；running；restartCount=0 |
| 生产健康与就绪 | `/healthz` 返回 `ok`，`/readyz` 返回 `ready`，两条命令均 exit 0 |

旧部署包装器在实际部署成功后，删除容器临时验证程序的清理步骤失败，导致外层没有完整成功收据并留下暂停的计时器。本次重新读回版本、运行二进制、健康和真实 bot 结果，确认部署已发生；没有将失败的包装器改写成成功，也没有再次部署同一个版本。

实时读取源 PR 时 `reviews=[]`、`statusCheckRollup=[]`。这两个空数组如实保留，不能表述为原生 APPROVE、CI 或 DCO 绿灯。已经合入的源修复与本次生产交付接受是两件事；本记录不伪造新的历史审查或认证。

## GET-only bot 路径回读

在实际生产容器内执行现有 `sprint7-report-verify -verify -start 2026-11-20 -end 2026-11-22`，**exit 0**。使用真实 bot 的存储及 Discord 读取路径核对以下四份既有日报；没有 apply、replay、post 或 Discord 发信。

| 已有日报 | 语言 | 正文匹配 | 重复媒体名称 | 正文 fingerprint |
| --- | --- | --- | --- | --- |
| 2026-11-20 | zh-CN | true | 无 | `a99fa08aaaadd590b8d497b2248e40c31ee3527aefdb4d7a2520666573bf85a2` |
| 2026-11-20 | en | true | 无 | `0ae1b2c2b89decfe5d349460e07bdddfabb93a30e13ec73d1779dd2969f11247` |
| 2026-11-21 | zh-CN | true | 无 | `9c260feb46e9bc4d9512d47e0f213626a9c8f8bc483fffea7a786ee834416434` |
| 2026-11-21 | en | true | 无 | `f54e8a1bda8f0133e02d1b92791a4b3dcc82835edee196ab24517fa5b9280122` |

原始程序把重复媒体名称的空结果返回为 `null`，表格中的“无”只对应这四个实际结果。没有据此外推所有报告或未来运行。线程、消息、媒体 ID 和消息正文保留在用户设备的原始回执，公开收据只包含日期、语言、结果和哈希。

## 计时器与日志处置

确认五处版本和健康状态后，恢复之前包装器暂停的 `pully-deploy.timer`。恢复前 `inactive`，`systemctl start` exit 0，恢复后 `active`。这是原部署流程的收尾，不是一次新版本上线。

实际队列读数为 completed 36,910、failed 699、pending 43,798、processing 1；116 份报告中 70 份已有 canonical hash。最近 200 行日志存在 mirror reconciliation、recovery scan、rate limit、模型工具调用上限等警告/错误。它们没有被擦除或标为修复；这次四份日报的匹配也不证明队列整体健康。脱敏后的日志模板计数、完整原日志的哈希和取样边界已保留。后续运维问题仍应按各自真实输入归属，不能用“#1151 完成”替代它们的诊断。

## 接受与证据

原有界部署及回读条件现在有实际成功后继：源修复合入、真实生产 revision/image/binary 一致、健康与就绪成功、四份真实结果匹配、原流程暂停的计时器恢复。Issue 的旧关闭历史应保留；只回填这条条件和本次证据，不重开后再造一次关闭。

完整脱敏收据：[production-readback.json](evidence/2026-11-24-sprint7-dcbot/production-readback.json)。它同时绑定原生产私有回执 SHA-256 `ce0efe08b8ecac98b1e324d7eef92f0b6f1527e57a5620738ec0fe58bea765cd` 和计时器回执 SHA-256 `29825594e307756842ede8d727ba979ce7a29c6729b249ef4bcaa7201658efef`。原始失败、时间、空平台检查、日志债务与后继成功各自保留。
