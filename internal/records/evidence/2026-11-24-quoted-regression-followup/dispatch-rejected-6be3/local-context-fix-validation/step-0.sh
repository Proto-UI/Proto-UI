set -euo pipefail
export CONTENTS_WHEEL_EVIDENCE_DIR="$RUNNER_TEMP/contents-wheel"
export PROTO_UI_RUNTIME_EVIDENCE_DIR="$CONTENTS_WHEEL_EVIDENCE_DIR/runtime"
printf '%s\n' "CONTENTS_WHEEL_EVIDENCE_DIR=$CONTENTS_WHEEL_EVIDENCE_DIR" \
  "PROTO_UI_RUNTIME_EVIDENCE_DIR=$PROTO_UI_RUNTIME_EVIDENCE_DIR" >> "$GITHUB_ENV"
mkdir -p "$CONTENTS_WHEEL_EVIDENCE_DIR"
printf '%s\n' "$CANDIDATE_SHA" > "$CONTENTS_WHEEL_EVIDENCE_DIR/requested-source-sha.txt"
cat > "$CONTENTS_WHEEL_EVIDENCE_DIR/record-source.mjs" <<'JS'
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const directory = process.env.CONTENTS_WHEEL_EVIDENCE_DIR;
const phase = process.argv[2];
const command = (file, args) => {
  const result = spawnSync(file, args, { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message ?? null };
};
const source = command('git', ['rev-parse', 'HEAD']);
const status = command('git', ['status', '--porcelain=v1', '--untracked-files=all']);
const hashFile = (file) => {
  try {
    const bytes = readFileSync(file);
    return { path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch (error) { return { path: file, error: String(error) }; }
};
const sourceFiles = [
  '.github/workflows/browser-suite-repair-evidence.yml', 'pnpm-lock.yaml',
  'apps/www/package.json', 'apps/www/scripts/generate-website-prototype-tokens.mjs',
  'apps/www/scripts/prepare-homepage-composition-fonts.sh',
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'apps/www/src/content/docs/zh-cn/contents-wheel-evidence.ts',
  'apps/www/src/content/docs/zh-cn/contents-wheel-evidence.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts',
  'apps/www/src/styles/site-contents-command.css',
].map(hashFile);
// Actual outputs of apps-www generate:proto-ui-style, including the
// ignored CSS/Shadow artifacts that git status cannot account for.
const generatedFiles = [
  'shadcn-theme.css', 'proto-ui-style.css', 'proto-ui-tokens.generated.css',
  'proto-ui-shadow-style.generated.js', 'proto-ui-shadow-style.generated.d.ts',
].map((name) => hashFile(`apps/www/src/styles/${name}`));
const archive = path.join(directory, phase, 'generated');
mkdirSync(archive, { recursive: true });
for (const file of generatedFiles) {
  if (!file.error) copyFileSync(file.path, path.join(archive, path.basename(file.path)));
}
const record = {
  phase, observedAt: new Date().toISOString(), expectedSha: process.env.CANDIDATE_SHA,
  source, status, dirty: status.status === 0 ? status.stdout !== '' : null,
  runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  event: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF,
  node: process.version, platform: process.platform, arch: process.arch, os: os.release(),
  chromePath: process.env.CHROME_PATH ?? null,
  chrome: process.env.CHROME_PATH ? command(process.env.CHROME_PATH, ['--version']) : null,
  sourceFiles, generatedFiles,
};
writeFileSync(path.join(directory, `${phase}.json`), JSON.stringify(record, null, 2) + '\n');
writeFileSync(path.join(directory, `${phase}-git-status.txt`), status.stdout + status.stderr);
if (source.status !== 0 || source.stdout.trim() !== process.env.CANDIDATE_SHA || status.status !== 0)
  throw new Error('Could not bind evidence to the requested source and worktree state');
JS
