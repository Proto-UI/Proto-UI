import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(TEST_DIR, '..');
const BIN_PATH = path.join(CLI_DIR, 'bin/proto-ui.js');

beforeAll(() => {
  // bin/proto-ui.js imports ../dist/index.js, so the cli must be compiled
  // before any spawnSync call below. building unconditionally here keeps
  // the test hermetic — `pnpm -s test` from the repo root works even when
  // no one has run `pnpm --filter @proto.ui/cli build` first.
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: CLI_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed to build @proto.ui/cli before tests:\n${result.stdout}\n${result.stderr}`
    );
  }
}, 120_000);

function runCli(cwd: string, args: string[]) {
  return spawnSync('node', [BIN_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

async function createTempProject(name: string, packageJson: Record<string, unknown>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
  await fs.writeFile(
    path.join(dir, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8'
  );
  return dir;
}

describe('@proto.ui/cli', () => {
  it('prints the new help text', () => {
    const result = runCli(process.cwd(), ['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('proto-ui init');
    expect(result.stdout).toContain('proto-ui add <host> <component>');
    expect(result.stdout).toContain('Style commands');
    expect(result.stdout).toContain('proto-ui style --out ./src/styles/proto-ui-style.css');

    const addHelp = runCli(process.cwd(), ['add', '--help']);
    expect(addHelp.status).toBe(0);
    expect(addHelp.stdout).toContain('proto-ui add <host> <component>');
    expect(addHelp.stdout).toContain('generates proto-ui/components/<host>/index.ts');
  });

  it('initializes proto-ui workspace and default style files', async () => {
    const cwd = await createTempProject('pui-cli-init', {
      name: 'pui-cli-init',
      private: true,
    });

    const result = runCli(cwd, ['init', '--no-interactive']);
    expect(result.status).toBe(0);

    await expect(fs.stat(path.join(cwd, 'proto-ui/config.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(cwd, 'proto-ui/components'))).resolves.toBeTruthy();
    const tokensCss = await fs.readFile(
      path.join(cwd, 'src/styles/proto-ui-tokens.generated.css'),
      'utf8'
    );
    const styleCss = await fs.readFile(path.join(cwd, 'src/styles/proto-ui-style.css'), 'utf8');
    const themeCss = await fs.readFile(path.join(cwd, 'src/styles/shadcn-theme.css'), 'utf8');

    expect(tokensCss).toContain(`[data-pui-style~="bg-primary"]`);
    expect(tokensCss).toContain(`data-[active]:bg-muted"])[data-active]`);
    expect(tokensCss).toContain(
      `data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])`
    );
    expect(tokensCss).toContain(`data-[checked]:bg-primary"])[data-checked]`);
    expect(tokensCss).not.toContain(`aria-checked:bg-primary"])[aria-checked='true']`);
    expect(tokensCss).not.toContain('@source');
    expect(tokensCss).not.toContain('Unsupported Proto UI style tokens');
    expect(styleCss).toContain(`@import './shadcn-theme.css';`);
    expect(styleCss).toContain(`@import './proto-ui-tokens.generated.css';`);
    expect(themeCss).toContain('--pui-background');
    expect(themeCss).not.toContain('--background:');
    await expect(fs.stat(path.join(cwd, 'src/styles/shadcn-theme.css'))).resolves.toBeTruthy();
  });

  it('renders the official prototype token set without unsupported-token comments', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pui-cli-token-coverage-'));
    const outFile = path.join(cwd, 'proto-ui-tokens.generated.css');

    const result = runCli(process.cwd(), [
      'tokens',
      '--input',
      'packages/prototypes',
      '--out',
      outFile,
    ]);

    expect(result.status).toBe(0);

    const tokensCss = await fs.readFile(outFile, 'utf8');
    expect(tokensCss).toContain(`[data-pui-style~="bg-primary"]`);
    expect(tokensCss).toContain(`[data-pui-style~="rounded-md"]`);
    expect(tokensCss).toContain(`data-[active]:bg-muted"])[data-active]`);
    expect(tokensCss).toContain(
      `data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])`
    );
    expect(tokensCss).not.toContain(`not-[data-open]:hidden`);
    expect(tokensCss).toContain(`data-[checked]:pl-[20px]"])[data-checked]`);
    expect(tokensCss).toContain(`data-[checked]:bg-primary"])[data-checked]`);
    expect(tokensCss).toContain(`data-[selected]:bg-background"])[data-selected]`);
    expect(tokensCss).toContain(`data-[hidden]:hidden"])[data-hidden]`);
    expect(tokensCss).toContain(
      `data-[focus-visible]:ring-3"])[data-focus-visible] {\n    --pui-ring-width: 3px;`
    );
    expect(tokensCss).toContain(
      `data-[focus-visible]:shadow-xs"])[data-focus-visible] {\n    --pui-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);`
    );
    expect(tokensCss).toContain(
      'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
    );
    expect(tokensCss).not.toContain(`aria-checked:bg-muted"])[aria-checked='true']`);
    expect(tokensCss).not.toContain('Unsupported Proto UI style tokens');
  }, 30_000);

  it('rejects the removed tailwindcss command with an explicit migration message', () => {
    const result = runCli(process.cwd(), ['tailwindcss', '--out', './unused.css']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'The tailwindcss command has been removed. Use `proto-ui style` instead.'
    );
  });

  it('adds a React facade without installing packages when --no-install is used', async () => {
    const cwd = await createTempProject('pui-cli-add', {
      name: 'pui-cli-add',
      private: true,
      dependencies: {
        react: '^19.0.0',
      },
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-styles']).status).toBe(0);
    const result = runCli(cwd, ['add', 'react', 'shadcn-button', '--no-install']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('@proto.ui/adapter-react');
    expect(result.stdout).toContain('@proto.ui/prototypes-shadcn');

    const reactIndex = await fs.readFile(
      path.join(cwd, 'proto-ui/components/react/index.ts'),
      'utf8'
    );
    const rootIndex = await fs.readFile(path.join(cwd, 'proto-ui/components/index.ts'), 'utf8');
    const config = JSON.parse(await fs.readFile(path.join(cwd, 'proto-ui/config.json'), 'utf8'));

    expect(reactIndex).toContain(`createReactAdapter`);
    expect(reactIndex).toContain(`shadcnButton`);
    expect(reactIndex).toContain(`export const ShadcnButton = adapt(shadcnButton);`);
    expect(rootIndex).toContain(`export { ShadcnButton as ReactShadcnButton } from './react';`);
    expect(config.components.react).toEqual(['shadcn-button']);
  });

  it('adds a compound Web Component facade from base prototypes', async () => {
    const cwd = await createTempProject('pui-cli-add-wc', {
      name: 'pui-cli-add-wc',
      private: true,
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-styles']).status).toBe(0);
    const result = runCli(cwd, ['add', 'wc', 'base-dialog', '--no-install']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('@proto.ui/adapter-web-component');
    expect(result.stdout).toContain('@proto.ui/prototypes-base');

    const wcIndex = await fs.readFile(path.join(cwd, 'proto-ui/components/wc/index.ts'), 'utf8');
    const rootIndex = await fs.readFile(path.join(cwd, 'proto-ui/components/index.ts'), 'utf8');
    const config = JSON.parse(await fs.readFile(path.join(cwd, 'proto-ui/config.json'), 'utf8'));

    expect(wcIndex).toContain(`AdaptToWebComponent`);
    expect(wcIndex).toContain(`dialogRoot`);
    expect(wcIndex).toContain(`export const BaseDialogRootElement = AdaptToWebComponent`);
    expect(wcIndex).toContain(`registerAs: 'proto-ui-base-dialog-root'`);
    expect(rootIndex).toContain(`export { BaseDialogRootElement } from './wc';`);
    expect(config.components.wc).toEqual(['base-dialog']);
  });

  it('adds a namespaced Web Component facade from shadcn prototypes', async () => {
    const cwd = await createTempProject('pui-cli-add-wc-shadcn', {
      name: 'pui-cli-add-wc-shadcn',
      private: true,
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-styles']).status).toBe(0);
    const result = runCli(cwd, ['add', 'wc', 'shadcn-button', '--no-install']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('@proto.ui/adapter-web-component');
    expect(result.stdout).toContain('@proto.ui/prototypes-shadcn');

    const wcIndex = await fs.readFile(path.join(cwd, 'proto-ui/components/wc/index.ts'), 'utf8');
    const rootIndex = await fs.readFile(path.join(cwd, 'proto-ui/components/index.ts'), 'utf8');

    expect(wcIndex).toContain(`export const ShadcnButtonElement = AdaptToWebComponent`);
    expect(rootIndex).toContain(`export { ShadcnButtonElement } from './wc';`);
  });

  it('fails fast when the required React runtime is missing', async () => {
    const cwd = await createTempProject('pui-cli-missing-runtime', {
      name: 'pui-cli-missing-runtime',
      private: true,
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-styles']).status).toBe(0);
    const result = runCli(cwd, ['add', 'react', 'shadcn-button', '--no-install']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('React runtime is required');
    expect(result.stderr).toContain('react-dom');
  });
});
