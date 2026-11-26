// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeMap } from '../src/content/docs/demo_components/base-tooltip/baseTooltipCode';
import { shadcnTooltipFiles } from '../src/content/docs/demo_components/tooltip-usage';
import { runAddCommand } from '../../../packages/cli/src/commands/add';
import {
  addComponentToConfig,
  createDefaultConfig,
  resolveConfigPaths,
} from '../../../packages/cli/src/config/project-config';
import { getAdapter } from '../../../packages/cli/src/registry/adapters';
import { getComponentEntry } from '../../../packages/cli/src/registry/components';
import { writeGeneratedIndexes } from '../../../packages/cli/src/services/codegen';

const hosts = ['wc', 'react', 'vue', 'vue2'] as const;
const parts = ['Group', 'Root', 'Trigger', 'Content'];

describe('Tooltip public Usage', () => {
  it.each(hosts)('offers Base Tooltip code for %s using a public entrypoint', (host) => {
    const code = codeMap[host]?.['demo-base-tooltip'];
    expect(code).toBeTypeOf('string');
    expect(code).toContain('@proto.ui/prototypes-base/tooltip');
    expect(code).not.toMatch(/@prototype-libs|wc-base-tooltip|\.setProps\(/);
  });

  it.each(['base-tooltip', 'brutalist-tooltip'])(
    'retains the real CLI rejection for %s instead of documenting an invented add target',
    async (component) => {
      expect(getComponentEntry(component)).toBeNull();
      await expect(
        runAddCommand(['wc', component, '--no-install', '--no-interactive'])
      ).rejects.toThrow(`unsupported component "${component}"`);
    }
  );

  it.each(hosts)(
    'writes the real Shadcn %s facade with the exports or tags used by Usage',
    async (host) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'tooltip-public-codegen-'));
      try {
        const adapter = getAdapter(host);
        if (!adapter) throw new Error(`Missing adapter: ${host}`);
        const entry = getComponentEntry('shadcn-tooltip');
        expect(entry?.sourceOnly).not.toBe(true);
        expect(entry?.items.map((item) => item.reactExport)).toEqual(
          parts.map((part) => `ShadcnTooltip${part}`)
        );
        const config = addComponentToConfig(
          createDefaultConfig(),
          host,
          'shadcn-tooltip',
          adapter.packageName
        );
        const paths = resolveConfigPaths(directory);
        await writeGeneratedIndexes(paths, config, 'ts');
        const generated = await readFile(path.join(paths.componentsDir, host, 'index.ts'), 'utf8');
        expect(generated).toContain("from '@proto.ui/prototypes-shadcn/tooltip'");
        const usage = shadcnTooltipFiles[host].map((file) => file.code).join('\n');
        expect(usage).toContain(`'../proto-ui/components/${host}'`);
        for (const part of parts) {
          expect(generated).toContain(
            `export const ShadcnTooltip${part}${host === 'wc' ? 'Element' : ''} =`
          );
          if (host === 'wc') {
            const tag = `proto-ui-shadcn-tooltip-${part.toLowerCase()}`;
            expect(generated).toContain(`registerAs: '${tag}'`);
            expect(usage).toContain(`<${tag}`);
          } else {
            expect(usage).toContain(`ShadcnTooltip${part}`);
          }
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );

  it('publishes complete Usage on all six pages while retaining the source and ShadowRoot boundaries', async () => {
    for (const locale of ['en', 'zh-cn']) {
      for (const family of ['base', 'shadcn', 'brutalist']) {
        const page = path.join(
          process.cwd(),
          'apps/www/src/content/docs',
          locale,
          'ui-libraries',
          family,
          family === 'brutalist' ? 'components/tooltip.mdx' : 'tooltip.mdx'
        );
        const source = await readFile(page, 'utf8');
        expect(source).toContain(`files={${family}TooltipFiles}`);
        if (family === 'base') {
          expect(source).toContain('scripts/release/consumer-smoke-cli.mjs');
          expect(source).toContain('>=2.6.0 <2.7');
        }
        expect(source).toContain('ShadowRoot');
        expect(source).not.toMatch(/npx @proto\.ui\/cli@latest add/);
        expect(source).not.toMatch(/add (?:wc|react|vue|vue2) (?:base|brutalist)-tooltip/);
      }
    }
  });
});
