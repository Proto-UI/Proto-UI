// Evidence bookkeeping only. This module cannot own input or material state.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RuntimeId } from '../../src/content/docs/zh-cn/browser-harness';
import {
  LIQUID_HOVER_NEGATIVES,
  LIQUID_HOVER_PARTS,
} from '../../src/content/docs/zh-cn/liquid-hover-fixture';

export const LIQUID_HOVER_THEMES = ['light', 'dark'] as const;
export const LIQUID_HOVER_JOURNEYS = ['interaction', 'policy-and-boundaries'] as const;
export type LiquidHoverJourney = (typeof LIQUID_HOVER_JOURNEYS)[number];
export type EvidenceState = 'not-run' | 'running' | 'failed' | 'completed';
export type HoverSource = {
  sourceSha: string;
  sourceTree: string;
  patchSha256: string;
  candidateSha?: string;
  runId?: string;
  runAttempt?: string;
  job?: string;
};

type Progress = { state: EvidenceState; failure?: string; updatedAt?: string };
const pending = (): Progress => ({ state: 'not-run' });
const INTERACTION_STAGES = [
  'idle',
  'hover',
  'down',
  'release',
  'leave',
  'focus-visible',
  'focus-plus-hover',
  'forced-colors-focus',
  'focus-restored',
  'held',
  'held-leave',
  'held-reenter',
  'held-release-outside',
  'native-element-blur-before',
  'native-element-blur',
  'window-blur-after-element-transfer',
  ...['pointercancel', 'lostpointercapture', 'window-blur'].flatMap((name) => [
    `${name}-before`,
    `${name}-injected-host-route`,
  ]),
  'secondary-before',
  'secondary-down',
  'secondary-up',
  'nonprimary-injected-host-route',
  'nonprimary-canceled',
  'native-touch-down',
  'native-touch-cancel',
] as const;

/** Mirrors the existing stage semantics; no stage drives the fixture itself. */
export function liquidHoverStages(journey: LiquidHoverJourney, part: string): string[] {
  if (journey === 'interaction') {
    if (!LIQUID_HOVER_PARTS.some((owner) => owner === part))
      throw new Error(`Unknown owner: ${part}`);
    return [...INTERACTION_STAGES];
  }
  if (part === 'accordion-blocked')
    return [
      'collapse-blocked',
      'collapse-blocked-hover',
      'collapse-blocked-down',
      'collapse-blocked-click',
      'collapse-blocked-focus',
      'collapse-blocked-focus-hover',
      'collapse-blocked-blur',
    ];
  if ([...LIQUID_HOVER_NEGATIVES, 'accordion-tight'].includes(part))
    return ['negative-idle', 'negative-hover', 'negative-press', 'negative-release'];
  if (!LIQUID_HOVER_PARTS.some((owner) => owner === part))
    throw new Error(`Unknown owner: ${part}`);
  const directRef = part === 'accordion' ? 'item' : 'subject';
  const refs = part === 'button' || part === 'toggle' ? [directRef] : [directRef, 'owner'];
  return [
    'policy-idle',
    'source-lost',
    'source-lost-hover',
    'source-restored',
    ...refs.flatMap((ref) => [`disable-${ref}-held`, `disabled-${ref}`, `reenabled-${ref}`]),
    ...(['button', 'toggle', 'submit', 'reset'].includes(part)
      ? ['explicit-opaque', 'material-prop-removed']
      : []),
    ...(part === 'toggle'
      ? [true, false].flatMap((active) => [
          `selection-${active}`,
          `selection-${active}-hover`,
          `selection-${active}-disabled`,
        ])
      : []),
    'reduced-motion',
    'reduced-transparency',
  ];
}

export function selectLiquidHoverRuntimes(
  all: readonly RuntimeId[],
  selected: string | undefined
): readonly RuntimeId[] {
  if (selected === undefined) return [...all];
  if (!all.some((runtime) => runtime === selected))
    throw new Error(`Invalid PROTO_UI_HOVER_RUNTIME: ${JSON.stringify(selected)}`);
  return [selected as RuntimeId];
}

export const liquidHoverCaseId = (runtime: string, theme: string, journey: LiquidHoverJourney) =>
  `${runtime}/${theme}/${journey}`;

export function planLiquidHoverEvidence(
  runtimes: readonly RuntimeId[],
  source: HoverSource,
  route: string
) {
  return {
    schemaVersion: 1,
    source,
    route,
    runtimes: [...runtimes],
    createdAt: new Date().toISOString(),
    scope:
      'Planned native captures, not acceptance. Completed captures mean the capture returned; part completion requires every planned capture and the existing assertions plus cleanup. Case completion requires the test body, final assertion and teardown to return. Vitest terminal outcome remains authoritative. Running/not-run work is incomplete after cancellation.',
    cases: runtimes.flatMap((runtime) =>
      LIQUID_HOVER_THEMES.flatMap((theme) =>
        LIQUID_HOVER_JOURNEYS.map((journey) => ({
          id: liquidHoverCaseId(runtime, theme, journey),
          runtime,
          theme,
          journey,
          parts: (journey === 'interaction'
            ? [...LIQUID_HOVER_PARTS]
            : [
                ...LIQUID_HOVER_PARTS,
                'accordion-blocked',
                ...LIQUID_HOVER_NEGATIVES,
                'accordion-tight',
              ]
          ).map((part) => ({
            part,
            captures: liquidHoverStages(journey, part).map((stage) => {
              const name = `${runtime}-${theme}-${part}-${stage}`;
              return {
                stage,
                name,
                record: `${name}.json`,
                root: `${name}.png`,
                context: `${name}-context.png`,
                materialIfPresent: `${name}-material.png`,
              };
            }),
          })),
        }))
      )
    ),
  };
}
export type LiquidHoverPlan = ReturnType<typeof planLiquidHoverEvidence>;

