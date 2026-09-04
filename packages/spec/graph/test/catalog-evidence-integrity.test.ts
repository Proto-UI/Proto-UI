import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const SPEC_DIR = path.join(process.cwd(), 'spec');

type Source = { path?: string };
type Implementation = { id?: string; path?: string; status?: string; consumesCases?: string[] };
type Case = { id?: string };
type Entity = {
  id: string;
  sources?: Source[];
  implementations?: Implementation[];
  cases?: Case[];
};

/**
 * A remote citation is evidence this check cannot resolve, and only a portable
 * scheme counts as remote. `file:` names a path on one machine, so it is not
 * auditable from another checkout and must be treated as a repository path,
 * where the absolute-path rule then rejects it.
 */
function isRepositoryPath(value: string | undefined): value is string {
  return typeof value === 'string' && !/^https?:\/\//i.test(value);
}

/**
 * Resolves under the repository only. A traversal such as `../shared/x.ts`
 * would otherwise be validated against whatever sits beside the checkout, so
 * the result would depend on the machine rather than on the catalog.
 */
/**
 * Everything the commit carries. A generated or ignored file can exist in one
 * checkout and not in another, so resolving on disk is not enough to call it
 * repository evidence.
 */
const TRACKED_FILES: ReadonlySet<string> = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter(Boolean)
);

