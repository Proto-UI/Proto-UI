import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot } from 'react-dom/client';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { writeArtifactSet } from '../src/artifact-output';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { tw } from '@proto.ui/core';
import { renderTemplateToReact } from '../../adapters/react/src/template';
import { assertChildStyleProjection } from './source-presentation-projection';

function adapterObservation() {
  const element = renderTemplateToReact(React, {
    type: 'span',
    style: tw('bg-yellow-500', 'p-2'),
    children: 'Presentation 0',
  }) as React.ReactElement<Record<string, string>>;
  return {
    childProjection: element.props['data-pui-style'] ? 'data-pui-style' : 'class',
    childTokens: (element.props['data-pui-style'] ?? '').split(/\s+/).filter(Boolean).sort(),
    childClassTokens: (element.props.className ?? '').split(/\s+/).filter(Boolean).sort(),
  };
}

describe('source presentation projection oracle', () => {
  it('checks the actual emitted source Template carrier independently of the Adapter', async () => {
    const parsed = parsePrototype(
      `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'presentation-carrier',setup(){
return r=>r.el('span',{style:tw('bg-yellow-500','p-2')},'Presentation 0');
}});`,
      { fileName: 'presentation-carrier.proto.ts' }
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const emitted = emitReactSource(parsed.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    const directory = await mkdtemp(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-projection-')
    );
    const host = document.createElement('div');
    const root = createRoot(host);
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    try {
      const written = await writeArtifactSet(
        [
          { path: 'Component.tsx', kind: 'source', contents: emitted.value.code },
          ...(emitted.value.supportingFiles ?? []),
        ],
        path.join(directory, 'output')
      );
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const file = path.join(directory, 'output', 'Component.tsx');
      const { CompiledComponent } = await import(/* @vite-ignore */ file);
      await React.act(async () => {
        root.render(React.createElement(CompiledComponent));
      });
      const child = host.querySelector('span');
      expect(child).not.toBeNull();
      assertChildStyleProjection('source', {
        childProjection: child!.hasAttribute('data-pui-style') ? 'data-pui-style' : 'class',
        childTokens: (child!.getAttribute('data-pui-style') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .sort(),
        childClassTokens: child!.className.split(/\s+/).filter(Boolean).sort(),
      });
    } finally {
      await React.act(async () => {
        root.unmount();
      });
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(['reference', 'runtime'])(
    'accepts the actual Adapter dual projection for %s',
    (target) => {
      assertChildStyleProjection(target, adapterObservation());
    }
  );
  it('accepts source carrier without requiring Adapter compatibility classes', () => {
    assertChildStyleProjection('source', { ...adapterObservation(), childClassTokens: [] });
  });
  it.each(['reference', 'runtime', 'source'])(
    'rejects missing carrier despite unchanged classes for %s',
    (target) => {
      const data = adapterObservation();
      expect(() =>
        assertChildStyleProjection(target, { ...data, childProjection: 'class', childTokens: [] })
      ).toThrow();
    }
  );
  it('rejects missing compatibility classes on the Adapter', () => {
    expect(() =>
      assertChildStyleProjection('reference', { ...adapterObservation(), childClassTokens: [] })
    ).toThrow();
  });
  it('rejects missing carrier tokens even when the carrier remains present', () => {
    expect(() =>
      assertChildStyleProjection('source', {
        ...adapterObservation(),
        childTokens: [],
        childClassTokens: [],
      })
    ).toThrow();
  });
});
