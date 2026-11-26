# Sprint 6：Bootstrap 编辑会话与组合输入证据补全

本轮按当前用户补完 Sprint 6 的指示，为 #799 / #1148 补充 Bootstrap Input、Textarea 的可执行接受路径。基线为 `34cbf089c3e5ff638a27372ab973b54fd364b54b`，关联原 PR #1712。这里记录已实施的证据增量，真实浏览器终态需绑定发布后的具体 SHA。

## 责任与预期

依据 draft `C-TEXT-CONTROL-0001-B/C/D/E/G`，四 Web Adapter 必须保持一个原生编辑器、稳定的 controlled/uncontrolled owner，以及原生选区和组合输入会话。普通属性更新不能重置 dirty uncontrolled 值、抢回尚未结束的 controlled composition，也不能额外生成输入 proposal。该记录不改变契约生命周期。

原 15 条浏览器旅程完整保留，并补充 defaultValue、placeholder、name、required 的往返、受控同值同步、实际 ElementHandle 身份和键盘建立的选区。新增 16 条独立 composition 旅程，覆盖 WC / React / Vue 3 / Vue 2 × Input / Textarea × controlled / uncontrolled。

每条 composition 旅程在同一个 Chromium 上先运行独立裸编辑器，再运行 Proto 控件，比较真实 CDP composition 与 input 序列。实际脚本派发的 compositionend 作为负控；不会把浏览器观察到的 untrusted end 改写为 trusted。CDP 结果只证明该浏览器输入路径，不代替物理 OS IME 或读屏验证。

## 严格收据与本地结果

收据要求原 15 条与新增 16 条全部出现且通过，共 31 条浏览器旅程。选中 suite 从 4 个增加到 5 个，包含共享 composition oracle。旧 15/15 收据、任一组合缺失、失败、跳过、重复、run/attempt 或源码漂移都会被拒绝。原 SHA/环境守卫、用例时限和其他工作流步骤保持。

| 验证 | 实际结果 | 范围 |
| --- | --- | --- |
| Node fixture / source / receipt guards | 50/50，零失败、零跳过 | 包含拒绝旧 15 条收据及每个缺失组合的负控 |
| 四个 Vitest support / Prototype suite | 52/52，零失败、零跳过 | Input oracle 9、composition oracle 24、disabled paint 10、Bootstrap controls 9 |
| 变更 browser test 的严格 TypeScript 依赖图 | exit 0 | 非 workspace 全量检查 |
| Prettier / diff 检查 | 通过 | 五个变更文件 |

工具链为 Node 24.22.3、pnpm 10.32.1、冻结 lockfile。原始日志和结果保存在同名证据目录的归档中，manifest 保留逐文件 SHA-256。源码独立审查未发现 Bootstrap 补充的阻断问题；这不是 GitHub APPROVED review。

## 仍须真实执行

- [ ] 发布后在实际 GitHub Actions 上运行 `bootstrap-state-controls-evidence.yml`，取得 31 条浏览器和 52 条支持测试的完整结果、截图及严格收据。
- [ ] 亲自检查这次组件截图，并接受同版本 Navbar、motion 和清理结果。
- [ ] 物理 OS IME、真实 AT、Compiler / non-Web，以及 #799 / #1148 其余原条件继续独立接受。

本地 50/50 和 52/52 不计作新增 31 条浏览器通过，不关闭原 Issue，也不替代原 Sprint 6 的全库或物理目标。
