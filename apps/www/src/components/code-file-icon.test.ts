import { describe, expect, it } from 'vitest';
import { codeFileIcon } from './code-file-icon';
describe('authored file icon kind', () => {
  it.each(['src/App.tsx', 'src/main.ts', 'App.vue', 'index.html', 'styles/theme.css', 'main.rs'])(
    'identifies source %s',
    (path) => expect(codeFileIcon(path)).toBe('file-code')
  );
  it.each([
    ['config.json', 'file-braces'],
    ['CONFIG.JSON', 'file-braces'],
    ['pnpm-workspace.yaml', 'file-cog'],
    ['.env.local', 'file-cog'],
    ['README.md', 'file-text'],
    ['notes.txt', 'file-text'],
    ['asset.bin', 'file'],
    ['json/readme.unknown', 'file'],
  ])('maps %s without guessing content', (path, icon) => expect(codeFileIcon(path)).toBe(icon));
});
