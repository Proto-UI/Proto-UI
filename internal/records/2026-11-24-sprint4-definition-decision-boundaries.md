# Sprint 4 最小决定与可继续工作清单

核对revision：`d0eb81d3c61c3d3e93e46c4151e78031273d6116`。原manifest：`35110c1036f441828f060d8fbf239965a8587a99699ead6b5689268b226adb69`。

**目前没有一个已经具备完整原候选差异、必须立刻让用户二选一才能继续开发的问题。** 已有定义足以指导重建、比对、公共修复和有界私有验证；原包可访问性、原贡献认证和未执行验收不能被改写成“请全部批准61项”。原IR10最终接受仍未完成。

## 按已有authority继续

- **CORE_INTERNAL_PRIVILEGED_ATOM**：按已有内部 privileged helper 和 setup phase 边界实施。只有恢复原候选、找到准确 ABI 差异后，才判断是否需要新增 Core atom。依赖：共享 ABI → 官方 authored callers → source-bank producer → 原 frontend。
- **PUBLIC_DECLARATION_TYPE_DIFFS**：保留 observed 只读权限、borrowed 投影、实例生命周期和 Rule 现有纯函数／严格比较语义；类型声明须与其一致。这些规则要求实际实现验证，不需要重复人工选择。依赖：Core／State／Rule 定义 → declaration inputs → source-bank producer → frontend 与消费者。
- **STATIC_DATA_PUBLICATION_SCHEMA**：绑定实际 nominal publications 和各自的 effect owner。现行 CSS witness 有独立 draft 定义，且只读，不能从候选 CSS 名称推断已产生的投影。依赖：schema／publication 定义 → static inputs 与官方入口 → source-bank producer。
- **OFFICIAL_AUTHORED_SOURCE_AND_PACKAGE_ENTRIES**：恢复并核对原 22 个输入／43 个入口的字节与 exports；Compiler 忠实编译 authored behavior，组件协议继续由共享定义与组件源持有。依赖：已选共享 ABI → 官方 caller 与入口映射 → source bank → frontend。
- **EXISTING_PRIMITIVE_AND_NATIVE_BOUNDARIES**：沿用现有 Props 所有权、逻辑生命周期、回调错误优先级、host input／Focus／A11y 和 native resource 语义。在真实迁移源码上验证当前 ControlLabel／TextControl 澄清；这不激活 draft 定义。依赖：共享 primitive／host 契约 → frontend → native realization → 实际 SDK／应用消费者。
- **SSR_REQUEST_AND_BROWSER_ADOPTION**：当前已有 request-owned／zero-view-epoch 和 fresh owner／bounded data 的 draft 方向，可作为有界私有一致性验证的依据。canonical SSR 仍拒绝为 PUI4001；不再沿用“没有定义”的旧说法。依赖：普通 lifecycle ＋ 当前 request／owner draft → 绑定源码的私有消费者验证 → 独立目标准入。

## 只在确实扩大范围时需要选择

### S4-STATE-VALIDATION-SCOPE

本次是否新增要求所有旧 scalar definition/setDefault/set 都执行统一 runtime value-domain validation？

状态：真实现存未决范围；保持当前范围可继续，不是本轮所有迁移的前置人类批准。

- **A · 保留当前规则与明确未完成项（建议）**：保留现有静态非法输入拒绝、有限范围和独立number.list校验，legacy blanket-runtime validation继续独立追踪；不以私有候选顺带创设新保证。
- **B · 新增统一runtime校验要求**：先定义拒绝类型、发生时机、原值/错误优先级及兼容策略，再同步Runtime/Compiler；这是新增规范和迁移范围。

### S4-PRIVILEGED-ABI-LOCATION

只有原候选确实依赖不同privileged atom ABI时：沿用当前Hooks内部helper并适配Compiler，还是新增Core atom契约？

状态：目前缺原ABI逐字段差异，不能把旧ledger的UNRESOLVED直接当作现成需要用户签字的问题。先恢复原包比较；A属于按已有定义实施。