/** Same-directory rename leaves either the prior complete JSON or the new one. */
export async function writeLiquidHoverJsonAtomic(file: string, value: unknown) {
  const serialized = JSON.stringify(value, null, 2);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, serialized);
  await rename(temporary, file);
}

export class LiquidHoverCheckpoint {
  readonly progress;
  private pendingWrite = Promise.resolve();

  constructor(
    readonly plan: LiquidHoverPlan,
    private readonly output: string
  ) {
    this.progress = {
      schemaVersion: 1,
      source: plan.source,
      planSha256: createHash('sha256')
        .update(JSON.stringify(plan, null, 2))
        .digest('hex'),
      setup: pending(),
      cases: plan.cases.map((entry) => ({
        id: entry.id,
        ...pending(),
        parts: entry.parts.map(({ part, captures }) => ({
          part,
          ...pending(),
          cleanupErrors: [] as string[],
          captures: captures.map(({ name, stage }) => ({ name, stage, ...pending() })),
        })),
      })),
    };
  }

  async initialize() {
    await writeLiquidHoverJsonAtomic(path.join(this.output, 'plan.json'), this.plan);
    await this.persist();
  }
  private persist() {
    // Serialize at the transition, then queue replacements so snapshots cannot race.
    const snapshot = structuredClone(this.progress);
    this.pendingWrite = this.pendingWrite.then(() =>
      writeLiquidHoverJsonAtomic(path.join(this.output, 'progress.json'), snapshot)
    );
    return this.pendingWrite;
  }
  private update(target: Progress, state: EvidenceState, failure?: string) {
    if (target.state === 'completed' || target.state === 'failed')
      throw new Error(`Cannot change terminal evidence state: ${target.state}`);
    if (state === 'running' && target.state !== 'not-run')
      throw new Error(`Evidence already started: ${target.state}`);
    if (state !== 'running' && target.state !== 'running')
      throw new Error(`Evidence must start before ${state}`);
    target.state = state;
    target.updatedAt = new Date().toISOString();
    if (failure) target.failure = failure;
  }
  private case(id: string) {
    const entry = this.progress.cases.find((entry) => entry.id === id);
    if (!entry) throw new Error(`Unplanned hover case: ${id}`);
    return entry;
  }
  private part(id: string, part: string) {
    const entry = this.case(id);
    if (entry.state !== 'running') throw new Error(`Hover case is not running: ${id}`);
    const result = entry.parts.find((entry) => entry.part === part);
    if (!result) throw new Error(`Unplanned hover part: ${id}/${part}`);
    return result;
  }
  async setup<T>(task: () => Promise<T>): Promise<T> {
    this.update(this.progress.setup, 'running');
    await this.persist();
    try {
      const result = await task();
      this.update(this.progress.setup, 'completed');
      await this.persist();
      return result;
    } catch (error) {
      this.update(this.progress.setup, 'failed', String(error));
      await this.persist();
      throw error;
    }
  }
  async runCase(id: string, task: () => Promise<void>, runnerFailed: () => boolean = () => false) {
    const entry = this.case(id);
    this.update(entry, 'running');
    await this.persist();
    try {
      await task();
      if (runnerFailed()) throw new Error(`Vitest already reported failure or timeout for ${id}`);
      if (entry.parts.some((part) => part.state !== 'completed'))
        throw new Error(`Incomplete or failed parts in ${id}`);
      this.update(entry, 'completed');
      await this.persist();
    } catch (error) {
      this.update(entry, 'failed', String(error));
      await this.persist();
      throw error;
    }
  }
  async beginPart(id: string, part: string) {
    this.update(this.part(id, part), 'running');
    await this.persist();
  }
  async capture<T>(id: string, part: string, stage: string, task: () => Promise<T>): Promise<T> {
    const owner = this.part(id, part);
    if (owner.state !== 'running') throw new Error(`Hover part is not running: ${part}`);
    const entry = owner.captures.find((capture) => capture.stage === stage);
    if (!entry) throw new Error(`Unplanned hover capture: ${id}/${part}/${stage}`);
    this.update(entry, 'running');
    await this.persist();
    try {
      const result = await task();
      this.update(entry, 'completed');
      await this.persist();
      return result;
    } catch (error) {
      this.update(entry, 'failed', String(error));
      await this.persist();
      throw error;
    }
  }
  async finishPart(id: string, part: string, failure: string | null, cleanupErrors: string[]) {
    const entry = this.part(id, part);
    const incomplete = entry.captures.filter((capture) => capture.state !== 'completed');
    const reason = [
      failure,
      ...cleanupErrors,
      incomplete.length &&
        `Incomplete captures: ${incomplete.map((capture) => capture.stage).join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');
    entry.cleanupErrors = [...cleanupErrors];
    this.update(entry, reason ? 'failed' : 'completed', reason || undefined);
    await this.persist();
    return reason || null;
  }
}
