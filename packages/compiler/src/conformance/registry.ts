import { isDeepStrictEqual } from 'node:util';
import {
  assessCase,
  requireCaseCollection,
  runOracleSuite,
  type CaseResult,
  type ContractOracle,
} from './result';
import { snapshotTrace, type IdentityNormalization, type SemanticCheckpoint, type TraceValue } from './trace';

export type CaseApplicability =
  | { readonly status: 'SUPPORTED' }
  | { readonly status: 'UNSUPPORTED'; readonly reason: string };

export interface CaseStep<Action extends { kind: string } = { kind: string }> {
  readonly id: string;
  readonly action: Action;
  /** Top-level fields are selected explicitly; each selected value is compared in full. */
  readonly expected: Readonly<Record<string, TraceValue>>;
  readonly criteria: readonly string[];
  readonly observation?: {
    readonly phase?: string;
    /** Provenance never implies event trust. Assert isTrusted in expected data when relevant. */
    readonly inputSources?: SemanticCheckpoint['inputSources'];
  };
}

export interface CaseDefinition<Action extends { kind: string } = { kind: string }> {
  readonly id: string;
  readonly source: string;
  readonly domain: string;
  readonly profile: string;
  readonly styleFamily: string;
  readonly feature?: string;
  readonly steps: readonly CaseStep<Action>[];
  readonly requiredCriteria: readonly string[];
  /** Absence means applicable, not executed. Unsupported claims require an explicit reason. */
  readonly applicability?: CaseApplicability;
}

export interface CaseIdentities {
  readonly reference?: IdentityNormalization;
  readonly candidate?: IdentityNormalization;
}

/** Reports carry raw observations, never caller-selected criteria or precomputed verdicts. */
export interface CaseObservationReport {
  readonly id: string;
  readonly source?: string;
  readonly domain?: string;
  readonly profile?: string;
  readonly styleFamily?: string;
  readonly reference?: readonly SemanticCheckpoint[];
  readonly candidate?: readonly SemanticCheckpoint[];
  readonly identities?: CaseIdentities;
  readonly harnessError?: string;
  readonly authorityBlocker?: string;
}