- **A · 沿用已定义内部helper边界（建议）**：保留官方Hooks caller/phase/trace/borrowed权限和component-business ownership，通过Compiler绑定适配；需完整差分与真实消费者验证。
- **B · 提出新的Core atom ABI**：必须先给准确接口/返回值/phase/identity/ownership差异、旧新caller和拒绝案例；由共享定义owner审查后才公开依赖层。

### S4-IR-MIGRATION-COMPATIBILITY

原IR10采用已有source recompilation＋strict schema refusal方向，还是另外承诺自动转换旧IR5产物？

状态：A已有公共兼容说明与原候选提案依据，可继续准备和验证；B才增加尚未承诺的兼容能力。原候选接受需实际执行，不能用选择A代替。

- **A · 源码完整重编与严格拒绝旧IR（建议）**：保留完整旧产物；同批更新producer/validator/emitter/API/cache/CLI/WASM/Worker/bank，精确pin消费者；完整原图与cold rebind验证。
- **B · 新增IR5→IR10自动转换**：需独立定义可转换子集、保真、拒绝、未知field、source-bank身份与失效策略；当前没有可直接接受的实现或保证。

## 需要事实或执行结果，不是批准选项

- **S4-ORIGINAL-CONTRIBUTION-FACTS**：需要与精确 captured source 库存绑定的原作者、提交权和真实贡献认证。持有归档、hash 一致、本轮 agent sign-off 或普通批准都不能证明其他人的原贡献事实。下一步：恢复保留的来源记录，将每个原贡献者的实际认证绑定到对应源变更；当前 agent 只签署自己新写的工作。
- **S4-PACKET-ACCESS**：需要授权执行器能够读取的原认证 packet 和 pinned installed-input manifest。这是缺少输入，不是产品方向选择，也不授予绕过设备根目录的权限。下一步：在允许根目录内定位或取得明确提供的精确副本；先核验固定身份再物化，不补造 node_modules。
- **S4-SSR-ADMISSION**：需要按已有 draft 执行、绑定实际源码的独立 request／owner 消费者证据和目标准入。当前方向已有记录；用户选择方向不产生验收结果。下一步：与 #895／#896 对齐，在真实准入证据被接受前继续保留 PUI4001。

## 准确定义绑定

以下全部绑定同一public revision。原hash只有先前明确same-byte的条目可据旧记录推导；其余是未知，未读到原packet前不补造。新增两条request/owner定义补充当前依赖，不替换原61项历史分母。

