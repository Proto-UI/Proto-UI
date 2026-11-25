// Navigation and artifact classes, not a second source of product semantics.
// New Markdown defaults to maintained; exceptions have bounded paths and reasons.
export const repositoryDocPolicy = {
  requiredEntrypoints: [
    'README.md',
    'README.zh-CN.md',
    'CONTRIBUTING.md',
    'AGENTS.md',
    'RELEASE_CHECKLIST.md',
    'apps/README.md',
    'packages/README.md',
    'spec/README.md',
    'docs/README.md',
    'experiments/README.md',
    'benchmarks/README.md',
    'native/README.md',
    'scripts/README.md',
    'shared/README.md',
    'types/README.md',
    'internal/README.md',
    'internal/governance/README.md',
    'internal/governance/documentation-policy.md',
    'internal/releases/README.md',
    'internal/records/README.md',
    'scripts/docs/README.md',
  ],
  scopes: [
    {
      prefix: 'apps/www/src/content/docs/',
      kind: 'website',
      reason:
        'Website routes and localized release projections use check-public-docs and the Astro build.',
    },
    {
      prefix: 'internal/records/',
      kind: 'historical',
      reason:
        'Dated observations retain their original context; the directory README remains maintained.',
      maintainedIndex: true,
    },
    {
      prefix: 'docs/superpowers/',
      kind: 'historical',
      reason:
        'Retained planning records are historical context, not current contribution instructions.',
      maintainedIndex: true,
    },
    ...['docs/evidence/', 'apps/www/test/evidence/'].map((prefix) => ({
      prefix,
      kind: 'evidence',
      reason:
        'Source-bound observations are retained; their links are interpreted against that evidence source.',
      maintainedIndex: true,
    })),
    ...[
      'internal/fixtures/',
      'scripts/coverage-matrices/test/fixtures/',
      'scripts/docs/test/fixtures/',
    ].map((prefix) => ({
      prefix,
      kind: 'fixture',
      reason:
        'Test input may deliberately contain missing paths, obsolete claims or consumer-only commands.',
    })),
  ],
  localProjections: [
    {
      file: 'internal/agent/PROJECT-UNDERSTANDING.zh-CN.md',
      generator: 'scripts/spec/generate-agent-project-understanding.mjs',
      command: 'spec:docs:agent',
      reason:
        'AGENTS.md and spec/README.md require this disposable projection to remain Git-ignored.',
    },
  ],
};
