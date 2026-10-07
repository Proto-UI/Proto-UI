// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button } from '@proto.ui/prototypes-base';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { compilePrototype } from '../src/memory';
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
import { writeCaseEvidence } from './case-evidence';

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
  { id: 'up', action: { kind: 'simulated-click' } },
  { id: 'disable', action: { kind: 'rerender', props: { disabled: true } } },
  { id: 'disabled-click', action: { kind: 'key-down', key: 'Enter' } },
  { id: 'omit-disabled', action: { kind: 'rerender', props: {}, omitKeys: ['disabled'] } },
  { id: 'focus', action: { kind: 'focus' } },
  { id: 'enabled-click', action: { kind: 'simulated-click' } },
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

const generatedDirectories: string[] = [];
afterEach(async () => {
  for (const directory of generatedDirectories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

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
  generatedDirectories.push(directory);
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
    observe: (exposes, host, run) => ({
      ...(observeButton(clickSink, exposes, host) as Record<string, TraceValue>),
      hasDisabledProp: run.hasProp('disabled'),
    }),
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

describe('simulated-host same-source Adapter/generated differential journey', () => {
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
    if (process.env.COMPILER_EVIDENCE_DIR) {
      await writeCaseEvidence(
        path.join(process.env.COMPILER_EVIDENCE_DIR, 'simulated'),
        evaluation,
        reference,
        candidate,
        ownerIdentities,
        null
      );
    }
    expect(evaluation.failures).toEqual([]);
    for (const coverage of [
      evaluation.oracleCoverage?.reference,
      evaluation.oracleCoverage?.candidate,
    ]) {
      expect(coverage?.every((entry) => entry.outcome === 'PASS')).toBe(true);
    }
    expect(evaluation.status).toBe('PASS');
  });

  it('detects an injected emitted-code semantic defect end to end, not as a code-string difference', async () => {
    const compilation = compilePrototype(source, { fileName: 'button.proto.ts' });
    if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));
    const original = compilation.value.output.code;
    const mutant = original.replace(
      'run.expose.emit("click");',
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

    // Re-execute unchanged emitted code in this negative-control test: neither
    // a broken reference nor a broken positive candidate may validate the mutant.
    const unchangedClicks = vi.fn();
    const unchangedModule = await loadEmittedModule(original, 'unchanged-control');
    const unchanged = await runTarget(
      unchangedModule.createComponent(scheduleNow) as TargetComponent,
      'compiled-candidate',
      unchangedClicks,
      () => unchangedClicks.mock.calls.length
    );
    const positiveControl = evaluateButtonCase(
      'button.state-events',
      reference,
      unchanged,
      ownerIdentities
    );
    expect(positiveControl.status).toBe('PASS');
    expect(positiveControl.failures).toEqual([]);
    for (const coverage of [
      positiveControl.oracleCoverage?.reference,
      positiveControl.oracleCoverage?.candidate,
    ]) {
      expect(coverage?.every((entry) => entry.outcome === 'PASS')).toBe(true);
    }

    // With justified identity normalization in place, the mutant must
    // diverge specifically on the click count at the routed commit step.
    const comparison = compareTraces(reference, candidate, {
      referenceIdentity: ownerIdentities.reference,
      candidateIdentity: {
        reason: 'Per-target opaque instance IDs; both journeys bind one owner',
        aliases: { 'compiled-mutant-0': 'journey-button' },
      },
    });
    const upCheckpoint = reference.findIndex((entry) => entry.step === 'up');
    expect(upCheckpoint).toBeGreaterThanOrEqual(0);
    expect(candidate[upCheckpoint].step).toBe('up');
    expect(comparison).toEqual({
      equal: false,
      firstDifference: {
        checkpoint: upCheckpoint,
        path: [upCheckpoint, 'data', 'clicks'],
        reference: { present: true, value: 1 },
        candidate: { present: true, value: 2 },
      },
    });

    const evaluation = evaluateButtonCase('button.state-events', reference, candidate, {
      reference: ownerIdentities.reference,
      candidate: {
        reason: 'Per-target opaque instance IDs; both journeys bind one owner',
        aliases: { 'compiled-mutant-0': 'journey-button' },
      },
    });
    expect(evaluation.status).toBe('FAIL');
    expect(evaluation.failures).toContain('compiler-mismatch');
    // The click-carrying criteria must be the specific violated contracts.
    const mutantClickFailures = evaluation.oracleCoverage?.candidate.filter(
      (entry) =>
        entry.criterion === 'P-BASE-BUTTON-ROLE-COMMAND' ||
        entry.criterion === 'P-BASE-BUTTON-CLICK-PROTOCOL-NAME'
    );
    expect(mutantClickFailures).toBeDefined();
    expect(mutantClickFailures?.length).toBeGreaterThan(0);
    expect(mutantClickFailures?.every((entry) => entry.outcome === 'FAIL')).toBe(true);
  });
});
