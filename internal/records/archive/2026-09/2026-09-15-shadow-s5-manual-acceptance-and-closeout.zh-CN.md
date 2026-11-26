# Shadow split S5：人工验收完成与收尾建议

## 已确认的阶段状态

2026-09-15，用户在公共事件路由性能修复 `f26ad152` 之后反馈：“验收完成，未发现问题。S5 可以标记为完成了。”据此，S5 的已批准目标及修复后人工复验标记为完成。

本记录更新以下记录中的“待人工验收”状态，保留原记录作为当时交付事实，不回写历史：

- [S5 批准目标](./2026-09-14-shadow-s5-approved-goal.zh-CN.md)
- [S5 交付与人工验收入口](./2026-09-14-shadow-s5-delivery-and-manual-acceptance.zh-CN.md)
- [S5 公共 Web 事件路由性能修复](./2026-09-14-shadow-s5-event-routing-performance.zh-CN.md)

本次反馈没有逐项指定浏览器、操作系统或真实 IME 的测试矩阵。因此它是阶段人工验收结论，不新增 Safari / Firefox 全覆盖、系统 IME 全兼容或稳定帧率的证据。先前自动测试和性能采样结果仍以对应记录为准；本次仅更新记录，没有重跑行为测试。

## 能力定位不变

`D-WEB-COMPONENT-SHADOW-PROFILE-0001` 及相关 split 语义保持 draft。当前交付是同一 `AdaptToWebComponent` 上显式启用的实验性 split profile，不替换 Light 或既有 boolean direct Shadow profile，也不因阶段验收而自动发布或提升稳定性。

S1–S5 已积累正式生成产物、Light / split / mixed 场景及浏览器回归，覆盖基础样式与交互、Button / Switch、Tabs、限定 Dialog / Portal 组合，以及 Base Input、Base Textarea、Shadcn Textarea 原生文本编辑器。S5 还纳入公共 Web 事件路由性能修复。这些是已治理、已验证的具体范围，不代表任意原型和任意 CSS 都能自动迁移。

保留的边界包括：host / 继承 / consumer slot 不完全隔离；生成式 sizing recipe 不扩展为任意 raw CSS 等价；原生尺寸 token 仍仅准入 `w-full`、`min-h-16`；不新增 Image View、Form、富文本、closed Shadow、跨 document 或通用跨 Shadow IDREF 保证。Dialog 快速重开 mask 失效按既有记录独立归属 #645，不作为本分支已修复事项；本次未查询该 Issue 的实时状态。

## 下一步建议，尚非新阶段授权

当前没有已批准且必须先完成的 S6。建议结束初次能力建设，进入 PR 收尾，以“有明确边界、纳入回归和后续维护的实验性支持”为合入定位，而不是继续扩大原型准入后才允许审阅。

PR 准备应先完成：

1. 对照最新目标分支审计提交与差异范围，排除工作区中无关的暂存及未提交改动，处理真实集成问题；不能用本地缓存的 base 推断远端无冲突。
2. 将累积的阶段说明整理为当前能力、启用方式、兼容性、已知限制与验证入口；历史 Records 继续保留，不再要求读者依次理解内部决策编号。
3. 在待提交的准确版本上完成相称回归、独立审阅及 CI，明确基线失败和未覆盖项；现有局部验证不等于全仓测试全绿。

更多原型和尺寸 recipe、跨树 a11y、复杂 Portal 场景及进一步性能改进，可以在明确范围后独立迭代，不自动成为本次合入前置。若 PR 审阅发现已承诺范围内的缺陷，仍应在合入前处理，不能以“后续维护”为由移出验收边界。

本记录仅补记人工验收并提出收尾路线，没有创建 PR、push、merge、发布或修改 spec lifecycle。
