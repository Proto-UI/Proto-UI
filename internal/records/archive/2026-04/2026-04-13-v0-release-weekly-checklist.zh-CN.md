# 2026-04-13 v0 发布前按周推进 Checklist 与 Issue 拆分

> Internal planning note. 本文用于把 v0 第一次公开发布前的剩余工作，拆成一个按周推进的倒排计划，并进一步拆到可以直接建 issue 的粒度。

---

## 1）使用方式

本文默认采用 **T-4 到 T-1** 的倒排方式：

- `T-4`：距离公开发布约 4 周
- `T-3`：距离公开发布约 3 周
- `T-2`：距离公开发布约 2 周
- `T-1`：距离公开发布约 1 周

当前目标公开发布时间：**2026-05-14**（CLI 上线目标同日）。

如果实际节奏更快或更慢，可以整体平移，但顺序尽量不要变。

核心原则：

- 先做现实闭环，再做可信表面，最后做发布物料
- 没有进入官方首发路径的工作，默认不抢 `T-4 / T-3`
- 每周都要有“可判断是否完成”的 done definition

---

## 2）阶段目标总览

| 周次 | 阶段目标 | 关键产出 |
| --- | --- | --- |
| T-4 | 锁定范围，做实首发路径 | Quick Start 路线决策、首发 package 子集、首发 prototype 子集 |
| T-3 | 清理安装与发布阻塞，改正文档 | 可运行的上手路径、可重复的 staging/publish、Quick Start 初稿 |
| T-2 | 加固可信度与协作基础设施 | CI、contract/test 索引、文档口径对齐、首发 demo 审核 |
| T-1 | 做最后发版检查与对外物料 | 发布 checklist、release note、公告文案、回归检查 |

---

## 3）T-4：锁定范围与首发叙事

### 本周目标

- 明确 v0 第一次发布到底发布什么、不发布什么
- 结束“CLI 是否阻塞首发”这个核心悬而未决问题
- 冻结首发 package 与首发 prototype 集合

### Checklist

- [x] 决定官方 Quick Start 路线是 `manual install` 还是 `CLI`
- [ ] 明确首发推荐 onboarding adapter，建议 React
- [x] 明确首发 package 子集
- [x] 明确首发 prototype 子集
- [ ] 把未纳入首发的 adapter / prototype / CLI 能力标记为 post-launch
- [ ] 确认 README / docs / release note 的一句话定位口径
- [ ] 为后续 3 周建立 issue board 或 milestone

### 本周完成标准

- 有一份被确认的首发范围表
- 所有人知道哪些方向是 `P0`、哪些不允许继续膨胀
- Quick Start 路线不再摇摆

### 本周建议 issue

1. `Decision: v0 首发 Quick Start 采用 manual install 还是最小 CLI`
2. `Decision: v0 首发 package 子集冻结`
3. `Decision: v0 首发 prototype 子集冻结`
4. `Docs: 对外一句话定位与非目标口径冻结`
5. `Ops: 建立 v0 launch milestone / board`

---

## 4）T-3：清理发布阻塞，跑通真实上手路径

### 本周目标

- 让首发 package 子集进入“可 staging / 可 publish”的状态
- 让官方 Quick Start 从“叙事”变成“真实路径”
- 把最关键的 package / docs 阻塞项一次清掉

### Checklist

- [ ] 针对首发 package 子集跑 `release:scan`
- [ ] 清理首发 package 上的 README 缺失问题
- [ ] 清理首发 package 上的 export / metadata 阻塞问题
- [ ] 在首发 package 子集上反复跑 staging，直到流程稳定
- [ ] 基于真实安装方式重写 EN / ZH Quick Start
- [ ] 建立一个 clean-environment smoke 流程
- [ ] 用真实路径验证 `Button` 示例
- [ ] 用真实路径验证一个复合组件示例，建议 `Dialog`

### 本周完成标准