function contained(candidate: string): boolean {
  const relative = path.relative(REPO_ROOT, candidate);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Resolves under the repository only, and against the real target.
 *
 * An absolute path resolves inside its author's checkout and nowhere else. A
 * traversal reads whatever sits beside the checkout. A symlink can be lexically
 * contained while pointing outside it. All three make the result depend on the
 * machine rather than on the catalog. `requireFile` additionally rejects a
 * directory, which exists but is not executable evidence.
 */
function resolves(value: string, requireFile = false): boolean {
  if (path.isAbsolute(value)) return false;
  const candidate = path.resolve(REPO_ROOT, value);
  if (!contained(candidate) || !existsSync(candidate)) return false;
  const real = realpathSync(candidate);
  if (!contained(real)) return false;
  if (requireFile && !statSync(real).isFile()) return false;
  // A directory is never tracked by name, so only file evidence is checked
  // against the commit.
  if (!statSync(real).isFile()) return true;
  // `git ls-files` reports slash-separated index paths on every platform, while
  // `path.relative` uses the host separator; this suite runs on Windows too.
  return TRACKED_FILES.has(path.relative(REPO_ROOT, real).split(path.sep).join('/'));
}

/**
 * The one status that declares a future target rather than current evidence.
 * `missing` is deliberately not exempt: whether it carries no-file semantics is
 * a schema and lifecycle question, not something this check may decide.
 */
const DECLARED_ABSENT: ReadonlySet<string> = new Set(['planned']);

/**
 * Reports the citations that do not resolve and the cases nothing consumes.
 * Exported so a focused fixture can drive it without a repository scan.
 */
export function collectEvidenceGaps(entities: readonly Entity[]): {
  missingSources: string[];
  missingImplementations: string[];
  orphanCases: string[];
} {
  const missingSources: string[] = [];
  const missingImplementations: string[] = [];
  const orphanCases: string[] = [];

  for (const entity of entities) {
    for (const source of entity.sources ?? []) {
      if (!isRepositoryPath(source.path)) continue;
      if (!resolves(source.path)) missingSources.push(`${entity.id}: ${source.path}`);
    }

    for (const implementation of entity.implementations ?? []) {
      if (implementation.status && DECLARED_ABSENT.has(implementation.status)) continue;
      // An implementation that claims current evidence has to name a file in
      // this repository. Skipping an absent or remote path would let it satisfy
      // the case-consumption invariant below with no executable behind it.
      if (!isRepositoryPath(implementation.path) || !resolves(implementation.path, true)) {
        missingImplementations.push(
          `${entity.id}: ${implementation.id} -> ${implementation.path ?? '(no path)'}`
        );
      }
    }

    const consumed = new Set(
      (entity.implementations ?? []).flatMap((implementation) => implementation.consumesCases ?? [])
    );
    for (const testCase of entity.cases ?? []) {
      if (testCase.id && !consumed.has(testCase.id))
        orphanCases.push(`${entity.id}: ${testCase.id}`);
    }
  }

  return { missingSources, missingImplementations, orphanCases };
}

describe('catalog evidence integrity', () => {
  it('separates a resolvable citation from one that only looks like evidence', () => {
    const gaps = collectEvidenceGaps([
      {
        id: 'C-FIXTURE-0001',
        sources: [
          { path: 'package.json' },
          { path: 'spec/nothing-here.md' },
          // Exists beside most checkouts; a traversal must not satisfy a
          // repository-scoped citation.
          { path: '../package.json' },
          // Exists in this checkout and nowhere else.
          { path: path.join(REPO_ROOT, 'package.json') },
          // Generated and Git-ignored: present for its author, absent from a
          // fresh checkout.
          { path: 'internal/agent/PROJECT-UNDERSTANDING.zh-CN.md' },
          // A portable remote citation is not this check's to resolve.
          { path: 'https://www.w3.org/TR/wai-aria-1.2/' },
          // A machine-local URL is not auditable from another checkout.
          { path: 'file:///home/alice/evidence.md' },
        ],
        implementations: [
          {
            id: 'present',
            path: 'package.json',
            status: 'passing',
            consumesCases: ['C-FIXTURE-0001-CASE-A'],
          },
          {
            id: 'absent',
            path: 'packages/nothing-here.test.ts',
            status: 'passing',
            consumesCases: ['C-FIXTURE-0001-CASE-B'],
          },
          // `planned` names a file that has not been written yet, which is what
          // planned means; it is not a broken citation.
          {
            id: 'later',
            path: 'packages/not-written-yet.test.ts',
            status: 'planned',
            consumesCases: ['C-FIXTURE-0001-CASE-C'],
          },
          // `missing` is a real status, and it is not exempt: only `planned`
          // is a declared future target under the current boundary.
          {
            id: 'gap',
            path: 'packages/never-written.test.ts',
            status: 'missing',
            consumesCases: ['C-FIXTURE-0001-CASE-D'],
          },
          {
            id: 'escapes',
            path: '../package.json',
            status: 'passing',
            consumesCases: ['C-FIXTURE-0001-CASE-E'],
          },
          // A directory exists but is not executable evidence.
          {
            id: 'directory',
            path: 'packages',
            status: 'passing',
            consumesCases: ['C-FIXTURE-0001-CASE-F'],
          },
          // No path at all, and a remote one: neither names a repository file,
          // so neither may satisfy the case-consumption invariant unchallenged.
          { id: 'pathless', status: 'passing', consumesCases: ['C-FIXTURE-0001-CASE-G'] },
          {
            id: 'remote',
            path: 'https://example.test/suite.ts',
            status: 'passing',
            consumesCases: ['C-FIXTURE-0001-CASE-H'],
          },
        ],
        cases: [
          { id: 'C-FIXTURE-0001-CASE-A' },
          { id: 'C-FIXTURE-0001-CASE-B' },
          { id: 'C-FIXTURE-0001-CASE-C' },
          { id: 'C-FIXTURE-0001-CASE-D' },
          { id: 'C-FIXTURE-0001-CASE-E' },
          { id: 'C-FIXTURE-0001-CASE-F' },
          { id: 'C-FIXTURE-0001-CASE-G' },
          { id: 'C-FIXTURE-0001-CASE-H' },
          { id: 'C-FIXTURE-0001-CASE-ORPHAN' },
        ],
      },
    ]);

    expect(gaps.missingSources).toEqual([
      'C-FIXTURE-0001: spec/nothing-here.md',
      'C-FIXTURE-0001: ../package.json',
      `C-FIXTURE-0001: ${path.join(REPO_ROOT, 'package.json')}`,
      'C-FIXTURE-0001: internal/agent/PROJECT-UNDERSTANDING.zh-CN.md',
      'C-FIXTURE-0001: file:///home/alice/evidence.md',
    ]);
    expect(gaps.missingImplementations).toEqual([
      'C-FIXTURE-0001: absent -> packages/nothing-here.test.ts',
      'C-FIXTURE-0001: gap -> packages/never-written.test.ts',
      'C-FIXTURE-0001: escapes -> ../package.json',
      'C-FIXTURE-0001: directory -> packages',
      'C-FIXTURE-0001: pathless -> (no path)',
      'C-FIXTURE-0001: remote -> https://example.test/suite.ts',
    ]);
    expect(gaps.orphanCases).toEqual(['C-FIXTURE-0001: C-FIXTURE-0001-CASE-ORPHAN']);
  });

  it('leaves no cited evidence path unresolved across the catalog', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    expect(workspace.issues).toEqual([]);

    const gaps = collectEvidenceGaps(workspace.entities as unknown as Entity[]);

    expect(gaps.missingSources, 'cited sources that do not resolve').toEqual([]);
    expect(
      gaps.missingImplementations,
      'implementations claiming current evidence at a path that does not resolve'
    ).toEqual([]);
  });

  it('leaves no declared case without an implementation that consumes it', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    // A file that fails to load contributes no cases, so without this the
    // invariant would read as satisfied by an entity that never arrived.
    expect(workspace.issues).toEqual([]);

    const gaps = collectEvidenceGaps(workspace.entities as unknown as Entity[]);

    // Coverage a catalog intends but has not written is a `status: planned`
    // implementation consuming the case, not a case pointing at nothing.
    expect(gaps.orphanCases, 'cases no implementation consumes').toEqual([]);
  });
});
