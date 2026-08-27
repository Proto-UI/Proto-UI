import { codeToHtml } from 'shiki';

export type CodeLang = 'bash' | 'html' | 'javascript' | 'tsx' | 'typescript' | 'vue';

export async function highlightCode(
  raw: string | undefined,
  lang: CodeLang = 'tsx'
): Promise<string> {
  if (!raw) return '';

  let html = await codeToHtml(raw, {
    lang,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });
  const safeRaw = raw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  html = html.replace(
    /<pre class="([^"]*)"/,
    '<pre class="proto-previewer__code m-0 text-[0.8125rem] leading-6 whitespace-pre $1"'
  );
  return html.replace(/<code([^>]*)>/, `<code$1 data-raw-code="${safeRaw}">`);
}
