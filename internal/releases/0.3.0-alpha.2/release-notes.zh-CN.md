# Proto UI 0.3.0-alpha.2

> Draft release notes。本版本尚未发布；npm package、Git tag、GitHub prerelease、dist-tag 与不可变 snapshot 证据仍属于独立发行步骤。

Proto UI 0.3.0-alpha.2 为 Control Label 修复候选开启下一条 0.3 alpha 准备线。全部 47 个公开 `@proto.ui/*` package 精确使用这一版本。Stable `0.2.0` 保留既有发行身份。

## Control Label 修复范围

- 明确公开 `createControlLabelRef()` consumer、Runtime Adapter 与独立生成的原生源码图共同使用的关联边界。
- 修复主动参与关联的 control 的原生源码编译，保留目标既有 naming、activation、disabled、controlled value、focus 与 lifetime 所有权。
- 通过四个 Web source profile 检查真实 Base Button、Toggle 与 Label 定义。独立 consumer 检查分别报告 compiler admission、普通框架 import、Runtime/compiled 混合关联和真实原生输入证据。
- 通过明确的 client-only hydration 模式，保留既有私有 Web Component SSR 实验对未配对 Button 定义的支持。Hydration 安装真实关联 helper；服务端 Props、options、markup 与 carrier 明确拒绝关联身份传输。公开 SSR profile 仍未获支持，本修复不声称服务端 ControlLabel 配对成立。
- 对 Toggle Group Root/Item 既有的未支持语言边界保留带源码位置的诊断。其 typed collection、reflection 与 publication queue 操作需要独立 compiler 工作；本修复不声称 compiled Toggle Group 已获支持。

这些条目描述候选范围。最终已评审源码及实际验证记录决定已经完成的行为；版本声明本身不证明全部 backend 通过或 stable admission 完成。

## 相对 0.3.0-alpha.1 的变更清单

- 0.3.0-alpha.1 train 于 2026-09-20 发布 43 个公开 package，其名单由已发布的 `package-bom-0.3.0-alpha.1.json` 发行物料给出；其不可变发行 BOM、本地化说明、spec snapshot 与 checksum 均附在 `v0.3.0-alpha.1` GitHub Release 上。
- 0.3.0-alpha.2 候选 BOM 列出 47 个公开 package，全部为 `0.3.0-alpha.2`，且每一个都与当前公开 package manifest 一致。
- 相对已发布的 0.3.0-alpha.1 BOM，本候选新增四个 identity：`@proto.ui/module-axis-input`、`@proto.ui/module-native-link`、`@proto.ui/module-control-label` 与 `@proto.ui/module-table-structure`。registry 中不存在这四个名称的任何 npm package，也没有它们的 `0.3.0-alpha.1` 版本，因此本候选发布前，每个都仍需完成 registry bootstrap 与受保护 workflow 配置。
- 本候选没有任何 package 在 registry 中解析出 `0.3.0-alpha.2`，因此该候选尚未发布。
- 其余内容范围即上文描述的 Control Label 定义与 compiler 修复。

## 已知问题与验收状态

- 同候选消费验收仍然缺失。没有任何候选 SHA 被冻结，也没有 rehearsal 或 consumer 凭据绑定到某个 SHA；2026-11-15 记录的 24/24 四 Web 原生 consumer 结果属于未冻结候选。周期 43837651044 中的 18/18 `component-consumer-repairs.browser.test.ts` React 与 Web Component consumer 用例以及 Drawer/Command 密度套件结果，仍只覆盖它们实际执行的配方。
- 完整可信回归基线尚未恢复。2026-11-16 阻塞清单记录周期 43812576775 中 8 个浏览器分片有 7 个触达 900 秒内层上限；之后的周期 43837651044 同样有 7 个共享浏览器分片在 900 秒终止，browser5 为 7 failed / 202 passed / 17 skipped，Drawer/Command 密度套件为 56 failed / 56 passed。本说明所绑定的源码线包含浏览器分片均衡变更（#1482），但没有为它记录任何完整可信周期。
- 该清单中的交互阻塞在本说明绑定的源码 commit（`0f0955a9`）上部分已修复、部分仍开放。家族切换 portal 封闭修复（#1480）与 Tooltip composition 及水平 Drawer consumer 修复（`155d6d206`）已包含在该 commit 中，而 Tooltip 多余 tab 停靠点（#1455）、可访问名称与宿主外观属性通道（#1454）以及 Search 旅程闭合（#848）在本说明撰写时（2026-11-18 观测）仍是开放 Issue。整合 0.3 回归修复的 pull request #1490 在该观测时点仍开放，其 head 尚未包含在绑定的源码 commit 中。
- 如上文所述，compiled Toggle Group Root/Item、公开 SSR profile 与服务端 ControlLabel 配对在本修复范围内仍不受支持。
- coverage matrix 仍是基于更旧基线的非规范清单，不得被引用为本候选的发行证据。

## 版本与生命周期

公开 package set 继续采用全局精确版本。`@proto.ui/compiler` 仍是私有工具，不加入发行 BOM。当前 scoped lifecycle disposition 使所评审的 Control Label 与目标实体继续保持 draft；稳定接纳仍需独立的原生输入、lifetime 与 assistive-technology 证据。其余 catalog draft 继续在 lifecycle report 中可见，本准备不替它们填写无依据的统一 disposition。

## 发布状态

本准备不发布 package、不创建 `v0.3.0-alpha.2`、不移动 npm `next`，也不激活 `V-PROTO-UI-0011`。Package-local alpha.2 安装命令是未发布候选的示例；网站可用版本说明继续遵循最后一次已核验发行。真实发布要求最终已评审 package set 完成完整 rehearsal、从 `main` 受保护发布，再进行独立不可变证据评审。
