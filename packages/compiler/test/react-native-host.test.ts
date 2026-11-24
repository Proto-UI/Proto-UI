// @vitest-environment happy-dom
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

it('delivers native root attributes, events and refs without duplicating prototype signals or replacing the root', async () => {
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `native-host-${process.pid}`
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const source = `import {definePrototype} from '@proto.ui/core';
    import {asAccessible,asTrigger} from '@proto.ui/hooks';
    export default definePrototype({name:'native-host-boundary',setup(def){
      asTrigger();
      asAccessible().nameFromContent();
      def.expose.event('click',{payload:'void'});
      def.event.on('press.commit',run=>run.expose.emit('click'));
      return r=>r.slot();
    }});`;
  const result = compilePrototype(source, { profile: 'react-dom-source-v1', rootTag: 'button' });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  try {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'Component.tsx');
    await writeFile(file, result.value.output.code);
    for (const artifact of result.value.output.supportingFiles ?? []) {
      await mkdir(path.dirname(path.join(directory, artifact.path)), { recursive: true });
      await writeFile(path.join(directory, artifact.path), artifact.contents);
    }
    const { CompiledComponent } = (await import(/* @vite-ignore */ file)) as {
      CompiledComponent: React.ComponentType<Record<string, unknown>>;
    };
    const first = React.createRef<HTMLElement>();
    const second = React.createRef<HTMLElement>();
    const handle = React.createRef<{ getElement(): HTMLElement | null }>();
    let clicks = 0;
    const onClick = () => {
      clicks++;
    };
    const render = async (hostRef: React.Ref<HTMLElement>, className: string) =>
      React.act(async () => {
        root.render(
          React.createElement(
            CompiledComponent,
            {
              ref: handle,
              hostRef,
              className,
              title: 'Native help',
              'data-file-action': 'choose',
              'aria-label': 'Choose files',
              onClick,
              hostProps: { type: 'button', onClick },
            },
            'Choose'
          )
        );
      });
    await render(first, 'before');
    const button = host.querySelector('button')!;
    expect(first.current).toBe(button);
    expect(handle.current?.getElement()).toBe(button);
    expect(button.type).toBe('button');
    expect(button.className).toBe('before');
    expect(button.title).toBe('Native help');
    expect(button.getAttribute('data-file-action')).toBe('choose');
    expect(button.getAttribute('aria-label')).toBe('Choose files');
    await React.act(async () => {
      button.click();
    });
    expect(clicks).toBe(1);
    await render(second, 'after');
    expect(first.current).toBe(null);
    expect(second.current).toBe(button);
    expect(host.querySelector('button')).toBe(button);
    expect(button.className).toBe('after');
    expect(button.getAttribute('aria-label')).toBe('Choose files');
    expect(result.value.output.code).not.toMatch(/from\s*['"]@proto\.ui\//);
    await React.act(async () => {
      root.unmount();
    });
    expect(second.current).toBe(null);
    expect(handle.current).toBe(null);
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    host.remove();
    await rm(directory, { recursive: true, force: true });
  }
});
