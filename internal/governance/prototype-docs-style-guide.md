# Prototype documentation style guide

This guide defines the writing standards and technical invariants for human-facing component documentation under `apps/www/src/content/docs/{zh-cn,en}/ui-libraries/`. It complements [documentation-policy.md](documentation-policy.md) and is enforced in part by the automated prose check in [scripts/docs/README.md](../../scripts/docs/README.md).

## Goal

Write crisp, natural, developer-friendly component documentation on par with Base UI, Radix UI, and shadcn/ui. Keep every API fact, prop, event, export, and MDX invariant accurate while eliminating defensive AI hedging, internal audit logs, and translationese.

## 1. Remove defensive hedging and internal audit boilerplate

Preserve facts a developer needs to choose an API or host: catalog lifecycle, published versus workspace-only availability, exact supported versions, unavailable capabilities, and known limitations. State them briefly beside the relevant preview, installation or usage instructions. A draft catalog identity must remain visibly **early draft** when its status is discussed; a runtime selector lists preview choices and does not establish compatibility or completed host validation. Keep a concise link to the governing test coverage when that distinction affects use. Shortening prose must not remove these facts or turn them into an unqualified compatibility claim.

- **Do not include site-wide compliance or acceptance disclaimers** in component pages, such as:
  - `这不修改公共组件的兼容默认值，也不代表全部浏览器、原生宿主和视觉验收已完成`
  - `当前为 Draft 源码工作…不宣称 Finf 验收通过`
  - `当前源码与 synthetic-DOM 测试不代表浏览器/native、辅助技术、材质或 GPUI 已完整验收`
  - `四 Adapter synthetic DOM 与 compiler mappings…未执行的宿主证据仍是验收缺口`
  - `当前本地证据为 24 个 Base 测试…本地 Chromium 启动被 socket EPERM 阻止，不伪报通过`
  - `工作区 manifest 的版本不能证明 registry 已发布`
  - `这不是 Liquid Glass 的实现` / `不宣称参考源码已有这些样式` / `两者不混称跨宿主已视觉等价`
  - English equivalents: `does not claim/imply/establish/prove ... parity/completion/acceptance`, `not a claim of ...`, `without claiming ...`, `synthetic-DOM`, `Finf`, `socket EPERM`, `evidence boundary`, `acceptance gap`, `rendered parity`, `visual parity`.
- **Do not include internal audit material**: test counts, CI logs, 40-character commit SHAs (except in `design-contract.mdx`), the internal codename `Finf`, PR/Issue review chatter, or audit sections such as `## 证据与参考`, `## 建议验收路径`, `## 验证边界`, `## 依据`, `## Evidence`, or `## Verification`.
- **Do not use filler openers** such as `当前页面展示 Proto UI 中 shadcn 风格的 switch 条目`.
- **Workspace-only availability note**: only when a component is genuinely workspace-only (not yet in the 0.2.0 stable release), use at most one plain sentence in the Installation/Usage section:
  - `zh-cn`: `当前仅在源码工作区提供，尚未进入 0.2.0 稳定版。`
  - `en`: `Currently available from workspace source; not yet included in the 0.2.0 stable release.`

## 2. State behavioral boundaries positively

Never stack long negative lists (`不声明 A、B、C、D、E...`). Keep only the 1–3 constraints a developer will actually encounter, stated positively with what to do instead.

Replace internal architecture jargon in `ui-libraries/` prose with reader-facing wording:

| Avoid in `ui-libraries/` prose | Prefer (`zh-cn`) | Prefer (`en`) |
| --- | --- | --- |
| `唯一 owner` / `canonical 状态所有权` / `sole owner` | `状态由 Root 统一管理` | `Root manages the state` |
| `投射` / `投影` / `projection` (for component families) | `风格组件` / `主题实现` / `组件` | `styled component` / `styled family` |
| `authored 后代` / `authored 内容` | `传入的子元素` / `自定义内容` | `your children` / `custom content` |
| `可重复 L1 detach` / `L1 view presence` | `关闭时默认卸载内容节点（设置 keepMounted 可保留隐藏节点）` | `unmounts content when closed (set keepMounted to keep it mounted)` |
| `fail closed` | `忽略非法配置并保持当前状态` | `ignores invalid configuration and stays inactive` |
| `IDREF 随实际 lease 撤销/恢复` | `自动维护 aria-describedby / aria-labelledby 关联并在卸载时清理` | `automatically links and cleans up ARIA attributes` |
| `prop-only 转换` | `仅更新属性时` | `when updating props` |
| `发出命名值快照 submit` | `校验通过后在 submit 事件中返回按字段名组织的表单数据` | `emits form values keyed by field name on submit` |

