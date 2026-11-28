import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Serialized as one page init script; every runtime dependency is local here. */
export function installMatrixAnatomyNotificationDiagnostic(options: { enabled: boolean }) {
  const key = '__puiMatrixAnatomyNotificationDiagnostic';
  if (options.enabled !== true) return () => {};
  let clock: () => number;
  let origin: number;
  let timeOrigin: number;
  let info: (line: string) => void;
  try {
    if (Object.getOwnPropertyDescriptor(globalThis, key)) return () => {};
    clock = performance.now.bind(performance);
    origin = clock();
    if (!Number.isFinite(origin)) return () => {};
    timeOrigin = performance.timeOrigin;
    info = console.info.bind(console);
  } catch {
    return () => {};
  }
  const descriptor = Object.getOwnPropertyDescriptor;
  const windowMs = 180_000;
  const maxEvents = 32;
  const maxFamilies = 128;
  const maxLeaders = 8;
  type Totals = {
    notifications: number;
    aborted: number;
    indexedSubscribers: number;
    maxIndexedSubscribers: number;
    visitedSubscribers: number;
    maxVisitedSubscribers: number;
    inclusiveMs: number;
    maxNotificationMs: number;
    maxDepth: number;
  };
  type Family = Totals & { key: string; name: string };
  type Ticket = { family?: Family; started: number; indexed: number; depth: number };
  const empty = (): Totals => ({
    notifications: 0,
    aborted: 0,
    indexedSubscribers: 0,
    maxIndexedSubscribers: 0,
    visitedSubscribers: 0,
    maxVisitedSubscribers: 0,
    inclusiveMs: 0,
    maxNotificationMs: 0,
    maxDepth: 0,
  });
  const families = new Map<object, Family>();
  const leaders: Family[] = [];
  const pending = new WeakSet<object>();
  const totals = empty();
  let active = true;
  let depth = 0;
  let emitted = 0;
  let lastBucket = -1;
  let lastEmissionMs = 0;
  let overflowNotifications = 0;
  let observationErrors = 0;
  let slowest: Record<string, unknown> | null = null;

  const elapsed = () => {
    const value = clock() - origin;
    if (!Number.isFinite(value) || value < 0 || value >= windowMs) {
      active = false;
      return null;
    }
    return value;
  };
  const increment = (row: Totals, ticket: Ticket, visited: number, cost: number, ok: boolean) => {
    row.notifications++;
    if (!ok) row.aborted++;
    row.indexedSubscribers += ticket.indexed;
    row.maxIndexedSubscribers = Math.max(row.maxIndexedSubscribers, ticket.indexed);
    row.visitedSubscribers += visited;
    row.maxVisitedSubscribers = Math.max(row.maxVisitedSubscribers, visited);
    row.inclusiveMs += cost;
    row.maxNotificationMs = Math.max(row.maxNotificationMs, cost);
    row.maxDepth = Math.max(row.maxDepth, ticket.depth);
  };
  const hook = Object.freeze({
    enabled: true,
    begin(family: object, indexed: number): Ticket | undefined {
      if (!active || emitted >= maxEvents) return;
      try {
        const started = elapsed();
        if (started === null || !Number.isSafeInteger(indexed) || indexed < 0) return;
        let row = families.get(family);
        if (!row && families.size < maxFamilies) {
          // Existing immutable family data only: never invoke a user getter.
          const name = descriptor(family, 'debugName')?.value;
          row = {
            ...empty(),
            key: `family-${families.size + 1}`,
            name:
              typeof name === 'string' && /^[A-Za-z0-9_.:/-]+$/.test(name)
                ? name.slice(0, 96)
                : '[non-data-or-noncanonical-name]',
          };
          families.set(family, row);
        }
        const ticket = { family: row, started, indexed, depth: ++depth };
        pending.add(ticket);
        return ticket;
      } catch {
        observationErrors++;
        return;
      }
    },
    finish(ticket: Ticket, visited: number, completed: boolean) {
      if (!pending.delete(ticket)) return;
      depth = Math.max(0, depth - 1);
      if (!active) return;
      try {
        const after = elapsed();
        if (after === null || !Number.isSafeInteger(visited) || visited < 0) return;
        const cost = after - ticket.started;
        if (cost < 0) return;
        increment(totals, ticket, visited, cost, completed);
        const row = ticket.family;
        if (row) {
          increment(row, ticket, visited, cost, completed);
          // Inspect at most eight existing leaders, never all families or subscribers.
          if (!leaders.includes(row)) {
            if (leaders.length < maxLeaders) leaders.push(row);
            else {
              let smallest = 0;
              for (let index = 1; index < leaders.length; index++)
                if (leaders[index]!.inclusiveMs < leaders[smallest]!.inclusiveMs) smallest = index;
              if (row.inclusiveMs > leaders[smallest]!.inclusiveMs) leaders[smallest] = row;
            }
          }
        } else overflowNotifications++;
        if (!slowest || cost > (slowest.durationMs as number)) {
          slowest = {
            familyKey: row?.key ?? null,
            familyName: row?.name ?? '[family-cap-overflow]',
            startedMs: ticket.started,
            completedMs: after,
            durationMs: cost,
            indexedSubscribers: ticket.indexed,
            visitedSubscribers: visited,
            depth: ticket.depth,
            completed,
          };
        }
        const bucket =
          after < 10_000 ? Math.floor(after / 2000) : 5 + Math.floor((after - 10_000) / 10_000);
        if (bucket === lastBucket || emitted >= maxEvents) return;
        const previousBucket = lastBucket;
        const previousEmissionMs = lastEmissionMs;
        lastBucket = bucket;
        lastEmissionMs = after;
        emitted++;
        info(
          '[matrix-anatomy-notification] ' +
            JSON.stringify({
              kind: 'anatomy-notification',
              schemaVersion: 1,
              diagnosticOnly: true,
              sequence: emitted,
              elapsedMs: after,
              bucket,
              previousBucket,
              previousEmissionMs,
              clock: { timeOrigin, installedAtPerformanceMs: origin },
              totals,
              currentFamily: row ?? null,
              leaders,
              slowest,
              trackedFamilies: families.size,
              overflowNotifications,
              observationErrors,
              limits: {
                windowMs,
                maxEvents,
                maxFamilies,
                maxLeaders,
                earlyBucketMs: 2000,
                lateBucketMs: 10_000,
              },
              meaning:
                'Completed notifications only; nested durations are inclusive. Leaders are unsorted bounded cumulative-cost records, not a complete family table. No timer, host query or subscriber enumeration. Long unfinished notifications and completions after the owner window are invisible.',
            })
        );
      } catch {
        observationErrors++;
      }
    },
  });
  try {
    Object.defineProperty(globalThis, key, { configurable: true, value: hook });
  } catch {
    active = false;
    return () => {};
  }
  return () => {
    active = false;
    try {
      if (descriptor(globalThis, key)?.value === hook) Reflect.deleteProperty(globalThis, key);
    } catch {
      /* Disposal cannot replace a caller's failure. */
    }
  };
}

