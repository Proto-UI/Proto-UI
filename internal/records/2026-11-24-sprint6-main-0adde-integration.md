# Sprint 6：保留当前主线修复的整合

按当前用户继续补完 Sprint 6 的指示，把原分支 `24e553961e7a898b74b959792d35f49364f35efc` 与冻结主线 `0adde15d1e5dacb112cdad4d8d7811e015cc4456` 合并。共同祖先为 `457d27f7fe554f398970a836ee9c95edb4846f47`。这是原 PR #1712 的来源整合，不重写既有提交或证据。

## 冲突决定与保留的实现

唯一内容冲突是 `spec/host-caps/HC-CONTROL-LABEL-0001.yaml`。S6 的临时修正把两个原有 GPUI 条件合在同一 criterion 中；主线 #1748 已为 provider 条件建立独立的 `HC-CONTROL-LABEL-0001-GPUI-PROVIDER` ID，并同步测试定义引用。本次完整保留主线文件，两个原语义段均在，没有删除条件或复制重复 ID。

保留主线已合并的 SVG schema/validator 去重、CLI helper 的 setup capability 保真、installed Select 观测、GPUI scroll_reader producer 修复、调度边界及原来源档案。Compiler 改动由原主线作者提交，本次没有接管或另改其实现。主线对历史 JSON/记录的格式变化按其真实提交保留；本次新增证据另行归档，不把格式变化当成重跑的结果。

## 此组合实际验证

- SVG primitives、owned template 与选中的 spec graph/schema 共 **11 文件、99/99**，零失败、零 pending。
- 公开 TypeScript 契约检查 exit 0。
- 合并冲突已清零，source diff 检查通过。

原始日志、Vitest JSON 和逐文件来源清单保存在同名证据目录。此处没有声称 workspace/网站/包体或所有原生旅程已在合并树通过；最终源码冻结后分别执行适用门禁。

Bootstrap 原生工作流 `45248165760` 绑定 `8f6bc70ccef54d0f513d2fc11d3ea83f6af603a5`；Liquid clean-source 配对 `45249737653` 绑定 baseline `457d27f7fe554f398970a836ee9c95edb4846f47` 与 candidate `24e553961e7a898b74b959792d35f49364f35efc`。这些回执不会重标为此合并后的提交。原七项 Issue 的物理输入、AT、光学、全库和跨目标条件仍按各自来源接受。
