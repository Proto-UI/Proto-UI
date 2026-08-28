// @vitest-environment node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveBrowserHarnessRoots } from './browser-harness';

describe('browser harness workspace roots', () => {
  it('derives the website and repository roots from the module URL', () => {
    const repoRoot = path.resolve('D:/fixture/proto-ui');
    const moduleUrl = pathToFileURL(
      path.join(repoRoot, 'apps/www/src/content/docs/zh-cn/browser-harness.ts')
    ).href;

    expect(resolveBrowserHarnessRoots(moduleUrl)).toEqual({
      repoRoot,
      appsWwwRoot: path.join(repoRoot, 'apps', 'www'),
    });
  });
});
