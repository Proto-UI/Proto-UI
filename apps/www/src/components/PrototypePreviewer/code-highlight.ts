import { codeToHtml } from 'shiki';
import { codeThemes } from './code-themes.mjs';

export type CodeLang =
  | 'text'
  | 'json'
  | 'css'
  | 'bash'
  | 'html'
  | 'javascript'
  | 'tsx'
  | 'typescript'
  | 'vue';

export type HighlightLinesInput = string | readonly number[];

export interface HighlightCodeOptions {
  highlightLines?: HighlightLinesInput;
}

export function parseHighlightLines(input?: HighlightLinesInput): Set<number> {
  const lines = new Set<number>();
  if (!input) return lines;
  if (Array.isArray(input)) {
    for (const value of input) {
      if (Number.isInteger(value) && value > 0) lines.add(value);
    }
    return lines;
  }
  for (const part of String(input).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > 0 && end >= start) {
        for (let line = start; line <= end; line += 1) lines.add(line);
      }
      continue;
    }
    const single = Number(trimmed);
    if (Number.isInteger(single) && single > 0) lines.add(single);
  }
  return lines;
}

export async function highlightCode(
  raw: string | undefined,
  lang: CodeLang = 'tsx',
  options: HighlightCodeOptions = {}
): Promise<string> {
  if (!raw) return '';

  const highlightedLines = parseHighlightLines(options.highlightLines);
  let html = await codeToHtml(raw, {
    lang,
    themes: codeThemes,
    defaultColor: false,
    transformers: highlightedLines.size
      ? [
          {
            line(node, line) {
              if (highlightedLines.has(line)) {
                node.properties['data-highlighted-line'] = '';
              }
            },
          },
        ]
      : undefined,
  });
  const safeRaw = raw
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;');
  const highlightAttr = highlightedLines.size ? ' data-has-highlighted-lines="true"' : '';
  html = html.replace(
    /<pre class="([^"]*)"/,
    `<pre class="proto-previewer__code $1"${highlightAttr} tabindex="0"`
  );
  return html.replace(/<code([^>]*)>/, `<code$1 data-raw-code="${safeRaw}">`);
}
