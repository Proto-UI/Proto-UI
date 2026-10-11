import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildDraftPackages, DRAFT_FAMILIES } from '../draft-prototype-packages.mjs';
import { ROOT_DIR } from '../public-packages.mjs';

test(
  'private drafts pack and install their real closure for loader-free ESM and strict NodeNext types',
  { timeout: 300000 },
  () => {
    const names = DRAFT_FAMILIES.map((family) => `@proto.ui/prototypes-${family}`);
    const originals = names.map((_, index) =>
      readFileSync(
        join(ROOT_DIR, 'packages/prototypes', DRAFT_FAMILIES[index], 'package.json'),
        'utf8'
      )
    );
    const report = buildDraftPackages(names, { pack: true });
    const consumer = mkdtempSync(join(tmpdir(), 'proto-ui-draft-consumer-'));
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' })
    );
    const run = (args) => {
      const result = spawnSync(process.execPath, args, {
        cwd: consumer,
        encoding: 'utf8',
        timeout: 180000,
        env: {
          ...process.env,
          NODE_PATH: '',
          npm_config_cache: join(consumer, '.npm-cache'),
          npm_config_offline: 'true',
          npm_config_ignore_scripts: 'true',
          npm_config_audit: 'false',
          npm_config_fund: 'false',
        },
      });
      assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    };
    run([
      join(ROOT_DIR, 'node_modules/npm/bin/npm-cli.js'),
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      ...report.packages.map((pkg) => pkg.tarball),
    ]);
    const entries = [
      'label',
      'field',
      'collapsible',
      'accordion',
      'button',
      'select',
      'surface',
      'text',
      'tabs',
    ];
    const specifiers = names.flatMap((name) => [
      name,
      ...entries.map((entry) => `${name}/${entry}`),
    ]);
    const smoke = `import assert from 'node:assert/strict';\n${specifiers.map((specifier, index) => `import * as entry${index} from ${JSON.stringify(specifier)};\nassert.ok(Object.keys(entry${index}).length > 0);`).join('\n')}\n${names
      .map((name, index) => {
        const rootIndex = specifiers.indexOf(name);
        const tabsIndex = specifiers.indexOf(`${name}/tabs`);
        return ['Root', 'List', 'Trigger', 'Content']
          .map(
            (part) =>
              `assert.equal(entry${tabsIndex}.tabs${part}.name, '${DRAFT_FAMILIES[index]}-tabs-${part.toLowerCase()}');\nassert.equal(entry${rootIndex}.tabs${part}, entry${tabsIndex}.tabs${part});`
          )
          .join('\n');
      })
      .join('\n')}`;
    writeFileSync(join(consumer, 'smoke.mjs'), smoke);
    run(['smoke.mjs']);
    writeFileSync(
      join(consumer, 'consumer.ts'),
      specifiers
        .map(
          (specifier, index) =>
            `import * as entry${index} from ${JSON.stringify(specifier)};\nvoid entry${index};`
        )
        .join('\n')
    );
    writeFileSync(
      join(consumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        files: ['consumer.ts'],
      })
    );
    run([
      join(ROOT_DIR, 'node_modules/typescript/bin/tsc'),
      '--project',
      join(consumer, 'tsconfig.json'),
      '--pretty',
      'false',
    ]);
    for (const artifact of report.packages) {
      const installed = join(consumer, 'node_modules', artifact.name);
      assert.equal(lstatSync(installed).isSymbolicLink(), false);
      const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
      assert.equal(manifest.private, true);
      assert.equal(manifest.protoUi.distribution.publicAdmission, false);
      assert.doesNotMatch(JSON.stringify(manifest.exports), /\.\/src\//);
    }
    for (let index = 0; index < names.length; index++)
      assert.equal(
        readFileSync(
          join(ROOT_DIR, 'packages/prototypes', DRAFT_FAMILIES[index], 'package.json'),
          'utf8'
        ),
        originals[index]
      );
    const evidence = {
      ...report,
      consumerValidation: {
        status: 'passed',
        esmEntries: specifiers.length,
        strictNodeNextTypes: true,
        exactTabsIdentities: 8,
        workspaceLinks: false,
      },
      consumer,
    };
    writeFileSync(
      join(report.outDir, 'consumer-report.json'),
      `${JSON.stringify(evidence, null, 2)}\n`
    );
    console.log(`Draft-only consumer evidence: ${join(report.outDir, 'consumer-report.json')}`);
  }
);
