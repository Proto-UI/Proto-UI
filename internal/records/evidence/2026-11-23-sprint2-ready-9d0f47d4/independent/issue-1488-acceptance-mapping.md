# Issue #1488：B/C/D 原条件的最终回填映射

## 证据绑定与结论边界

- 产品提交：`9d0f47d4ef67bbc3676e4db24c7906f8721e5b42`；tree：`0c9d31e5bb05d3af79932ec3c62a61480197f9eb`。
- 已核对 [hosted run 45188583301](https://github.com/Proto-UI/Proto-UI/actions/runs/45188583301) 的 reconciliation：site **42/42**，B8、C24、D8、Hook2，HEAD/tree 一致。
- 本文件是独立内部审查形成的条件映射，**不宣告本轮 Tabs13 或独立 9d 视觉验收已经通过**，也不构成 GitHub APPROVE 或 canonical review packet。
- 原条件按 Issue 原文解释；回填须使用最新 Issue 快照，保留并行更新和历史失败。

## 原 checkbox 映射

| 原 key 与条件 | 已有证据 | 尚须满足的条件 | 回填结论 |
| --- | --- | --- | --- |
| **B1**：两语言静态对比文案准确 | EN/ZH 明确区分静态外观对比与实际同实例切换演示；未将 authored profile 覆盖写成完整视觉验收。 | 无新增条件。 | 可以勾原框。 |
| **B2**：同实例切换保留 selected、focus、child identity | 9d B8 实际通过，两语言 × 四宿主；快捷键切换逐次检查 selected、原 Tab 焦点、原 firstChild、panel 节点及连接状态。文案说明点击切换按钮产生正常浏览器焦点转移。 | 无新增条件；不把正常按钮焦点转移误判为实例重建。 | 可以勾原框。 |
| **B3**：最终源码绑定的运行证据、文档宿主及 unsupported | site B8 已通过；原 Tabs13 覆盖四宿主真实 Code 示例、四宿主 unsupported-profile 及相关 profile 规则。 | 本轮 9d 原 Tabs13 实际 **13/13**，包括真实 Code 与 unsupported；不能用 site B8 或历史 1450 结果替代。 | 条件实际完成后可以勾原框；此前保持未勾。 |
| **C1**：家族内 group/leaf 几何一致，涵盖 SSR/no-JS/failed/enhanced | C24 实际通过，覆盖 Shadcn/Brutalist、桌面 enhanced/阻断脚本 fallback、移动 enhanced/no-JS。 | 9d 独立视觉报告确认对应实际画面；no-JS 的实际 SSR dark 应如实记录，不能写成所请求的 light。 | 视觉条件完成后可以勾原框。 |
| **C2**：hover/current/focus、披露、层级、嵌套长标签及移动原生目标 | C24 检查原生 disclosure 键盘开合、current 保留、focus、全宽与四点命中、桌面/移动目标及原生滚动。 | 9d 视觉确认实际嵌套、换行长标签及层级呈现。原条件不要求任意标签全集。 | 视觉条件完成后可以勾原框。 |
| **C3**：各自家族外观，避免将 Shadcn 圆角套给 Brutalist | 实际断言区分两家族，Brutalist 明确检查四角 **5px**。 | 9d 视觉确认两家族各自边框、圆角及外观。 | 视觉条件完成后可以勾原框。 |
| **C4**：修复版本绑定的截图及 computed geometry | 已有 9d 最终捕获、捕获 JSON 与几何证据；site42 已实际通过。 | 完成并链接最终 9d 视觉报告：变化图实际审阅，沿用的未变图逐图哈希关联；1450 报告单独不能替代新头证据。 | 条件完成后可以勾原框。 |
| **D1**：Hero pill 有意设计，避免普通文本下划线 | Hero 专属 pill appearance 与局部样式；D8 检查文本节点无下划线及 hover 响应。 | 无新增条件。 | 可以勾原框。 |
| **D2**：原生导航、名称、键盘焦点及非下划线反馈 | D8 检查本地化原生 href、链接可访问名称、真实 focus-visible 与可见轮廓、hover 颜色变化，并通过 Enter 实际导航。 | 无新增条件。 | 可以勾原框。 |
| **D3**：两语言/主题 fallback+enhanced 最终图，普通文章链接保持 | D8 对应 EN/ZH × light/dark × enhanced/failed-scripts；普通文章链接的源码保留依据见下。 | 9d 独立视觉报告确认上述最终画面。无需新增完整文章链接交互矩阵。 | 视觉条件完成后可以勾原框。 |

## D3：ordinary article links 的保留依据

1. [site-native-controls.ts](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/apps/www/src/components/site-native-controls.ts#L42) 仅将 `.homepage-hero__eyebrow` 识别为 `pill`；普通 `text` 分类保留，也未新增对任意文章链接的全局选择。
2. [site-link-recipes.ts](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/apps/www/src/components/site-link-recipes.ts#L204) 中普通 `text`/`nav` 的 hover/current 下划线条件与原版本一致，普通 text 焦点规则也保留。
3. [Hero.astro](https://github.com/Proto-UI/Proto-UI/blob/9d0f47d4ef67bbc3676e4db24c7906f8721e5b42/apps/www/src/components/override/Hero.astro#L59) 的去下划线、背景、圆角及 hover/focus 样式都限定在 Hero eyebrow 内。1450→9d 网站产品源码未变。

因此，限定修改范围与原规则保留可以支持原条件中的 “keep ordinary article links unchanged”。原条件没有要求对普通文章链接另跑完整 hover/focus/keyboard 笛卡尔矩阵；不以该额外矩阵作为回填门槛。

## 条件与历史边界

- 旧 `4541dfb` 的 C23/24 FAIL 子项必须保持历史原状，不能因新 9d C24/24 通过而改勾历史失败行。最新 Issue 已有的新功能区无需重复添加。
- 视觉结论应写明实际家族、主题、脚本模式与画面范围。阻断脚本加载的 fallback 是已执行场景，不扩写成任意中途故障测试。
- 本映射不新增“任意标签全集”“任意中途故障”“完整文章链接交互矩阵”等原 Issue 未要求的 gate，也不省略原明确条件。
- 条件完成后可勾相应原框，不必永久降为 child；补充 child 可用于保留明确范围、执行链接与历史记录。
- 本映射只涉及 B/C/D，不据此关闭整个 #1488；其他原始条件仍按各自证据处理。
