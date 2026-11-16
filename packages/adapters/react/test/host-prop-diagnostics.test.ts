import { afterEach, expect, it, vi } from 'vitest';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { definePrototype } from '@proto.ui/core';
import toggle from '../../../prototypes/base/src/toggle';
import { createMountedReactAdapter } from './utils/fake-react';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('diagnoses dropped host-looking props without forwarding or overriding semantic ARIA', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const props = {
    'aria-label': 'private name',
    'aria-pressed': false,
    'aria-describedby': 'help',
    'data-kind': 'icon',
    title: 'private title',
    defaultActive: true,
  };
  const mounted = createMountedReactAdapter(toggle, props);
  try {
    for (const key of ['aria-label', 'aria-describedby', 'data-kind', 'title'])
      expect(mounted.root!.hasAttribute(key)).toBe(false);
    expect(mounted.root!.getAttribute('aria-pressed')).toBe('true');
    expect(warn).toHaveBeenCalledTimes(5);
    const messages = warn.mock.calls.flat().join('\n');
    expect(messages).toContain('instanceAssociations.controlLabel');
    expect(messages).not.toContain('private name');
    expect(messages).not.toContain('private title');
    mounted.update({ ...props });
    expect(warn).toHaveBeenCalledTimes(5);
    mounted.update({ ...props, id: 'app-id' });
    expect(warn).toHaveBeenCalledTimes(6);
  } finally {
    mounted.unmount();
  }
});

it('preserves declared prototype inputs and documented Adapter channels without warnings', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const prototype = definePrototype<{ title?: string; 'data-mode'?: string }>({
    name: 'declared-host-looking-props',
    setup(def) {
      def.props.define({ title: { type: 'string' }, 'data-mode': { type: 'string' } });
    },
  });
  const mounted = createMountedReactAdapter(prototype, {
    title: 'Semantic title',
    'data-mode': 'owned',
    className: 'app-class',
    style: { color: 'red' },
    dir: 'rtl',
    'data-demo-ref': 'demo',
  });
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(mounted.root!.className).toContain('app-class');
    expect(mounted.root!.getAttribute('data-demo-ref')).toBe('demo');
  } finally {
    mounted.unmount();
  }
});

it('does not emit host prop diagnostics in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mounted = createMountedReactAdapter(toggle, { 'aria-label': 'ignored' });
  try {
    expect(warn).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
  }
});

it('suppresses warnings in a production browser bundle without a process global', () => {
  const warn = vi.fn();
  const bundle = buildSync({
    entryPoints: [path.resolve('packages/adapters/react/src/host-prop-diagnostics.ts')],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'hostDiagnostics',
    define: { 'process.env.NODE_ENV': '"production"' },
  }).outputFiles[0].text;
  runInNewContext(
    bundle +
      ';hostDiagnostics.diagnoseHostProps("button", {"aria-label":"ignored"}, {}, new Set());',
    { console: { warn } }
  );
  expect(warn).not.toHaveBeenCalled();
});

it('does not warn when a custom getProps mapping consumes a host-looking input', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mounted = createMountedReactAdapter(
    toggle,
    { 'data-selected': true },
    {
      getProps: (props: Record<string, unknown>) => ({ active: props['data-selected'] }),
    }
  );
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(mounted.root!.getAttribute('aria-pressed')).toBe('true');
    expect(mounted.root!.hasAttribute('data-selected')).toBe(false);
  } finally {
    mounted.unmount();
  }
});
