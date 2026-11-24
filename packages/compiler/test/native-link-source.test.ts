// @vitest-environment happy-dom
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { checkTargetOperations, TARGET_PROFILES } from '../src/targets';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const source = `import {definePrototype} from '@proto.ui/core';
import {asNativeLink} from '@proto.ui/hooks';
import {declareNativeLink} from '@proto.ui/module-native-link';
export default definePrototype({name:'navigation-observer',modules:[declareNativeLink()],setup(def){
  def.props.define({href:{type:'string'},target:{type:'string'},rel:{type:'string'},disabled:{type:'boolean'}});
  def.props.setDefaults({href:'',target:'',rel:'',disabled:false});
  const link=asNativeLink();
  def.expose.event('navigate',{payload:'json'});
  link.on('navigate',(run,event)=>run.expose.emit('navigate',event));
  def.lifecycle.onCreated(run=>link.sync({href:run.props.get().href,target:run.props.get().target,rel:run.props.get().rel,disabled:run.props.get().disabled}));
  def.props.watchAll(run=>link.sync({href:run.props.get().href,target:run.props.get().target,rel:run.props.get().rel,disabled:run.props.get().disabled}));
  return r=>r.slot();
}});`;

const roots: Root[] = [];
const directories: string[] = [];
let sequence = 0;
afterEach(async () => {
  await React.act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function consumer() {
  const parsed = parsePrototype(source, { fileName: 'link.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `native-link-${process.pid}-${sequence++}`
  );
  directories.push(directory);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'Component.tsx');
  await writeFile(file, emitted.value.code);
  for (const artifact of emitted.value.supportingFiles ?? []) {
    const destination = path.join(directory, artifact.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, artifact.contents);
  }
  const { CompiledComponent } = (await import(/* @vite-ignore */ file)) as {
    CompiledComponent: React.ComponentType<Record<string, unknown>>;
  };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  return { host, root, CompiledComponent, emitted: emitted.value };
}

it('lowers a real native anchor with retained child identity and complete destination replacement', async () => {
  const { host, root, CompiledComponent, emitted } = await consumer();
  const render = async (props: Record<string, unknown>) =>
    React.act(async () => {
      root.render(
        React.createElement(
          CompiledComponent,
          props,
          React.createElement('strong', null, 'A native destination')
        )
      );
    });
  await render({ href: '/first', target: '_blank', rel: 'noreferrer', download: 'result.txt' });
  const anchor = host.querySelector('a')!;
  const child = anchor.querySelector('strong');
  expect(anchor.getAttribute('href')).toBe('/first');
  expect(anchor.getAttribute('rel')).toBe('noreferrer noopener');
  expect(anchor.getAttribute('download')).toBe('result.txt');
  await render({ href: '/second' });
  expect(host.querySelector('a')).toBe(anchor);
  expect(anchor.querySelector('strong')).toBe(child);
  expect(anchor.getAttribute('href')).toBe('/second');
  expect(anchor.hasAttribute('target')).toBe(false);
  expect(anchor.hasAttribute('rel')).toBe(false);
  await render({ href: 'java\nscript:alert(1)' });
  expect(anchor.hasAttribute('href')).toBe(false);
  expect(emitted.code).not.toMatch(/(?:from\s*|import\s*\()['"]@proto\.ui\//);
  const support = emitted.supportingFiles?.map((file) => file.contents).join('\n') ?? '';
  expect(support).not.toContain('computePosition');
  expect(support).not.toContain('attachText');
});

it('observes native activation after defaults, preserves modifiers, and retires disabled or detached observations', async () => {
  const { host, root, CompiledComponent } = await consumer();
  const observed: unknown[] = [];
  const render = async (disabled: boolean) =>
    React.act(async () => {
      root.render(
        React.createElement(
          CompiledComponent,
          { href: '/next', disabled, onNavigate: (detail: unknown) => observed.push(detail) },
          'Next'
        )
      );
    });
  await render(false);
  const anchor = host.querySelector('a')!;
  const modified = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    button: 0,
  });
  anchor.dispatchEvent(modified);
  expect(modified.defaultPrevented).toBe(false);
  expect(observed).toEqual([]);
  await React.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
  });
  expect(observed).toEqual([{ href: '/next', target: '', rel: '', modified: true }]);
  await render(true);
  expect(anchor.getAttribute('aria-disabled')).toBe('true');
  expect(anchor.getAttribute('tabindex')).toBe('-1');
  expect(anchor.hasAttribute('href')).toBe(false);
  const blocked = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
  anchor.dispatchEvent(blocked);
  expect(blocked.defaultPrevented).toBe(true);
  await render(false);
  expect(anchor.hasAttribute('aria-disabled')).toBe(false);
  expect(anchor.hasAttribute('tabindex')).toBe(false);
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await React.act(async () => {
    root.unmount();
  });
  roots.splice(roots.indexOf(root), 1);
  await new Promise((resolve) => setTimeout(resolve, 1));
  expect(observed).toHaveLength(1);
});

it('diagnoses missing physical declarations, conflicting roots and unsupported backend claims', () => {
  const parsed = parsePrototype(source, { fileName: 'link.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  expect(checkTargetOperations(parsed.value, TARGET_PROFILES['react-dom-source-v1']).ok).toBe(true);
  for (const target of [
    'vue-source-v1',
    'web-component-source-v1',
    'gpui-source-v1',
    'react-dom-ssr-v1',
  ] as const)
    expect(checkTargetOperations(parsed.value, TARGET_PROFILES[target]).ok).toBe(false);
  const missing = parsePrototype(source.replace('modules:[declareNativeLink()],', ''), {
    fileName: 'missing.proto.ts',
  });
  if (!missing.ok) throw new Error(JSON.stringify(missing.diagnostics));
  const missingOutput = emitReactSource(missing.value);
  expect(missingOutput.ok).toBe(false);
  if (!missingOutput.ok)
    expect(
      missingOutput.diagnostics.some((entry) => entry.message.includes('static native-link'))
    ).toBe(true);
  const conflict = {
    ...parsed.value,
    moduleDeclarations: [
      ...parsed.value.moduleDeclarations,
      {
        id: '@proto.ui/text-control/declaration',
        config: { content: 'plain-text', lineMode: 'single', engine: 'host' },
        span: parsed.value.setup.span,
      },
    ],
  };
  expect(emitReactSource(conflict).ok).toBe(false);
});
