#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSpecReleases, getSpecSnapshot } from '@proto.ui/spec-engine';
import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { format, resolveConfig } from 'prettier';

const ENTITY_TYPE_ORDER = [
  'knowledge',
  'decision',
  'contract',
  'prototype',
  'module',
  'host-cap',
  'adapter',
  'test',
  'version',
];

const RELATION_KINDS = [
  'relates',
  'dependsOn',
  'inherits',
  'references',
  'refines',
  'satisfies',
  'verifies',
  'explains',
  'exercises',
  'requires',
  'owns',
  'supports',
  'provides',
  'omits',
];

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const specDir = path.join(root, 'spec');
const outputPath = path.join(root, 'internal/agent/PROJECT-UNDERSTANDING.zh-CN.md');
const checkOnly = readMode(process.argv.slice(2));

const workspace = await loadSpecWorkspaceFromDirectory(specDir);

if (workspace.issues.length > 0) {
  const details = workspace.issues
    .map((issue) => `- ${relativeToRoot(issue.filePath) ?? '<workspace>'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Cannot generate Agent project understanding from an invalid spec workspace:\n${details}`
  );
}

const releases = getSpecReleases(workspace);
const latestRelease = releases.at(-1);

if (!latestRelease) {
  throw new Error('Cannot generate Agent project understanding without a version entity.');
}

const snapshot = getSpecSnapshot(workspace, latestRelease.version);
const sourcePathById = new Map(
  workspace.files.map(({ entity, filePath }) => [entity.id, relativeToRoot(filePath)])
);
const entitiesById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
const incomingById = buildIncomingIndex(snapshot.entities);
const fingerprint = createHash('sha256').update(JSON.stringify(snapshot.entities)).digest('hex');
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
const document = await format(
  renderDocument({
    entities: snapshot.entities,
    entitiesById,
    fingerprint,
    incomingById,
    latestRelease,
    sourcePathById,
  }),
  { ...prettierConfig, filepath: outputPath }
);

if (checkOnly) {
  let current;

  try {
    current = await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      current = undefined;
    } else {
      throw error;
    }
  }

  if (current === undefined) {
    console.log(
      `Agent project understanding is renderable; local projection is absent as expected: ${relativeToRoot(outputPath)}`
    );
  } else if (current !== document) {
    throw new Error(
      `Generated Agent document is stale: ${relativeToRoot(outputPath)}. Run pnpm spec:docs:agent.`
    );
  } else {
    console.log(`Agent project understanding is current: ${relativeToRoot(outputPath)}`);
  }
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, document);
  console.log(
    `Generated ${relativeToRoot(outputPath)} from ${snapshot.entities.length} entities (${latestRelease.version}, sha256:${fingerprint}).`
  );
}

