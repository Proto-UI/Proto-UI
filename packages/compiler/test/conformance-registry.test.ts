// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CaseRegistry,
  evaluate,
  type CaseDefinition,
  type CaseObservationReport,
} from '../src/conformance/registry';
import type { SemanticCheckpoint, TraceValue } from '../src/conformance/trace';

type Action = { kind: 'input'; value: string } | { kind: 'dispose' };

function definition(patch: Partial<CaseDefinition<Action>> = {}): CaseDefinition<Action> {
  return {
    id: 'field.input-disposal',
    source: 'field.proto.ts',
    domain: 'text-field',
    profile: 'target-a',
    styleFamily: 'unstyled',
    steps: [
      {
        id: 'input',
        action: { kind: 'input', value: 'hello' },
        expected: {
          value: 'hello',
          events: [{ name: 'change', payload: { value: 'hello', isTrusted: false } }],
        },
        criteria: ['FIELD-VALUE', 'FIELD-CHANGE'],
        observation: { phase: 'settled', inputSources: ['synthetic-dispatch'] },
      },
      {
        id: 'dispose',
        action: { kind: 'dispose' },
        expected: { valid: false, events: [] },
        criteria: ['FIELD-DISPOSAL'],
        observation: { inputSources: ['host-api'] },
      },
    ],
    requiredCriteria: ['FIELD-VALUE', 'FIELD-CHANGE', 'FIELD-DISPOSAL'],
    ...patch,
  };
}

function observations(ownerId = 'field'): SemanticCheckpoint[] {
  return [
    {
      step: 'input', phase: 'settled', ownerId, parentId: null, viewEpoch: 1,
      kind: 'snapshot', inputSources: ['synthetic-dispatch'],
      data: { value: 'hello', events: [{ name: 'change', payload: { value: 'hello', isTrusted: false } }], extra: 'allowed' },
    },
    {
      step: 'dispose', phase: 'settled', ownerId, parentId: null, viewEpoch: 1,
      kind: 'snapshot', inputSources: ['host-api'], data: { valid: false, events: [] },
    },
  ];
}

