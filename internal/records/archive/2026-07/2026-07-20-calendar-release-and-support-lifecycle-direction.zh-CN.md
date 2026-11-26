# 2026-07-20 日历发版与 v0 支持生命周期方向记录

> Internal record. Not normative. 本文记录 Proto UI 在 `v0` 阶段采用固定日历 minor release train、支持线迁移、npm deprecation 与 V 实体扩展的一次阶段性治理判断。正式规则稳定后应提升到 `internal/governance/versioning-policy*`、`release-workflow*`、V entity schema 与 release automation；本文不自行改变当前 npm registry 状态。

---

## 1）背景

Proto UI 已从 `0.2.0-rc.0` 开始采用全局精确版本：一个数字版本标识一次完整生态发行，全部公开 `@proto.ui/*` package、根 `VERSION` 与 spec snapshot 使用同一精确版本。

现有版本策略已经规定：

- `v0` minor 可以包含用户侧新能力、跨包假设变化和 breaking change。
- Patch 属于同一 minor 内相对安全的修复边界。
- 公开 package 不允许 package-local patch autonomy。
- V 实体以 `draft/active` 表达发行准备与不可变发布证据。

现有规则尚未规定：

- Minor 的固定发版节奏。
- Previous/archived release line 的支持窗口。
- npm deprecate 何时使用。
- 外部人工 journey 是否是发布门禁。
- V 实体如何表达支持生命周期、successor 与迁移资料。

相关既有文档：

- `internal/governance/versioning-policy.zh-CN.md`
- `internal/governance/release-workflow.zh-CN.md`
- `spec/decisions/D-GLOBAL-RELEASE-VERSION-0001.yaml`
- `internal/records/2026-07-20-0.2-rc-post-publication-priority-audit.zh-CN.md`

## 2）当前决定：固定三个月 minor release train

Proto UI 在 `v0` 阶段承诺每三个月发布一个新的 minor release train。发版日期与功能目标分离：

- Release train 有固定时间承诺。
- 研究、架构、原型、文档和工程目标通常不设置 deadline。
- 到达发版时间时，无论当前目标完成多少，都发布当时已通过门禁的真实生态快照。
- 未完成工作自然延续到下一条 minor，不为了“完成里程碑”推迟 release。
- 提前完成当前目标后，可以转向其他修正或功能；新能力根据兼容边界进入下一次 patch 或下一 minor。

因此，版本号表达“某个日期真实发布的生态身份”，不表达：

- 所有计划功能已经完成。
- 项目达到某种主观成熟度。
- 外部试用、文档或原型集合已经达到理想状态。

每次 release notes 必须诚实说明已完成能力、已知边界、未完成验证和延续工作。

## 3）`0.2.0` 与人工 journey

稳定 `0.2.0` 是否按时发布，不依赖“至少完成一份仓库外人工 journey”。外部试用是高优先级产品证据，但不是日历 release 的必要条件。

如果到达发布时间时人工 journey 尚未完成：

- `0.2.0` 仍按发布门禁和时间表推进。
- Release notes 明确记录外部人工验证仍在进行。
- 未完成的 trial、Style Compiler、本地 Shadcn 或文档工作继续在 `0.2` 后推进，必要时进入 `0.3`。

如果人工 journey 提前完成并发现 blocker：

- 能在 release cut 前安全修正的内容进入当前 train。
- 需要 breaking change 或更大设计的内容进入下一 minor。
- 不为了追齐所有发现无限延迟当前 train。

## 4）支持生命周期

在任一新 minor 发布后，release line 分为：

| 生命周期 | 含义 | 默认维护行为 |
| --- | --- | --- |
| `current` | 最新 stable minor | 唯一正常维护线，接收常规修复、文档和工具改进 |
| `previous` / project-deprecated | 前一 stable minor | 作为迁移来源和历史消费基线；不接收常规修复，安全问题单独评估 |
| `archived` / closed | 更早 stable minor | 不运行常规 CI、不处理普通问题、不发布常规修复 |

若三个月节奏稳定，一条 release line 大致经历：

- 约三个月 `current`。
- 约三个月 `previous`。
- 此后进入 `archived`。

状态迁移由下一条 minor 实际发布触发，而不是在 registry 中按日历自动执行。历史 npm tarball、Git tag、spec snapshot、release note 和 BOM 保留，不因为 archived 而 unpublish 或删除历史事实。

## 5）Previous line 的安全问题

当前不承诺同时维护两条完整 release line。Previous line 接受安全问题评估，但是否 backport 根据以下因素决定：

- 严重度与可利用性。
- 是否存在已知受影响用户。
- 修复是否能低风险回移。
- 团队能力与当前用户规模。
- Current line 是否已经提供可接受升级路径。

Current line 始终优先。除非未来真实用户规模和维护能力支持，不对外宣称 previous line 拥有固定安全补丁 SLA。

## 6）项目生命周期与 npm deprecate 分离

npm deprecate 会给安装目标版本的用户显示消息，支持单版本或 semver range，也可以通过清空消息撤销。npm 官方建议在鼓励升级或停止维护时优先 deprecate，而不是 unpublish：

- https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/
- https://docs.npmjs.com/cli/v11/commands/npm-deprecate/

