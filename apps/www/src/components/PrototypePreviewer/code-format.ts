import prettier from 'prettier';
import type { CodeLang } from './code-highlight';

/** Default previewer column width (~68 chars fits Starlight's content column
 * alongside line numbers without horizontal scrollbar overflow on desktop). */
export const PREVIEW_CODE_PRINT_WIDTH = 68;

const formatCache = new Map<string, Promise<string>>();

function prettierParserForLang(lang: CodeLang): string | null {
  switch (lang) {
    case 'html':
      return 'html';
    case 'vue':
      return 'vue';
    case 'tsx':
    case 'typescript':
    case 'javascript':
      return 'typescript';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'bash':
    case 'text':
    default:
      return null;
  }
}

/**
 * Format previewer code snippets at build time with Prettier so lines fold
 * cleanly within the previewer width while preserving valid syntax.
 * Falls back safely to the original string if a snippet is a partial fragment.
 */
export async function formatPreviewCode(
  raw: string | undefined,
  lang: CodeLang = 'tsx',
  printWidth: number = PREVIEW_CODE_PRINT_WIDTH
): Promise<string> {
  if (!raw || !raw.trim()) return '';
  const parser = prettierParserForLang(lang);
  if (!parser) return raw;

  const cacheKey = `${lang}\0${printWidth}\0${raw}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const formatted = await prettier.format(raw, {
        parser,
        printWidth,
        tabWidth: 2,
        singleQuote: true,
        semi: true,
        trailingComma: 'es5',
        htmlWhitespaceSensitivity: 'ignore',
        bracketSameLine: false,
      });
      return formatted.trimEnd();
    } catch {
      return raw;
    }
  })();

  formatCache.set(cacheKey, promise);
  return promise;
}
