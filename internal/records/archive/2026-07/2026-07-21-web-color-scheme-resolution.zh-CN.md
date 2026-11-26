# 2026-07-21 Web color scheme 解析与 RC 试用发现

> Internal record. Not normative. 本文记录 `0.2.0-rc.0` 仓库外人工试用发现的主题解析失配、当前修正方向与仍未稳定的边界。Prototype 语义仍以适用的 P/C/T 实体为准；Web environment meta 的最终归属需在 Module、Host Capability 与 Adapter 系统编目时提升。

## 1）外部观察

在独立 React + TypeScript + Vite 项目中执行精确版本 CLI `init` 并直接引入生成的 Shadcn Button 后，宿主页面会通过 `prefers-color-scheme` 跟随系统暗色偏好，但 CLI 生成的 `shadcn-theme.css` 只在根元素存在 `.dark` 或 `data-theme="dark"` 时启用暗色变量。

这不是单一 theme 文件的问题。`0.2.0-rc.0` 同时存在三套相关行为：

- React、Vue 与 Web Component Adapter 的默认 `colorScheme` meta 读取 `prefers-color-scheme`。
- 生成的 Shadcn theme variables 只识别根元素的显式 dark marker。
- Style Compiler 为 `dark:*` token 生成的 selector 只识别 `.dark` 或 `[data-theme="dark"]` ancestor。

因此，在没有 ThemeProvider 的普通项目中，Prototype rule、theme variables 与 dark token selector 可能得出不同主题。显式宿主主题与系统偏好相反时也会出现同类失配。

## 2）当前修正方向

Web 的有效 color scheme 采用以下优先级：

1. 根元素显式 `.dark` 或 `data-theme="dark"`。
2. 根元素显式 `.light` 或 `data-theme="light"`。
3. 未声明显式主题时，使用 `prefers-color-scheme`。
4. SSR 或宿主无法读取媒体查询时，回退为 light。

CLI 生成的 theme variables、Style Compiler 的 `dark:*` selector lowering，以及三个官方 Web Adapter 的默认 `colorScheme` meta 必须遵循同一优先级。显式主题继续允许应用覆盖系统偏好；本次修正不会把属性/class 主题模式替换为只能跟随媒体查询的模式。

## 3）版本与发布边界

该修正影响已发布 CLI、Adapter 与生成 CSS，不能覆盖 `0.2.0-rc.0`。它先进入 `0.2.0-rc.1` 未发布更新日志，与后续人工试用发现一起收集；正式切入 release train 时再创建 draft V 实体、统一更新全部公开 package 版本、生成 BOM 与 spec snapshot，并走完整发布门禁。

当前不提前修改 `VERSION` 或 package manifest，也不宣称 `0.2.0-rc.1` 已经形成可安装版本。

## 4）验证边界

本轮至少验证：

- 无显式主题时，system light/dark 能驱动生成的 theme variables 与 dark token CSS。
- 显式 light 能覆盖 system dark。
- 显式 dark 能覆盖 system light。
- React、Vue 与 Web Component 共享同一个默认 Web meta resolver。
- RC Trial 文档说明默认系统回退和显式覆盖规则。

## 5）后续未决项

- `colorScheme` meta 对主题运行期切换是否需要一等订阅能力，而不是只在现有 rule evaluation 时读取当前值。
- 是否支持组件子树内的嵌套 light/dark scope；本次只稳定根元素主题与系统 fallback。
- Web environment/configuration 输入最终应编目为 Module、Host Capability、Adapter profile，还是更系统的 environment abstraction。当前 `D-RULE-META-NAMING-0001` 与 `C-RULE-WHEN-0002` 已明确 `meta` 命名及抽象层级仍未稳定。
