import { describe, expect, it, vi } from 'vitest';
import { textareaRoot } from '../../../prototypes/base/src/textarea';

import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

describe('adapter-vue2: base textarea integration', () => {
  it('materializes the host textarea and forwards value input through the Proto UI control', async () => {
    const onValueChange = vi.fn();
    const mounted = createMountedVue2Adapter(textareaRoot, {
      defaultValue: 'initial',
      placeholder: 'Write',
      rows: 4,
      surfaceClass: 'surface-control w-full outline-none',
      surfaceStyle: { minHeight: '7rem' },
      onValueChange,
    });

    try {
      await flushVue2();
      const textarea = mounted.root as HTMLTextAreaElement;
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
      expect(textarea.value).toBe('initial');
      expect(textarea.defaultValue).toBe('initial');
      expect(textarea.placeholder).toBe('Write');
      expect(Number(textarea.rows)).toBe(4);
      expect(textarea.classList.contains('surface-control')).toBe(true);
      expect(textarea.style.minHeight).toBe('7rem');

      textarea.value = 'edited';
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flushVue2();

      expect(mounted.vm.getExposes().value.get()).toBe('edited');
      expect(onValueChange.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ value: 'edited' })
      );
    } finally {
      mounted.unmount();
    }
  });
});