| ID | lifecycle / since | 当前 SHA-256 | 原 SHA-256 来源 |
| --- | --- | --- | --- |
| `C-AS-HOOK-PRIVILEGED-0001` | draft / 0.1.0 | `9efbe3f153f842f1808174beba4a8a7753061e6615d3d2f7337b506efa2b68d4` | 未单独公开，待原包 |
| `D-AS-HOOK-PRIVILEGED-DEFINE-0001` | draft / 0.1.0 | `3b0ad43189bb0e6eec0bab8f9776721c5185fa4ad518bb986860f5782131366e` | 未单独公开，待原包 |
| `C-AS-HOOK-0007` | draft / 0.1.0 | `f0de1904739cb5ca08931a8a038414d873f59c12d5db3f676ae07d78d8759dd4` | 未单独公开，待原包 |
| `C-CORE-SYNTAX-0007` | draft / 0.1.0 | `a9c1280b301f7cea647320528585c8d8f78bf1cef45e1a9c0cf29f1ab3331d96` | 由先前same-byte记录推导：`a9c1280b301f7cea647320528585c8d8f78bf1cef45e1a9c0cf29f1ab3331d96` |
| `C-STATE-0012` | draft / 0.1.0 | `cee5db1a6aff4b0fba31a0ba424ae3b345de36723100aa2aa1f4b989a1942480` | 由先前same-byte记录推导：`cee5db1a6aff4b0fba31a0ba424ae3b345de36723100aa2aa1f4b989a1942480` |
| `C-RULE-WHEN-0001` | draft / 0.1.0 | `0cac436d696d48a9b0c73ebee38604c514ad0629994bd6fa37f62fed1fa93776` | 未单独公开，待原包 |
| `C-STATE-0006` | draft / 0.1.0 | `a3017b6857e1d369780e9dbb65908fa3be34df3e8fc72cb2a5cf1f36c87bb923` | 由先前same-byte记录推导：`a3017b6857e1d369780e9dbb65908fa3be34df3e8fc72cb2a5cf1f36c87bb923` |
| `D-STATE-VALIDATION-0001` | draft / 0.1.0 | `862e997d3d2558ab024394e5fc101988ff3d2f1ef91bb72973168d8f09f875d5` | 现行补充定义，不在原61项 |
| `HC-HIT-PARTICIPATION-0001` | draft / 0.3.0-alpha.0 | `ccc2ca0aaa53a3825fd23a63acb6b68a1c28bc88354c82706fb8fa0325c891f5` | 未单独公开，待原包 |
| `M-EXPOSE-STATE-WEB-0001` | draft / 0.3.0-alpha.0 | `d9196e61cd3c8020beffb854495000eb36d5d07e7617c316cf5241e6f8bcb860` | 未单独公开，待原包 |
| `M-TABLE-STRUCTURE-0001` | draft / 0.3.0-alpha.1 | `2f08c788d428eb13e083d28db28e17af37c1d03f7a2dcc399fc473ebf4feb755` | 未单独公开，待原包 |
| `C-MODULE-DECLARATION-0001` | draft / 0.2.0-rc.7 | `7d583321104793f4383476f4f283357213a1133bc5c8e1c1f140ad6cdc2b1a8e` | 由先前same-byte记录推导：`7d583321104793f4383476f4f283357213a1133bc5c8e1c1f140ad6cdc2b1a8e` |
| `C-CONTROL-LABEL-0001` | draft / 0.3.0-alpha.1 | `42f914d2f05f338df79e094a3b8cd6d9ade90d29f0376953da0c5401e668c32f` | 未单独公开，待原包 |
| `C-TEXT-CONTROL-0001` | draft / 0.2.0-rc.7 | `b8063c7fb70616d64bb540121952cc36d8877fac08c1f72635b7393b18d2454c` | 由先前same-byte记录推导：`bc8bb4ab39e20c919414b3be54b1e38fae731916c70ee3c45dc822197ae8bc8f` |
| `C-PROPS-0001` | active / 0.1.0 | `cffc9edd78756abf778a67d85e055dac827e4449cbbc815fc375a985f766251d` | 由先前same-byte记录推导：`cffc9edd78756abf778a67d85e055dac827e4449cbbc815fc375a985f766251d` |
| `C-PROPS-0013` | active / 0.1.0 | `e560a2586cc1e8786b606715ba79bc05b230510effeb1907a0177156993bcc6c` | 由先前same-byte记录推导：`e560a2586cc1e8786b606715ba79bc05b230510effeb1907a0177156993bcc6c` |
| `C-LIFECYCLE-0002` | draft / 0.1.0 | `d40b760f6cd48aa0d4b9dd5e5cb58be94e9da78dfed5e0001c7b754d06346498` | 未单独公开，待原包 |
| `C-LIFECYCLE-0008` | active / 0.1.0 | `021ce74e0439481bda5a316982573e06dfd16ea77b0f6c11b36e6077b20549e7` | 由先前same-byte记录推导：`021ce74e0439481bda5a316982573e06dfd16ea77b0f6c11b36e6077b20549e7` |
| `C-LIFECYCLE-REQUEST-0001` | draft / 0.3.0-alpha.2 | `cb31255342be4fb85398ff4ac89508d9b5620b126663e1298384241bb239dd9a` | 现行补充定义，不在原61项 |
| `C-LIFECYCLE-OWNER-INITIALIZATION-0001` | draft / 0.3.0-alpha.2 | `015abc6e3fc7f49934a676e1449c9b555860ce5ea79cc934e7c85c1f687d5e56` | 现行补充定义，不在原61项 |

完整criteria、open questions、依赖方向与代码输入SHA见同目录 [2026-11-24-sprint4-definition-decision-boundaries.json](2026-11-24-sprint4-definition-decision-boundaries.json)。这份材料没有执行远程写入、激活定义或替原作者签署。