Proto UI 有大量精确锁步 package。若每次新 minor 发布后立即对 previous line 的全部 package 执行 npm deprecate，普通安装可能收到大量重复警告。因此当前采用：

1. `previous` 生命周期先通过官网、V 实体、release notes 与迁移文档表达，不机械执行 npm deprecate。
2. 正常生命周期进入 `archived` 后，优先对用户直接入口 package 执行 npm deprecate，例如 CLI、Adapters 与 Prototype libraries。
3. Module/Core/Runtime 等传递依赖是否批量 deprecate，需权衡警告噪音和直接消费者，默认不因为正常生命周期机械执行。
4. 某个版本确认 unsafe、broken、registry identity 错误或会误导安装时，可以立即对全部受影响精确 package/version 执行 npm deprecate。
5. 不用 unpublish 伪装版本未曾存在。

普通生命周期消息应避免暗示安全漏洞，例如：

```text
Proto UI 0.3 is outside active support. Upgrade to 0.5. Migration guide: <url>
```

安全/严重缺陷消息应明确风险、受影响范围和修复版本。

## 7）Dist-tag 与安装入口

- `latest` 始终指向 current stable release train。
- `next` 指向当前 prerelease train。
- 精确版本是试用、证据和迁移记录的身份。
- Previous/archived line 不通过 `latest` 或普通 Quick Start 暗示为推荐版本。
- 是否增加 `previous` 等额外 dist-tag 暂不决定；当前没有必要增加新的长期 channel。

## 8）V 实体的发行状态与支持状态分离

现有 V 实体 `draft/active` 表达发行事实：

- `draft`：release train 正在准备，尚未具备完整发布证据。
- `active`：npm、Git tag 与 spec snapshot 证据成立。

这与 current/previous/archived 支持生命周期不是同一维度。后续可以在 V entity schema 中增加独立字段，例如：

```yaml
support:
  lifecycle: current
  scheduledFor: 2026-10-20
  successor: null
  deprecatedAt: null
  archivedAt: null
  migrationGuide: null
```

还可记录：

- Calendar train identity。
- 实际发布时间与计划时间。
- Successor V entity。
- Known boundaries。
- Migration guide。
- 外部 Lab evidence 链接。

外部 evidence 是参考事实，不是 V 实体转为 active 的必要条件。

## 9）Fresh install 与 upgrade evidence

每个 stable minor 推荐产生两类外部证据：

1. 从空项目开始使用 current 文档的 fresh install。
2. 从 previous baseline 升级到 current 的 migration journey。

Upgrade 流程：

1. 冻结 previous consumer 的 Git tag、lockfile 和可工作证据。
2. 只升级 Proto UI 精确 release version，先不修改业务代码。
3. 保存类型、构建、运行时、生成文件和样式的原始失败。
4. 根据 migration guide 完成修改。
5. 记录手工修改量、CLI diff、API 变化与语义差异。
6. 将迁移后实现作为新的 current baseline。

这两类证据服务版本治理和文档，但不阻塞固定日期发版。

外部 Lab 方向见：

- `internal/records/2026-07-20-consumer-evidence-lab-and-dogfood-direction.zh-CN.md`

## 10）当前不做

- 不把功能 milestone 完成度作为延迟 minor release 的理由。
- 不承诺 previous line 的常规 patch 或固定安全 SLA。
- 不在正常生命周期中 unpublish 历史 package。
- 不对 37 个 package 机械产生重复 deprecation warning。
- 不把人工 journey、官网完善或 Style Compiler 完成度设为 V entity active 的硬门禁。
- 不允许 package-local patch 绕过全局精确 release train。

## 11）工作顺序

1. 确定三个月 release train 的首个正式日历锚点和 release cut 流程。
2. 在下一次 versioning policy 修订中加入 calendar cadence 与生命周期定义。
3. 为 V entity 设计独立 `support` 元数据，而不复用 `draft/active`。
4. 定义用户入口 package 集合与 npm deprecate 操作清单。
5. 在 release workflow 中生成生命周期迁移和消息的 dry-run 报告。
6. 在 Lab 中冻结 `0.2` baseline，并在 `0.3` 首次执行完整 fresh/upgrade 双车道。
7. 根据实际用户规模复审 previous-line security backport 策略。

## 12）Open questions

- 三个月 cadence 的正式锚点、cut 日期、prerelease 窗口和时区。
- 当 release date 恰逢 registry/GitHub 故障时，如何定义“按时发布”的允许恢复窗口。
- 哪些公开 package 属于 npm deprecate 的用户直接入口集合。
- Unsafe/broken release 触发全量 deprecation 的判定与审批方式。
- Previous line security backport 在出现真实用户后是否升级为正式承诺。
- V entity schema 如何表达 lifecycle history，而不仅是当前 support snapshot。
- Migration guide、Lab evidence 与 GitHub Release 之间的稳定链接方式。

## 13）后续提升目标

本记录稳定后应提升到：

- `internal/governance/versioning-policy.zh-CN.md` 及英文投射。
- `internal/governance/release-workflow.zh-CN.md` 及英文投射。
- Version entity schema 与 Workspace 展示。
- Release automation 的 lifecycle/deprecate dry-run。
- 官网 Status、support policy 与 migration 文档。
