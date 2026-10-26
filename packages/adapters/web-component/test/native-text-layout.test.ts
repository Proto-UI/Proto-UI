import { describe, expect, it } from 'vitest';
import { readRootStyleEntries, type RootStyleEntry } from '@proto.ui/core/internal';
import { createNativeTextLayoutApplier } from '../src/native-text-layout';

const entriesFor = (tokens: string[]) => readRootStyleEntries({ kind: 'tw', tokens }, 'runtime');
const lowered = (tokens: string[], prefix: string) =>
  entriesFor(tokens).map((entry) => ({ ...entry, token: `${prefix}:${entry.token}` }));

describe('bounded native width contribution', () => {
  it.each(['replace', 'clear'] as const)(
    'preserves an overlapping external boundary width on %s',
    (withdrawal) => {
      const host = document.createElement('x-width-owner');
      const editor = document.createElement('input');
      host.setAttribute('data-pui-style', 'consumer-host w-full');
      let entries: readonly RootStyleEntry[] = entriesFor(['w-full']);
      const applier = createNativeTextLayoutApplier(host, editor, () => entries);
      applier.apply(['w-full']);
      if (withdrawal === 'replace') {
        entries = entriesFor(['opacity-50']);
        applier.apply(['opacity-50']);
      } else {
        applier.clear();
      }
      expect(host.getAttribute('data-pui-style')).toBe('consumer-host w-full');
      expect(editor.getAttribute('data-pui-style')).toBe(
        withdrawal === 'replace' ? 'opacity-50' : null
      );
    }
  );
  it('preserves canonical lowered conditions and retracts only its own width', () => {
    const host = document.createElement('x-width-owner');
    const editor = document.createElement('input');
    host.setAttribute('data-pui-style', 'consumer-host');
    editor.setAttribute('data-pui-style', 'consumer-surface');
    let entries: readonly RootStyleEntry[] = [];
    const applier = createNativeTextLayoutApplier(host, editor, () => entries);
    const apply = (next: readonly RootStyleEntry[]) => {
      entries = next;
      applier.apply(next.map((entry) => entry.token));
    };
    const first = lowered(['w-full', 'opacity-50'], 'data-[wide=true]');
    const second = lowered(['w-full', 'border-2'], 'data-[expanded=true]');
    apply([...first, ...second]);
    expect(host.getAttribute('data-pui-style')).toBe(
      'consumer-host data-[wide=true]:w-full data-[expanded=true]:w-full'
    );
    apply(second);
    expect(host.getAttribute('data-pui-style')).toBe('consumer-host data-[expanded=true]:w-full');
    expect(editor.getAttribute('data-pui-style')).toBe(
      'consumer-surface data-[expanded=true]:w-full data-[expanded=true]:border-2'
    );
    apply(entriesFor(['opacity-50']));
    expect(host.getAttribute('data-pui-style')).toBe('consumer-host');
    expect(editor.getAttribute('data-pui-style')).toBe('consumer-surface opacity-50');
    applier.clear();
    expect(host.getAttribute('data-pui-style')).toBe('consumer-host');
    expect(editor.getAttribute('data-pui-style')).toBe('consumer-surface');
  });

  it('does not infer width from unknown or unsafe selector strings, or move decoration and flex tokens', () => {
    const host = document.createElement('x-width-owner');
    const editor = document.createElement('textarea');
    const tokens = [
      'custom-w-full',
      'data-[wide=true]:w-full',
      'selection:bg-blue-500',
      'placeholder:text-muted-foreground',
      'px-3',
      'border',
      'opacity-50',
      'grow',
      'min-w-0',
    ];
    const entries = entriesFor(tokens);
    const applier = createNativeTextLayoutApplier(host, editor, () => entries);
    applier.apply(tokens);
    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect(editor.getAttribute('data-pui-style')).toBe(tokens.join(' '));
  });
});
