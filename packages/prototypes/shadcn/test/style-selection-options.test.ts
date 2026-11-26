import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, type OwnedStateHandle } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleSelection,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../src/style-scope';
import { SHADCN_STYLE_IDS as DIRECT_IDS } from '../src/style-scope/ids';
import { normalizeShadcnStyle } from '../src/style-scope/context';

const expected = ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea', 'new-york-v4'];
const originalIds = SHADCN_STYLE_IDS;
const consumer = definePrototype<ShadcnStyleProps, { selected: OwnedStateHandle<ShadcnStyleId> }>({
  name: 'shadcn-style-options-canary',
  setup(def) {
    const selected = setupShadcnStyleSelection(def, 'nova');
    def.expose.state('selected', selected);
  },
});
AdaptToWebComponent(consumer);

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const mount = (profile: ShadcnStyleId) => {
  const element = document.createElement(consumer.name) as HTMLElement & {
    getExposes(): {
      selected: { get(): ShadcnStyleId; spec: { kind: string; options: readonly string[] } };
    };
  };
  setElementProps(element, { styleProfile: profile });
  document.body.append(element);
  return element;
};

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('style selection owns its State enum options', () => {
  it('checks membership through private receivers while preserving the shared Rule domain', () => {
    const includes = Array.prototype.includes;
    const receivers: unknown[][] = [];
    const spy = vi.spyOn(Array.prototype, 'includes').mockImplementation(function (
      this: unknown[],
      value: unknown,
      fromIndex?: number
    ) {
      if (this.length === expected.length && this[0] === 'vega') receivers.push(this);
      return includes.call(this, value, fromIndex);
    });
    let normalized: Array<ShadcnStyleId | null>;
    try {
      normalized = expected.map(normalizeShadcnStyle);
    } finally {
      spy.mockRestore();
    }
    expect(normalized).toEqual(expected);
    expect(receivers).toHaveLength(expected.length);
    for (const receiver of receivers) {
      expect(receiver).not.toBe(SHADCN_STYLE_IDS);
      expect(receiver).toEqual(expected);
    }
    expect(new Set(receivers).size).toBe(expected.length);
    expect(SHADCN_STYLE_IDS).toBe(originalIds);
    expect(SHADCN_STYLE_IDS).toBe(DIRECT_IDS);
    expect(SHADCN_STYLE_IDS).toEqual(expected);
  });

  it.each(SHADCN_STYLE_IDS)(
    'constructs the real State with the original ordered domain for %s',
    async (profile) => {
      const element = mount(profile);
      await flush();
      const selected = element.getExposes().selected;
      expect(selected.get()).toBe(profile);
      expect(selected.spec.kind).toBe('enum');
      expect(selected.spec.options).toEqual(expected);
      expect(selected.spec.options).not.toBe(SHADCN_STYLE_IDS);
      expect(SHADCN_STYLE_IDS).toBe(originalIds);
      expect(SHADCN_STYLE_IDS).toBe(DIRECT_IDS);
      expect(SHADCN_STYLE_IDS).toEqual(expected);
    }
  );

  it('keeps each constructed State spec independent of the next consumer', async () => {
    const first = mount('nova');
    const second = mount('rhea');
    await flush();
    const firstState = first.getExposes().selected;
    const secondState = second.getExposes().selected;
    expect(firstState.spec.options).not.toBe(secondState.spec.options);
    expect(firstState.spec.options).toEqual(secondState.spec.options);
    expect(firstState.get()).toBe('nova');
    expect(secondState.get()).toBe('rhea');
    expect(SHADCN_STYLE_IDS).toBe(originalIds);
  });
});