function requireName(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be nonempty`);
}

function requireUniqueNames(value: readonly string[], label: string): void {
  if (!Array.isArray(value) || !value.length) throw new Error(`${label} must be nonempty`);
  for (const name of value) requireName(name, label);
  if (new Set(value).size !== value.length) throw new Error(`${label} must be unique`);
}

const inputSources: Readonly<Record<string, true>> = {
  'host-api': true,
  'synthetic-dispatch': true,
  'browser-automation': true,
};

function requireInputSources(value: unknown): void {
  if (!Array.isArray(value) || value.some((source) => typeof source !== 'string' || !Object.hasOwn(inputSources, source))) {
    throw new Error('Input provenance must contain only explicit host-api, synthetic-dispatch or browser-automation sources');
  }
}

function copyDefinition<Action extends { kind: string }>(definition: CaseDefinition<Action>): CaseDefinition<Action> {
  for (const field of ['id', 'source', 'domain', 'profile', 'styleFamily'] as const) {
    requireName(definition[field], `Case ${field}`);
  }
  if (definition.feature !== undefined) requireName(definition.feature, 'Case feature');
  requireUniqueNames(definition.requiredCriteria, 'Required criterion IDs');
  if (!Array.isArray(definition.steps) || !definition.steps.length) {
    throw new Error(`Case ${definition.id} must define ordered steps`);
  }
  requireUniqueNames(definition.steps.map((step) => step.id), 'Step IDs');
  const covered = new Set<string>();
  for (const step of definition.steps) {
    if (!step.action || typeof step.action !== 'object' || Array.isArray(step.action)) {
      throw new Error(`Step ${step.id} must define an action`);
    }
    requireName(step.action.kind, `Step ${step.id} action kind`);
    requireUniqueNames(step.criteria, `Step ${step.id} criterion IDs`);
    for (const criterion of step.criteria) covered.add(criterion);
    if (!step.expected || typeof step.expected !== 'object' || Array.isArray(step.expected) || !Object.keys(step.expected).length) {
      throw new Error(`Step ${step.id} must define structured data expectations`);
    }
    if (step.observation) {
      if (step.observation.phase !== undefined) requireName(step.observation.phase, 'Observation phase');
      if (step.observation.inputSources !== undefined) requireInputSources(step.observation.inputSources);
    }
  }
  if (covered.size !== definition.requiredCriteria.length || definition.requiredCriteria.some((criterion) => !covered.has(criterion))) {
    throw new Error(`Case ${definition.id} required criteria must exactly cover its step criteria`);
  }
  if (definition.applicability) {
    if (definition.applicability.status === 'UNSUPPORTED') {
      requireName(definition.applicability.reason, 'Unsupported applicability reason');
    } else if (definition.applicability.status !== 'SUPPORTED') {
      throw new Error(`Case ${definition.id} has invalid applicability`);
    }
  }
  // Use the authoritative data snapshot validation, including nested values and mutation isolation.
  // Optional undefined properties are omitted; undefined in actions/expectations remains invalid data.
  const data = {
    id: definition.id,
    source: definition.source,
    domain: definition.domain,
    profile: definition.profile,
    styleFamily: definition.styleFamily,
    ...(definition.feature === undefined ? {} : { feature: definition.feature }),
    steps: definition.steps.map((step) => ({
      id: step.id,
      action: step.action,
      expected: step.expected,
      criteria: step.criteria,
      ...(step.observation === undefined ? {} : { observation: step.observation }),
    })),
    requiredCriteria: definition.requiredCriteria,
    ...(definition.applicability === undefined ? {} : { applicability: definition.applicability }),
  };
  return snapshotTrace([{
    step: 'declaration', phase: 'declaration', ownerId: 'registry', parentId: null,
    viewEpoch: 0, kind: 'declaration', data: data as unknown as TraceValue,
  }])[0].data as unknown as CaseDefinition<Action>;
}

function oraclesFor<Action extends { kind: string }>(definition: CaseDefinition<Action>): ContractOracle[] {
  const stepIds = new Set(definition.steps.map((step) => step.id));
  return definition.requiredCriteria.map((criterion) => ({
    criterion,
    description: `Declared ${criterion} expectations for ${definition.id}`,
    test(trace) {
      const snapshots = trace.filter((entry) => entry.kind === 'snapshot' && stepIds.has(entry.step));
      // Matching errors on both paths are still contract failures, including ordering and extras.
      // Ancillary observations remain in the full trace comparison, as in the existing Button runners.
      if (snapshots.length !== definition.steps.length || snapshots.some((entry, index) => entry.step !== definition.steps[index].id)) {
        return false;
      }
      return definition.steps.every((step, index) => {
        if (!step.criteria.includes(criterion)) return true;
        const entry = snapshots[index];
        if (step.observation?.phase !== undefined && entry.phase !== step.observation.phase) return false;
        if (step.observation?.inputSources !== undefined && !isDeepStrictEqual(entry.inputSources, step.observation.inputSources)) return false;
        const data = entry.data;
        if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
        return Object.entries(step.expected).every(([key, value]) =>
          Object.hasOwn(data, key) && isDeepStrictEqual(data[key], value)
        );
      });
    },
  }));
}

export class CaseRegistry<Action extends { kind: string } = { kind: string }> {
  private readonly definitions = new Map<string, CaseDefinition<Action>>();

  constructor(definitions: readonly CaseDefinition<Action>[]) {
    if (!Array.isArray(definitions) || !definitions.length) throw new Error('Case definitions must be nonempty');
    for (const definition of definitions) {
      const copy = copyDefinition<Action>(definition);
      if (this.definitions.has(copy.id)) throw new Error(`Duplicate registered case ${copy.id}`);
      this.definitions.set(copy.id, copy);
    }
  }

  cases(): readonly CaseDefinition<Action>[] {
    return Object.freeze([...this.definitions.values()]);
  }

  get(id: string): CaseDefinition<Action> {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown registered case ${id}`);
    return definition;
  }

  evaluate(
    id: string,
    reference?: readonly SemanticCheckpoint[],
    candidate?: readonly SemanticCheckpoint[],
    identities?: CaseIdentities
  ): CaseResult {
    return this.evaluateReport({ id, reference, candidate, identities });
  }

  evaluateReport(report: CaseObservationReport): CaseResult {
    const definition = this.get(report.id);
    const base = { id: definition.id, requiredCriteria: definition.requiredCriteria };
    for (const field of ['source', 'domain', 'profile', 'styleFamily'] as const) {
      if (report[field] !== undefined && report[field] !== definition[field]) {
        return assessCase({ ...base, harnessError: `Case ${report.id} report ${field} does not match its registered definition` });
      }
    }
    if (report.harnessError || report.authorityBlocker || definition.applicability?.status === 'UNSUPPORTED') {
      return assessCase({
        ...base,
        harnessError: report.harnessError,
        authorityBlocker: report.authorityBlocker,
        unsupported: definition.applicability?.status === 'UNSUPPORTED' ? definition.applicability.reason : undefined,
      });
    }
    const oracles = oraclesFor(definition);
    try {
      for (const trace of [report.reference, report.candidate]) {
        if (trace) {
          for (const entry of trace) {
            if (entry.inputSources !== undefined) requireInputSources(entry.inputSources);
          }
        }
      }
      return assessCase({
        ...base,
        reference: report.reference === undefined ? undefined : runOracleSuite(report.reference, oracles),
        candidate: report.candidate === undefined ? undefined : runOracleSuite(report.candidate, oracles),
        identities: report.identities,
      });
    } catch (error) {
      return assessCase({ ...base, harnessError: String(error) });
    }
  }

  /** Every declaration gets a verdict. Absent observations remain UNTESTED, never PASS. */
  evaluateReports(reports: readonly CaseObservationReport[]): readonly CaseResult[] {
    const collected = new Map<string, CaseObservationReport>();
    for (const report of reports) {
      this.get(report.id);
      if (collected.has(report.id)) throw new Error(`Duplicate case report ${report.id}`);
      collected.set(report.id, report);
    }
    const results = this.cases().map((definition) => this.evaluateReport(collected.get(definition.id) ?? { id: definition.id }));
    requireCaseCollection([...this.definitions.keys()], results);
    return Object.freeze(results);
  }
}

/** Same observation-based signature as case-specific evaluators; the registry owns all criteria. */
export function evaluate<Action extends { kind: string }>(
  registry: CaseRegistry<Action>,
  id: string,
  reference?: readonly SemanticCheckpoint[],
  candidate?: readonly SemanticCheckpoint[],
  identities?: CaseIdentities
): CaseResult {
  return registry.evaluate(id, reference, candidate, identities);
}