- 已选定的首发路径能够被真实执行
- Quick Start 不再包含“暂不可安装”的文案
- package 发布路径不再停留在理论上可用

### 本周建议 issue

1. `Release: 首发 package 子集 release scan 清零`
2. `Release: 首发 package 子集 README 补齐`
3. `Release: 首发 package 子集 export / metadata 清理`
4. `Quick Start(EN): 按真实路径重写`
5. `Quick Start(ZH): 按真实路径重写`
6. `Smoke: clean environment 跑通 Button 示例`
7. `Smoke: clean environment 跑通 Dialog 示例`
8. `CLI: 如果 CLI 进入首发，则仅实现 init + 一条 add 路径`

---

## 5）T-2：加固可信度与协作基础设施

### 本周目标

- 让首发范围从“能跑”进入“可信”
- 为公开发布后的协作留出最小基础设施
- 把 contract / tests / docs 的地图搭起来

### Checklist

- [ ] 增加基础 GitHub Actions：type check
- [ ] 增加基础 GitHub Actions：tests
- [ ] 如成本可控，补 docs build check
- [ ] 建立 contract catalog 索引
- [ ] 建立 contract-test catalog 索引
- [ ] 写出 adapter / prototype 改动的最小 review 规则
- [ ] 审核 README、status、roadmap、homepage、links 的口径一致性
- [ ] 审核首发 prototype 集合的 docs / demo 覆盖
- [ ] 清理首发 prototype 页面中“看起来像已支持但其实没承诺”的表述

### 本周完成标准

- PR 上至少自动检查测试与类型
- 贡献者能找到“契约在哪里、测试在哪里、我改动后要补什么”
- 对外主路径文档不再互相打架

### 本周建议 issue

1. `CI: 新增 type-check workflow`
2. `CI: 新增 test workflow`
3. `CI: 评估并新增 docs build workflow`
4. `Contracts: 建立 contract family 索引`
5. `Contracts: 建立 contract-test 索引`
6. `Contributing: 写出 adapter / prototype 的最小 review 规则`
7. `Docs: README / status / roadmap / homepage 口径对齐`
8. `Prototypes: 首发集合 docs / demo 覆盖审计`

---

## 6）T-1：发版检查、公告物料与最终回归

### 本周目标

- 把“准备发布”变成一组最后可执行的检查
- 准备最小对外公告物料
- 做最后一轮首发路径回归

### Checklist

- [ ] 用发布视角重跑一次完整 Quick Start
- [ ] 再次跑 staging / publish rehearsal
- [ ] 核对首发 package 清单与 docs 中提及的 package 完全一致
- [ ] 核对首发 prototype 清单与 docs / demo 完全一致
- [ ] 准备 release note / release summary
- [ ] 准备官网首发页或 changelog 文案
- [ ] 准备社交媒体 / 社区公告短文案
- [ ] 准备发布后 1 周 issue triage 方案
- [ ] 最终确认 README、Quick Start、status 页面无过期承诺

### 本周完成标准

- 任何对外会被看到的路径都经过至少一轮“发布视角回归”
- 首发内容清单与实际 ship 内容完全一致
- 有最小公告包，可直接发出

### 本周建议 issue

1. `Release rehearsal: 从 docs 到运行组件全链路回归`
2. `Release rehearsal: staging / publish 全链路彩排`
3. `Release note: v0 首发说明`
4. `Website: 首发页 / changelog 入口`
5. `Community: GitHub / Discord / 社交媒体公告文案`
6. `Ops: 发布后 1 周 triage 值班与响应规则`

---

## 7）建议的 Issue 拆分总表

下表是更适合直接建 issue 的粒度。