## 3. Unified page skeleton (`ui-libraries/`)

1. **Frontmatter**: `zh-cn` pages with a `description` field must write it in natural Chinese (never English-only). Keep `title` clean and recognizable without body `(WIP)` clutter.
2. **Lead (1–2 sentences)**: state what the component does, plus one short visual-style note for styled families. Ordinary Shadcn pages must mention `Shadcn Rhea` (e.g., `本页示例使用 **Shadcn Rhea** 风格。` / `The examples on this page use the **Shadcn Rhea** style preset.`).
3. **`## 预览` / `## Preview`**: preserve `<PrototypePreviewer ... />` and add 1–2 helpful sentences if needed.
4. **`## 安装` / `## Installation`**: preserve `<InstallCommandCard ... />` when present plus a brief host note.
5. **`## 用法` / `## Usage`**: cover parts and composition roles, code examples (`<CodeExample />` or fenced code blocks), controlled vs. uncontrolled usage, keyboard and accessibility behavior, and key behavioral notes.
6. **`## API`**: provide one single props table (merge duplicate `## 输入` / `## JSON Props` and `## API` tables into `<ApiPropsTable />`), followed by events and methods.
7. **`## 参考` / `## References`**: include only `<SpecEntityLinks ... />` when originally present.

## 4. Technical invariants

- Preserve all original `import` statements and JSX component tags and props (`<PrototypePreviewer>`, `demoId`, `initialRuntime`, `runtimes`, `codePanel`, `toolbar`, `compiledPrototypeId`, `compiledItems`, `<InstallCommandCard>`, `<CodeExample>`, `<ApiPropsTable>`, `<SpecEntityLinks>`, `<PrototypeDocumentationIndex>`, `<DraftProjectionStyle>`, `<div data-adapter-panel=...>`, `<div id=...>`, `<div class="select-content-preview">`).
- Wrap all literal JSON or object payloads in prose in backticks (for example, `` `{ active: boolean }` `` or `` `{ open, reason }` ``) so MDX compiles cleanly.
- Never write authoring placeholders (`写作提示`, `Coming soon`) or stale release claims (`稳定版发布仍待完成`, `stable publication pending`, or recommending prerelease installs as current stable).
- Never invent props, defaults, events, or exports that are not backed by the original documentation or source implementation.
- **`<ApiPropsTable>` column ownership**: use `headers.default` / `row.default` **only** for short code default or initial values (`Default` / `Defaults` / `Initial` / `默认值` / `默认` / `初始值`). Use `headers.description` / `row.description` for prose explanations, notes, timing, or part ownership (`Description` / `Notes` / `Part` / `说明` / `所属部件` / `触发时机`). `default` renders non-wrapping `<code>` and crushes adjacent columns into single-character vertical lines when misused for prose. When `check:public-docs` flags a table violation, fix the MDX column mapping (or `<ApiPropsTable>` layout) directly—never weaken the linter or hack tests to silence it.

## Automated checks

`checkUiLibraryProse` and `checkApiPropsTables` in [scripts/docs/check-public-docs.mjs](../../scripts/docs/check-public-docs.mjs) check all `.md` and `.mdx` files under `apps/www/src/content/docs/{zh-cn,en}/ui-libraries/` (ignoring fenced code blocks) for forbidden audit/hedging phrases, raw 40-character commit SHAs outside `design-contract.mdx`, non-Chinese `zh-cn` frontmatter descriptions, and misused `<ApiPropsTable>` `default` columns. Run them through the public documentation gate:

```sh
corepack pnpm@10.32.1 check:public-docs
corepack pnpm@10.32.1 test:public-docs
```
