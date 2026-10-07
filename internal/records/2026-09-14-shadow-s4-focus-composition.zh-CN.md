# S4：Focus 组合修复与 L1 内部采样决定

日期：2026-09-14；non-normative。按用户 S4 同规模决策授权独立采用 L1，不新增原型作者 API，不提升 draft。

真实 Chrome 完整组合先后暴露两类问题：Scope 原先包含 `navParticipation:none` 的 Tabs Trigger，且仅枚举注册的 logical focusable，遗漏 Details 原生按钮、空面板 entry fallback，并可能请求隐藏 view 内的旧 target。另一个独立问题是遮罩 pointerdown 触发同步关闭后，浏览器默认聚焦动作覆盖已恢复的 Trigger。

L1 采用可选内部 `FOCUS_SAMPLE_SCOPE_TARGETS_CAP`：WC 采样当前 scope 的 open composed subtree 中可 Tab targets 与实际焦点；Focus 继续拥有 top active gate、方向、loop、默认动作阻止与 focus request。无能力的宿主保留 logical fallback，但统一尊重 navParticipation。采样不拥有 open，不伪造 focus facts，不安装第二套页面键盘处理。

范围限于当前 WC 同 document/open Shadow 配置；不据此声明 closed tree、跨 document、嵌套 modal、任意 portal target 或 native-control Adapter 准入。候选结构在每次 Tab 时重新采样，不缓存列表；Focus 仅记住最近顺序 target 供失焦后恢复，并在 scope deactivate、view detach、instance dispose 清除。不新增 observer/listener lifetime。Mask 只阻止参与遮挡时的默认聚焦，不拥有 dismissal；passthrough 保留。

证据计划：FocusCenter 顺序/roving 区分、WC composed target 采样与资源边界、Mask 取消默认动作/不关闭/passthrough，以及公开完整 Dialog 的 Details/Empty/设置控件、双向循环、所有关闭入口与真实 AX。失败不转为页面补丁，结果在后续交付记录中记录。

## 本节点结果

- FocusCenter 新例先失败后通过；Mask 的取消默认动作/不拥有 open/passthrough 与 WC 新采样测试通过。既有 Mask 旧 companion 测试改用正式 Adapter 在 open 父节点内激活，仍精确拒绝缺少 I1 recipe，并清空失败 owner 的 Shadow 资源。
- WC 全套 + Focus/Runtime + Base Dialog + catalog evidence integrity：86 文件、366 测试通过；workspace types、workspace 数据生成、Agent snapshot/check 通过。
- 正在开发的 S4 完整公开 dist 消费在 Chrome 152.0.7977.83 三种 profile 通过；真实中英文 demo-matrix 两条路径亦通过。完整 scene 和 journey 在后续交付节点提交；此处不宣称用户已验收。
