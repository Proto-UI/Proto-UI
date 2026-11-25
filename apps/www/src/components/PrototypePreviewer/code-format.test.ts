// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatPreviewCode, PREVIEW_CODE_PRINT_WIDTH } from './code-format';

describe('formatPreviewCode', () => {
  it('folds long preview HTML snippets to fit previewer width and stays idempotent', async () => {
    const raw = `<shadcn-live-region-root id="inbox-status">No unread messages</shadcn-live-region-root>
<script type="module">
  import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
  import { liveRegionRoot } from '@proto.ui/prototypes-shadcn/live-region';
  setElementProps(document.querySelector('#inbox-status'), { politeness: 'polite', atomic: true });
</script>`;
    const formatted = await formatPreviewCode(raw, 'html');
    expect(formatted).toContain('\n');
    expect(
      formatted.split('\n').every((line) => line.length <= PREVIEW_CODE_PRINT_WIDTH + 18)
    ).toBe(true);
    expect(await formatPreviewCode(formatted, 'html')).toBe(formatted);
  });

  it('formats tsx and vue snippets cleanly', async () => {
    const tsx = `export function Demo() { return <PopoverContent align="start" sideOffset={8} className="w-80"><PopoverTitle>Dimensions</PopoverTitle></PopoverContent>; }`;
    const formattedTsx = await formatPreviewCode(tsx, 'tsx');
    expect(formattedTsx).toContain('\n');
    expect(await formatPreviewCode(formattedTsx, 'tsx')).toBe(formattedTsx);

    const vue = `<template><PopoverRoot :open="open"><PopoverTrigger>Open popover</PopoverTrigger><PopoverContent class="w-80">Dimensions</PopoverContent></PopoverRoot></template>`;
    const formattedVue = await formatPreviewCode(vue, 'vue');
    expect(formattedVue).toContain('\n');
    expect(await formatPreviewCode(formattedVue, 'vue')).toBe(formattedVue);
  });

  it('returns empty string for empty input and falls back safely on unparseable fragments', async () => {
    expect(await formatPreviewCode(undefined, 'html')).toBe('');
    expect(await formatPreviewCode('   \n  ', 'tsx')).toBe('');

    const brokenTsx = 'const x = <unclosed {{{ ;;;';
    expect(await formatPreviewCode(brokenTsx, 'tsx')).toBe(brokenTsx);
  });
});