describe('target-neutral case registry', () => {
  it('evaluates the same independent contract from distinct target runner observations', () => {
    for (const profile of ['target-a', 'target-b']) {
      const registry = new CaseRegistry([definition({ profile })]);
      const result = registry.evaluateReport({
        id: 'field.input-disposal', profile,
        reference: observations('reference-owner'), candidate: observations('candidate-owner'),
        identities: {
          reference: { reason: 'Target-local opaque owner', aliases: { 'reference-owner': 'field' } },
          candidate: { reason: 'Target-local opaque owner', aliases: { 'candidate-owner': 'field' } },
        },
      });
      expect(result.status).toBe('PASS');
      expect(result.oracleCoverage?.reference.map((entry) => [entry.criterion, entry.outcome])).toEqual([
        ['FIELD-VALUE', 'PASS'], ['FIELD-CHANGE', 'PASS'], ['FIELD-DISPOSAL', 'PASS'],
      ]);
      expect(result.oracleCoverage?.candidate.map((entry) => [entry.criterion, entry.outcome])).toEqual([
        ['FIELD-VALUE', 'PASS'], ['FIELD-CHANGE', 'PASS'], ['FIELD-DISPOSAL', 'PASS'],
      ]);
    }
  });

  it('rejects equally missing, reordered, duplicate and unexpected snapshots on both paths', () => {
    const registry = new CaseRegistry([definition()]);
    const trace = observations();
    for (const broken of [
      [trace[0]], [trace[1], trace[0]], [trace[0], trace[0], trace[1]],
      [trace[0], { ...trace[1], step: 'unregistered-step' }],
    ]) {
      const result = evaluate(registry, 'field.input-disposal', broken, broken);
      expect(result.status).toBe('FAIL');
      expect(result.comparison).toEqual({ equal: true });
      expect(result.failures).toEqual(['adapter-baseline-defect', 'compiled-contract-defect']);
    }
  });

  it('retains ancillary observations for full differential comparison without making them claimed criteria', () => {
    const registry = new CaseRegistry([definition()]);
    const reference = observations();
    reference.unshift({ ...reference[0], step: 'mount', data: { created: 1 } });
    const candidate = structuredClone(reference);
    expect(registry.evaluate('field.input-disposal', reference, candidate).status).toBe('PASS');
    candidate[0].data = { created: 2 };
    expect(registry.evaluate('field.input-disposal', reference, candidate)).toMatchObject({
      status: 'FAIL', failures: ['compiler-mismatch'],
    });
  });

  it('checks nested payloads, event order and exact selected structures independently of equality', () => {
    const registry = new CaseRegistry([definition()]);
    const mutations: TraceValue[][] = [
      [{ name: 'change', payload: { value: 'wrong', isTrusted: false } }],
      [{ name: 'change', payload: { value: 'hello' } }],
      [{ name: 'change', payload: { value: 'hello', isTrusted: false, invented: true } }],
      [{ name: 'unwanted', payload: null }, { name: 'change', payload: { value: 'hello', isTrusted: false } }],
    ];
    for (const events of mutations) {
      const trace = observations();
      trace[0].data = { value: 'hello', events };
      const result = registry.evaluate('field.input-disposal', trace, trace);
      expect(result.status).toBe('FAIL');
      expect(result.comparison).toEqual({ equal: true });
    }
    const original = definition();
    const ordered = new CaseRegistry([{
      ...original,
      steps: [{ ...original.steps[0], expected: { events: ['first', 'second'] } }, original.steps[1]],
    }]);
    const reversed = observations();
    reversed[0].data = { events: ['second', 'first'] };
    expect(ordered.evaluate('field.input-disposal', reversed, reversed).status).toBe('FAIL');
  });

  it('does not infer trust from provenance or normalize away different input sources', () => {
    const registry = new CaseRegistry([definition()]);
    const wrongSource = observations();
    wrongSource[0].inputSources = ['browser-automation'];
    expect(registry.evaluate('field.input-disposal', wrongSource, wrongSource).status).toBe('FAIL');
    const wrongTrust = observations();
    wrongTrust[0].data = { value: 'hello', events: [{ name: 'change', payload: { value: 'hello', isTrusted: true } }] };
    expect(registry.evaluate('field.input-disposal', wrongTrust, wrongTrust).status).toBe('FAIL');
    const malformed = observations();
    malformed[0].inputSources = ['trusted-event'] as unknown as SemanticCheckpoint['inputSources'];
    expect(registry.evaluate('field.input-disposal', malformed, malformed)).toMatchObject({
      status: 'BLOCKED', failures: ['harness-defect'],
    });
  });

  it('keeps declarations, unobserved paths, unsupported applicability and blockers distinct', () => {
    const registry = new CaseRegistry([definition()]);
    expect(registry.evaluateReports([]).map((result) => result.status)).toEqual(['UNTESTED']);
    expect(registry.evaluate('field.input-disposal', observations()).status).toBe('UNTESTED');
    expect(registry.evaluate('field.input-disposal', [], []).status).toBe('UNTESTED');
    const unsupported = new CaseRegistry([definition({ applicability: { status: 'UNSUPPORTED', reason: 'Target lacks the declared input contract' } })]);
    expect(unsupported.evaluate('field.input-disposal', observations(), observations()).status).toBe('UNSUPPORTED');
    expect(unsupported.evaluateReports([])[0].status).toBe('UNSUPPORTED');
    expect(registry.evaluateReport({ id: 'field.input-disposal', authorityBlocker: 'Authority is unresolved' })).toMatchObject({
      status: 'BLOCKED', failures: ['shared-contract-defect-or-ambiguity'],
    });
    expect(registry.evaluateReport({ id: 'field.input-disposal', harnessError: 'Driver crashed' })).toMatchObject({
      status: 'BLOCKED', failures: ['harness-defect'],
    });
  });

  it('rejects unknown/duplicate collection and target-mislabeled reports instead of accepting verdicts', () => {
    const registry = new CaseRegistry([definition()]);
    expect(() => registry.evaluate('unknown', observations(), observations())).toThrow('Unknown');
    expect(() => registry.evaluateReports([{ id: 'unknown' }])).toThrow('Unknown');
    expect(() => registry.evaluateReports([{ id: 'field.input-disposal' }, { id: 'field.input-disposal' }])).toThrow('Duplicate');
    expect(registry.evaluateReport({ id: 'field.input-disposal', profile: 'target-b', reference: observations(), candidate: observations() }).status).toBe('BLOCKED');
    const forged = { id: 'field.input-disposal', status: 'PASS', oracleExecutions: [{ criterion: 'FIELD-VALUE', outcome: 'PASS' }] } as unknown as CaseObservationReport;
    expect(registry.evaluateReport(forged).status).toBe('UNTESTED');
    const broken = observations();
    broken[0].data = { value: 'wrong', events: [] };
    expect(registry.evaluateReport({ ...forged, reference: broken, candidate: broken }).status).toBe('FAIL');
  });

  it('rejects vacuous or ambiguous definitions before any runner can claim coverage', () => {
    const original = definition();
    expect(() => new CaseRegistry([original, original])).toThrow('Duplicate');
    expect(() => new CaseRegistry([definition({ requiredCriteria: ['FIELD-VALUE'] })])).toThrow('exactly cover');
    expect(() => new CaseRegistry([definition({ requiredCriteria: [...original.requiredCriteria, 'UNOWNED'] })])).toThrow('exactly cover');
    expect(() => new CaseRegistry([definition({ requiredCriteria: ['FIELD-VALUE', 'FIELD-VALUE'] })])).toThrow('unique');
    expect(() => new CaseRegistry([definition({ steps: [original.steps[0], original.steps[0]] })])).toThrow('unique');
    expect(() => new CaseRegistry([definition({ steps: [{ ...original.steps[0], expected: {} }, original.steps[1]] })])).toThrow('structured data expectations');
    expect(() => new CaseRegistry([definition({ applicability: { status: 'UNSUPPORTED', reason: '' } })])).toThrow('reason');
  });

  it('retains independent declaration values after nested caller mutation', () => {
    const original = definition();
    const registry = new CaseRegistry([original]);
    const events = original.steps[0].expected.events as { name: string; payload: { value: string; isTrusted: boolean } }[];
    events[0].payload.value = 'changed-after-registration';
    expect(registry.evaluate('field.input-disposal', observations(), observations()).status).toBe('PASS');
    expect(() => { (registry.get('field.input-disposal').steps[0].expected as Record<string, unknown>).value = 'rewrite'; }).toThrow();
  });
});
