import { StrictMode, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  createSpecWorkspace,
  diffSpecSnapshots,
  getSpecSnapshot,
  type SpecSnapshot,
  type SpecSnapshotDiff,
} from '@proto.ui/spec-engine';
import { buildSpecGraph, type SpecGraph } from '@proto.ui/spec-graph';
import {
  SPEC_RELATION_KINDS,
  type SpecEntity,
  type SpecRelations,
  type SpecRelationTarget,
} from '@proto.ui/spec-schema';

import './styles.css';

type Locale = 'zh' | 'en';

const UI_TEXT = {
  en: {
    loading: 'Loading spec workspace...',
    appTitle: 'Semantic Workspace',
    from: 'From',
    to: 'To',
    navLabel: 'Spec entities',
    quickJump: 'Jump',
    scope: 'Scope',
    entities: 'Entities',
    graphNodes: 'Graph Nodes',
    graphEdges: 'Graph Edges',
    criteria: 'Criteria',
    cases: 'Cases',
    implementations: 'Implementations',
    openQuestions: 'Open Questions',
    issues: 'Issues',
    id: 'ID',
    status: 'Status',
    since: 'Since',
    noEntity: 'No entity selected.',
    statement: 'Statement',
    adapterProfile: 'Adapter Profile',
    packageName: 'Package',
    platform: 'Platform',
    runtime: 'Runtime',
    versionRange: 'Version Range',
    anatomy: 'Anatomy',
    family: 'Family',
    roles: 'Roles',
    relations: 'Relations',
    profiles: 'Profiles',
    cardinality: 'Cardinality',
    requires: 'Requires',
    rationale: 'Rationale',
    blocks: 'Blocks',
    covers: 'Covers',
    consumes: 'Consumes',
    exercises: 'Exercises',
    expectation: 'Expectation',
    implementationStatus: 'Implementation Status',
    primary: 'Primary',
    supporting: 'Supporting',
    coveredBy: 'Covered By',
    note: 'Note',
    notes: 'Notes',
    path: 'Path',
    required: 'Required',
    optional: 'Optional',
    implementationKinds: {
      fixture: 'Fixture',
      'module-test': 'Module Test',
      'adapter-test': 'Adapter Test',
      'runtime-test': 'Runtime Test',
      'workspace-check': 'Workspace Check',
    },
    implementationStatuses: {
      missing: 'Missing',
      planned: 'Planned',
      active: 'Active',
      passing: 'Passing',
      failing: 'Failing',
      'needs-review': 'Needs Review',
      skipped: 'Skipped',
    },
    relationships: 'Relationships',
    relationKinds: {
      relates: 'Relates',
      dependsOn: 'Depends On',
      inherits: 'Inherits',
      references: 'References',
      refines: 'Refines',
      satisfies: 'Satisfies',
      verifies: 'Verifies',
      explains: 'Explains',
      exercises: 'Exercises',
      requires: 'Requires',
      owns: 'Owns',
      supports: 'Supports',
      provides: 'Provides',
      omits: 'Omits',
    },
    relationTargetKinds: {
      contracts: 'Contracts',
      prototypes: 'Prototypes',
      modules: 'Modules',
      adapters: 'Adapters',
      decisions: 'Decisions',
      hostCaps: 'Host Capabilities',
      tests: 'Tests',
      knowledge: 'Knowledge',
    },
    semanticDiff: 'Semantic Diff',
    added: 'Added',
    removed: 'Removed',
    revised: 'Revised',
    none: 'None',
    explicitRelations: 'Explicit relations',
    graphProjection: 'Graph Projection',
    noActiveEdges: 'No active edges in this snapshot.',
    validation: 'Validation',
    noIssues: 'No validation issues.',
    noOpenQuestions: 'No unresolved work items.',
    file: 'File',
    language: 'Language',
    entityTypes: {
      contract: 'Contracts',
      prototype: 'Prototypes',
      module: 'Modules',
      adapter: 'Adapters',
      decision: 'Decisions',
      'host-cap': 'Host Capabilities',
      test: 'Tests',
      version: 'Versions',
      knowledge: 'Knowledge',
    },
  },
  zh: {
    loading: '正在加载 Spec Workspace...',
    appTitle: '语义工作台',
    from: '起始版本',
    to: '目标版本',
    navLabel: 'Spec 实体',
    quickJump: '跳转',
    scope: '族',
    entities: '实体',
    graphNodes: '图节点',
    graphEdges: '图关系',
    criteria: '判定准则',
    cases: '用例',
    implementations: '工程落点',
    openQuestions: '断口',
    issues: '问题',
    id: 'ID',
    status: '状态',
    since: '引入版本',
    noEntity: '未选择实体。',
    statement: '契约陈述',
    adapterProfile: 'Adapter Profile',
    packageName: 'Package',
    platform: '平台',
    runtime: 'Runtime',
    versionRange: '版本范围',
    anatomy: '解剖学',
    family: '家族',
    roles: '角色',
    relations: '关系',
    profiles: 'Profile',
    cardinality: '基数',
    requires: '要求',
    rationale: '理由',
    blocks: '阻塞项',
    covers: '覆盖',
    consumes: '消费',
    exercises: '演练',
    expectation: '预期',
    implementationStatus: '落点状态',
    primary: '主落点',
    supporting: '辅助落点',
    coveredBy: '覆盖落点',
    note: '备注',
    notes: '备注',
    path: '路径',
    required: '必需',
    optional: '可选',
    implementationKinds: {
      fixture: '共享 Fixture',
      'module-test': 'Module 测试',
      'adapter-test': 'Adapter 测试',
      'runtime-test': 'Runtime 测试',
      'workspace-check': 'Workspace 校验',
    },
    implementationStatuses: {
      missing: '缺失',
      planned: '计划中',
      active: '已启用',
      passing: '通过',
      failing: '失败',
      'needs-review': '待复核',
      skipped: '跳过',
    },
    relationships: '实体关系',
    relationKinds: {
      relates: '关联',
      dependsOn: '依赖',
      inherits: '继承',
      references: '参考',
      refines: '细化',
      satisfies: '满足',
      verifies: '验证',
      explains: '解释',
      exercises: '演练',
      requires: '要求',
      owns: '拥有',
      supports: '支持',
      provides: '提供',
      omits: '不接入',
    },
    relationTargetKinds: {
      contracts: '契约',
      prototypes: '原型',
      modules: '模块',
      adapters: 'Adapter',
      decisions: '决策',
      hostCaps: 'Host 能力',
      tests: '测试',
      knowledge: '知识',
    },
    semanticDiff: '语义差异',
    added: '新增',
    removed: '移除',
    revised: '修订',
    none: '无',
    explicitRelations: '显式关系',
    graphProjection: '图谱投影',
    noActiveEdges: '当前快照没有有效关系。',
    validation: '校验',
    noIssues: '没有校验问题。',
    noOpenQuestions: '没有待解决断口。',
    file: '文件',
    language: '语言',
    entityTypes: {
      contract: '契约',
      prototype: '原型',
      module: '模块',
      adapter: 'Adapter',
      decision: '决策',
      'host-cap': 'Host 能力',
      test: '测试',
      version: '版本',
      knowledge: '知识',
    },
  },
} as const;