function renderDocument({
  entities,
  entitiesById,
  fingerprint,
  incomingById,
  latestRelease,
  sourcePathById,
}) {
  const byType = groupBy(entities, (entity) => entity.type);
  const byStatus = countBy(entities, (entity) => entity.status);
  const relationCounts = countRelations(entities);
  const implementationStatuses = countBy(
    byType.get('test')?.flatMap((entity) => entity.implementations) ?? [],
    (implementation) => implementation.status
  );
  const implementationKinds = countBy(
    byType.get('test')?.flatMap((entity) => entity.implementations) ?? [],
    (implementation) => implementation.kind
  );
  const openQuestions = entities.flatMap((entity) =>
    entity.openQuestions.map((question) => ({ entity, question }))
  );
  const context = { entitiesById, incomingById, sourcePathById };

  const lines = [
    '# Proto UI 项目理解：spec 工作区快照',
    '',
    '> 此文件是由 `scripts/spec/generate-agent-project-understanding.mjs` 生成且被 Git 忽略的本地一次性投影。请勿手工编辑或提交；修改 spec 或生成器后运行 `corepack pnpm@10.32.1 spec:docs:agent` 重新生成。',
    '',
    '本文面向需要快速建立 Proto UI 全局认知的 Agent。它把当前检出版本中的 spec 实体组织成项目模型、协议边界、验证关系与完整索引，同时明确哪些结论不能由 spec 单独推出。',
    '',
    '## 快照身份',
    '',
    '| 项目 | 值 |',
    '| --- | --- |',
    `| 当前 spec 版本 | \`${escapeTable(latestRelease.version)}\` |`,
    `| Release channel | \`${escapeTable(latestRelease.channel)}\` |`,
    `| Version entity | ${entityLink(latestRelease.entityId, context)} |`,
    `| 工作区实体数 | ${entities.length} |`,
    '| Workspace validation issues | 0 |',
    `| 工作区快照指纹 | \`sha256:${fingerprint}\` |`,
    `| 已发布 release snapshot digest | \`${escapeTable(latestRelease.specSnapshotDigest ?? '未记录')}\` |`,
    '',
    '工作区快照指纹来自按 ID 排序、按当前版本过滤后的实体内容。它用于判断本文是否与当前检出版本一致；它不替代 `V-*` 中记录的不可变发布快照 digest。',
    '',
    '## 阅读与权威边界',
    '',
    `当前快照包含 ${byStatus.get('active') ?? 0} 个 active、${byStatus.get('draft') ?? 0} 个 draft、${byStatus.get('deprecated') ?? 0} 个 deprecated、${byStatus.get('removed') ?? 0} 个 removed 实体。`,
    '',
    '- `active` 可以作为当前稳定保证读取。',
    '- `draft` 是已进入正式目录的当前方向，但不能包装为稳定公共承诺。',
    '- `deprecated` 用于兼容与迁移；读取时应检查替代实体和版本。',
    '- 本文只组织 spec 中已经编目的事实。实现存在但尚未编目的行为不会自动出现在本文。',
    '- `internal/contracts/**` 仍可能包含未完成迁移的约束与解释；它只补充 spec 空白，不覆盖适用实体。',
    '- `internal/records/**` 提供短期方向和工程上下文，但始终是非规范记录。',
    '- 本文列出的 test implementation 状态来自实体声明，并不表示生成本文时重新执行了这些测试。',
    '',
    '## 一、项目的协议模型',
    '',
    'Proto UI 把组件交互从具体框架实现中抽离为可命名、可组合、可验证、可跨宿主投射的协议实体。当前 catalog 的基本推理链如下：',
    '',
    '```mermaid',
    'flowchart LR',
    '  K["Knowledge: 概念与词汇"] --> C["Contracts: 跨领域规范"]',
    '  D["Decisions: 稳定选择"] --> C',
    '  K --> P["Prototypes: 组件协议身份"]',
    '  D --> P',
    '  C --> P',
    '  C --> M["Modules: 语义能力身份"]',
    '  HC["Host capabilities: 宿主能力"] --> M',
    '  M --> A["Adapter profiles: 翻译身份与支持矩阵"]',
    '  HC --> A',
    '  C --> T["Tests: conformance 映射"]',
    '  P --> T',
    '  A --> T',
    '  T --> I["Executable implementation paths"]',
    '  M --> I',
    '  A --> I',
    '  I --> DOC["README / 官网 / 示例投射"]',
    '```',
    '',
    '这张图是阅读顺序，不表示每条边都必须使用同一种 relation。实际关系由 `dependsOn`、`satisfies`、`verifies`、`exercises`、`requires`、`inherits` 等字段表达。',
    '',
    '当前 schema 已将 official Adapter profile 建模为 `A-*` 实体；Compiler 仍无一级实体类型。Adapter profile 采用逐 Module slice 编目，未列出的 Module 不能从 catalog 推断为支持或不支持。',
    '',
    '### 实体职责与成熟度',
    '',
    '| 类型 | 总数 | active | draft | deprecated | 有 statement | 有 criteria | 有 open questions |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...ENTITY_TYPE_ORDER.map((type) => maturityRow(type, byType.get(type) ?? [])),
    '',
    '### 实体级关系分布',
    '',
    '| Relation | 边数 |',
    '| --- | ---: |',
    ...RELATION_KINDS.map((kind) => `| \`${kind}\` | ${relationCounts.get(kind) ?? 0} |`),
    '',
    '关系统计只计算实体顶层 relation；criterion 内的 `dependsOn` 和 `references` 仍保留在各实体源文件中。',
    '',
    '## 二、知识基础',
    '',
    'Knowledge 实体提供跨领域概念模型。Agent 在修改具体 API 或行为前，应先确认相关术语在这里的含义。',
    '',
    ...renderKnowledge(byType.get('knowledge') ?? [], context),
    '## 三、契约域',
    '',
    'Contract 是规范性规则的主要载体。下表按 ID 的主领域聚合；“被 T 验证”统计来自指向该 contract 的顶层 `verifies` relation。完整准则、版本关系和来源请进入实体文件。',
    '',
    ...renderGroupedEntities(byType.get('contract') ?? [], context, renderContractTable),
    '## 四、官方 Prototype 协议',
    '',
    'Prototype 实体描述官方协议身份，而不是某个框架组件的偶然实现。Base 通常表达基础协议，Shadcn 等 design-language 实体可通过 `inherits.prototypes` 表达继承与差异。',
    '',
    ...renderGroupedEntities(byType.get('prototype') ?? [], context, renderPrototypeTable),
    '## 五、Module、Host Capability 与 Adapter Profile',
    '',
    'Module 实体是语义能力的稳定身份锚点；Host Capability 表达宿主可提供或可接受的能力。实体数不应机械追随 package 数或 capability token 数，而应形成有准则、有关系、有验证证据的语义切片。',
    '',
    '### Modules',
    '',
    ...renderModuleTable(byType.get('module') ?? [], context),
    '',
    '### Host capabilities',
    '',
    ...renderHostCapTable(byType.get('host-cap') ?? [], context),
    '',
    '### Official Adapter profiles',
    '',
    'Adapter Profile 是具体 official translation identity。`supports.modules` 与 `omits.modules` 记录已经审查的支持决策，`provides.hostCaps` 记录 capability 的兑现方式；缺席项保持 uncataloged。',
    '',
    ...renderAdapterTable(byType.get('adapter') ?? [], context),
    '',
    '## 六、关键决策',
    '',
    'Decision 实体固定已经稳定下来的设计与治理选择。它们解释“为什么如此”，但具体行为仍应追溯到相应 contract、prototype 和 test。',
    '',
    ...renderGroupedEntities(byType.get('decision') ?? [], context, renderDecisionTable),
    '## 七、Conformance 与测试映射',
    '',
    'Test 实体连接可寻址 case、被验证的实体准则和仓库中的 executable implementation。`verifies` 表示验证责任，`exercises` 只表示经过某个表面，不能等同于完整验证。',
    '',
    '### Implementation 状态',
    '',
    '| Status | 数量 |',
    '| --- | ---: |',
    ...sortedCountRows(implementationStatuses),
    '',
    '### Implementation 类型',
    '',
    '| Kind | 数量 |',
    '| --- | ---: |',
    ...sortedCountRows(implementationKinds),
    '',
    '### Test entities',
    '',
    ...renderGroupedEntities(byType.get('test') ?? [], context, renderTestTable),
    '## 八、版本与发布身份',
    '',
    ...renderVersionEntities(byType.get('version') ?? [], context),
    '## 九、显式 Open Questions',
    '',
    openQuestions.length > 0
      ? `当前实体共声明 ${openQuestions.length} 个 open question。它们是已知断口，不应由 Agent 静默补全。`
      : '当前实体未声明 open question；这不代表 catalog 已经完整。',
    '',
    ...renderOpenQuestions(openQuestions, context),
    '## 十、如何用这份快照处理任务',
    '',
    '### 修改跨领域行为',
    '',
    '1. 从相关 Knowledge 与 Decision 建立术语和设计边界。',
    '2. 定位 applicable Contract，检查 status、since、criteria、relations 与 revisions。',
    '3. 沿 `verifies` 找到 Test entity，再查看 implementation path。',
    '4. 对照 Module、Host Capability、runtime 和各 Adapter 的现实实现。',
    '5. 同步修改真理之源、验证证据和用户可见投射。',
    '',
    '### 修改或新增 Prototype',
    '',
    '1. 判断它是新的协议身份、既有协议的 part，还是 design-language delta。',
    '2. 检查 `inherits.prototypes`、anatomy、依赖 Contract 与相关 Decision。',
    '3. 确保 P/T/implementation 的追溯链成立；不要用文件数量代替覆盖判断。',
    '4. 保持跨 Adapter 的交互语义，除非实体明确声明宿主差异。',
    '',
    '### 修改 Adapter 或 Module wiring',
    '',
    '1. 从对应 `A-*` profile 查看 target runtime、已编目的 Module support 与 host capability provision。',
    '2. 以 `M-*`、`HC-*` 与 Contract 为 portable baseline，不从 framework 实现反向改写协议。',
    '3. 支持、拒绝或不适用必须分别进入 `supports.modules` 或 `omits.modules`，并说明 role。',
    '4. 用 `T-*` 的 `verifies.adapters` 将 profile criteria 绑定到 executable Adapter evidence。',
    '',
    '### 处理 catalog 空白',
    '',
    '1. 确认确实没有适用实体，而不是搜索遗漏。',
    '2. 阅读 `internal/contracts/**`、实现、测试和相关最新 record。',
    '3. 清楚标注哪些结论只是 fallback 或观察事实。',
    '4. 尚未稳定的讨论进入 dated record；稳定语义进入实体与 executable coverage。',
    '',
    '## 十一、当前快照的结构性限制',
    '',
    `- ${byStatus.get('draft') ?? 0}/${entities.length} 个实体仍为 draft；catalog 广度不能直接解释为稳定度。`,
    `- 当前只有 ${byType.get('module')?.length ?? 0} 个 Module、${byType.get('host-cap')?.length ?? 0} 个 Host Capability 与 ${byType.get('adapter')?.length ?? 0} 个 Adapter Profile 实体；不要据此推断实现中只有这些能力或 profile 已形成完整矩阵。`,
    '- Compiler 尚无一级实体类型；Adapter 已有 profile identity，但尚未编目的 Module 必须保持 unknown，不能从 package dependency 推断。',
    '- 生成器只验证 schema 与关系完整性，不验证网站内容、README、package exports 或运行时代码与实体完全一致。',
    '- 发布 snapshot digest 与当前工作区指纹用途不同；同一版本下继续编辑 draft 实体时，两者可能不同。',
    '- 本文提供完整实体导航，但不会复制每条 criterion、relation anchor 和测试代码；做出行为判断前必须进入链接源文件。',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function renderKnowledge(entities, context) {
  return entities.flatMap((entity) => {
    const lines = [
      `### ${entityLink(entity.id, context)} ${escapeText(entity.title)}`,
      '',
      `- 状态：\`${entity.status}\`；since：\`${entity.since}\`；activeSince：\`${entity.activeSince ?? '未记录'}\`；criteria：${entity.criteria.length}`,
    ];

    if (entity.summary) lines.push(`- 摘要：${escapeText(entity.summary)}`);
    const statement = localized(entity.statement);
    if (statement) lines.push('', statement);

    if (entity.criteria.length > 0) {
      lines.push('', '关键准则：', '');
      for (const criterion of entity.criteria) {
        lines.push(`- \`${criterion.id}\`：${localized(criterion.text)}`);
      }
    }

    lines.push('');
    return lines;
  });
}

function renderGroupedEntities(entities, context, renderTable) {
  const groups = groupBy(entities, topicFor);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([topic, group]) => [
      `### ${topic}（${group.length}）`,
      '',
      ...renderTable(group, context),
      '',
    ]);
}

function lifecycleStatus(entity) {
  return `\`${entity.status}\` / \`${entity.activeSince ?? '未记录'}\``;
}

function renderContractTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | 标题 | Criteria | 被 T 验证 | 摘要 |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...entities.map((entity) => {
      const verifiedBy = incomingOfType(entity.id, 'test', 'verifies', context).length;
      return `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | ${escapeTable(entity.title)} | ${entity.criteria.length} | ${verifiedBy} | ${escapeTable(entity.summary ?? '')} |`;
    }),
  ];
}

function renderPrototypeTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | 标题 | 继承 | Anatomy | Criteria | 关联 T |',
    '| --- | --- | --- | --- | --- | ---: | ---: |',
    ...entities.map((entity) => {
      const inherits = relationIds(entity.inherits).map(code).join('<br>') || '—';
      const relatedTests = incomingOfType(entity.id, 'test', undefined, context).length;
      const anatomy = entity.anatomy
        ? `${Object.keys(entity.anatomy.roles).length} roles / ${Object.keys(entity.anatomy.profiles).length} profiles`
        : '—';
      return `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | ${escapeTable(entity.title)} | ${inherits} | ${anatomy} | ${entity.criteria.length} | ${relatedTests} |`;
    }),
  ];
}

function renderModuleTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | 标题 | Satisfies contracts | Criteria | 摘要 |',
    '| --- | --- | --- | --- | ---: | --- |',
    ...entities.map((entity) => {
      const contracts = relationIds(entity.satisfies, 'contracts').map(code).join('<br>') || '—';
      return `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | ${escapeTable(entity.title)} | ${contracts} | ${entity.criteria.length} | ${escapeTable(entity.summary ?? '')} |`;
    }),
  ];
}

function renderHostCapTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | 标题 | Related contracts | Criteria | 摘要 |',
    '| --- | --- | --- | --- | ---: | --- |',
    ...entities.map((entity) => {
      const contracts =
        allRelationIdsByTargetType(entity, 'contracts').map(code).join('<br>') || '—';
      return `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | ${escapeTable(entity.title)} | ${contracts} | ${entity.criteria.length} | ${escapeTable(entity.summary ?? '')} |`;
    }),
  ];
}

function renderAdapterTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | Package | Target | Supports Modules | Omits Modules | Provides Host Caps |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...entities.map((entity) => {
      const profile = entity.adapterProfile;
      const runtime = profile?.target.runtime;
      const target = [profile?.target.platform, runtime?.name, runtime?.versionRange]
        .filter(Boolean)
        .join(' / ');
      const supports = relationIds(entity.supports, 'modules').map(code).join('<br>') || '—';
      const omits = relationIds(entity.omits, 'modules').map(code).join('<br>') || '—';
      const provides = relationIds(entity.provides, 'hostCaps').map(code).join('<br>') || '—';
      return `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | \`${escapeTable(profile?.package ?? '—')}\` | ${escapeTable(target || '—')} | ${supports} | ${omits} | ${provides} |`;
    }),
  ];
}

function renderDecisionTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | 标题 | Criteria | 摘要 |',
    '| --- | --- | --- | ---: | --- |',
    ...entities.map(
      (entity) =>
        `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | ${escapeTable(entity.title)} | ${entity.criteria.length} | ${escapeTable(entity.summary ?? '')} |`
    ),
  ];
}

function renderTestTable(entities, context) {
  return [
    '| Entity | 状态 / activeSince | 标题 | Cases | Implementations | Verifies | Exercises |',
    '| --- | --- | --- | ---: | --- | --- | --- |',
    ...entities.map((entity) => {
      const implementations = summarizeImplementations(entity.implementations);
      const verifies = relationIds(entity.verifies).map(code).join('<br>') || '—';
      const exercises = relationIds(entity.exercises).map(code).join('<br>') || '—';
      return `| ${entityLink(entity.id, context)} | ${lifecycleStatus(entity)} | ${escapeTable(entity.title)} | ${entity.cases.length} | ${implementations} | ${verifies} | ${exercises} |`;
    }),
  ];
}

