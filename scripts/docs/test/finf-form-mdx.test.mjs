import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
const root = process.cwd();
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
for (const locale of ['en', 'zh-cn'])
  for (const family of families)
    for (const kind of ['field', 'fieldset', 'checkbox-group']) {
      const file = path.join(
        root,
        `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${kind}.mdx`
      );
      // Field is required in this repair. Forms entries become mandatory as soon as
      // their Base source exists, so a pre-forms integration remains independently testable.
      const required =
        kind === 'field' ||
        existsSync(path.join(root, `packages/prototypes/base/src/${kind}/index.ts`));
      test(
        `Finf MDX literal JSON is code, not executable prose: ${locale}/${family}/${kind}`,
        { skip: !required && !existsSync(file) },
        async () => {
          assert.ok(existsSync(file), `Missing ${file}`);
          const source = readFileSync(file, 'utf8');
          await assert.doesNotReject(() => compile(source));
          for (const line of source.split('\n')) {
            if (/^\s*(?:import|export|<)/.test(line)) continue;
            const prose = line
              .split(/(`+[^`]*`+)/)
              .filter((_, index) => index % 2 === 0)
              .join('');
            assert.doesNotMatch(
              prose,
              /\{(?:\s*(?:invalid|value|disabled|requestId|checked|changedValues)\b)[^{}]*\}/,
              'Protocol JSON examples must be inline code, never MDX expressions.'
            );
          }
        }
      );
    }
