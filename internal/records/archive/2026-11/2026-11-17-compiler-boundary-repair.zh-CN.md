# Compiler 后续边界修复与独立复审

本记录续接 [11 月 16 日编译器同源验收](2026-11-16-compiler-isolated-acceptance.zh-CN.md)，记录当前用户授权的 compiler stages 1–3 后续修复。基线是 main `bf8b1f55f93a89f3c689276d6e339d83891f4dba`；候选通过九个源码/测试文件的 SHA-256 绑定，提交与平台收据由协调者另行绑定真实新 head。本文不改变 spec 生命周期。

**最终源码的完整 11 文件 affected 组实际执行 105/105 通过，0 failed、0 pending；另一组公开边界消费者 52/52 通过；九个入口的完整传递 TypeScript Program 为 0 诊断。** 独立本地审查先后发现两条 Expose 修复中的 P2，两条均保留真实红例并在最终源码复审关闭。正式 GitHub review、当前新 head 的平台检查、整合与 release acceptance 仍是后续条件。

完整原始日志、Vitest JSON、类型文件清单、独立探针、各轮文件指纹及可恢复代码补丁，保存在 [机器证据](evidence/2026-11-17-compiler-boundary-repair.json) 的带 hash ZIP 附件中。恢复先核对 ZIP，再核对逐成员 SHA-256；历史失败没有被绿色结果覆盖。

## 为什么修复这三处

### 默认参数也会使用当前 owner

