// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  compareTraces,
  normalizeTrace,
  TraceRecorder,
  type SemanticCheckpoint,
} from '../src/conformance/trace';
import {
  assessCase,
  requireCaseCollection,
  runOracleSuite,
  type ContractOracle,
} from '../src/conformance/result';
import { generateSequence, minimizeSequence } from '../src/conformance/sequences';

function checkpoint(patch: Partial<SemanticCheckpoint> = {}): SemanticCheckpoint {
  return {
    step: 'pointer-enter',
    phase: 'settled',
    ownerId: 'button',
    parentId: null,
    viewEpoch: 1,
    kind: 'state',
    data: { hovered: true, events: ['down', 'click'] },
    ...patch,
  };
}

const hoverCriterion = 'P-BASE-BUTTON-POINTER-HOVER';
const hoverOracle: ContractOracle = {
  criterion: hoverCriterion,
  description: 'Enabled pointer entry must expose hovered=true',
  test(trace) {
    const value = trace[0]?.data;
    return (
      value !== null && typeof value === 'object' && !Array.isArray(value) && value.hovered === true
    );
  },
};

describe('semantic differential conformance', () => {
  it('identifies the first mutation without discarding intermediate state or event ordering', () => {
    const reference = [checkpoint(), checkpoint({ step: 'disabled', data: { hovered: false } })];
    const changed = [
      checkpoint({ data: { hovered: false, events: ['down', 'click'] } }),
      reference[1],
    ];
    const result = compareTraces(reference, changed);
    expect(result).toMatchObject({
      equal: false,
      firstDifference: {
        checkpoint: 0,
        path: [0, 'data', 'hovered'],
        reference: { present: true, value: true },
        candidate: { present: true, value: false },
      },
    });
    expect(
      compareTraces(
        [checkpoint()],
        [checkpoint({ data: { hovered: true, events: ['click', 'down'] } })]
      ).equal
    ).toBe(false);
    expect(
      compareTraces(
        [checkpoint()],
        [checkpoint({ data: { hovered: true, events: ['down', 'click', 'click'] } })]
      ).equal
    ).toBe(false);
  });

  it('does not normalize away ownership topology, epochs, default prevention, or missing values', () => {
    for (const patch of [
      { parentId: 'another' },
      { viewEpoch: 2 },
      { data: { hovered: true, events: ['down', 'click'], defaultPrevented: false } },
    ]) {
      expect(compareTraces([checkpoint()], [checkpoint(patch)]).equal).toBe(false);
    }
    expect(
      compareTraces([checkpoint({ data: { value: null } })], [checkpoint({ data: {} })]).equal
    ).toBe(false);
    expect(compareTraces([checkpoint()], []).equal).toBe(false);
  });

  it('permits explicitly justified bijective owner renaming, but keeps public data exact', () => {
    const reference = [checkpoint({ ownerId: 'ref-1', parentId: 'ref-0' })];
    const candidate = [checkpoint({ ownerId: 'gen-7', parentId: 'gen-4' })];
    const options = {
      referenceIdentity: {
        reason: 'Opaque allocation IDs; declared child and parent roles',
        aliases: { 'ref-1': 'child', 'ref-0': 'parent' },
      },
      candidateIdentity: {
        reason: 'Opaque allocation IDs; declared child and parent roles',
        aliases: { 'gen-7': 'child', 'gen-4': 'parent' },
      },
    };
    expect(compareTraces(reference, candidate, options)).toEqual({ equal: true });
    expect(
      compareTraces(reference, [checkpoint({ ownerId: 'gen-4', parentId: 'gen-7' })], options).equal
    ).toBe(false);
    expect(
      compareTraces(
        reference,
        [checkpoint({ ...candidate[0], data: { hovered: true, events: ['gen-7'] } })],
        options
      ).equal
    ).toBe(false);
    expect(() =>
      normalizeTrace(reference, { reason: 'collapse', aliases: { 'ref-1': 'one', 'ref-0': 'one' } })
    ).toThrow('injective');
    expect(() =>
      normalizeTrace(reference, {
        reason: 'collision with unmapped identity',
        aliases: { 'ref-1': 'ref-0' },
      })
    ).toThrow('collapse');
    expect(() => normalizeTrace(reference, { reason: '', aliases: {} })).toThrow('reason');
  });

  it('fails matching traces when independent executions of the contract oracle reject both paths', () => {
    const trace = [checkpoint({ data: { hovered: false } })];
    const result = assessCase({
      id: 'hover',
      requiredCriteria: [hoverCriterion],
      reference: runOracleSuite(trace, [hoverOracle]),
      candidate: runOracleSuite(trace, [hoverOracle]),
    });
    expect(result.status).toBe('FAIL');
    expect(result.comparison).toEqual({ equal: true });
    expect(result.failures).toEqual(['adapter-baseline-defect', 'compiled-contract-defect']);
    expect(
      assessCase({
        id: 'ambiguous',
        requiredCriteria: [hoverCriterion],
        authorityBlocker: 'Catalog disagrees on required timing',
      }).failures
    ).toEqual(['shared-contract-defect-or-ambiguity']);
  });

  it('separates absent collection, unsupported inputs, malformed traces and actual passing runs', () => {
    expect(assessCase({ id: 'none', requiredCriteria: [hoverCriterion] }).status).toBe('UNTESTED');
    expect(
      assessCase({
        id: 'unsupported',
        requiredCriteria: [hoverCriterion],
        unsupported: 'dynamic import is not admitted',
      }).status
    ).toBe('UNSUPPORTED');
    expect(
      assessCase({
        id: 'blocked',
        requiredCriteria: [hoverCriterion],
        harnessError: 'browser unavailable',
      }).status
    ).toBe('BLOCKED');
    const run = runOracleSuite([checkpoint()], [hoverOracle]);
    const passed = assessCase({
      id: 'hover',
      requiredCriteria: [hoverCriterion],
      reference: run,
      candidate: run,
    });
    expect(passed.status).toBe('PASS');
    expect(() => requireCaseCollection(['hover'], [])).toThrow('missing');
    expect(() => requireCaseCollection(['hover'], [passed, passed])).toThrow('duplicate');
    expect(() => requireCaseCollection(['other'], [passed])).toThrow('unexpected');
    expect(() => compareTraces([checkpoint({ data: Number.NaN })], run.trace)).toThrow(
      'Invalid trace'
    );
  });

  it('does not pass identical traces without complete oracle execution on each path', () => {
    const trace = [checkpoint()];
    const complete = runOracleSuite(trace, [hoverOracle]);
    const empty = runOracleSuite(trace, []);
    expect(
      assessCase({
        id: 'empty',
        requiredCriteria: [hoverCriterion],
        reference: empty,
        candidate: empty,
      }).status
    ).toBe('UNTESTED');
    expect(
      assessCase({
        id: 'candidate-missing',
        requiredCriteria: [hoverCriterion],
        reference: complete,
        candidate: empty,
      }).status
    ).toBe('UNTESTED');
    expect(
      assessCase({
        id: 'reference-missing',
        requiredCriteria: [hoverCriterion],
        reference: empty,
        candidate: complete,
      }).status
    ).toBe('UNTESTED');
    expect(
      assessCase({
        id: 'partial',
        requiredCriteria: [hoverCriterion, 'P-BASE-BUTTON-PROP-DISABLED'],
        reference: complete,
        candidate: complete,
      }).status
    ).toBe('UNTESTED');
    expect(
      assessCase({ id: 'no-scope', requiredCriteria: [], reference: complete, candidate: complete })
        .status
    ).toBe('BLOCKED');
  });

  it('rejects duplicate and unknown criterion execution without confusing it with semantic failure', () => {
    const trace = [checkpoint()];
    const complete = runOracleSuite(trace, [hoverOracle]);
    const duplicate = runOracleSuite(trace, [hoverOracle, hoverOracle]);
    const unknown = runOracleSuite(trace, [{ ...hoverOracle, criterion: 'UNDECLARED' }]);
    for (const invalid of [duplicate, unknown]) {
      const result = assessCase({
        id: 'coverage',
        requiredCriteria: [hoverCriterion],
        reference: complete,
        candidate: invalid,
      });
      expect(result.status).toBe('BLOCKED');
      expect(result.failures).toEqual(['harness-defect']);
    }
  });

  it('records actual independent oracle invocations and distinguishes false from thrown evaluation', () => {
    let calls = 0;
    const oracle: ContractOracle = {
      ...hoverOracle,
      test(trace) {
        calls++;
        return hoverOracle.test(trace);
      },
    };
    const reference = runOracleSuite([checkpoint()], [oracle]);
    const candidate = runOracleSuite([checkpoint()], [oracle]);
    expect(calls).toBe(2);
    expect(
      assessCase({ id: 'executed', requiredCriteria: [hoverCriterion], reference, candidate })
        .status
    ).toBe('PASS');
    const throws = runOracleSuite(
      [checkpoint()],
      [
        {
          ...hoverOracle,
          test() {
            throw new Error('oracle implementation failed');
          },
        },
      ]
    );
    const blocked = assessCase({
      id: 'throws',
      requiredCriteria: [hoverCriterion],
      reference,
      candidate: throws,
    });
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.failures).toEqual(['harness-defect']);
    expect(throws.oracleExecutions[0].outcome).toBe('ERROR');
    const nonBoolean = runOracleSuite(
      [checkpoint()],
      [{ ...hoverOracle, test: (() => undefined) as unknown as ContractOracle['test'] }]
    );
    expect(
      assessCase({
        id: 'invalid-return',
        requiredCriteria: [hoverCriterion],
        reference,
        candidate: nonBoolean,
      }).status
    ).toBe('BLOCKED');
  });

  it('captures immutable intermediate observations rather than live data references', () => {
    const data = { hovered: true, events: ['pointer.enter'] };
    const input = checkpoint({ data });
    const recorder = new TraceRecorder();
    recorder.record(input);
    const normalized = normalizeTrace([input]);
    data.hovered = false;
    data.events.push('pointer.leave');
    input.viewEpoch = 2;
    recorder.record(input);
    const history = recorder.snapshot();
    expect(history[0]).toMatchObject({
      viewEpoch: 1,
      data: { hovered: true, events: ['pointer.enter'] },
    });
    expect(history[1]).toMatchObject({
      viewEpoch: 2,
      data: { hovered: false, events: ['pointer.enter', 'pointer.leave'] },
    });
    expect(normalized[0]).toMatchObject({
      viewEpoch: 1,
      data: { hovered: true, events: ['pointer.enter'] },
    });
    const captured = history[0].data;
    if (
      captured === null ||
      typeof captured !== 'object' ||
      Array.isArray(captured) ||
      !Array.isArray(captured.events)
    )
      throw new Error('Expected recorded state payload');
    const capturedEvents = captured.events;
    expect(() => {
      captured.hovered = false;
    }).toThrow();
    expect(() => {
      capturedEvents.push('erased');
    }).toThrow();
  });

  it('replays recorded seeds and shrinks a causal sequence without mutating its source', async () => {
    const alphabet = ['hover', 'down', 'disable', 'up'] as const;
    expect(generateSequence(41, 32, alphabet)).toEqual(generateSequence(41, 32, alphabet));
    expect(generateSequence(42, 32, alphabet)).not.toEqual(generateSequence(41, 32, alphabet));
    const source = ['hover', 'down', 'hover', 'disable', 'up'];
    const fails = (actions: readonly string[]) =>
      actions.includes('down') && actions.indexOf('disable') > actions.indexOf('down');
    const reduced = await minimizeSequence(source, fails);
    expect(reduced.sequence).toEqual(['down', 'disable']);
    expect(source).toEqual(['hover', 'down', 'hover', 'disable', 'up']);
    for (let index = 0; index < reduced.sequence.length; index++) {
      expect(fails(reduced.sequence.filter((_, at) => at !== index))).toBe(false);
    }
    await expect(minimizeSequence(['hover'], fails)).rejects.toThrow('does not reproduce');
  });
});
