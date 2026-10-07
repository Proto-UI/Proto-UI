# Collapsible 保留空白的边界换行

## 原生事实

精确头 `f91b80c45edc992beb0cdb2e77224a67c9c998a5`，Actions `37616450209`，20/36 通过、16 个窄屏用例失败。四家族 × 四 Runtime 的 320px/200% 字号原始 Trigger PNG 与逐 glyph JSON 均保留。

16 份记录各只有一个 U+0020 行末空格超出 padding 内容边界，可见非空 glyph 越界均为零。旧 `white-space: pre-wrap` 允许保留空格 hanging；因此不能将旧红描述为可见字形被裁切。旧 WholeRange ±1px 断言仍然失败，这个历史不改。

## 有界源修复

四个风格 Collapsible Trigger 改为 `whitespace-break-spaces`。它保留作者空格和换行，同时使保留空格也占据换行宽度。继续使用 anywhere 长词换行。没有过滤空格、trim 文案、隐藏越界或放宽原生断言。原条件、原生截图路径与 oracle 不变，下一精确头重跑才判通过。

CLI finite CSS 增加 `white-space: break-spaces` lowering；源码闭包测试要求该声明。四家族样式清单和 GPUI 声明 fixture 通过原生成器更新，非手写生成物。整合其他新原型时必须在最终源码重新生成，不能用本地较小清单覆盖它们。

## 目标边界与验证

- 新约束在旧源：9 红、42 绿；包括四家族源码、四 family 编译闭包和 finite CSS 单项。
- 修复后四 Web Adapter、四风格、CLI、GPUI peer 语义 fixture 共 8 files / 163 tests 通过。另对最终新增的作者双空格/换行保留断言复跑 8/8。
- 样式清单检查通过；GPUI 声明 fixture 检查通过。包脚本的 tsx CLI 尝试创建本地 IPC pipe 被环境 EPERM 拒绝，日志保留；相同生成脚本通过 Node 已安装的 tsx import hook 执行，无 IPC 服务，生成/校验完成。
- GPUI Rust `proto-ui-gpui/src/style.rs` 既有映射没有 `white-space`，旧 pre-wrap 与新 break-spaces 均在显式 `Unmapped::UnknownProperty` 边界；`tests/style_map.rs` 有完整未映射属性清单。此补丁只更新声明 fixture，不宣称 GPUI 文本布局保真或 optical 支持。未启动本地 Chromium，修复后 native UI 尚待 CI。
