import {
  compareTraces,
  snapshotTrace,
  type IdentityNormalization,
  type SemanticCheckpoint,
  type TraceComparison,
} from './trace';

export type CaseStatus = 'PASS' | 'FAIL' | 'UNSUPPORTED' | 'UNTESTED' | 'BLOCKED';
export type FailureKind =
  | 'compiler-mismatch'
  | 'compiled-contract-defect'
  | 'adapter-baseline-defect'
  | 'shared-contract-defect-or-ambiguity'
  | 'harness-defect';
export interface ContractOracle {
  criterion: string;
  description: string;
  test: (trace: readonly SemanticCheckpoint[]) => boolean;
}
export interface OracleExecution {
  criterion: string;
  outcome: 'PASS' | 'FAIL' | 'ERROR';
  detail: string;
}
export interface ObservedRun {
  trace: readonly SemanticCheckpoint[];
  oracleExecutions: readonly OracleExecution[];
}

/** Evaluate independent expectations and retain explicit execution evidence, including thrown/invalid results. */
export function runOracleSuite(
  trace: readonly SemanticCheckpoint[],
  oracles: readonly ContractOracle[]
): ObservedRun {
  const snapshot = snapshotTrace(trace);
  const executions = oracles.map((oracle): OracleExecution => {
    try {
      const value = oracle.test(snapshot);
      if (typeof value !== 'boolean')
        return Object.freeze({
          criterion: oracle.criterion,
          outcome: 'ERROR',
          detail: 'Oracle did not return a boolean result',
        });
      return Object.freeze({
        criterion: oracle.criterion,
        outcome: value ? 'PASS' : 'FAIL',
        detail: oracle.description,
      });
    } catch (error) {
      return Object.freeze({
        criterion: oracle.criterion,
        outcome: 'ERROR',
        detail: String(error),
      });
    }
  });
  return Object.freeze({ trace: snapshot, oracleExecutions: Object.freeze(executions) });
}
export interface CaseResult {
  id: string;
  status: CaseStatus;
  reasons: string[];
  failures: FailureKind[];
  comparison?: TraceComparison;
  requiredCriteria: readonly string[];
  oracleCoverage?: { reference: readonly OracleExecution[]; candidate: readonly OracleExecution[] };
}

/** PASS requires exact executed oracle coverage on BOTH paths, passing contracts and equal traces. */
export function assessCase(input: {
  id: string;
  requiredCriteria: readonly string[];
  reference?: ObservedRun;
  candidate?: ObservedRun;
  unsupported?: string;
  authorityBlocker?: string;
  identities?: {
    reference?: IdentityNormalization;
    candidate?: IdentityNormalization;
  };
}): CaseResult {
  const required = input.requiredCriteria;
  const result: CaseResult = {
    id: input.id,
    requiredCriteria: required,
    status: 'UNTESTED',
    reasons: [],
    failures: [],
  };
  if (input.authorityBlocker)
    return {
      ...result,
      status: 'BLOCKED',
      reasons: [input.authorityBlocker],
      failures: ['shared-contract-defect-or-ambiguity'],
    };
  if (input.unsupported) return { ...result, status: 'UNSUPPORTED', reasons: [input.unsupported] };
  if (
    !Array.isArray(required) ||
    !required.length ||
    required.some((id) => typeof id !== 'string' || !id.trim()) ||
    new Set(required).size !== required.length
  ) {
    return {
      ...result,
      status: 'BLOCKED',
      reasons: ['Required criterion IDs must be nonempty, explicit and unique'],
      failures: ['harness-defect'],
    };
  }
  if (
    !input.reference ||
    !input.candidate ||
    !input.reference.trace.length ||
    !input.candidate.trace.length
  ) {
    return { ...result, reasons: ['Both independently observed paths must collect checkpoints'] };
  }
  result.oracleCoverage = {
    reference: input.reference.oracleExecutions,
    candidate: input.candidate.oracleExecutions,
  };
  for (const [path, run] of [
    ['reference', input.reference],
    ['candidate', input.candidate],
  ] as const) {
    if (!Array.isArray(run.oracleExecutions)) {
      return { ...result, reasons: [`${path}: no oracle execution evidence collected`] };
    }
    const executed = run.oracleExecutions.map((entry) => entry.criterion);
    const unknown = executed.filter((id) => !required.includes(id));
    const duplicates = executed.filter((id, index) => executed.indexOf(id) !== index);
    const invalid = run.oracleExecutions.filter(
      (entry) => !['PASS', 'FAIL', 'ERROR'].includes(entry.outcome)
    );
    if (unknown.length || duplicates.length || invalid.length) {
      return {
        ...result,
        status: 'BLOCKED',
        reasons: [
          `${path}: invalid oracle collection ${JSON.stringify({ unknown, duplicates, invalid })}`,
        ],
        failures: ['harness-defect'],
      };
    }
    const missing = required.filter((id) => !executed.includes(id));
    if (missing.length)
      result.reasons.push(`${path}: unexecuted required criteria ${missing.join(', ')}`);
  }
  if (result.reasons.length) return result;
  try {
    result.comparison = compareTraces(input.reference.trace, input.candidate.trace, {
      referenceIdentity: input.identities?.reference,
      candidateIdentity: input.identities?.candidate,
    });
  } catch (error) {
    return { ...result, status: 'BLOCKED', reasons: [String(error)], failures: ['harness-defect'] };
  }
  for (const [path, run, failure] of [
    ['Adapter', input.reference, 'adapter-baseline-defect'],
    ['Compiled', input.candidate, 'compiled-contract-defect'],
  ] as const) {
    for (const execution of run.oracleExecutions) {
      if (execution.outcome === 'ERROR') {
        result.reasons.push(`${path} oracle ${execution.criterion}: ${execution.detail}`);
        if (!result.failures.includes('harness-defect')) result.failures.push('harness-defect');
      } else if (execution.outcome === 'FAIL') {
        result.reasons.push(`${path} ${execution.criterion}: ${execution.detail}`);
        if (!result.failures.includes(failure)) result.failures.push(failure);
      }
    }
  }
  if (!result.comparison.equal) result.failures.push('compiler-mismatch');
  result.status = result.failures.includes('harness-defect')
    ? 'BLOCKED'
    : result.failures.length
      ? 'FAIL'
      : 'PASS';
  return result;
}

/** Missing/duplicate/unexpected collection is a harness failure, not a zero-test success. */
export function requireCaseCollection(
  expected: readonly string[],
  results: readonly CaseResult[]
): void {
  if (!expected.length || new Set(expected).size !== expected.length)
    throw new Error('Expected case IDs must be nonempty and unique');
  const counts = new Map<string, number>();
  for (const result of results) counts.set(result.id, (counts.get(result.id) ?? 0) + 1);
  const missing = expected.filter((id) => !counts.has(id));
  const unexpected = [...counts.keys()].filter((id) => !expected.includes(id));
  const duplicate = [...counts].filter(([, count]) => count !== 1).map(([id]) => id);
  if (missing.length || unexpected.length || duplicate.length)
    throw new Error(
      `Case collection mismatch: ${JSON.stringify({ missing, unexpected, duplicate })}`
    );
}