/** Console delivery is immediately persisted in Node; no renderer RPC or queue. */
export function createMatrixAnatomyConsoleJournal(options: {
  directory: string;
  sourceSha: string;
  caseName: string;
  phase(): string;
}) {
  const prefix = '[matrix-anatomy-notification] ';
  const filename = `${options.caseName.replace(/[^A-Za-z0-9-]+/g, '-').slice(0, 150)}.ndjson`;
  const directory = join(options.directory, 'demo-matrix', 'anatomy-notifications');
  const path = join(directory, filename);
  let persisted = true;
  let warned = false;
  let received = 0;
  const warn = () => {
    if (warned) return;
    warned = true;
    try {
      console.error(
        '[matrix-anatomy-journal-unavailable] bounded console output remains in browser.log'
      );
    } catch {
      /* Diagnostic errors must not become the test failure. */
    }
  };
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, '', { flag: 'wx' });
  } catch {
    persisted = false;
    warn();
  }
  return (text: string) => {
    if (received >= 32 || !text.startsWith(prefix) || Buffer.byteLength(text) > 16_384) return;
    try {
      const record = JSON.parse(text.slice(prefix.length));
      if (record?.kind !== 'anatomy-notification' || record?.diagnosticOnly !== true) return;
      received++;
      const line = JSON.stringify({
        sourceSha: options.sourceSha,
        caseName: options.caseName,
        phase: options.phase(),
        hostAt: new Date().toISOString(),
        record,
      });
      if (persisted) {
        try {
          appendFileSync(path, `${line}\n`);
        } catch {
          persisted = false;
          warn();
        }
      }
      try {
        console.log(prefix + line);
      } catch {
        warn();
      }
    } catch {
      warn();
    }
  };
}
