// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { button } from '@proto.ui/prototypes-base';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { compilePrototype } from '../src/compile';
import {
  compareTraces,
  type IdentityNormalization,
  type SemanticCheckpoint,
  type TraceValue,
} from '../src/conformance/trace';
import { evaluateButtonCase } from '../src/conformance/button-cases';
import {
  readExposedStates,
  runJourney,
  type JourneyStep,
  type TargetComponent,
} from '../src/conformance/journey';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const source = readFileSync(
  path.resolve(
    fileURLToPath(import.meta.url),
    '../../../prototypes/base/src/button/button.proto.ts'
  ),
  'utf8'
);
const journeySteps: readonly JourneyStep[] = Object.freeze([
  { id: 'hover', action: { kind: 'pointer-enter' } },
  { id: 'down', action: { kind: 'pointer-down' } },
  { id: 'up', action: { kind: 'native-click', trusted: true } },
  { id: 'disable', action: { kind: 'rerender', props: { disabled: true } } },
  { id: 'disabled-click', action: { kind: 'key-down', key: 'Enter' } },
  { id: 'omit-disabled', action: { kind: 'rerender', props: { disabled: false } } },
  { id: 'focus', action: { kind: 'focus' } },
  { id: 'enabled-click', action: { kind: 'native-click', trusted: true } },
  { id: 'leave', action: { kind: 'pointer-leave' } },
]);

const scheduleNow = {
  schedule: (task: () => void): void => {
    task();
  },
} as const;

interface LoadedEmittedModule {
  prototype: unknown;
  createComponent: (options?: Record<string, unknown>) => unknown;
}

/**
 * Candidate code is runtime-selected content, so a static import cannot exist.
 * Distinct per-identity directories under the test folder keep Vite resolution
 * working and keep reference/mutant modules independently loaded.
 */
async function loadEmittedModule(code: string, identity: string): Promise<LoadedEmittedModule> {
  const directory = path.join(
    path.resolve(fileURLToPath(import.meta.url), '..'),
    'generated-modules',
    `emitted-${identity}-${process.pid}`
  );
  await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'Component.tsx'), code, 'utf8');
  return (await import(
    /* @vite-ignore */ path.join(directory, 'Component.tsx')
  )) as LoadedEmittedModule;
}

function observeButton(
  clickSink: () => number,
  exposes: Record<string, unknown> | null,
  host: HTMLElement
): TraceValue {
  const states = readExposedStates(exposes);
  const container = host.firstElementChild;
  const root =
    container && container.firstElementChild instanceof HTMLElement
      ? container.firstElementChild
      : null;
  return {
    disabled: states.disabled ?? null,
    hovered: states.hovered ?? null,
    pressed: states.pressed ?? null,
    focused: states.focused ?? null,
    focusVisible: states.focusVisible ?? null,
    clicks: clickSink(),
    rootRole: root?.getAttribute('role') ?? null,
    ariaDisabled: root?.getAttribute('aria-disabled') ?? null,
  };
}

async function runTarget(
  component: TargetComponent,
  displayName: string,
  onClick: () => void,
  clickSink: () => number
): Promise<readonly SemanticCheckpoint[]> {
  return runJourney(component, {
    mountProps: { disabled: false, onClick },
    steps: journeySteps,
    displayName,
    observe: (exposes, host) => observeButton(clickSink, exposes, host),
  });
}

function referenceTarget(): TargetComponent {
  return createReactAdapter(React)(button as never, scheduleNow) as unknown as TargetComponent;
}

const ownerIdentities: Record<'reference' | 'candidate', IdentityNormalization> = {
  reference: {
    reason: 'Per-target opaque instance IDs; both journeys bind one owner with no parent',
    aliases: { 'adapter-reference-0': 'journey-button' },
  },
  candidate: {
    reason: 'Per-target opaque instance IDs; both journeys bind one owner with no parent',
    aliases: { 'compiled-candidate-0': 'journey-button' },
  },
};

describe('same-source Adapter/generated differential journey', () => {
  it('executes the unchanged prototype and emitted module with equal semantic traces and passing oracles', async () => {
    const compilation = compilePrototype(source, { fileName: 'button.proto.ts' });
    if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));

    const referenceClicks = vi.fn();
    const candidateClicks = vi.fn();
    const emitted = await loadEmittedModule(compilation.value.output.code, 'candidate');
    const candidateAdapted = emitted.createComponent(scheduleNow);
    const reference = await runTarget(
      referenceTarget(),
      'adapter-reference',
      referenceClicks,
      () => referenceClicks.mock.calls.length
    );
    const candidate = await runTarget(
      candidateAdapted as unknown as TargetComponent,
      'compiled-candidate',
      candidateClicks,
      () => candidateClicks.mock.calls.length
    );

    const evaluation = evaluateButtonCase(
      'button.state-events',
      reference,
      candidate,
      ownerIdentities
    );
    expect(evaluation.failures).toEqual([]);
    expect(evaluation.oracleCoverage?.reference.length).toBeGreaterThan(0);
    expect(evaluation.oracleCoverage?.candidate.length).toBe(
      evaluation.oracleCoverage?.reference.length
    );
    expect(evaluation.status).toBe('PASS');
  });

  it('detects an injected emitted-code semantic defect end to end, not as a code-string difference', async () => {
    const compilation = compilePrototype(source, { fileName: 'button.proto.ts' });
    if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));
    const original = compilation.value.output.code;
    const mutant = original.replace(
      'if (disabled.get()) {\n        // Source 127:25\n        return;\n      }\n      // Source 128:5\n      run.expose.emit("click");',
      'run.expose.emit("click");\n      run.expose.emit("click");'
    );
    expect(mutant).not.toBe(original);

    const referenceClicks = vi.fn();
    const candidateClicks = vi.fn();
    const emitted = await loadEmittedModule(mutant, 'mutant');
    const candidateAdapted = emitted.createComponent(scheduleNow);

    const reference = await runTarget(
      referenceTarget(),
      'adapter-reference',
      referenceClicks,
      () => referenceClicks.mock.calls.length
    );
    const candidate = await runTarget(
      candidateAdapted as unknown as TargetComponent,
      'compiled-mutant',
      candidateClicks,
      () => candidateClicks.mock.calls.length
    );
    const comparison = compareTraces(reference, candidate);
    expect(comparison.equal).toBe(false);
    const evaluation = evaluateButtonCase('button.pointer-props', reference, candidate);
    expect(evaluation.status).toBe('FAIL');
    expect(evaluation.failures).toContain('compiler-mismatch');
  });
});
