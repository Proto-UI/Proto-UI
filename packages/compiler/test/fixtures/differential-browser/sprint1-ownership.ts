import * as React from 'react';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { definePrototype } from '@proto.ui/core';
import { asSelectItem } from '../../../../prototypes/base/src/select';
import { mountSelectLegacySlotProbe } from '../../../../prototypes/base/test/fixtures/select-legacy-slot';
import { mountPropsPolicyProbe, type PropsPolicyMode } from './props-policy-probe';

const params = new URL(location.href).searchParams;
const kind = params.get('kind');
let compilation: unknown = null;
let probe;
if (kind === 'props') {
  const mode = params.get('mode') as PropsPolicyMode;
  const watcher = params.get('watcher') === 'true';
  let component;
  if (mode === 'compiled-explicit') {
    const emitted = watcher
      ? await import('virtual:sprint1-compiled-props-watch')
      : await import('virtual:sprint1-compiled-props-no-watch');
    component = emitted.CompiledComponent;
    compilation = emitted.__puiFixtureCompilation;
  } else if (mode === 'adapter-default' || mode === 'adapter-explicit') {
    const authored = watcher
      ? await import('virtual:sprint1-authored-props-watch')
      : await import('virtual:sprint1-authored-props-no-watch');
    component = createReactAdapter(React)(
      authored.default,
      mode === 'adapter-explicit' ? { autoUpdateOnPropsChange: false } : {}
    );
  } else throw new Error('Unknown props mode');
  probe = mountPropsPolicyProbe(component, document.getElementById('ownership-root')!);
} else if (kind === 'select') {
  const family = params.get('family');
  if (family !== 'base' && family !== 'shadcn' && family !== 'brutalist')
    throw new Error('Unknown family');
  let item;
  if (params.get('variant') === 'legacy') {
    const legacy = await import('virtual:sprint1-select-legacy');
    item = legacy.default;
    compilation = legacy.__puiFixtureSource;
  } else if (params.get('variant') === 'hook') {
    item = definePrototype({
      name: 'select-browser-hook-consumer',
      setup() {
        return asSelectItem().render;
      },
    });
  }
  probe = mountSelectLegacySlotProbe(family, item);
} else throw new Error('Choose props or select');

(window as unknown as Record<string, unknown>).ownershipProbe = probe;
(window as unknown as Record<string, unknown>).ownershipCompilation = compilation;
