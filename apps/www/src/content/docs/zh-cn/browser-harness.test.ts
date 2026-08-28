// @vitest-environment node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveBrowserExecutableCandidates, resolveBrowserHarnessRoots } from './browser-harness';

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

describe('browser executable candidates', () => {
  it('discovers per-user Chrome and Edge installations under LOCALAPPDATA on Windows', () => {
    const localAppData = 'C:\\Users\\fixture\\AppData\\Local';

    expect(
      resolveBrowserExecutableCandidates('win32', {
        LOCALAPPDATA: localAppData,
        PROGRAMFILES: 'C:\\Program Files',
        'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
      })
    ).toEqual(
      expect.arrayContaining([
        path.win32.join(localAppData, 'Google/Chrome/Application/chrome.exe'),
        path.win32.join(localAppData, 'Microsoft/Edge/Application/msedge.exe'),
      ])
    );
  });
});