| 标题 | 优先级 | 建议负责人角色 | 完成定义 | 前置依赖 |
| --- | --- | --- | --- | --- |
| 决策：v0 Quick Start 路线冻结 | P0 | 项目负责人 | 书面确定 manual install 或最小 CLI | 无 |
| 决策：v0 首发 package 子集冻结 | P0 | 项目负责人 / 发布负责人 | 有明确 package 名单 | 无 |
| 决策：v0 首发 prototype 子集冻结 | P0 | 项目负责人 / 原型库负责人 | 有明确 prototype 名单 | 无 |
| 发布：首发 package 的 README 缺失清理 | P0 | 发布负责人 | 首发 package 不再缺 README | package 子集已冻结 |
| 发布：首发 package 的 export / metadata 清理 | P0 | 发布负责人 / 包维护者 | 首发 package 的 scan blocker 清零 | package 子集已冻结 |
| 发布：首发 package staging 彩排通过 | P0 | 发布负责人 | staging 针对首发 package 成功 | README / export 清理完成 |
| 文档：Quick Start EN 改为真实路径 | P0 | 文档负责人 | EN Quick Start 可按文执行 | Quick Start 路线已确定 |
| 文档：Quick Start ZH 改为真实路径 | P0 | 文档负责人 | ZH Quick Start 可按文执行 | Quick Start 路线已确定 |
| 验证：Button 首发样例 smoke 测试 | P0 | 运行时 / 文档负责人 | 在干净环境跑通 | Quick Start 初稿完成 |
| 验证：Dialog 首发样例 smoke 测试 | P0 | 运行时 / 文档负责人 | 在干净环境跑通 | Quick Start 初稿完成 |
| 文档：README / status / roadmap / homepage 口径对齐 | P0 | 文档负责人 | 主入口文档说同一个故事 | Quick Start 真实路径确定 |
| CI：新增 type-check workflow | P1 | 后勤 / 工程效率负责人 | PR 自动跑类型检查 | 无 |
| CI：新增 test workflow | P1 | 后勤 / 工程效率负责人 | PR 自动跑测试 | 无 |
| CI：docs build 检查 | P1 | 后勤 / 文档负责人 | docs build 被自动或半自动验证 | 可选 |
| 契约：contract family 索引 | P1 | 契约负责人 | 存在一份 family 级索引 | 无 |
| 契约：contract-test 索引 | P1 | 契约负责人 / 测试负责人 | contract 到测试位置可追踪 | family 索引完成更佳 |
| 规范：adapter / prototype review 最小规则 | P1 | 项目负责人 / 契约负责人 | 有一份简短的 review 规则文档 | contract / test 索引更佳 |
| 原型库：首发集合 docs / demo 审计 | P1 | 原型库负责人 | 首发集合 docs / demo 覆盖明确 | prototype 子集已冻结 |
| 网站：首发页 / changelog 文案 | P2 | 文档 / 网站负责人 | 有对外首发说明页 | 主文档已对齐 |
| 社区：首发公告文案包 | P2 | 社区 / 项目负责人 | 有 GitHub / Discord / 社媒短文案 | release note 初稿完成 |

---

## 8）每周例会建议检查问题

建议每周固定只问这几类问题，避免讨论发散：

1. 本周有没有新增工作在抢 `P0` 的时间？
2. Quick Start 是否比上周更接近真实可跑？
3. 首发 package / prototype 清单是否有人想继续扩？
4. 是否出现新的发布阻塞项，还是只是“想做得更完整”？
5. 哪些任务已经可以明确后置到 post-launch？

---

## 9）建议的发版前最后判断标准

当以下条件同时成立时，可以认真考虑按下首次公开发布：

- Quick Start 已真实可跑
- 首发 package staging / publish rehearsal 已通过
- 首发 prototype 集合已冻结
- README 与 docs 主入口口径一致
- PR 基础 CI 已开启
- 至少有一版对外发布文案

如果这六件事里还有明显空洞，就说明还不应该被“再补一个新能力”分散注意力。

---

## 10）后续可继续补的文件

如果这份周计划开始实际执行，建议后面继续补两类文件：

- 一份 `launch issues index`，把真实 issue 链接回填进来
- 一份 `post-launch backlog`，专门承接被明确后置的 P2 事项
