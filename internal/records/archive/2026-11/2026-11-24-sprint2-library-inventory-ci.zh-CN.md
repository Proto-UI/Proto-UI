# Sprint 2：完整 library × public profile inventory 的 CI 接入

本记录说明 CI 实现和配置 / 负控验证，不是一次托管全库执行结果。来源从 `7b7fba3077c5ab5065bd4738962f3fe51302c78f` 建立独立 worktree；之前十入口 pilot 的实测数据继续绑定自己的来源。

## 调度与资源边界

`.github/workflows/compiler-library-inventory.yml` 只声明 `workflow_call` 和 `workflow_dispatch`，由 `ci.yml` 的非 PR cycle lane 调用，并纳入 `cycle-report.needs`。仍只有 `ci.yml` 声明原三个回归 cron；不在普通 PR 更新时启动全库编译，不取消正在保留证据的同 ref 执行。

四个固定分片按排序后 entry index 对 4 取模，各自完整保留所有 entry × public `TARGET_PROFILES` 分母。每个 runner 同时只有一个 entry worker，heap 为 1,536MiB；worker 内同一 entry 的 snapshot 供各个真实 `compileFile` 调用共享。矩阵 `fail-fast: false`，一个分片的编译缺陷或资源失败不会取消其余分片。Node 固定为 24.22.3，pnpm 为 10.32.1，使用冻结 lock 安装且不执行 install scripts。

## 收据完整性 gate

合并 job 使用同一 SHA 的干净 checkout 重新生成完整 expected plan，然后校验四个分片的精确 source / script / tools / profile / 全库身份和选择范围。它读取当前 workflow run 每个分片的最新实际 attempt：后继失败不能退回旧成功；重跑失败分片也不要求给其他分片编造新执行。

原始 inventory merger 先校验每份 row、closure 和 emitted artifact metadata 的哈希，拒绝异源或重叠收据。CI gate 再逐行核对 expected entry × profile 笛卡尔积分母、每行源码哈希、诊断分类、计数、全部 worker profiles 和终态。少一整项、遗漏未实现的公开 profile、重复一行、`UNTESTED`、任何 `FAIL`（包括 compiler-defect）、缺失终态、SIGKILL、timeout、资源错误或 setup / matrix failure 均不能变绿。即使调用者伪填 `admissionCoverageComplete: true`，逐行和进程检查仍拒绝不完整结果。

`UNSUPPORTED` 与 `UNIMPLEMENTED` 保留原分类及诊断；完整清点不代表全库都已准入。Gate 独立输出 `allImplementedEntriesAdmitted`，`acceptedBaseline` 固定为 `null`；没有从历史用户报告、十入口 pilot 或第一次 CI 自动制造已接受 baseline。原有 inventory 的显式 `--baseline` ratchet 能力保留，但本轮没有给它填入未经接受的报告。

每个分片和合并 job 都始终尝试上传原始 plan、全部 rows / closures、artifact metadata、stdout/stderr、worker requests / resources / process receipts、CI source / run / attempt 和 gate 结果，保存 30 天。合并失败时仍保存独立的 expected 全分母及已获得的原始分片结果。托管 runner 若在上传前完全失去执行能力，缺失 artifact 也只形成失败或未知，不能被计为成功。

## 已执行的有界验证

- `node --test scripts/ci/test/compiler-library-inventory.test.mjs scripts/compiler/library-profile-inventory.test.mjs`：8 / 8，通过。独立小收据负控覆盖移除完整 entry / unimplemented profile、重复行、UNTESTED、compiler-defect、SIGKILL、缺终态、少 worker、旧失败和最新 attempt 选择；不执行 Compiler worker。
- `node scripts/ci/check-ci-schedule.mjs`：通过；仍为唯一三个 slot 的回归 owner，既有禁止 push / 重型 PR fan-out / 活跃证据取消规则均保留。
- `node --test scripts/ci/test/ci-scheduling-policy.test.mjs scripts/ci/test/cycle-job-inventory.test.mjs scripts/ci/test/cycle-report.test.mjs`：59 / 59，通过。包括原调度负控、原完整 native job acquisition、未知 / 取消 / 未启动不能形成绿色 baseline 的条件。

本轮没有在本地启动全库重任务，没有远端 dispatch 或修改 Issue。新整合来源上的完整 inventory、真实 registry consumers、生产成本和托管终态须按各自实际来源另行取得。
