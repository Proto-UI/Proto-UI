import { codeToHtml } from 'shiki';
import { codeThemes } from './code-themes.mjs';

export type CodeLang = 'bash' | 'html' | 'javascript' | 'tsx' | 'typescript' | 'vue';

export async function highlightCode(
  raw: string | undefined,
  lang: CodeLang = 'tsx'
): Promise<string> {
  if (!raw) return '';

  let html = await codeToHtml(raw, {
    lang,
    themes: codeThemes,
    defaultColor: false,
  });
  const safeRaw = raw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  html = html.replace(/<pre class="([^"]*)"/, '<pre class="proto-previewer__code $1" tabindex="0"');
  return html.replace(/<code([^>]*)>/, `<code$1 data-raw-code="${safeRaw}">`);
}