function renderVersionEntities(entities, context) {
  return entities.flatMap((entity) => {
    const release = entity.release;
    return [
      `### ${entityLink(entity.id, context)} ${escapeText(entity.title)}`,
      '',
      '| Field | Value |',
      '| --- | --- |',
      `| Entity status | \`${entity.status}\` |`,
      `| Version | \`${release?.version ?? '—'}\` |`,
      `| Channel | \`${release?.channel ?? '—'}\` |`,
      `| Git tag | \`${release?.gitTag ?? '—'}\` |`,
      `| npm dist-tag | \`${release?.npmDistTag ?? '—'}\` |`,
      `| Package policy | \`${release?.packageVersionPolicy ?? '—'}\` / \`${release?.packageScope ?? '—'}\` |`,
      `| Published at | \`${release?.publishedAt ?? '—'}\` |`,
      `| Commit | \`${release?.commit ?? '—'}\` |`,
      `| Snapshot digest | \`${release?.specSnapshotDigest ?? '—'}\` |`,
      '',
    ];
  });
}

function renderOpenQuestions(openQuestions, context) {
  if (openQuestions.length === 0) return [];

  return [
    '| Entity | Question | Blocks |',
    '| --- | --- | --- |',
    ...openQuestions.map(({ entity, question }) => {
      const blocks = question.blocks.map(escapeTable).join('<br>') || '—';
      return `| ${entityLink(entity.id, context)}<br>\`${escapeTable(question.id)}\` | ${escapeTable(localized(question.question))} | ${blocks} |`;
    }),
    '',
  ];
}

