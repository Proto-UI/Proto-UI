# Brutalist Dialog：标题与 CloseIcon 的组合留白

## 实际观察

PR #872 的 source / probe `cb8807672c2cdbb426cbc7cd99354b48953c68b3`、native run `37604289132` 的八条 Dialog journey 通过，但原始 PNG 显示黄色 CloseIcon 覆盖标题。本轮直接检查了以下两张原图，并核对 artifact 中的 SHA-256：

- `brutalist-wc-long-font200.png`：390×360、根字号 200%，`7c2b9fa3ae534887c6e5a76fd4e140172fec8f978b266c5ff792979fe476ab67`
- `brutalist-react-scale2.png`：430×900、CDP page scale 2，`b7ee09e72e30b2f01f06a864a8181230915e344d3ab1834f6e6da15d67b89c76`

该 candidate 元数据记录 Chromium `154.0.8037.57`。历史 baseline 与 candidate 的浏览器版本不同，本轮不声称历史逐像素一致性。既有 viewport bounds、scroll、hit 和 focus 断言没有测量标题遮挡，因此原先的通过结果不足以否定这一视觉缺陷。

## Owner 与修复

- draft `P-BRUTALIST-DIALOG-CONTENT` 保留自己的 `p-6`、居中和可用区域上限。
- draft `P-BRUTALIST-DIALOG-CLOSE-ICON` 保留 `absolute right-4 top-4 size-9`、黄色控制表面和 Base close 行为。
- draft `P-BRUTALIST-DIALOG-HEADER` 是可选的无交互布局部件。消费层显式组合 Header 和 CloseIcon；两者的避让属于这份组合的外层布局，遵循 `C-PROTOTYPE-STYLE-CLOSURE-0001` 的消费层边界。

`demo-brutalist-dialog.demo.ts` 为 Header 增加普通 `box`，只携带 `min-w-0 pt-10`。Content 的 1.5rem 内边距加该盒的 2.5rem 顶部留白，让标题从 4rem 开始，越过 CloseIcon 的 1rem 顶部 inset + 2.25rem 高度，并留下 0.75rem 间隙。留白随字号缩放；标题仍占完整正文宽度，不采用窄屏侧边挤压。

没有改写 Prototype 默认几何、固定 panel 高度、隐藏或截断标题、缩小 CloseIcon、添加交互 owner 或页面全局修补选择器。Footer 的 Close > Button 关系、DOM 控制顺序、Title/Description 关系均保留。

## 验证与未完成项

- 新增 `demo-brutalist-dialog.test.ts`，先在原组合上出现预期 red：缺少被动预留盒；原文案和两种 Close 组合控制通过。修复后两条都通过。
- focused Vitest 共 27/27：Base Dialog 16、Brutalist Dialog 6、既有 Brutalist demo 3、新增组合 2。
- demo renderer / narrow-layout 7/7。
- workspace + docs `check:types` 通过，530 files、0 errors、7 hints；对这三份修改文件的 scoped TypeScript 也通过。
- `dialog-available-space.browser.test.ts` 在每份 settled viewport、200% 字号及 scale2 截图之后，记录标题 box、实际文本 Range、CloseIcon rect、可见性和交叠面积，再严格要求交叠为 0。四个 Adapter 均进入同一断言；所有旧阈值、长文、scale/restore、Shadcn 320px cases、pointer/focus/keyboard journey 保留。
- 本机 native Chromium 的既有 Unix socket 拒绝没有重试或绕过。因此新布局的四 Adapter 原生几何、实际 PNG 和输入回归仍等待最终发布 source 的官方 CI；本轮的 source/type 通过不冒充 native 修复完成。

下一步：把增量补丁集成到最终 source，在官方 Dialog native journey 执行新断言，核对该 source 的观测元数据、原图及交互结果后再结清视觉证据。
