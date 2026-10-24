import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const routerSplices = [
  {
    name: 'router-enabled',
    before: `  const isEnabled = () => activeRouterByRoot.get(rootEl) === routerIdentity && opt.isEnabled();`,
    after: `  const isEnabled = (native?: Event, handler?: string) => {
    const active = activeRouterByRoot.get(rootEl) === routerIdentity;
    const enabled = active && opt.isEnabled();
    try {
      (globalThis as any).__accordionTrace?.record(
        'router.enabled',
        { active, optEvaluated: active, enabled, handler },
        rootEl, opt.instanceToken, routerIdentity, native
      );
    } catch {}
    return enabled;
  };`,
  },
  {
    name: 'router-emit',
    before: `    target.dispatchEvent(ev);`,
    after: `    try {
      (globalThis as any).__accordionTrace?.record(
        'router.emit.before', { type }, rootEl, opt.instanceToken, routerIdentity, native
      );
    } catch {}
    target.dispatchEvent(ev);
    try {
      (globalThis as any).__accordionTrace?.record(
        'router.emit.after', { type }, rootEl, opt.instanceToken, routerIdentity, native
      );
    } catch {}`,
  },
  {
    name: 'global-keydown-event',
    before: `    listen(globalEl, 'keydown', (e: KeyboardEvent) => {
      if (!isEnabled()) return;`,
    after: `    listen(globalEl, 'keydown', (e: KeyboardEvent) => {
      if (!isEnabled(e, 'global.keydown')) return;`,
  },
  {
    name: 'root-keydown-event',
    before: `    listen(rootEl, 'keydown', (e: KeyboardEvent) => {
      if (!isEnabled()) return;`,
    after: `    listen(rootEl, 'keydown', (e: KeyboardEvent) => {
      if (!isEnabled(e, 'root.keydown')) return;`,
  },
  {
    name: 'global-keyup-event',
    before: `    listen(globalEl, 'keyup', (e: KeyboardEvent) => {
      if (!isEnabled()) return;`,
    after: `    listen(globalEl, 'keyup', (e: KeyboardEvent) => {
      if (!isEnabled(e, 'global.keyup')) return;`,
  },
];

const reactSplices = [
  {
    name: 'react-event-gate',
    before: `        eventGateRef.current = eventGate;`,
    after: `        eventGateRef.current = eventGate;
        for (const method of ['enable', 'disable', 'isEnabled', 'dispose'] as const) {
          const original = eventGate[method];
          (eventGate as any)[method] = function (...args: any[]) {
            const value = Reflect.apply(original, this, args);
            try {
              (globalThis as any).__accordionTrace?.record(
                'react.gate.' + method,
                { value, viewGeneration: viewGenerationRef.current, viewReady: viewReadyRef.current, hasPendingCommit: !!pendingCommitRef.current },
                rootEl, instanceTokenRef.current, eventGate
              );
            } catch {}
            return value;
          };
        }`,
  },
];

/** Test-only development instrumentation; no plugin is installed without the explicit env. */
export function accordionActivationProbePlugin(root) {
  const probeDirectory = process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR;
  if (!probeDirectory) return undefined;
  const sources = new Map([
    [
      path
        .resolve(root, 'packages/adapters/base/src/events/web-event-router.ts')
        .replaceAll('\\', '/'),
      routerSplices,
    ],
    [
      path.resolve(root, 'packages/adapters/react/src/adapt.ts').replaceAll('\\', '/'),
      reactSplices,
    ],
  ]);
  return {
    name: 'proto-ui-accordion-activation-probe',
    apply: /** @type {const} */ ('serve'),
    enforce: /** @type {const} */ ('pre'),
    transform(code, id) {
      const filename = id.split('?')[0].replaceAll('\\', '/');
      const splices = sources.get(filename);
      if (!splices) return null;
      const beforeSHA = createHash('sha256').update(code).digest('hex');
      for (const splice of splices) {
        const first = code.indexOf(splice.before);
        if (first < 0 || code.indexOf(splice.before, first + splice.before.length) !== -1) {
          throw new Error(
            `[ACCORDION_ACTIVATION_PROBE_SETUP] Expected one ${splice.name} source shape in ${filename}`
          );
        }
        code = code.slice(0, first) + splice.after + code.slice(first + splice.before.length);
      }
      const afterSHA = createHash('sha256').update(code).digest('hex');
      const relativePath = path.relative(root, filename).replaceAll('\\', '/');
      const name = splices === routerSplices ? 'router' : 'react';
      const receipt =
        JSON.stringify(
          {
            relativePath,
            beforeSHA,
            afterSHA,
            stage: 'test-onlyViteServe',
            shapes: splices.map((splice) => splice.name),
          },
          null,
          2
        ) + '\n';
      try {
        const directory = path.join(probeDirectory, 'source-transforms');
        mkdirSync(directory, { recursive: true });
        writeFileSync(path.join(directory, `${name}-${beforeSHA}-${afterSHA}.json`), receipt);
      } catch (error) {
        throw new Error(
          `[ACCORDION_ACTIVATION_PROBE_SETUP] Cannot retain transform binding for ${relativePath}`,
          { cause: error }
        );
      }
      return { code, map: null };
    },
  };
}