function maturityRow(type, entities) {
  const statuses = countBy(entities, (entity) => entity.status);
  return `| \`${type}\` | ${entities.length} | ${statuses.get('active') ?? 0} | ${statuses.get('draft') ?? 0} | ${statuses.get('deprecated') ?? 0} | ${entities.filter((entity) => localized(entity.statement)).length} | ${entities.filter((entity) => entity.criteria.length > 0).length} | ${entities.filter((entity) => entity.openQuestions.length > 0).length} |`;
}

function entityLink(id, context) {
  const sourcePath = context.sourcePathById.get(id);
  if (!sourcePath) return code(id);
  return `[\`${escapeText(id)}\`](../../${sourcePath})`;
}

function buildIncomingIndex(entities) {
  const index = new Map();

  for (const entity of entities) {
    for (const kind of RELATION_KINDS) {
      for (const targetId of relationIds(entity[kind])) {
        const entries = index.get(targetId) ?? [];
        entries.push({ source: entity, kind });
        index.set(targetId, entries);
      }
    }
  }

  return index;
}

function incomingOfType(id, sourceType, kind, context) {
  return (context.incomingById.get(id) ?? []).filter(
    (entry) => entry.source.type === sourceType && (kind === undefined || entry.kind === kind)
  );
}

function countRelations(entities) {
  const counts = new Map();
  for (const kind of RELATION_KINDS) {
    counts.set(
      kind,
      entities.reduce((total, entity) => total + relationIds(entity[kind]).length, 0)
    );
  }
  return counts;
}

function allRelationIdsByTargetType(entity, targetType) {
  return unique(RELATION_KINDS.flatMap((kind) => relationIds(entity[kind], targetType))).sort();
}

function relationIds(relations, targetType) {
  if (!relations) return [];
  const groups = targetType ? [[targetType, relations[targetType]]] : Object.entries(relations);
  return groups.flatMap(([, targets]) => (targets ?? []).map((target) => target.id));
}

function summarizeImplementations(implementations) {
  if (implementations.length === 0) return '—';
  const counts = countBy(implementations, (implementation) => implementation.status);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${code(status)} ${count}`)
    .join('<br>');
}

function sortedCountRows(counts) {
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `| \`${escapeTable(key)}\` | ${count} |`);
}

function topicFor(entity) {
  const withoutPrefix = entity.id.replace(/^(?:HC|[CPMDTKV])-/, '');
  const withoutNumber = withoutPrefix.replace(/-\d{4}$/, '');
  const parts = withoutNumber.split('-');

  if (entity.type === 'prototype') return parts[0];
  if (parts[0] === 'AS' && parts[1]) return `${parts[0]}-${parts[1]}`;
  return parts[0];
}

function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function countBy(values, keyOf) {
  const counts = new Map();
  for (const value of values) {
    const key = keyOf(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function localized(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value['zh-CN'] ?? value.en ?? '';
}

function code(value) {
  return `\`${escapeText(value)}\``;
}

function escapeText(value) {
  return String(value).replaceAll('\r', '').replaceAll('\n', ' ');
}

function escapeTable(value) {
  return escapeText(value).replaceAll('|', '\\|');
}

function unique(values) {
  return [...new Set(values)];
}

function relativeToRoot(filePath) {
  if (!filePath) return undefined;
  return path.relative(root, filePath).split(path.sep).join('/');
}

function readMode(args) {
  if (args.length === 0) return false;
  if (args.length === 1 && args[0] === '--check') return true;
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log('Usage: pnpm spec:docs:agent [--check]');
    process.exit(0);
  }
  throw new Error(`Unknown arguments: ${args.join(' ')}`);
}