type UiText = (typeof UI_TEXT)[Locale];

type SpecWorkspaceDataset = {
  generatedAt: string;
  releases: Array<{
    entityId: string;
    status: 'draft' | 'active';
    version: string;
    channel: 'prerelease' | 'stable';
    gitTag: string;
    npmDistTag: string;
    packageVersionPolicy: 'exact';
    packageScope: 'public-@proto.ui';
    publishedAt?: string;
    commit?: string;
    specSnapshotDigest?: string;
  }>;
  versions: string[];
  latestVersion: string;
  entities: SpecEntity[];
  issues: Array<{ filePath?: string; message: string }>;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; dataset: SpecWorkspaceDataset }
  | { status: 'error'; message: string };

function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [locale, setLocale] = useState<Locale>('zh');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fromVersion, setFromVersion] = useState('0.1.0');
  const [toVersion, setToVersion] = useState('0.2.0');
  const t = UI_TEXT[locale];

  useEffect(() => {
    let active = true;

    fetch('/spec-workspace.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load spec dataset: ${response.status}`);
        return response.json() as Promise<SpecWorkspaceDataset>;
      })
      .then((dataset) => {
        if (!active) return;

        setLoadState({ status: 'ready', dataset });
        setSelectedId(getEntityIdFromLocation(dataset.entities) ?? dataset.entities[0]?.id ?? null);
        setFromVersion(dataset.versions[0] ?? dataset.latestVersion);
        setToVersion(dataset.latestVersion);
      })
      .catch((error) => {
        if (!active) return;
        setLoadState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loadState.status !== 'ready') return;

    const syncSelectedIdFromLocation = () => {
      const routeId = getEntityIdFromLocation(loadState.dataset.entities);
      if (routeId) setSelectedId(routeId);
    };

    window.addEventListener('hashchange', syncSelectedIdFromLocation);
    window.addEventListener('popstate', syncSelectedIdFromLocation);
    syncSelectedIdFromLocation();

    return () => {
      window.removeEventListener('hashchange', syncSelectedIdFromLocation);
      window.removeEventListener('popstate', syncSelectedIdFromLocation);
    };
  }, [loadState]);

  const handleSelectEntity = useCallback((id: string) => {
    setSelectedId(id);
    writeEntityRoute(id);
  }, []);

  if (loadState.status === 'loading') return <main className="status-page">{t.loading}</main>;
  if (loadState.status === 'error') return <main className="status-page">{loadState.message}</main>;

  const dataset = loadState.dataset;
  const workspace = createSpecWorkspace(dataset.entities);
  const snapshot = getSpecSnapshot(workspace, toVersion);
  const diff = diffSpecSnapshots(getSpecSnapshot(workspace, fromVersion), snapshot);
  const graph = buildSpecGraph(snapshot);
  const selectedEntity =
    snapshot.entities.find((entity) => entity.id === selectedId) ?? snapshot.entities[0] ?? null;

  return (
    <WorkspaceView
      dataset={dataset}
      snapshot={snapshot}
      diff={diff}
      graph={graph}
      selectedEntity={selectedEntity}
      selectedId={selectedEntity?.id ?? null}
      locale={locale}
      t={t}
      fromVersion={fromVersion}
      toVersion={toVersion}
      onSelectEntity={handleSelectEntity}
      onSelectLocale={setLocale}
      onSelectFromVersion={setFromVersion}
      onSelectToVersion={setToVersion}
    />
  );
}

