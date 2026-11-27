# 官网首章的概念核对与读者引导调整

日期：2026-09-08

## 背景与基线

维护者已上线白皮书，正在收集组织内外反馈，本次要求检查官网首章的概念时效与读者引导。检查基线为 `fe45855973d4f0f5ad48f6c79ce11b70bfb5a768`，范围是 `apps/www/src/content/docs/{zh-cn,en}/start-here/` 四页及对应 sidebar。

本文记录一次本地编辑与其理由，不改变白皮书、Spec lifecycle、支持范围或发布承诺。它也不是已收到的读者反馈报告。

## 发现与处理

| 原有问题 | 核对依据 | 本次处理 |
| --- | --- | --- |
| 首页文档入口名为“你刚刚看到的是什么？”，正文默认读者来自 Demo | Header、PageFrame 与两种语言首页都指向 `start-here/what-you-saw` | 改为“认识 Proto UI”，先交代项目与术语，再提供可选 Demo 和阅读分流；保留 URL |
| “交互行为保持完全一致”把局部演示扩大为无条件结论 | 已发布白皮书第六章；`D-ADAPTER-PROFILE-0001-C/E` | 改为具体观察任务，说明 Web-family 范围与进一步比较所需的条件 |
| “每一次切换都会重新加载运行时环境”混淆模块加载与实例重建 | `apps/www/src/components/PrototypePreviewer/home-demo-client.ts` 的 `renderCurrent`；`runtimes/registry.ts` | 描述旧示例销毁、新实例挂载，不承诺模块每次重新加载或保留状态 |
| 现有方案“只在实现层复用”低估 Headless 库的语义积累 | 已发布白皮书序章 | 承认状态、键盘与无障碍复用，准确指出技术边界 |
| “扩展成本接近线性”“更快补齐生态”缺少适用条件和测量证据 | `D-ADAPTER-PROFILE-0001-B/C/D`；白皮书第五章 | 改为待场景验证的收益，明确组合支持与验证成本 |
| “接下来几个月”成为没有日期和依据的长期路线承诺 | 旧 Why 页；白皮书第七章的演进讨论 | 删除预测，以现有版本和一次真实接入作为评估起点 |
| Prototype 被简化为已抽离完成的宿主无关部分，Adapter 被描述为任意决定 API | `K-COMPONENT-INTERACTION-0001`；白皮书第一、五章 | 说明当前可执行近似、必要义务和 Host API 映射的边界 |
| 英文 Why 页的两条继续链接跳到中文 | 原英文 `why-proto-ui.mdx` | 保持英文阅读路径 |
| Quick Start 提供命令但未明确第一次完成的可观察结果 | 原中英文 `quick-start.mdx` | 增补首个 Button 的渲染、样式与键盘检查；保留安装流程 |

## 章节分工

1. **认识 Proto UI**：让直接访问的读者知道这是什么、现在可以看什么、下一步去哪。
2. **为什么关注 Proto UI**：围绕重复维护的真实成本，帮助判断是否值得试用。
3. **它是怎么工作的？**：用 Switch 说明 Prototype、Adapter 和应用的分工，简述 Runtime / Module / Host Capability 的位置。
4. **快速开始**：在已有应用中完成一次具体接入，并知道怎样检查结果。

前三页压缩重复动机与“下一步”往返。白皮书承接完整论证，不要求应用开发者先完成理论阅读。沿用既有四页顺序、slug 和安装示例，同时同步中英文标题与 sidebar。

## 来源与证据边界

- `spec/knowledge/K-COMPONENT-INTERACTION-0001.yaml`、`spec/knowledge/K-INFORMATION-CHANNEL-0001.yaml` 与 `spec/contracts/C-CORE-CHANNEL-0001.yaml` 是自 `0.1.0` 编目的 draft；概念说明不把它们晋升为稳定保证。
- `spec/decisions/D-ADAPTER-PROFILE-0001.yaml` 是 active，初始编目版本为 `0.2.0-rc.7`，当前 revision 包含 Vue 2 profile。它要求显式支持与证据，不能推出所有组合均支持。
- 工程链示例：`A-REACT-18-19-0001` → `M-PROPS-0001` / `HC-PROPS-SOURCE-0001` → `T-PROPS-0012`，对应 `packages/adapters/react/src/runtime/modules.ts` 与 profile 所列 contract tests。此链支持分工解释，不充当完整跨宿主一致性证明。
- `spec/versions/V-PROTO-UI-0008.yaml` 保存 `0.2.0` 已发布证据；`V-PROTO-UI-0009` 仍为 draft。网站当前 runtime registry 包含 `vue2`，不据此改写 `0.2.0` 安装支持。
- 当前白皮书正文位于 `apps/www/src/content/docs/{zh-cn,en}/whitepaper/`；`2026-08-28-whitepaper-rewrite-maintainer-decisions.zh-CN.md` 和 `2026-09-03-whitepaper-full-initial-draft-checkpoint.zh-CN.md` 用于理解历史方向，不能把其中“尚未发布”的历史状态当成当前状态。
- `internal/contracts/prototype-base/README.md` 仅作组件契约与共享语义契约分工的解释性补充。

## 验证与后续观察

验证范围为 agent operations、agent documentation、public docs 检查、官网生产构建、修改页的本地链接和 locale 对照；不因文案变更重跑完整 runtime suite，也不把本文当作新的 Adapter 符合性报告。

后续可在实际反馈中观察：新读者是否能说清 Prototype 与可用组件的关系，是否能找到适合自己的入口，以及完成 Quick Start 后是否知道如何评估一个真实组件。若仍有断点，再根据反馈调整；本次结构改写尚未经读者实测。

## 同日维护者反馈后的修订

首轮预览后，维护者指出“它是怎么工作的？”仍然过于抽象。最终版本回到 `Prototype + Adapter` 的简单模型，用 Switch 行为和各框架的组件映射解释分工；Runtime、Module、Host Capability、可执行近似与严格一致性讨论不再作为该页的入门负担，深入阅读转到白皮书第五、六章。这更新了上文首轮章节分工中的详细程度。

Quick Start 的“下一步”也根据反馈改为表格，直接引导到 Shadcn、Base、Brutalist、Lucide 和白皮书序章，移除返回首章其他文章的正文链接。

预览同时暴露两个既有样式问题：表格外框为 672px，内部行却仅约 429px；正文链接的 computed `text-decoration-line` 为 `none`。本轮修复让 Markdown 表格保留原生 table 布局，由 rehype 添加外层滚动容器，并给正文链接添加常驻下划线与 hover/focus 加粗。修复后桌面表格外框/行为 672/670px，手机为 326/324px，差值为边框；中英文、明暗主题和 1440/390px 宽度均通过浏览器检查，没有页面横向溢出，分页控件未添加下划线。桌面与手机截图已作目视检查。

本次样式修改位于 `apps/www/src/styles/markdown.css`、`apps/www/src/utils/rehype-scrollable-tables.ts` 与 `apps/www/astro.config.mjs`，不修改 Prototype 行为。
