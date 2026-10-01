import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createHostSessionModel,
  type DefaultActionRequest,
  type HostSessionModel,
  type InputSample,
  type LeaseId,
  type ProjectionTransaction,
} from '../src';

/**
 * The vectors under `vectors/` are the language-neutral conformance set for
 * the host state machine. This runner replays them against the TypeScript
 * model; the Rust crate replays the same files. A port that drifts from this
 * model fails on the side that drifted, not silently at integration time.
 */

type LeaseExpectation = { leaseId: string; active: boolean; released: boolean; commitId?: number };

type SnapshotExpectation = Partial<{
  phase: string;
  currentEpoch: number | null;
  currentCommit: number | null;
  activeEpoch: number | null;
  leases: LeaseExpectation[];
  diagnosticCodes: string[];
}>;

type Step =
  | {
      op: 'install';
      transaction: ProjectionTransaction;
      failAllocation?: LeaseId[];
      expect: { status: string; readySurfaces?: string[]; diagnosticCodes?: string[] };
    }
  | { op: 'activate'; viewEpoch: number; commitId: number; expect: { status: string } }
  | {
      op: 'release';
      leaseIds: LeaseId[];
      expect: { released: LeaseId[]; alreadyReleased: LeaseId[]; unknown: LeaseId[] };
    }
  | {
      op: 'deliver';
      sample: InputSample;
      expect: { status: string; leaseIds?: LeaseId[]; reason?: string };
    }
  | {
      op: 'defaultAction';
      request: DefaultActionRequest;
      withinWindow: boolean;
      expect: { status: string };
    }
  | { op: 'detach'; viewEpoch: number; expect: { status: string; releasedLeaseIds: LeaseId[] } }
  | { op: 'dispose'; expect: { status: string; releasedLeaseIds: LeaseId[] } }
  | { op: 'snapshot'; expect: SnapshotExpectation };

type Vector = { name: string; sessionId: string; steps: Step[] };

const VECTOR_DIR = path.resolve(__dirname, '../vectors');

function loadVectors(): { file: string; vector: Vector }[] {
  return readdirSync(VECTOR_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      vector: JSON.parse(readFileSync(path.join(VECTOR_DIR, file), 'utf8')) as Vector,
    }));
}

function applyStep(model: HostSessionModel, step: Step, label: string): void {
  switch (step.op) {
    case 'install': {
      const failing = new Set(step.failAllocation ?? []);
      const ack = model.installProjection(
        step.transaction,
        failing.size > 0
          ? { failAllocation: (registration) => failing.has(registration.leaseId) }
          : {}
      );
      expect(ack.status, label).toBe(step.expect.status);
      expect(ack.viewEpoch, label).toBe(step.transaction.viewEpoch);
      expect(ack.commitId, label).toBe(step.transaction.commitId);
      if (step.expect.readySurfaces) {
        expect([...ack.readySurfaces], label).toEqual(step.expect.readySurfaces);
      }
      if (step.expect.diagnosticCodes) {
        expect(
          ack.diagnostics.map((entry) => entry.code),
          label
        ).toEqual(step.expect.diagnosticCodes);
      }
      return;
    }
    case 'activate':
      expect(model.activate(step.viewEpoch, step.commitId), label).toEqual({
        status: step.expect.status,
      });
      return;
    case 'release': {
      const result = model.releaseLeases(step.leaseIds);
      expect(
        {
          released: [...result.released],
          alreadyReleased: [...result.alreadyReleased],
          unknown: [...result.unknown],
        },
        label
      ).toEqual(step.expect);
      return;
    }
    case 'deliver': {
      const result = model.deliver(step.sample);
      expect(result.status, label).toBe(step.expect.status);
      if (result.status === 'delivered') {
        expect([...result.leaseIds], label).toEqual(step.expect.leaseIds ?? []);
      } else {
        expect(result.reason, label).toBe(step.expect.reason);
      }
      return;
    }
    case 'defaultAction':
      expect(
        model.requestDefaultActionPrevention(step.request, { withinWindow: step.withinWindow }),
        label
      ).toEqual({ status: step.expect.status });
      return;
    case 'detach': {
      const result = model.detachView(step.viewEpoch);
      expect(
        { status: result.status, releasedLeaseIds: [...result.releasedLeaseIds] },
        label
      ).toEqual(step.expect);
      return;
    }
    case 'dispose': {
      const result = model.dispose();
      expect(
        { status: result.status, releasedLeaseIds: [...result.releasedLeaseIds] },
        label
      ).toEqual(step.expect);
      return;
    }
    case 'snapshot': {
      const snapshot = model.snapshot();
      const expected = step.expect;
      if (expected.phase !== undefined) expect(snapshot.phase, label).toBe(expected.phase);
      if (expected.currentEpoch !== undefined) {
        expect(snapshot.currentEpoch, label).toBe(expected.currentEpoch);
      }
      if (expected.currentCommit !== undefined) {
        expect(snapshot.currentCommit, label).toBe(expected.currentCommit);
      }
      if (expected.activeEpoch !== undefined) {
        expect(snapshot.activeEpoch, label).toBe(expected.activeEpoch);
      }
      if (expected.leases !== undefined) {
        expect(
          snapshot.leases.map((lease) => ({
            leaseId: lease.leaseId,
            active: lease.active,
            released: lease.released,
            ...(expected.leases?.[0]?.commitId === undefined ? {} : { commitId: lease.commitId }),
          })),
          label
        ).toEqual(expected.leases);
      }
      if (expected.diagnosticCodes !== undefined) {
        expect(
          snapshot.diagnostics.map((entry) => entry.code),
          label
        ).toEqual(expected.diagnosticCodes);
      }
      return;
    }
  }
}

describe('host session model: shared conformance vectors', () => {
  const vectors = loadVectors();

  it('finds the vector set', () => {
    expect(vectors.length).toBeGreaterThan(0);
    // The Rust crate reads the same directory; an accidental rename there
    // would otherwise silently reduce its coverage to nothing.
    expect(vectors.map((entry) => entry.file)).toContain('install-activate-deliver.json');
  });

  for (const { file, vector } of vectors) {
    it(`${file}: ${vector.name}`, () => {
      const model = createHostSessionModel(vector.sessionId);
      vector.steps.forEach((step, index) => {
        applyStep(model, step, `${file} step ${index} (${step.op})`);
      });
    });
  }
});