function WorkspaceView(props: {
  dataset: SpecWorkspaceDataset;
  snapshot: SpecSnapshot;
  diff: SpecSnapshotDiff;
  graph: SpecGraph;
  selectedEntity: SpecEntity | null;
  selectedId: string | null;
  locale: Locale;
  t: UiText;
  fromVersion: string;
  toVersion: string;
  onSelectEntity(id: string): void;
  onSelectLocale(locale: Locale): void;
  onSelectFromVersion(version: string): void;
  onSelectToVersion(version: string): void;
}) {
  const entityGroups = useMemo(
    () => groupEntitiesByType(props.snapshot.entities),
    [props.snapshot.entities]
  );
  const typeSummaries = useMemo(
    () =>
      getOrderedEntityTypes(entityGroups).map((type) => ({
        type,
        entities: entityGroups[type] ?? [],
      })),
    [entityGroups]
  );
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());
  const selectedEntity = props.selectedEntity;

  useEffect(() => {
    if (!selectedEntity) return;

    const scopeKey = getEntityScopeKey(selectedEntity);
    setExpandedScopes((previous) => {
      if (previous.has(scopeKey)) return previous;
      const next = new Set(previous);
      next.add(scopeKey);
      return next;
    });
  }, [selectedEntity]);

  const criteriaCount = props.snapshot.entities.reduce(
    (count, entity) => count + entity.criteria.length,
    0
  );
  const openQuestionCount = props.snapshot.entities.reduce(
    (count, entity) => count + entity.openQuestions.length,
    0
  );
  const toggleScope = (scopeKey: string) => {
    setExpandedScopes((previous) => {
      const next = new Set(previous);
      if (next.has(scopeKey)) next.delete(scopeKey);
      else next.add(scopeKey);
      return next;
    });
  };

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Proto UI</p>
            <h1>{props.t.appTitle}</h1>
          </div>
          <span className="version-pill">{props.toVersion}</span>
        </div>

        <div className="language-control" aria-label={props.t.language}>
          <button
            className={props.locale === 'zh' ? 'active' : ''}
            type="button"
            onClick={() => props.onSelectLocale('zh')}
          >
            中文
          </button>
          <button
            className={props.locale === 'en' ? 'active' : ''}
            type="button"
            onClick={() => props.onSelectLocale('en')}
          >
            English
          </button>
        </div>

        <div className="version-controls">
          <label>
            <span>{props.t.from}</span>
            <select
              value={props.fromVersion}
              onChange={(event) => props.onSelectFromVersion(event.target.value)}
            >
              {props.dataset.versions.map((version) => (
                <option key={version}>{version}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{props.t.to}</span>
            <select
              value={props.toVersion}
              onChange={(event) => props.onSelectToVersion(event.target.value)}
            >
              {props.dataset.versions.map((version) => (
                <option key={version}>{version}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="entity-jumpbar" aria-label={props.t.quickJump}>
          {typeSummaries.map(({ type, entities }) => (
            <button
              className={selectedEntity?.type === type ? 'active' : ''}
              key={type}
              title={props.t.entityTypes[type] ?? type}
              type="button"
              onClick={() => scrollEntityTypeIntoView(type)}
            >
              <span>{getEntityTypePrefix(type)}</span>
              <small>{entities.length}</small>
            </button>
          ))}
        </div>

        <nav className="entity-nav" aria-label={props.t.navLabel}>
          {typeSummaries.map(({ type, entities }) => (
            <section id={getEntityTypeSectionId(type)} key={type}>
              <h2>
                {props.t.entityTypes[type] ?? type}
                <span>{entities.length}</span>
              </h2>
              {groupEntitiesByScope(entities).map((scope) => {
                const scopeKey = getScopeKey(type, scope.name);
                const expanded = expandedScopes.has(scopeKey);
                const selectedInScope = scope.entities.some(
                  (entity) => entity.id === props.selectedId
                );

                return (
                  <div className="entity-scope" key={scopeKey}>
                    <button
                      aria-expanded={expanded}
                      className={`scope-toggle ${selectedInScope ? 'active' : ''}`}
                      type="button"
                      onClick={() => toggleScope(scopeKey)}
                    >
                      <span>{scope.name}</span>
                      <small>{scope.entities.length}</small>
                    </button>
                    {expanded ? (
                      <div className="scope-entities">
                        {scope.entities.map((entity) => (
                          <button
                            className={
                              entity.id === props.selectedId ? 'entity-link active' : 'entity-link'
                            }
                            key={entity.id}
                            type="button"
                            onClick={() => props.onSelectEntity(entity.id)}
                          >
                            <strong>{entity.id}</strong>
                            <span>{renderInlineText(entity.title)}</span>
                            {entity.openQuestions.length > 0 ? (
                              <em>{entity.openQuestions.length}</em>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <SummaryMetric label={props.t.entities} value={props.snapshot.entities.length} />
          <SummaryMetric label={props.t.graphNodes} value={props.graph.nodes.length} />
          <SummaryMetric label={props.t.graphEdges} value={props.graph.edges.length} />
          <SummaryMetric label={props.t.criteria} value={criteriaCount} />
          <SummaryMetric
            label={props.t.openQuestions}
            value={openQuestionCount}
            tone={openQuestionCount > 0 ? 'warn' : 'ok'}
          />
          <SummaryMetric
            label={props.t.issues}
            value={props.dataset.issues.length}
            tone={props.dataset.issues.length > 0 ? 'warn' : 'ok'}
          />
        </header>

        <section className="main-grid">
          <EntityInspector
            entity={props.selectedEntity}
            locale={props.locale}
            t={props.t}
            onSelectEntity={props.onSelectEntity}
          />
          <DiffPanel diff={props.diff} t={props.t} />
          <GraphPanel
            entities={props.snapshot.entities}
            graph={props.graph}
            locale={props.locale}
            selectedId={props.selectedId}
            t={props.t}
            onSelectEntity={props.onSelectEntity}
          />
          <OpenQuestionsPanel
            entities={props.snapshot.entities}
            locale={props.locale}
            t={props.t}
            onSelectEntity={props.onSelectEntity}
          />
          <IssuesPanel issues={props.dataset.issues} t={props.t} />
        </section>
      </section>
    </main>
  );
}

function SummaryMetric(props: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`metric ${props.tone ?? ''}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function EntityInspector(props: {
  entity: SpecEntity | null;
  locale: Locale;
  t: UiText;
  onSelectEntity(id: string): void;
}) {
  if (!props.entity) {
    return <section className="panel">{props.t.noEntity}</section>;
  }

  const entity = props.entity;
  const caseImplementations = getCaseImplementations(entity);
  const sortedImplementations = [...entity.implementations].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return (
    <section className="panel entity-panel">
      <div className="panel-heading">
        <p className="eyebrow">{entity.type}</p>
        <h2>{renderInlineText(entity.title)}</h2>
      </div>
      <dl className="entity-meta">
        <div>
          <dt>ID</dt>
          <dd>{entity.id}</dd>
        </div>
        <div>
          <dt>{props.t.status}</dt>
          <dd>{entity.status}</dd>
        </div>
        <div>
          <dt>{props.t.since}</dt>
          <dd>{entity.since}</dd>
        </div>
      </dl>
      {entity.summary ? <p className="summary">{renderInlineText(entity.summary)}</p> : null}
      {entity.statement ? (
        <section className="detail-section">
          <h3>{props.t.statement}</h3>
          <p>{renderLocalizedText(entity.statement, props.locale)}</p>
        </section>
      ) : null}
      {entity.anatomy ? (
        <AnatomySection anatomy={entity.anatomy} locale={props.locale} t={props.t} />
      ) : null}
      {entity.adapterProfile ? (
        <AdapterProfileSection profile={entity.adapterProfile} t={props.t} />
      ) : null}
      {entity.criteria.length > 0 ? (
        <section className="detail-section">
          <h3>{props.t.criteria}</h3>
          <div className="criteria-list">
            {entity.criteria.map((criterion) => (
              <article
                className="criterion-row"
                data-criterion-id={criterion.id}
                key={criterion.id}
              >
                <strong>{criterion.id}</strong>
                <p>{renderLocalizedText(criterion.text, props.locale)}</p>
                {criterion.rationale ? (
                  <p className="rationale">
                    <span>{props.t.rationale}: </span>
                    {renderLocalizedText(criterion.rationale, props.locale)}
                  </p>
                ) : null}
                <RelationList
                  compact
                  relations={criterion.dependsOn}
                  title={props.t.relationKinds.dependsOn}
                  t={props.t}
                  onSelectEntity={props.onSelectEntity}
                />
                <RelationList
                  compact
                  relations={criterion.references}
                  title={props.t.relationKinds.references}
                  t={props.t}
                  onSelectEntity={props.onSelectEntity}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {entity.openQuestions.length > 0 ? (
        <section className="detail-section">
          <h3>{props.t.openQuestions}</h3>
          <div className="issue-list compact">
            {entity.openQuestions.map((question) => (
              <article className="issue-row" key={question.id}>
                <p className="issue-file">{question.id}</p>
                <p>{renderLocalizedText(question.question, props.locale)}</p>
                {question.context ? (
                  <p className="issue-context">
                    {renderLocalizedText(question.context, props.locale)}
                  </p>
                ) : null}
                {question.blocks.length > 0 ? (
                  <p className="blocked-items">
                    {props.t.blocks}: {question.blocks.join(', ')}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {entity.cases.length > 0 ? (
        <section className="detail-section">
          <h3>{props.t.cases}</h3>
          <div className="criteria-list">
            {entity.cases.map((testCase) => (
              <article className="criterion-row" key={testCase.id}>
                <strong>{testCase.id}</strong>
                <p>{renderInlineText(testCase.title)}</p>
                <p className="rationale">
                  <span>{props.t.expectation}: </span>
                  {renderInlineText(testCase.expectation)}
                </p>
                {testCase.covers.length > 0 ? (
                  <p className="rationale">
                    <span>{props.t.covers}: </span>
                    {testCase.covers.join(', ')}
                  </p>
                ) : null}
                {(caseImplementations.get(testCase.id) ?? []).length > 0 ? (
                  <CaseCoverageList
                    label={props.t.coveredBy}
                    implementations={caseImplementations.get(testCase.id) ?? []}
                    t={props.t}
                  />
                ) : null}
                {testCase.notes.length > 0 ? (
                  <ul className="case-notes">
                    {testCase.notes.map((note) => (
                      <li key={note}>{renderInlineText(note)}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {entity.implementations.length > 0 ? (
        <section className="detail-section">
          <h3>{props.t.implementations}</h3>
          <div className="implementation-list">
            {sortedImplementations.map((implementation) => (
              <article
                className={`implementation-card status-${implementation.status} ${
                  implementation.required ? 'is-primary' : 'is-supporting'
                }`}
                key={implementation.id}
              >
                <div className="implementation-header">
                  <strong>{implementation.id}</strong>
                  <div className="implementation-tags">
                    <span className="kind-badge">
                      {props.t.implementationKinds[implementation.kind]}
                    </span>
                    <span className={`status-badge status-${implementation.status}`}>
                      {props.t.implementationStatuses[implementation.status]}
                    </span>
                    <span
                      className={implementation.required ? 'primary-badge' : 'supporting-badge'}
                    >
                      {implementation.required ? props.t.primary : props.t.supporting}
                    </span>
                  </div>
                </div>
                {implementation.path ? (
                  <p className="implementation-path">
                    <span>{props.t.path}</span>
                    <code>{implementation.path}</code>
                  </p>
                ) : null}
                <ImplementationChipGroup
                  label={props.t.consumes}
                  values={implementation.consumesCases}
                />
                <ImplementationChipGroup
                  label={props.t.exercises}
                  values={implementation.exercises}
                />
                {implementation.notes.length > 0 ? (
                  <div className="implementation-notes">
                    <span>{props.t.notes}</span>
                    <ul>
                      {implementation.notes.map((note) => (
                        <li key={note}>{renderInlineText(note)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="detail-section">
        <h3>{props.t.relationships}</h3>
        {SPEC_RELATION_KINDS.map((relationKind) => (
          <RelationList
            key={relationKind}
            title={props.t.relationKinds[relationKind]}
            relations={entity[relationKind]}
            t={props.t}
            onSelectEntity={props.onSelectEntity}
          />
        ))}
      </section>
    </section>
  );
}

function AnatomySection(props: {
  anatomy: NonNullable<SpecEntity['anatomy']>;
  locale: Locale;
  t: UiText;
}) {
  const roles = Object.entries(props.anatomy.roles);
  const profiles = Object.entries(props.anatomy.profiles);

  return (
    <section className="detail-section anatomy-section">
      <h3>{props.t.anatomy}</h3>
      <div className="anatomy-family">
        <span>{props.t.family}</span>
        <code>{props.anatomy.family}</code>
      </div>
      <div className="anatomy-grid">
        <div className="anatomy-block">
          <h4>{props.t.roles}</h4>
          <div className="anatomy-role-list">
            {roles.map(([roleName, role]) => (
              <article className="anatomy-role" key={roleName}>
                <strong>{roleName}</strong>
                <small>
                  {props.t.cardinality}: {formatCardinality(role.cardinality)}
                </small>
                {role.summary ? <p>{renderLocalizedText(role.summary, props.locale)}</p> : null}
                {role.requires.length > 0 ? (
                  <div className="anatomy-requires">
                    <span>{props.t.requires}</span>
                    {role.requires.map((requirement) => (
                      <code key={`${requirement.kind}:${requirement.name}`}>
                        {requirement.kind}:{requirement.name}
                      </code>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
        <div className="anatomy-block">
          <h4>{props.t.relations}</h4>
          {props.anatomy.relations.length > 0 ? (
            <div className="anatomy-relation-list">
              {props.anatomy.relations.map((relation, index) => (
                <code key={`${relation.kind}:${relation.parent}:${relation.child}:${index}`}>
                  {relation.kind}({relation.parent}, {relation.child})
                </code>
              ))}
            </div>
          ) : (
            <p className="empty">{props.t.none}</p>
          )}
        </div>
      </div>
      {profiles.length > 0 ? (
        <div className="anatomy-block anatomy-profiles">
          <h4>{props.t.profiles}</h4>
          <div className="anatomy-role-list">
            {profiles.map(([profileName, profile]) => (
              <article className="anatomy-role" key={profileName}>
                <strong>{profileName}</strong>
                {Object.entries(profile.roles).map(([roleName, role]) => (
                  <small key={roleName}>
                    {roleName}
                    {role.cardinality ? ` ${formatPartialCardinality(role.cardinality)}` : ''}
                  </small>
                ))}
                {profile.relations.map((relation, index) => (
                  <code key={`${relation.kind}:${relation.parent}:${relation.child}:${index}`}>
                    {relation.kind}({relation.parent}, {relation.child})
                  </code>
                ))}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AdapterProfileSection(props: {
  profile: NonNullable<SpecEntity['adapterProfile']>;
  t: UiText;
}) {
  return (
    <section className="detail-section">
      <h3>{props.t.adapterProfile}</h3>
      <dl className="entity-meta">
        <div>
          <dt>{props.t.packageName}</dt>
          <dd>{props.profile.package}</dd>
        </div>
        <div>
          <dt>{props.t.platform}</dt>
          <dd>{props.profile.target.platform}</dd>
        </div>
        {props.profile.target.runtime ? (
          <>
            <div>
              <dt>{props.t.runtime}</dt>
              <dd>{props.profile.target.runtime.name}</dd>
            </div>
            <div>
              <dt>{props.t.versionRange}</dt>
              <dd>{props.profile.target.runtime.versionRange ?? '—'}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function formatCardinality(cardinality: { min: number; max: number | '*' }): string {
  return `${cardinality.min}..${cardinality.max}`;
}

function formatPartialCardinality(cardinality: { min?: number; max?: number | '*' }): string {
  const min = cardinality.min ?? '*';
  const max = cardinality.max ?? '*';
  return `${min}..${max}`;
}

function CaseCoverageList(props: {
  label: string;
  implementations: SpecEntity['implementations'];
  t: UiText;
}) {
  return (
    <div className="case-coverage">
      <span>{props.label}</span>
      <div>
        {props.implementations.map((implementation) => (
          <span
            className={`coverage-chip ${implementation.required ? 'is-primary' : 'is-supporting'}`}
            key={implementation.id}
          >
            <code>{implementation.id}</code>
            <small>{props.t.implementationStatuses[implementation.status]}</small>
            <small>{implementation.required ? props.t.primary : props.t.supporting}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function ImplementationChipGroup(props: { label: string; values: string[] }) {
  if (props.values.length === 0) return null;

  return (
    <div className="implementation-chip-group">
      <span>{props.label}</span>
      <div>
        {props.values.map((value) => (
          <code key={value}>{value}</code>
        ))}
      </div>
    </div>
  );
}

function getCaseImplementations(entity: SpecEntity): Map<string, SpecEntity['implementations']> {
  const caseImplementations = new Map<string, SpecEntity['implementations']>();

  for (const implementation of entity.implementations) {
    for (const caseId of implementation.consumesCases) {
      const implementations = caseImplementations.get(caseId) ?? [];
      implementations.push(implementation);
      caseImplementations.set(caseId, implementations);
    }
  }

  for (const [caseId, implementations] of caseImplementations) {
    implementations.sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    caseImplementations.set(caseId, implementations);
  }

  return caseImplementations;
}

function RelationList(props: {
  title: string;
  relations: SpecRelations;
  t: UiText;
  compact?: boolean;
  onSelectEntity?(id: string): void;
}) {
  if (!props.relations) return null;

  const entries = Object.entries(props.relations).flatMap(([kind, targets]) =>
    (targets ?? []).map((target) => ({ kind: kind as keyof NonNullable<SpecRelations>, target }))
  );

  if (entries.length === 0) return null;

  return (
    <div className={props.compact ? 'relations compact-relations' : 'relations'}>
      <h3>{props.title}</h3>
      <div className="relation-list">
        {entries.map(({ kind, target }) => (
          <RelationChip
            key={`${kind}:${target.id}`}
            kind={kind}
            target={target}
            t={props.t}
            onSelectEntity={props.onSelectEntity}
          />
        ))}
      </div>
    </div>
  );
}

function RelationChip(props: {
  kind: keyof NonNullable<SpecRelations>;
  target: SpecRelationTarget;
  t: UiText;
  onSelectEntity?(id: string): void;
}) {
  const content = (
    <>
      <strong>{props.target.id}</strong>
      <small>{props.t.relationTargetKinds[props.kind]}</small>
      {props.target.anchors?.length ? <small>{props.target.anchors.join(', ')}</small> : null}
      {props.target.role ? <small>role={props.target.role}</small> : null}
      {props.target.coverageImpact ? (
        <small>coverageImpact={props.target.coverageImpact}</small>
      ) : null}
      {props.target.note ? <small>{props.target.note}</small> : null}
    </>
  );

  if (!props.onSelectEntity) {
    return <span className="relation-chip">{content}</span>;
  }

  return (
    <button
      className="relation-chip relation-button"
      data-relation-kind={props.kind}
      data-relation-target={props.target.id}
      type="button"
      onClick={() => props.onSelectEntity?.(props.target.id)}
    >
      {content}
    </button>
  );
}

function DiffPanel(props: { diff: SpecSnapshotDiff; t: UiText }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">
          {props.diff.fromVersion} to {props.diff.toVersion}
        </p>
        <h2>{props.t.semanticDiff}</h2>
      </div>
      <div className="diff-grid">
        <DiffColumn title={props.t.added} entities={props.diff.added} emptyLabel={props.t.none} />
        <DiffColumn
          title={props.t.removed}
          entities={props.diff.removed}
          emptyLabel={props.t.none}
        />
        <DiffColumn
          title={props.t.revised}
          entities={props.diff.revised.map((entry) => entry.after)}
          emptyLabel={props.t.none}
        />
      </div>
    </section>
  );
}

function DiffColumn(props: { title: string; entities: SpecEntity[]; emptyLabel: string }) {
  return (
    <div className="diff-column">
      <h3>{props.title}</h3>
      {props.entities.length === 0 ? (
        <p className="empty">{props.emptyLabel}</p>
      ) : (
        props.entities.map((entity) => (
          <span className="diff-item" key={entity.id}>
            {entity.id}
          </span>
        ))
      )}
    </div>
  );
}

function GraphPanel(props: {
  entities: SpecEntity[];
  graph: SpecGraph;
  locale: Locale;
  selectedId: string | null;
  t: UiText;
  onSelectEntity(id: string): void;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const visibleGraph = useMemo(
    () => getVisibleGraphProjection(props.graph, props.selectedId),
    [props.graph, props.selectedId]
  );
  const layout = useMemo(
    () => createGraphLayout(visibleGraph, props.selectedId),
    [visibleGraph, props.selectedId]
  );
  const entityById = useMemo(
    () => new Map(props.entities.map((entity) => [entity.id, entity])),
    [props.entities]
  );
  const hoveredEntity = hoveredNodeId ? (entityById.get(hoveredNodeId) ?? null) : null;
  const hoveredPoint = hoveredNodeId ? (layout.get(hoveredNodeId) ?? null) : null;

  return (
    <section className="panel graph-panel">
      <div className="panel-heading">
        <p className="eyebrow">{props.t.explicitRelations}</p>
        <h2>{props.t.graphProjection}</h2>
      </div>
      <div className="graph-canvas" aria-label={props.t.graphProjection}>
        {visibleGraph.edges.length === 0 ? (
          <p className="empty">{props.t.noActiveEdges}</p>
        ) : (
          <svg role="img" viewBox="0 0 820 580">
            <defs>
              <marker
                id="arrowhead"
                markerHeight="6"
                markerUnits="userSpaceOnUse"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="3"
              >
                <path d="M0,0 L8,3 L0,6 Z" />
              </marker>
            </defs>
            <g className="graph-edges">
              {visibleGraph.edges.map((edge) => {
                const from = layout.get(edge.from);
                const to = layout.get(edge.to);
                if (!from || !to) return null;
                const clipped = getClippedEdge(
                  from,
                  to,
                  getGraphNodeRadius(edge.from, props.selectedId),
                  getGraphNodeRadius(edge.to, props.selectedId)
                );
                const direct =
                  props.selectedId === null ||
                  edge.from === props.selectedId ||
                  edge.to === props.selectedId;

                return (
                  <g className={direct ? 'direct' : 'context'} key={edge.id}>
                    <line
                      markerEnd="url(#arrowhead)"
                      x1={clipped.x1}
                      y1={clipped.y1}
                      x2={clipped.x2}
                      y2={clipped.y2}
                    />
                    <text x={(clipped.x1 + clipped.x2) / 2} y={(clipped.y1 + clipped.y2) / 2}>
                      {props.t.relationKinds[edge.kind]}
                    </text>
                  </g>
                );
              })}
            </g>
            <g className="graph-nodes">
              {visibleGraph.nodes.map((node) => {
                const point = layout.get(node.id);
                if (!point) return null;

                return (
                  <g
                    className={`graph-node type-${node.type} active`}
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    transform={`translate(${point.x} ${point.y})`}
                    onClick={() => props.onSelectEntity(node.id)}
                    onFocus={() => setHoveredNodeId(node.id)}
                    onBlur={() => setHoveredNodeId(null)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        props.onSelectEntity(node.id);
                      }
                    }}
                  >
                    <circle r={getGraphNodeRadius(node.id, props.selectedId)} />
                    <title>{node.id}</title>
                    <text>{compactSpecId(node.id)}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {hoveredEntity && hoveredPoint ? (
          <GraphHoverCard
            entity={hoveredEntity}
            locale={props.locale}
            point={hoveredPoint}
            t={props.t}
          />
        ) : null}
      </div>
      <div className="edge-list">
        {visibleGraph.edges.slice(0, 12).map((edge) => (
          <div className="edge-row" key={edge.id}>
            <span>{edge.from}</span>
            <strong>{props.t.relationKinds[edge.kind]}</strong>
            <span>{edge.to}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GraphHoverCard(props: {
  entity: SpecEntity;
  locale: Locale;
  point: { x: number; y: number };
  t: UiText;
}) {
  const placement = props.point.y < 140 ? 'below' : 'above';
  const description = getGraphHoverDescription(props.entity, props.locale);

  return (
    <div
      className={`graph-hover-card is-${placement}`}
      style={{
        left: `${(props.point.x / 820) * 100}%`,
        top: `${(props.point.y / 580) * 100}%`,
      }}
    >
      <strong>{props.entity.id}</strong>
      <p className="graph-hover-title">{renderInlineText(props.entity.title)}</p>
      {description ? <p>{renderInlineText(description)}</p> : null}
      <div>
        <span>
          {props.t.criteria}: {props.entity.criteria.length}
        </span>
        <span>
          {props.t.cases}: {props.entity.cases.length}
        </span>
        <span>
          {props.t.openQuestions}: {props.entity.openQuestions.length}
        </span>
      </div>
    </div>
  );
}

function getGraphHoverDescription(entity: SpecEntity, locale: Locale): string {
  if (entity.statement) {
    return formatLocalizedText(entity.statement, locale);
  }

  return entity.summary ?? '';
}

function OpenQuestionsPanel(props: {
  entities: SpecEntity[];
  locale: Locale;
  t: UiText;
  onSelectEntity(id: string): void;
}) {
  const questions = props.entities.flatMap((entity) =>
    entity.openQuestions.map((question) => ({ entity, question }))
  );

  return (
    <section className="panel work-panel">
      <div className="panel-heading">
        <p className="eyebrow">WIP</p>
        <h2>
          {props.t.openQuestions}
          <span>{questions.length}</span>
        </h2>
      </div>
      {questions.length === 0 ? (
        <p className="empty">{props.t.noOpenQuestions}</p>
      ) : (
        <div className="issue-list">
          {questions.map(({ entity, question }) => (
            <article className="issue-row" key={question.id}>
              <button type="button" onClick={() => props.onSelectEntity(entity.id)}>
                {entity.id}
              </button>
              <p className="issue-file">{question.id}</p>
              <p>{renderLocalizedText(question.question, props.locale)}</p>
              {question.blocks.length > 0 ? (
                <p className="blocked-items">
                  {props.t.blocks}: {question.blocks.join(', ')}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function IssuesPanel(props: { issues: SpecWorkspaceDataset['issues']; t: UiText }) {
  return (
    <section className="panel issues-panel">
      <div className="panel-heading">
        <p className="eyebrow">{props.t.validation}</p>
        <h2>
          {props.t.issues}
          <span>{props.issues.length}</span>
        </h2>
      </div>
      {props.issues.length === 0 ? (
        <p className="empty">{props.t.noIssues}</p>
      ) : (
        <div className="issue-list">
          {props.issues.map((issue, index) => (
            <article className="issue-row" key={`${issue.filePath ?? 'workspace'}:${index}`}>
              {issue.filePath ? (
                <p className="issue-file">
                  {props.t.file}: {issue.filePath}
                </p>
              ) : null}
              <p>{issue.message}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function groupEntitiesByType(entities: SpecEntity[]): Record<string, SpecEntity[]> {
  return entities.reduce<Record<string, SpecEntity[]>>((groups, entity) => {
    groups[entity.type] ??= [];
    groups[entity.type].push(entity);
    return groups;
  }, {});
}

function getVisibleGraphProjection(graph: SpecGraph, selectedId: string | null): SpecGraph {
  if (!selectedId) return graph;

  const visibleIds = getHighlightedGraphIds(graph, selectedId);
  const visibleNodes = graph.nodes.filter((node) => visibleIds.has(node.id));
  const visibleEdges = graph.edges.filter(
    (edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)
  );

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
  };
}

function groupEntitiesByScope(
  entities: SpecEntity[]
): Array<{ name: string; entities: SpecEntity[] }> {
  const groups = entities.reduce<Record<string, SpecEntity[]>>((result, entity) => {
    const scope = getSpecScope(entity.id);
    result[scope] ??= [];
    result[scope].push(entity);
    return result;
  }, {});

  return Object.entries(groups)
    .map(([name, scopeEntities]) => ({
      name,
      entities: [...scopeEntities].sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatLocalizedText(
  value: string | { en?: string | undefined; 'zh-CN'?: string | undefined },
  locale: Locale
): string {
  if (typeof value === 'string') return value;

  if (locale === 'zh') {
    return value['zh-CN'] ?? value.en ?? '';
  }

  return value.en ?? value['zh-CN'] ?? '';
}

function renderLocalizedText(
  value: string | { en?: string | undefined; 'zh-CN'?: string | undefined },
  locale: Locale
): ReactNode {
  return renderInlineText(formatLocalizedText(value, locale));
}

function renderInlineText(value: string): ReactNode {
  const parts = value.split(/(`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}

function createGraphLayout(
  graph: SpecGraph,
  selectedId: string | null
): Map<string, { x: number; y: number }> {
  const center = { x: 410, y: 280 };
  const layout = new Map<string, { x: number; y: number }>();

  if (graph.nodes.length === 1) {
    layout.set(graph.nodes[0].id, center);
    return layout;
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  if (selectedId && nodeIds.has(selectedId)) {
    const incoming = new Set<string>();
    const outgoing = new Set<string>();

    for (const edge of graph.edges) {
      if (edge.to === selectedId && edge.from !== selectedId) incoming.add(edge.from);
      if (edge.from === selectedId && edge.to !== selectedId) outgoing.add(edge.to);
    }

    const bidirectional = [...incoming].filter((id) => outgoing.has(id)).sort();
    const left = [...incoming].filter((id) => !outgoing.has(id)).sort();
    const right = [...outgoing].filter((id) => !incoming.has(id)).sort();

    layout.set(selectedId, center);
    placeVerticalGraphGroup(layout, left, 140, 110, 450);
    placeVerticalGraphGroup(layout, right, 680, 110, 450);
    placeHorizontalGraphGroup(layout, bidirectional, 250, 570, 84);

    const placed = new Set(layout.keys());
    const context = graph.nodes
      .filter((node) => !placed.has(node.id))
      .sort((a, b) => compareGraphNodes(a, b));
    placeContextGraphNodes(layout, context, placed);

    return layout;
  }

  const levels = createRelationLevels(graph);
  const levelsByValue = new Map<number, SpecGraph['nodes']>();

  for (const node of [...graph.nodes].sort(compareGraphNodes)) {
    const level = levels.get(node.id) ?? 0;
    const nodes = levelsByValue.get(level) ?? [];
    nodes.push(node);
    levelsByValue.set(level, nodes);
  }

  const orderedLevels = [...levelsByValue.keys()].sort((a, b) => a - b);
  const maxLevelIndex = Math.max(orderedLevels.length - 1, 1);

  orderedLevels.forEach((level, levelIndex) => {
    const nodes = levelsByValue.get(level) ?? [];
    const x = 90 + (levelIndex / maxLevelIndex) * 640;
    placeVerticalGraphGroup(
      layout,
      nodes.map((node) => node.id),
      x,
      70,
      510
    );
  });

  return layout;
}

function createRelationLevels(graph: SpecGraph): Map<string, number> {
  const levels = new Map(graph.nodes.map((node) => [node.id, 0]));
  const ids = new Set(graph.nodes.map((node) => node.id));

  for (let index = 0; index < graph.nodes.length; index += 1) {
    let changed = false;

    for (const edge of graph.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
      const nextLevel = Math.min((levels.get(edge.from) ?? 0) + 1, 6);
      if (nextLevel > (levels.get(edge.to) ?? 0)) {
        levels.set(edge.to, nextLevel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return levels;
}

function placeVerticalGraphGroup(
  layout: Map<string, { x: number; y: number }>,
  ids: string[],
  x: number,
  minY: number,
  maxY: number
) {
  if (ids.length === 0) return;
  if (ids.length === 1) {
    layout.set(ids[0], { x, y: (minY + maxY) / 2 });
    return;
  }

  const step = (maxY - minY) / (ids.length - 1);
  ids.forEach((id, index) => {
    layout.set(id, { x, y: minY + step * index });
  });
}

function placeHorizontalGraphGroup(
  layout: Map<string, { x: number; y: number }>,
  ids: string[],
  minX: number,
  maxX: number,
  y: number
) {
  if (ids.length === 0) return;
  if (ids.length === 1) {
    layout.set(ids[0], { x: (minX + maxX) / 2, y });
    return;
  }

  const step = (maxX - minX) / (ids.length - 1);
  ids.forEach((id, index) => {
    layout.set(id, { x: minX + step * index, y });
  });
}

function placeContextGraphNodes(
  layout: Map<string, { x: number; y: number }>,
  nodes: SpecGraph['nodes'],
  placed: Set<string>
) {
  const columns = 9;
  const startX = 70;
  const gapX = 85;
  const startY = 520;
  const gapY = 32;

  nodes.forEach((node, index) => {
    if (placed.has(node.id)) return;
    const column = index % columns;
    const row = Math.floor(index / columns);
    layout.set(node.id, {
      x: startX + column * gapX,
      y: startY + row * gapY,
    });
  });
}

function compareGraphNodes(a: SpecGraph['nodes'][number], b: SpecGraph['nodes'][number]) {
  const typeDiff = getEntityTypeOrder(a.type) - getEntityTypeOrder(b.type);
  if (typeDiff !== 0) return typeDiff;
  return a.id.localeCompare(b.id);
}

function getHighlightedGraphIds(graph: SpecGraph, selectedId: string | null): Set<string> {
  if (!selectedId) return new Set(graph.nodes.map((node) => node.id));

  const ids = new Set([selectedId]);

  for (const edge of graph.edges) {
    if (edge.from === selectedId) ids.add(edge.to);
    if (edge.to === selectedId) ids.add(edge.from);
  }

  return ids;
}

function compactSpecId(id: string): string {
  const parts = id.split('-');
  if (parts.length <= 3) return id;

  return `${parts[0]}-${parts.at(-2)}-${parts.at(-1)}`;
}

function getClippedEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromRadius: number,
  toRadius: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };

  const ux = dx / length;
  const uy = dy / length;
  const endPadding = toRadius + 8;

  return {
    x1: from.x + ux * fromRadius,
    y1: from.y + uy * fromRadius,
    x2: to.x - ux * endPadding,
    y2: to.y - uy * endPadding,
  };
}

function getGraphNodeRadius(id: string, selectedId: string | null): number {
  return id === selectedId ? 28 : 22;
}

function getEntityTypePrefix(type: SpecEntity['type']): string {
  const prefixes: Record<SpecEntity['type'], string> = {
    contract: 'C',
    prototype: 'P',
    module: 'M',
    adapter: 'A',
    decision: 'D',
    'host-cap': 'HC',
    test: 'T',
    version: 'V',
    knowledge: 'K',
  };

  return prefixes[type];
}

function getOrderedEntityTypes(groups: Record<string, SpecEntity[]>): Array<SpecEntity['type']> {
  return (Object.keys(groups) as Array<SpecEntity['type']>).sort(
    (a, b) => getEntityTypeOrder(a) - getEntityTypeOrder(b)
  );
}

function getEntityTypeOrder(type: SpecEntity['type']): number {
  const order: Record<SpecEntity['type'], number> = {
    contract: 0,
    prototype: 1,
    test: 2,
    module: 3,
    knowledge: 4,
    decision: 5,
    'host-cap': 6,
    adapter: 7,
    version: 8,
  };

  return order[type] ?? 99;
}

function getSpecScope(id: string): string {
  const parts = id.split('-');
  if (parts.length <= 2) return id;
  return parts.slice(0, -1).join('-');
}

function getScopeKey(type: SpecEntity['type'], scope: string): string {
  return `${type}:${scope}`;
}

function getEntityScopeKey(entity: SpecEntity): string {
  return getScopeKey(entity.type, getSpecScope(entity.id));
}

function getEntityTypeSectionId(type: SpecEntity['type']): string {
  return `entity-section-${type}`;
}

function scrollEntityTypeIntoView(type: SpecEntity['type']) {
  document.getElementById(getEntityTypeSectionId(type))?.scrollIntoView({
    block: 'start',
    behavior: 'smooth',
  });
}

function getEntityIdFromLocation(entities: SpecEntity[]): string | null {
  const match = window.location.hash.match(/^#\/entities\/([^/?#]+)$/);
  if (!match) return null;

  const id = decodeURIComponent(match[1]);
  return entities.some((entity) => entity.id === id) ? id : null;
}

function writeEntityRoute(id: string) {
  const nextHash = `#/entities/${encodeURIComponent(id)}`;
  if (window.location.hash === nextHash) return;
  window.history.pushState(null, '', nextHash);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
