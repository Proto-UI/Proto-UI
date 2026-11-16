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

## 版本与生命周期

公开 package set 继续采用全局精确版本。`@proto.ui/compiler` 仍是私有工具，不加入发行 BOM。当前 scoped lifecycle disposition 使所评审的 Control Label 与目标实体继续保持 draft；稳定接纳仍需独立的原生输入、lifetime 与 assistive-technology 证据。其余 catalog draft 继续在 lifecycle report 中可见，本准备不替它们填写无依据的统一 disposition。

## 发布状态

本准备不发布 package、不创建 `v0.3.0-alpha.2`、不移动 npm `next`，也不激活 `V-PROTO-UI-0011`。Package-local alpha.2 安装命令是未发布候选的示例；网站可用版本说明继续遵循最后一次已核验发行。真实发布要求最终已评审 package set 完成完整 rehearsal、从 `main` 受保护发布，再进行独立不可变证据评审。