[#1462 的默认参数审查](https://github.com/Proto-UI/Proto-UI/pull/1462#discussion_r4586602514) 指出：`function wait(task = delay(0, () => {})) { return 1; }` 的参数初始化器在调用时执行，原 owner 分区却只遍历函数体。生成函数被错误地放在模块作用域，而默认参数引用的调度器只存在于组件 owner 内。合法公开入口调用 `wait()` 后，四个 DOM source profile 都实际抛出未定义调度器的 `ReferenceError`。

修复让参数默认表达式参与原有 operation/reference 依赖分析及传递闭包。它没有把所有 helper 都改成 owner 存储：仅含 `value = 7` 的普通 helper 仍共享。消费者分别覆盖直接默认值、默认值中的 helper 调用、默认 helper 引用、显式参数跳过默认求值、`undefined` 触发默认求值，以及终止后的调用保护。

依据是 `C-DELAY-0001-B/G/H/I` 的调用上下文与生命周期边界，以及 `internal/compiler/atomic-lowering-completion.md` 的 reached support 原则。前者仍为 draft；此次代码证据不构成生命周期提升。

### 结构字段清单没有封闭运行时键集合

[#1462 的动态索引审查](https://github.com/Proto-UI/Proto-UI/pull/1462#discussion_r4586602519) 指出：参数类型 `{ n: number }` 仍可接收带额外数据字段的对象。因此 `box[key]` 在 `key: string` 时，不能只根据已知字段推断成 `number | undefined`。原实现错误接受 `(box[key] ?? 0) + 1`；独立 portable IR 校验也接受同样伪造的窄类型。

源码前端和 IR 校验现在都保留 `unknown`，只有显式运行时 guard 才能取得数字操作资格。已有数字数组索引、静态属性以及实际支持的 `unknown` internal-store 索引路径保持原准入边界。四个生成消费者传入真正动态的字符串键，在作者代码内部使用 `{ n: 2, extra: 'text' }` 和 `{ n: 2, extra: 4 }` 的宽结构对象，验证 `typeof` guard 分别得到 0 和 5。

初期测试曾使用本就不支持的源码数字 index signature/`Record` 语法，或者让未检查的 `unknown` 穿过公开返回边界；这些是夹具问题，原失败保留，生产准入没有为它们放宽。Vue 的公开数据校验会拒绝额外入参字段，所以最终消费者在作者代码内部构造宽结构对象，对外只接收 `key: string`。这一修正保留了待验证的真实结构子类型路径。

### 可变公开记录必须先建立调用边界

[#1462 的 Expose 审查](https://github.com/Proto-UI/Proto-UI/pull/1462#discussion_r4586602507) 指出：最初不含函数的可变对象会原样返回，之后作者给它安装方法时，旧公开引用即可取得未经过 callback scope 和 terminal guard 的原函数。

Adapter reader 现在在首次读取时就为可变普通记录和数组建立稳定投影。显式 read 或公开返回值边界负责刷新；这不是自动订阅或 reactive update。冻结父容器中的可变子项、循环引用及冻结 accessor 也参与判断。真正不可变、无 callable/accessor 的图保持原身份，真实 ContextKey 和 presentation owner token 的已有集成控制继续通过。opaque host values 保持原处理范围。

适用定义包括 draft `C-EXPOSE-0006-C/D`、`C-EXPOSE-0008-B/C/D`、`C-EXPOSE-0004-E` 与 `C-COMPILER-OBSERVABLES-0001-LIFETIME`。它们分别约束非 JSON outward value、可变值的变化语义、owner lifetime、registry 隔离及 nominal identity。

## 独立审查中的两次修复

| Finding | 真实观察 | 修复与负控制 |
| --- | --- | --- |
| `B-EXPOSE-001`，P2 | 初版新投影遗漏 nested symbol/nonenumerable 成员；冻结 `Symbol.iterator` 对象失去迭代能力。新增五项运行结果为 21 pass / 5 fail。 | nested value 保留完整 own `PropertyKey` 和 enumerability，callable 仍进入 owner scope；刷新清理全部 own keys，数组 `length` 单独处理。覆盖隐藏/符号方法替换删除、数组自定义键、迭代性及保存方法在 dispose 后拒绝。 |
| `B-EXPOSE-002`，P2 | 将 registry 过滤仅绑定本次 read 后，已知 registry 经公开方法直接或嵌套返回时重新暴露内部协调项与 branded event declaration。新增四项为 26 pass / 4 fail。 | 用 owner 内的 WeakSet 保留 raw registry、cached projection 和 read 返回外层 copy 的分类；跨 replacement 保留旧 registry 身份。外层 copy 补充控制也曾实际失败，随后全文件组统一通过。普通作者 nested 同名前缀成员仍可用。 |

第二条过滤要求还来自 draft `M-EXPOSE-STATE-0001`：translation record 中的 branded outward-signal descriptor 在 Adapter 翻译后必须从 App Maker record 删除。记录角色由同 owner 已知对象的身份决定，不依据任意普通对象的字段拼写推断它是内部 registry。

输出继续采用既有的显式 snapshot 模型：每个 accessor 在 read/result 边界取值一次，投影使用可刷新数据 descriptor。此次保留 own key 和 enumerability，没有把它改成 live getter、完整 readonly/nonconfigurable descriptor 镜像或通用对象膜。

**兼容性变化需要明确保留：可变 data-only value 现在拥有公开投影身份。** 同 owner 的重复公开读取、返回及 echo 保持该身份，纯内部对象比较与冻结 nominal identity 保持；但把公开投影传回一个方法，再与闭包内 raw 原对象作严格 `===` 比较，可能从 true 变为 false。独立探针实际观察到了这个变化。原 callable-record 投影已经存在相同区分；现有定义和测试没有建立任意 mutable public-to-raw 身份往返承诺。本文记录实际变化，不将 mutable-value 的开放边界解释为所有兼容性变化都无风险。

## 最终执行证据

| 检查 | 最终实际结果 | 证据范围 |
| --- | --- | --- |
| 完整原 11 文件 affected 组 | 105 passed / 0 failed / 0 pending，41.87 秒 | 四个 DOM source consumer、默认参数与 helper 闭包、结构类型、表达式类型、authored Transition、公开记录与真实 React nominal controls |
| 公开边界四文件组 | 52 passed / 0 failed / 0 pending | base reader 31、React 5、legacy runtime consumer 7、四 DOM public roundtrip 9；与上组有重叠 |
| Scoped TypeScript | 9 roots，492 Program files，194 本树源码，foreign 0，0 diagnostics | 完整保留这些入口的传递依赖；6.647 秒，最大 RSS 555,040 KiB；不是完整 workspace `check:types` |
| 文件纪律 | 源码/测试 Prettier 与 `git diff --check` 通过 | 九路径内容指纹与最终类型入口绑定；可恢复 patch 单独记录 hash |
| 独立本地源复审 | `B-EXPOSE-001/002` resolved，无剩余 bounded source/test finding | fresh reviewer 独立运行内存探针并读取实际日志；不是 GitHub formal approval |

两个最终组按文件与完整用例名去重，共覆盖 121 个通过用例；这不是把两个执行伪装成一次命令。较早的 40/40、95 项中 94/1，以及修正后单文件 4/4 均保留为历史执行，不替换最终完整组。一次只选择外层 registry-copy 反例的红色运行含 1 failed、30 unselected；最终两组都没有 pending。

执行环境为 Node `24.22.1`、pnpm `10.32.1`、TypeScript `5.9.3`。依赖在独立工作树中 offline/frozen 安装，557 reused、0 downloads。测试始终使用一个 worker、禁用 file parallelism，单进程 heap 上限 1536 MiB。原有 esbuild `ES2024` target warnings 完整保留。

## 剩余交付与来源

当前源码没有新增 native/browser 执行。旧 Box main 因 wallet empty 无法读取，旧 scratch 已消失；协调者在本地的正常 Chromium 探针于 socket `EPERM` 阶段受阻，页面执行为 0。历史 97 项浏览器、Dart、GPUI 或当前 main 的 hosted CI 都保持原 SHA 归属。完整 workspace types、当前候选 official packed consumer、GPUI/Dart/Qt/Flutter native、合并后的组合/browser acceptance 仍需各自执行，不能由本次 HappyDOM 和 scoped Program 替代。

本 worker 完成源码、回归、独立复审响应与工程记录，没有提交或外部写入。协调者后续将真实新 head、DCO/CI、正式独立 review、PR/merge 和 criterion tracking readback 绑定到交付。已合并的 #1462 及先前历史记录保持原样。

实现与验证由 OpenAI 编码代理在当前用户明确授权下完成，输入来自本仓库源码、定义和锁定依赖。没有组件名/路径特判，没有放宽 `unknown`、删除原断言或修改他人贡献来源；审查发现、原始失败和未执行边界均保留。
