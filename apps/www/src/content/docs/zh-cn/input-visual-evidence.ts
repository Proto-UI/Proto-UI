import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Browser, Locator } from 'playwright-core';

const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

export interface InputSourceSnapshot {
  sourceSha: string;
  sourceGitTree: string;
  sourceDirty: boolean;
  sourceTreeSha256: string;
  membership: string;
  files: { path: string; kind: string; executable: boolean; bytes: number; sha256: string }[];
}

export interface InputCaptureScope {
  locale: 'en' | 'zh-cn';
  runtime: string;
  scheme: 'light' | 'dark';
  state: string;
  observations: unknown;
}

export interface InputEvidenceSession {
  source: InputSourceSnapshot;
  capture(preview: Locator, scope: InputCaptureScope): Promise<{ image: string; screenshotSha256: string }>;
  finish(): Promise<void>;
}

// Match the real authored tree, including hidden and untracked source files.
// Preserve symlink identity without following it into a dependency tree.
export function inputEvidenceSource(root = process.cwd()): InputSourceSnapshot {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);
  const files = [...new Set(paths)].sort().map((path) => {
    const absolute = join(root, path);
    const stat = lstatSync(absolute);
    assert.ok(stat.isFile() || stat.isSymbolicLink(), `Unsupported Input evidence source: ${path}`);
    const bytes = stat.isSymbolicLink() ? Buffer.from(readlinkSync(absolute)) : readFileSync(absolute);
    return {
      path,
      kind: stat.isSymbolicLink() ? 'symlink' : 'file',
      executable: Boolean(stat.mode & 0o111),
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });
  return {
    sourceSha: git('rev-parse', 'HEAD'),
    sourceGitTree: git('rev-parse', 'HEAD^{tree}'),
    sourceDirty: git('status', '--porcelain', '--untracked-files=all').length > 0,
    sourceTreeSha256: sha256(JSON.stringify(files)),
    membership: 'git cached and nonignored untracked paths; literal symlinks; generated assets listed separately',
    files,
  };
}

export async function createInputEvidence(
  directory: string,
  family: 'base' | 'shadcn' | 'brutalist',
  browser: Browser
): Promise<InputEvidenceSession> {
  const root = await realpath(process.cwd());
  const outsideSource = (path: string) => {
    const fromRoot = relative(root, path);
    return isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'));
  };
  assert.ok(outsideSource(resolve(directory)), 'Input evidence must live outside the source tree.');
  await mkdir(directory, { recursive: true });
  assert.ok(outsideSource(await realpath(directory)), 'Input evidence must not resolve into source.');
  const source = inputEvidenceSource(root);
  const generatedAssets = [
    'apps/www/src/styles/proto-ui-style.css',
    'apps/www/src/styles/proto-ui-tokens.generated.css',
    'apps/www/src/styles/shadcn-theme.css',
  ].map((path) => ({ path, sha256: sha256(readFileSync(join(root, path))) }));
  const startedAt = new Date().toISOString();
  const serverBinding = process.env.PROTO_UI_BROWSER_BASE_URL
    ? 'external-server-source-unverified'
    : 'owned-browser-harness-server-from-current-worktree';
  const binding = {
    schemaVersion: 1,
    family,
    startedAt,
    sourceSha: source.sourceSha,
    sourceDirty: source.sourceDirty,
    sourceTreeSha256: source.sourceTreeSha256,
    browserVersion: browser.version(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    serverBinding,
    generatedAssets,
  };
  // Reusing a previous run must fail before any screenshot can be overwritten.
  await writeFile(join(directory, 'source.json'), JSON.stringify({ ...binding, source }, null, 2) + '\n', { flag: 'wx' });
  const captures: { image: string; receipt: string; screenshotSha256: string }[] = [];

  return {
    source,
    async capture(
      preview: Locator,
      scope: InputCaptureScope
    ) {
      const name = `${scope.locale}-${scope.runtime}-${scope.scheme}-${scope.state}`;
      assert.match(name, /^[a-z0-9-]+$/);
      const image = `${name}.png`;
      assert.ok(!captures.some((capture) => capture.image === image), `Duplicate Input capture: ${image}`);
      const pixels = await preview.screenshot({
        path: join(directory, image),
        style: 'astro-dev-toolbar { visibility: hidden; }',
      });
      const screenshotSha256 = sha256(pixels);
      const receipt = `${name}.json`;
      await writeFile(join(directory, receipt), JSON.stringify({
        ...binding,
        ...scope,
        route: new URL(preview.page().url()).pathname,
        capturedAt: new Date().toISOString(),
        viewport: preview.page().viewportSize(),
        image,
        screenshotSha256,
        sourceConsistency: 'requires-matching-session-json-and-runner-result',
        inputProvenance: 'Playwright pointer/keyboard; DOM focus and synthetic composition are identified by each state observation; no OS IME claim.',
        limitations: 'Actual current-source component capture; visual review, public upload, upstream comparison, AT and non-Web acceptance are separate.',
      }, null, 2) + '\n', { flag: 'wx' });
      captures.push({ image, receipt, screenshotSha256 });
      return { image, screenshotSha256 };
    },
    async finish() {
      const finalSource = inputEvidenceSource(root);
      const sourceUnchanged = source.sourceSha === finalSource.sourceSha &&
        source.sourceTreeSha256 === finalSource.sourceTreeSha256;
      const generatedAssetsUnchanged = generatedAssets.every(({ path, sha256: expected }) =>
        sha256(readFileSync(join(root, path))) === expected
      );
      const imagesUnchanged = captures.every(({ image, screenshotSha256 }) =>
        sha256(readFileSync(join(directory, image))) === screenshotSha256
      );
      await writeFile(join(directory, 'session.json'), JSON.stringify({
        ...binding,
        finishedAt: new Date().toISOString(),
        sourceUnchanged,
        generatedAssetsUnchanged,
        imagesUnchanged,
        commitBound: sourceUnchanged && !source.sourceDirty && !finalSource.sourceDirty &&
          serverBinding === 'owned-browser-harness-server-from-current-worktree',
        finalSourceSha: finalSource.sourceSha,
        finalSourceTreeSha256: finalSource.sourceTreeSha256,
        captures,
        testOutcome: 'requires-the-separate-Vitest-result-including-hooks-and-teardown',
        visualReview: 'not-performed-by-this-receipt',
        publication: 'not-uploaded-by-this-receipt',
      }, null, 2) + '\n', { flag: 'wx' });
      assert.ok(sourceUnchanged, 'Input source changed during capture; retain this run as rejected evidence.');
      assert.ok(generatedAssetsUnchanged, 'Input generated CSS changed during capture.');
      assert.ok(imagesUnchanged, 'Input screenshot bytes changed after capture.');
    },
  };
}
