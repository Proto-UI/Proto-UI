import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const search = readFileSync('apps/www/src/components/override/Search.astro', 'utf8');
const website = readFileSync('apps/www/src/styles/search-trigger.css', 'utf8');
const require = createRequire(resolve('apps/www/package.json'));
const pagefind = readFileSync(require.resolve('@pagefind/default-ui/css/ui.css'), 'utf8');

// This checks the real authored dependency boundary, not browser hit-testing.
// An unlayered `all: unset` wins over every layered containing-block rule,
// leaving the link's absolute ::after hit area anchored outside its result row.
describe('Search generated-result CSS ownership', () => {
  it('keeps the installed Pagefind reset in the Starlight layer beneath result layout', () => {
    expect(pagefind).toMatch(/\.pagefind-ui--reset\s+\*[\s\S]*?all:\s*unset/);
    const frontmatter = search.match(/^---([\s\S]*?)---/)![1];
    expect(frontmatter).not.toMatch(/import\s+['"]@pagefind\/default-ui\/css\/ui\.css['"]/);
    const styles = [...search.matchAll(/<style is:global>([\s\S]*?)<\/style>/g)]
      .map((match) => match[1])
      .join('\n');
    expect(styles).toMatch(
      /@import\s+url\(['"]@pagefind\/default-ui\/css\/ui\.css['"]\)\s+layer\(starlight\.core\);/
    );
    // Retain the actual row containing blocks and native-link hot area; fixing
    // this by disabling links, pointer events or their pseudo content is invalid.
    expect(styles).toMatch(
      /\.pagefind-ui__result-title:not\(:where\(\.pagefind-ui__result-nested \*\)\),\s*#starlight__search \.pagefind-ui__result-nested\s*\{\s*position:\s*relative;/
    );
    expect(styles).toMatch(
      /\.pagefind-ui__result-link::after\s*\{\s*content:\s*'';\s*position:\s*absolute;\s*inset:\s*0;/
    );
    expect(website).toContain('@layer components');
  });
});
