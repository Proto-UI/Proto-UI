import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { COMPONENT_REGISTRY } from '../src/registry/components';
import { renderHostIndex, renderRootIndex } from '../src/services/codegen';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(TEST_DIR, '..');
const BIN_PATH = path.join(CLI_DIR, 'bin/proto-ui.js');
let cliVersion = '';

beforeAll(async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(CLI_DIR, 'package.json'), 'utf8'));
  cliVersion = manifest.version;

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
  it('keeps the deferred Brutalist Tooltip family out of proto-ui add', () => {
    expect(COMPONENT_REGISTRY).not.toHaveProperty('brutalist-tooltip');
  });

  it('pins official packages to the exact built CLI release train', () => {
    const moduleUrl = pathToFileURL(
      path.join(CLI_DIR, 'dist', 'services', 'package-manager.js')
    ).href;
    const script = `
      import {
        CLI_RELEASE_VERSION,
        formatInstallCommand,
        toExactProtoUiInstallSpec,
      } from ${JSON.stringify(moduleUrl)};
      console.log(JSON.stringify({
        version: CLI_RELEASE_VERSION,
        proto: toExactProtoUiInstallSpec('@proto.ui/adapter-react'),
        external: toExactProtoUiInstallSpec('react'),
        npm: formatInstallCommand('npm', ['@proto.ui/adapter-react@${cliVersion}'], { exact: true }),
        pnpm: formatInstallCommand('pnpm', ['@proto.ui/adapter-react@${cliVersion}'], { exact: true }),
        yarn: formatInstallCommand('yarn', ['@proto.ui/adapter-react@${cliVersion}'], { exact: true }),
      }));
    `;
    const result = spawnSync('node', ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      version: cliVersion,
      proto: `@proto.ui/adapter-react@${cliVersion}`,
      external: 'react',
      npm: `npm install --save --save-exact @proto.ui/adapter-react@${cliVersion}`,
      pnpm: `pnpm add --save-exact @proto.ui/adapter-react@${cliVersion}`,
      yarn: `yarn add --exact @proto.ui/adapter-react@${cliVersion}`,
    });
  });

  it('keeps installation packages separate from family import paths', () => {
    for (const entry of Object.values(COMPONENT_REGISTRY)) {
      expect(entry.importPath).toBe(
        `${entry.packageName}/${entry.id.replace(/^(?:base|shadcn|brutalist)-/, '')}`
      );
      expect(entry.importPath).not.toBe(entry.packageName);
    }
  });

  it('registers the promoted Brutalist families and both Textarea projections', () => {
    const brutalistIds = Object.keys(COMPONENT_REGISTRY)
      .filter((id) => id.startsWith('brutalist-'))
      .sort();
    expect(brutalistIds).toEqual([
      'brutalist-badge',
      'brutalist-button',
      'brutalist-card',
      'brutalist-dialog',
      'brutalist-dropdown',
      'brutalist-hover-card',
      'brutalist-scroll-area',
      'brutalist-select',
      'brutalist-separator',
      'brutalist-skeleton',
      'brutalist-switch',
      'brutalist-tabs',
      'brutalist-textarea',
      'brutalist-toggle',
    ]);
    expect(COMPONENT_REGISTRY['brutalist-badge']).toMatchObject({
      packageName: '@proto.ui/prototypes-brutalist',
      importPath: '@proto.ui/prototypes-brutalist/badge',
      stylePreset: 'brutalist',
      items: [
        {
          prototypeImport: 'brutalistBadgeRoot',
          reactExport: 'BrutalistBadgeRoot',
          elementName: 'proto-ui-brutalist-badge',
        },
      ],
    });
    expect(COMPONENT_REGISTRY['brutalist-card']).toMatchObject({
      packageName: '@proto.ui/prototypes-brutalist',
      importPath: '@proto.ui/prototypes-brutalist/card',
      stylePreset: 'brutalist',
      items: [
        {
          prototypeImport: 'brutalistCardRoot',
          reactExport: 'BrutalistCardRoot',
          elementName: 'proto-ui-brutalist-card-root',
        },
        {
          prototypeImport: 'brutalistCardHeader',
          reactExport: 'BrutalistCardHeader',
          elementName: 'proto-ui-brutalist-card-header',
        },
        {
          prototypeImport: 'brutalistCardContent',
          reactExport: 'BrutalistCardContent',
          elementName: 'proto-ui-brutalist-card-content',
        },
        {
          prototypeImport: 'brutalistCardFooter',
          reactExport: 'BrutalistCardFooter',
          elementName: 'proto-ui-brutalist-card-footer',
        },
      ],
    });
    expect(COMPONENT_REGISTRY['base-textarea']).toMatchObject({
      packageName: '@proto.ui/prototypes-base',
      importPath: '@proto.ui/prototypes-base/textarea',
      stylePreset: null,
      items: [
        {
          prototypeImport: 'textareaRoot',
          reactExport: 'BaseTextareaRoot',
          elementName: 'proto-ui-base-textarea',
        },
      ],
    });
    expect(COMPONENT_REGISTRY['brutalist-textarea']).toMatchObject({
      packageName: '@proto.ui/prototypes-brutalist',
      importPath: '@proto.ui/prototypes-brutalist/textarea',
      stylePreset: 'brutalist',
      items: [
        {
          prototypeImport: 'brutalistTextareaRoot',
          reactExport: 'BrutalistTextareaRoot',
          elementName: 'proto-ui-brutalist-textarea',
        },
      ],
    });

    const react = renderHostIndex('react', ['base-textarea', 'brutalist-textarea']);
    expect(react).toContain("import { textareaRoot } from '@proto.ui/prototypes-base/textarea';");
    expect(react).toContain(
      "import { brutalistTextareaRoot } from '@proto.ui/prototypes-brutalist/textarea';"
    );
    expect(react).toContain('export const BaseTextareaRoot = adapt(textareaRoot);');
    expect(react).toContain('export const BrutalistTextareaRoot = adapt(brutalistTextareaRoot);');

    for (const adapter of ['react', 'vue', 'wc'] as const) {
      const source = renderHostIndex(adapter, brutalistIds);
      for (const id of brutalistIds) {
        const entry = COMPONENT_REGISTRY[id];
        expect(source).toContain(entry.importPath);
        for (const item of entry.items) {
          expect(source).toContain(item.prototypeImport);
          const exportName =
            adapter === 'react'
              ? item.reactExport
              : adapter === 'vue'
                ? item.vueExport
                : item.wcExport;
          expect(source).toContain(exportName);
        }
      }
    }
  });

  it('registers the Base Radio Group compound facade', () => {
    expect(COMPONENT_REGISTRY['base-radio-group']).toMatchObject({
      packageName: '@proto.ui/prototypes-base',
      importPath: '@proto.ui/prototypes-base/radio-group',
      stylePreset: null,
      items: [
        {
          prototypeImport: 'radioGroupRoot',
          reactExport: 'BaseRadioGroupRoot',
          vueExport: 'BaseRadioGroupRoot',
          wcExport: 'BaseRadioGroupRootElement',
          elementName: 'proto-ui-base-radio-group-root',
        },
        {
          prototypeImport: 'radioGroupItem',
          reactExport: 'BaseRadioGroupItem',
          vueExport: 'BaseRadioGroupItem',
          wcExport: 'BaseRadioGroupItemElement',
          elementName: 'proto-ui-base-radio-group-item',
        },
        {
          prototypeImport: 'radioGroupIndicator',
          reactExport: 'BaseRadioGroupIndicator',
          vueExport: 'BaseRadioGroupIndicator',
          wcExport: 'BaseRadioGroupIndicatorElement',
          elementName: 'proto-ui-base-radio-group-indicator',
        },
      ],
    });
  });

  it('registers Base Live Region and Async Region public facades', () => {
    expect(COMPONENT_REGISTRY['base-live-region']).toMatchObject({
      packageName: '@proto.ui/prototypes-base',
      importPath: '@proto.ui/prototypes-base/live-region',
      stylePreset: null,
      items: [
        {
          prototypeImport: 'liveRegionRoot',
          reactExport: 'BaseLiveRegionRoot',
          vueExport: 'BaseLiveRegionRoot',
          wcExport: 'BaseLiveRegionRootElement',
          elementName: 'proto-ui-base-live-region',
        },
      ],
    });
    expect(COMPONENT_REGISTRY['base-async-region']).toMatchObject({
      packageName: '@proto.ui/prototypes-base',
      importPath: '@proto.ui/prototypes-base/async-region',
      stylePreset: null,
      items: [
        {
          prototypeImport: 'asyncRegionRoot',
          reactExport: 'BaseAsyncRegionRoot',
          vueExport: 'BaseAsyncRegionRoot',
          wcExport: 'BaseAsyncRegionRootElement',
          elementName: 'proto-ui-base-async-region',
        },
      ],
    });
  });

  it('materializes Base Live Region and Async Region facades for every adapter', () => {
    const componentIds = ['base-live-region', 'base-async-region'];

    for (const host of ['react', 'vue'] as const) {
      const source = renderHostIndex(host, componentIds);
      expect(source).toContain(
        `import { liveRegionRoot } from '@proto.ui/prototypes-base/live-region';`
      );
      expect(source).toContain(
        `import { asyncRegionRoot } from '@proto.ui/prototypes-base/async-region';`
      );
      expect(source).toContain('export const BaseLiveRegionRoot = adapt(liveRegionRoot);');
      expect(source).toContain('export const BaseAsyncRegionRoot = adapt(asyncRegionRoot);');
    }

    const wc = renderHostIndex('wc', componentIds);
    expect(wc).toContain(
      `export const BaseLiveRegionRootElement = AdaptToWebComponent(liveRegionRoot, { registerAs: 'proto-ui-base-live-region' });`
    );
    expect(wc).toContain(
      `export const BaseAsyncRegionRootElement = AdaptToWebComponent(asyncRegionRoot, { registerAs: 'proto-ui-base-async-region' });`
    );

    const root = renderRootIndex({
      react: componentIds,
      vue: componentIds,
      wc: componentIds,
    });
    expect(root).toContain(
      `export { BaseLiveRegionRoot as ReactBaseLiveRegionRoot } from './react';`
    );
    expect(root).toContain(
      `export { BaseAsyncRegionRoot as ReactBaseAsyncRegionRoot } from './react';`
    );
    expect(root).toContain(`export { BaseLiveRegionRoot as VueBaseLiveRegionRoot } from './vue';`);
    expect(root).toContain(
      `export { BaseAsyncRegionRoot as VueBaseAsyncRegionRoot } from './vue';`
    );
    expect(root).toContain(`export { BaseLiveRegionRootElement } from './wc';`);
    expect(root).toContain(`export { BaseAsyncRegionRootElement } from './wc';`);
  });

  it('materializes the replaceable shadcn Switch Thumb preset for every adapter', () => {
    const react = renderHostIndex('react', ['shadcn-switch']);
    expect(react).toContain('export const ShadcnSwitchRoot = adapt(shadcnSwitchRoot);');
    expect(react).toContain('export const ShadcnSwitchThumb = adapt(shadcnSwitchThumb);');
    expect(react).toContain('export const ShadcnSwitch = React.forwardRef');
    expect(react).toContain('thumb === null || hasDirectDefaultPart');
    expect(react).toContain('const rootProps = ref == null ? props : { ...props, ref };');

    const vue = renderHostIndex('vue', ['shadcn-switch']);
    expect(vue).toContain('export const ShadcnSwitch = Vue.defineComponent({');
    expect(vue).toContain('const resolvedDefaultPart = slots.thumb');
    expect(vue).toContain('child.type === ShadcnSwitchThumb');

    const wc = renderHostIndex('wc', ['shadcn-switch']);
    expect(wc).toContain('export class ShadcnSwitchElement extends ShadcnSwitchRootElement');
    expect(wc).toContain("!this.hasAttribute('data-pui-no-default-thumb')");
    expect(wc).toContain("document.createElement('proto-ui-shadcn-switch-thumb')");
    expect(wc.indexOf('ShadcnSwitchRootElement.prototype as unknown')).toBeLessThan(
      wc.indexOf("document.createElement('proto-ui-shadcn-switch-thumb')")
    );

    const root = renderRootIndex({
      react: ['shadcn-switch'],
      vue: ['shadcn-switch'],
      wc: ['shadcn-switch'],
    });
    expect(root).toContain('ShadcnSwitch as ReactShadcnSwitch');
    expect(root).toContain('ShadcnSwitch as VueShadcnSwitch');
    expect(root).toContain('export { ShadcnSwitchElement }');
  });

  it('materializes the replaceable Dialog Content CloseIcon preset while keeping raw parts', () => {
    const react = renderHostIndex('react', ['shadcn-dialog']);
    expect(react).toContain('export const ShadcnDialogContentRaw = adapt(shadcnDialogContent);');
    expect(react).toContain('export const ShadcnDialogCloseIcon = adapt(shadcnDialogCloseIcon);');
    expect(react).toContain('export const ShadcnDialogHeader = adapt(shadcnDialogHeader);');
    expect(react).toContain('export const ShadcnDialogFooter = adapt(shadcnDialogFooter);');
    expect(react).toContain('export const ShadcnDialogContent = React.forwardRef');
    expect(react).toContain('close === null || hasDirectDefaultPart');

    const vue = renderHostIndex('vue', ['shadcn-dialog']);
    expect(vue).toContain('const resolvedDefaultPart = slots.close');

    const wc = renderHostIndex('wc', ['shadcn-dialog']);
    expect(wc).toContain(
      'export class ShadcnDialogContentElement extends ShadcnDialogContentRawElement'
    );
    expect(wc).toContain("!this.hasAttribute('data-pui-no-default-close')");
    expect(wc.indexOf('ShadcnDialogContentRawElement.prototype as unknown')).toBeLessThan(
      wc.indexOf("document.createElement('proto-ui-shadcn-dialog-close-icon')")
    );
  });

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
    expect(tokensCss).toContain(
      `[data-pui-style],\n[data-pui-style]::before,\n[data-pui-style]::after {`
    );
    expect(tokensCss).toContain('box-sizing: border-box;');
    expect(tokensCss).toContain(`data-[active]:bg-muted"])[data-active]`);
    expect(tokensCss).toContain(
      `data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])`
    );
    expect(tokensCss).toContain(`data-[checked]:bg-primary"])[data-checked]`);
    expect(tokensCss).toContain(`[data-pui-style~="animate-in"]`);
    expect(tokensCss).toContain(`[data-pui-style~="animate-out"]`);
    expect(tokensCss).toContain(`[data-pui-style~="fade-in-0"]`);
    expect(tokensCss).toContain(`[data-pui-style~="fade-out-0"]`);
    expect(tokensCss).toContain(`[data-pui-style~="zoom-in-95"]`);
    expect(tokensCss).toContain(`[data-pui-style~="zoom-out-95"]`);
    expect(tokensCss).toContain('@keyframes pui-enter');
    expect(tokensCss).toContain('@keyframes pui-exit');
    expect(tokensCss).not.toContain(`aria-checked:bg-primary"])[aria-checked='true']`);
    expect(tokensCss).not.toContain('@source');
    expect(tokensCss).not.toContain('Unsupported Proto UI style tokens');
    expect(styleCss).toContain(`@import './shadcn-theme.css';`);
    expect(styleCss).toContain(`@import './proto-ui-tokens.generated.css';`);
    expect(themeCss).toContain('--pui-background');
    expect(themeCss).not.toContain('--background:');
    expect(themeCss).not.toContain('box-sizing: border-box;');
    expect(themeCss).toContain('@media (prefers-color-scheme: dark)');
    expect(themeCss).toContain(
      ":root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light'])"
    );
    expect(tokensCss).toContain('@media (prefers-color-scheme: dark)');
    await expect(fs.stat(path.join(cwd, 'src/styles/shadcn-theme.css'))).resolves.toBeTruthy();

    const scannedTokensFile = path.join(cwd, 'shadcn-source-tokens.css');
    const scanResult = runCli(process.cwd(), [
      'tokens',
      '--input',
      'packages/prototypes/shadcn/src',
      '--out',
      scannedTokensFile,
    ]);
    expect(scanResult.status).toBe(0);
    await expect(fs.readFile(scannedTokensFile, 'utf8')).resolves.toBe(tokensCss);
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
    expect(tokensCss).toContain(`[data-pui-style~="px-0.5"]`);
    expect(tokensCss).toContain(`data-[checked]:translate-x-[calc(100%_-_2px)]"])[data-checked]`);
    expect(tokensCss).toContain('--pui-translate-x: calc(100% - 2px);');
    expect(tokensCss).toContain(`data-[checked]:bg-sky"])[data-checked]`);
    expect(tokensCss).not.toContain(`data-[checked]:pl-[20px]"])[data-checked]`);
    expect(tokensCss).toContain(`data-[checked]:bg-primary"])[data-checked]`);
    expect(tokensCss).toContain(`data-[selected]:bg-background"])[data-selected]`);
    expect(tokensCss).toContain(`data-[hidden]:hidden"])[data-hidden]`);
    expect(tokensCss).toContain(`data-[open]:animate-in"])[data-open]`);
    expect(tokensCss).toContain('@keyframes pui-enter');
    expect(tokensCss).toContain('@keyframes pui-exit');
    expect(tokensCss).toContain(
      `data-[focus-visible]:ring-3"])[data-focus-visible] {\n    --pui-ring-width: 3px;`
    );
    expect(tokensCss).toContain(
      `data-[focus-visible]:outline-1"])[data-focus-visible] {\n    outline-style: solid;\n    outline-width: 1px;`
    );
    expect(tokensCss).toContain(
      `data-[selected]:shadow-sm"])[data-selected] {\n    --pui-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);`
    );
    expect(tokensCss).toContain(`[data-pui-style~="w-fit"]`);
    expect(tokensCss).toContain('width: fit-content;');
    expect(tokensCss).toContain(
      'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
    );
    expect(tokensCss).not.toContain(`aria-checked:bg-muted"])[aria-checked='true']`);
    expect(tokensCss).not.toContain('Unsupported Proto UI style tokens');
    expect(tokensCss).toContain(`[data-pui-style~="rounded-sm"]`);
    expect(tokensCss).toContain(`[data-pui-style~="min-w-32"]`);
    expect(tokensCss).toContain(`[data-pui-style~="overflow-x-hidden"]`);
    expect(tokensCss).toContain(`[data-pui-style~="overflow-y-auto"]`);
    expect(tokensCss).toContain(`[data-pui-style~="max-h-[var(--proto-ui-available-height)]"]`);
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
    expect(result.stdout).toContain(`@proto.ui/adapter-react@${cliVersion}`);
    expect(result.stdout).toContain(`@proto.ui/prototypes-shadcn@${cliVersion}`);

    const reactIndex = await fs.readFile(
      path.join(cwd, 'proto-ui/components/react/index.ts'),
      'utf8'
    );
    const rootIndex = await fs.readFile(path.join(cwd, 'proto-ui/components/index.ts'), 'utf8');
    const config = JSON.parse(await fs.readFile(path.join(cwd, 'proto-ui/config.json'), 'utf8'));

    expect(reactIndex).toContain(`createReactAdapter`);
    expect(reactIndex).toContain(`shadcnButton`);
    expect(reactIndex).toContain(
      `import { shadcnButton } from '@proto.ui/prototypes-shadcn/button';`
    );
    expect(reactIndex).not.toContain(`from '@proto.ui/prototypes-shadcn';`);
    expect(reactIndex).toContain(`export const ShadcnButton = adapt(shadcnButton);`);
    expect(rootIndex).toContain(`export { ShadcnButton as ReactShadcnButton } from './react';`);
    expect(config.components.react).toEqual(['shadcn-button']);
  });

  it('adds the complete shadcn Select React facade', async () => {
    const cwd = await createTempProject('pui-cli-add-shadcn-select', {
      name: 'pui-cli-add-shadcn-select',
      private: true,
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-styles']).status).toBe(0);
    const result = runCli(cwd, ['add', 'react', 'shadcn-select', '--no-install']);

    expect(result.status).toBe(0);
    const reactIndex = await fs.readFile(
      path.join(cwd, 'proto-ui/components/react/index.ts'),
      'utf8'
    );
    const config = JSON.parse(await fs.readFile(path.join(cwd, 'proto-ui/config.json'), 'utf8'));

    expect(reactIndex).toContain(`from '@proto.ui/prototypes-shadcn/select';`);
    for (const part of ['Root', 'Trigger', 'Value', 'Content', 'Item']) {
      expect(reactIndex).toContain(
        `export const ShadcnSelect${part} = adapt(shadcnSelect${part});`
      );
    }
    expect(config.components.react).toEqual(['shadcn-select']);
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
    expect(wcIndex).toContain(`from '@proto.ui/prototypes-base/dialog';`);
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

    expect(wcIndex).toContain(`from '@proto.ui/prototypes-shadcn/button';`);
    expect(wcIndex).toContain(`export const ShadcnButtonElement = AdaptToWebComponent`);
    expect(rootIndex).toContain(`export { ShadcnButtonElement } from './wc';`);
  });

  it('initializes with the Brutalist prototype and style preset when requested', async () => {
    const cwd = await createTempProject('pui-cli-init-brutalist', {
      name: 'pui-cli-init-brutalist',
      private: true,
    });

    const result = runCli(cwd, [
      'init',
      '--no-interactive',
      '--no-install',
      '--prototypes',
      'brutalist',
    ]);

    expect(result.status).toBe(0);
    const config = JSON.parse(await fs.readFile(path.join(cwd, 'proto-ui/config.json'), 'utf8'));
    const theme = await fs.readFile(path.join(cwd, 'src/styles/brutalist-theme.css'), 'utf8');
    const tokens = await fs.readFile(
      path.join(cwd, 'src/styles/proto-ui-tokens.generated.css'),
      'utf8'
    );

    expect(config.styles.preset).toBe('brutalist');
    expect(theme).toContain('--pui-background: #f5f5f5');
    expect(theme).toContain(':root.dark');
    expect(theme).toContain('--pui-canary: #FEF08A');
    expect(theme).toContain('--pui-mint: #A7F3D0');
    expect(theme).toContain('--pui-lavender: #DDD6FE');
    expect(theme).toContain('--pui-coral: #FECDD3');
    expect(theme).toContain('--pui-sky: #BAE6FD');
    expect(theme).toContain('--pui-radius-sm: 2px');
  });

  it('allows Brutalist add with styles disabled and emits an actionable ownership note', async () => {
    const cwd = await createTempProject('pui-cli-brutalist-styles-disabled', {
      name: 'pui-cli-brutalist-styles-disabled',
      private: true,
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-styles']).status).toBe(0);
    const configPath = path.join(cwd, 'proto-ui/config.json');
    const packagePath = path.join(cwd, 'package.json');
    const configBefore = await fs.readFile(configPath, 'utf8');
    const packageBefore = await fs.readFile(packagePath, 'utf8');

    const result = runCli(cwd, ['add', 'react', 'brutalist-button', '--no-install']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('styles are disabled');
    expect(result.stdout).toContain('complete brutalist --pui-* token set');
    await expect(fs.readFile(configPath, 'utf8')).resolves.not.toBe(configBefore);
    await expect(fs.readFile(packagePath, 'utf8')).resolves.toBe(packageBefore);
    await expect(
      fs.readFile(path.join(cwd, 'proto-ui/components/react/index.ts'), 'utf8')
    ).resolves.toContain('brutalistButton');
  });

  it('rejects Brutalist add under the Shadcn preset without mutating project state', async () => {
    const cwd = await createTempProject('pui-cli-brutalist-preset-mismatch', {
      name: 'pui-cli-brutalist-preset-mismatch',
      private: true,
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-install']).status).toBe(0);
    const configPath = path.join(cwd, 'proto-ui/config.json');
    const packagePath = path.join(cwd, 'package.json');
    const configBefore = await fs.readFile(configPath, 'utf8');
    const packageBefore = await fs.readFile(packagePath, 'utf8');

    const result = runCli(cwd, ['add', 'react', 'brutalist-button', '--no-install']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('brutalist-button');
    expect(result.stderr).toContain('requires the brutalist style preset');
    expect(result.stderr).toContain('shadcn');
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe(configBefore);
    await expect(fs.readFile(packagePath, 'utf8')).resolves.toBe(packageBefore);
    await expect(
      fs.stat(path.join(cwd, 'proto-ui/components/react/index.ts'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('adds Brutalist under the matching enabled preset', async () => {
    const cwd = await createTempProject('pui-cli-brutalist-preset-match', {
      name: 'pui-cli-brutalist-preset-match',
      private: true,
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    });

    expect(
      runCli(cwd, ['init', '--no-interactive', '--no-install', '--prototypes', 'brutalist']).status
    ).toBe(0);
    const result = runCli(cwd, ['add', 'react', 'brutalist-button', '--no-install']);

    expect(result.status).toBe(0);
    await expect(
      fs.readFile(path.join(cwd, 'proto-ui/components/react/index.ts'), 'utf8')
    ).resolves.toContain('brutalistButton');
  });

  it('rejects a missing enabled preset before mutating project state', async () => {
    const cwd = await createTempProject('pui-cli-brutalist-preset-missing', {
      name: 'pui-cli-brutalist-preset-missing',
      private: true,
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    });

    expect(runCli(cwd, ['init', '--no-interactive', '--no-install']).status).toBe(0);
    const configPath = path.join(cwd, 'proto-ui/config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    config.styles.preset = null;
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    const configBefore = await fs.readFile(configPath, 'utf8');

    const result = runCli(cwd, ['add', 'react', 'brutalist-button', '--no-install']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('requires the brutalist style preset');
    expect(result.stderr).toContain('enables no preset');
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe(configBefore);
    await expect(
      fs.stat(path.join(cwd, 'proto-ui/components/react/index.ts'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
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
