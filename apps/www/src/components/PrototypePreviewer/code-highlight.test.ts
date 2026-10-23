import { describe, expect, it } from 'vitest';
import { highlightCode } from './code-highlight';

describe('highlighted source copy bytes', () => {
  it.each(['text', 'json', 'css'] as const)(
    'preserves exact Unicode, special characters and CRLF for %s',
    async (lang) => {
      const raw = '{ "label": "中文<&>" }\r\n\t\r\n';
      const host = document.createElement('div');
      host.innerHTML = await highlightCode(raw, lang);
      expect(host.querySelector('code')?.dataset.rawCode).toBe(raw);
    }
  );
});
