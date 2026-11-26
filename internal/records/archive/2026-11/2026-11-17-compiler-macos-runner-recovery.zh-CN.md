# Compiler GPUI macOS runner 的配置恢复

## 为什么需要这个改动

[#1488 A 节](https://github.com/Proto-UI/Proto-UI/issues/1488) 跟踪的是原生验收入口的配置问题。开发父提交 `e329c21ef07a5e7d05b093250ee5ae2be80a3eed` 仍让 `compiler-gpui-source-consumers.yml` 请求 `macos-14`。[GitHub 官方公告](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/) 给出的 Actions 退休日期是 2026-11-02；截至本次 2026-11-17 检查，该日期已经过去。

对[原始 run 43795529524](https://github.com/Proto-UI/Proto-UI/actions/runs/43795529524) 的本次 API 回读确认：绑定 `3d1fc914e5f9f7dfada8da27f61dbb92783a84bf` 的 macOS job `133063369758` 为 cancelled，实际 steps 为 0；Linux job `133063369932` 为 success。零步执行不能成为 macOS 编译结果，Linux 成功也不能替代 macOS 验收。

## 修复选择与保持的边界

只把矩阵中的 `macos-14` 改为显式的标准 `macos-15`。该 label 在[官方 image 清单](https://github.com/actions/runner-images/blob/main/README.md) 中对应 ARM64 macOS 15，并与 `2026-11-16-compiler-isolated-acceptance.zh-CN.md` 已记录的修复方向一致。这里不使用浮动的 `macos-latest`，也不把 Azure DevOps 的 macOS 14 延长期限用于 GitHub Actions。

工作流其他字节保持原样：Linux lane、Rust `1.98.1`、frozen JavaScript lockfile、locked Rust 依赖、实际 Compiler producer、默认已发布 SDK 检查、原有 consumer 断言、单 Cargo job、超时、artifact、事件、并发与权限均不变。该变更不增加 PR 重任务或新的自动触发方式。

首次运行现有配置检查时，21 项调度测试中 20 项通过、1 项失败：既有矩阵断言也硬编码了已退休的 `macos-14`。将该断言同步更新为严格的 `['ubuntu-24.04', 'macos-15']`；只替换 label，不删除断言、不放宽成任意 macOS，也不修改同一测试中的事件、精确 checkout、凭据与 artifact 要求。这是配置选择的既有测试投影更新，原始失败日志保留。

旧记录中正常 push 被拒绝的 workflow scope 事实保留。本次只在当前用户已授权的自有修复分支上，通过现有正常连接器验证是否允许发布；不更换凭据、提升权限或绕过拒绝。源码准备、配置验证、分支发布和原生执行分别记账。

## 验证与未完成项

两处 label 替换分别通过逐字节守恒检查。更新既有 expected label 后，调度 policy 原 21 项全部通过、退出码 0；release-source-ledger 原 21 项全部通过、退出码 0；workflow inventory parser 退出码 0。后两项读取的输入未因 expected label 校正而改变。本次没有新增只复述实现的测试。原始 20/21 失败、后续 21/21、完整命令和输入摘要见 [机器证据](evidence/2026-11-17-compiler-macos-runner-recovery.json)。独立静态复核确认了官方 label、两处替换和保持的调度/权限边界；不代表 formal approval。

当前本机不是 macOS，也没有 Rust SDK；本地配置检查不证明 runner 分配、工具链安装、SDK 编译或原生消费者通过。对应准确源码的 macOS job 及其 artifact 仍须实际执行并回读。这里只恢复可审查的配置入口，不关闭 #1488 或整个 Compiler/native 验收。
