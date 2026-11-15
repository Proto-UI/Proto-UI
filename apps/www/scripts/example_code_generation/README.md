# 示例代码生成 CLI

同一 CLI 为 `demo_components/<folder>` 写入 `<folder camelCase>Code.ts`，保留网站现有 `codeMap[RuntimeId][demoId]` 消费接口。生成文件应由该入口重建，不在生成文件尾部维护普通应用包装。

## 有界生成

从仓库根目录，只生成已选择的 Button 目录：

```sh
corepack pnpm@10.32.1 --filter apps-www run generate-code --folder button
```

在 `apps/www` 中的等价命令：

```sh
corepack pnpm@10.32.1 run generate-code --folder button
```

`--folder` 只匹配 `demo_components` 中真实存在的一级目录。未知目录、无 demo 的所选目录或未知参数均报错，不退回全量生成。此选择在任何映射或输出写入前完成。

不传 `--folder` 仍按现有目录清单处理全部目录：

```sh
corepack pnpm@10.32.1 run generate-code
```

全量入口不是某个目录已通过四宿主验收的证据。协作中应选择自己的目录，避免覆盖其他所有者尚未迁移的输出。

## 显式作者来源优先

目录存在 `authored-code.ts` 时，CLI 优先读取其导出的 `codeMap`。它沿用已有数据形状：

```ts
Record<RuntimeId, Record<string, string>>;
```

每个宿主值都是作者提供的完整示例字符串。CLI 要求：

- 恰有 `wc`、`react`、`vue`、`vue2` 四个公开宿主；
- 每个宿主均覆盖该目录实际 `*.demo.ts` 文件名所定义的完整 demoId 集合；
- 每个 code 值是非空字符串。

来源存在但加载失败、宿主或 demoId 不完整、值无效时直接失败，不回退旧 emitter，也不省略缺失条目。有效来源交给同一 `renderRuntimeBlock` / `buildCodeFileContent`，实际写出四宿主 `codeMap`，并在输出头部记录来源。

这种输入明确保存作者编写的 imports、框架状态、事件、标签、属性与清理表达。它不声称从任意 `DemoSpec.setup` 闭包自动推导等价代码，也不按组件或业务名称选择模板。真实 Preview 仍读取自己的 `*.demo.ts`；二者是否在各宿主一致，需要实际消费者验证。

当前 Button 的来源为：

- `src/content/docs/demo_components/button/authored-code.ts`：四宿主示例输入，保留全部实际 demoId，包括真实 Ghost 计数/回调、显式 Rhea、icon/compact 内容；
- `src/content/docs/demo_components/button/buttonCode.ts`：CLI 的生成输出，继续服务 Previewer 的现有 codeMap lookup；
- `src/content/docs/demo_components/button/button-usage.ts`：普通应用文件包装，读取生成 codeMap，提供注册、样式和完整 CodeExample files；不是生成文件的未声明尾码。

只处理带显式来源的 Button 时，不加载旧 emitter，不生成或改写全局 `prototype-config.ts`。这条路径既不运行 DemoSpec.setup，也不取代它的 Preview 所有权。

## 旧静态树路径的边界

没有 `authored-code.ts` 的目录继续使用既有流程：

1. 生成 `prototype-config.ts`，收集实际 demo.root 中的 prototypeId。
2. 加载该新映射与旧 `generate-code.ts` emitter。
3. 从 demo.root 产生 WC / React / Vue 三宿主静态代码，并补上对应 facade imports。
4. 写入该目录的 `*Code.ts`。

旧路径仅生成三宿主静态树，不提供 Vue2，不降低 `setup` / ref / callback，现有 box.tag / attrs 与部分呈现表达也没有完整投影。它不是任意 DemoSpec 的无损导出器。三宿主输出显式使用 Partial 类型，不把缺少的 Vue2 声称为成功支持。

旧映射依旧是生成资产，不应手改。其前缀/组件推导不替代公开 CLI registry 或实际包导出验证。显式来源分支不依赖此旧映射，也不会把 Preview 的私有 `wc-*` 标签当作安装 API。

## 接纳与复现

先保留先前生成输出及其真实来源/失败。运行同一入口后再记录新输出字节、工具链、作者来源与 Preview 源绑定；按消费者分别验证 imports、公开 tag/export、真实事件、disabled、样式与各宿主生命周期。仅生成文件、字符串相同或类型通过不代表 Preview/Code、原生交互、视觉或 AT 通过。

Button 应从原生 Preview 与生成的完整应用文件分别观察：四宿主 Ghost 每次启用激活恰加一、禁用始终零；各 size 包括 icon-compact；图标按钮的名称与装饰性 glyph；以及同一候选包集合中的实际导出与样式。旧历史证据不能绑定到新输出来代替这些执行。
