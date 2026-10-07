// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  diffStyleProjection,
  evaluateStylePlan,
  type StyleContribution,
  type StylePlan,
  type StyleProjection,
  type StyleProjectionDiff,
  type StyleTargetEntry,
  type StyleTargetMapping,
} from './style-plan';

const mapping: StyleTargetMapping = {
  target: 'native-fixture',
  tokens: {
    'bg-red': [{ kind: 'property', name: 'fill', value: '#f00' }],
    'bg-blue': [{ kind: 'property', name: 'fill', value: '#00f' }],
    'bg-green': [{ kind: 'property', name: 'fill', value: '#0f0' }],
    'opacity-50': [{ kind: 'property', name: 'alpha', value: 0.5 }],
    'rounded-lg': [{ kind: 'property', name: 'cornerRadius', value: 12 }],
    // Distinct authored semantic groups can map onto the same native property.
    'native-accent': [{ kind: 'property', name: 'fill', value: 'accent' }],
    'native-multi': [
      { kind: 'property', name: 'fill', value: 'multi' },
      { kind: 'property', name: 'alpha', value: 0.8 },
    ],
  },
  properties: {
    ink: { name: 'foreground', values: [{ input: 'muted', output: '#888' }] },
  },
};
function contribution(
  id: string,
  tokens: string[],
  options: Partial<Omit<StyleContribution, 'id' | 'intents'>> = {}
): StyleContribution {
  return {
    id,
    scope: 'host',
    layer: 'base',
    ...options,
    intents: [{ kind: 'feedback.style.use', handles: [{ kind: 'tw', tokens }] }],
  };
}
function evaluate(contributions: readonly StyleContribution[]): StyleProjection {
  const result = evaluateStylePlan({ contributions }, mapping);
  if (!result.ok)
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join('\n'));
  return result.value;
}
function apply(
  current: readonly StyleTargetEntry[],
  diff: StyleProjectionDiff
): StyleTargetEntry[] {
  const entries = new Map(
    current.map((entry) => [JSON.stringify([entry.scope, entry.kind, entry.name]), entry])
  );
  for (const change of diff.changes) {
    if (change.kind === 'set') {
      const entry = change.entry;
      entries.set(JSON.stringify([entry.scope, entry.kind, entry.name]), entry);
    } else entries.delete(JSON.stringify([change.scope, change.channel, change.name]));
  }
  return [...entries.values()];
}

describe('portable style contribution precedence', () => {
  it('restores lower-priority values after rule withdrawal and respects declaration-order ties', () => {
    const base = contribution('base', ['bg-red'], { priority: 100 });
    const rule = contribution('rule', ['bg-blue'], { layer: 'rule' });
    const higherRule = contribution('higher', ['bg-green'], { layer: 'rule', priority: 1 });
    expect(evaluate([base, rule, higherRule]).entries).toMatchObject([
      { name: 'fill', value: '#0f0' },
    ]);
    expect(evaluate([base, rule, { ...higherRule, enabled: false }]).entries).toMatchObject([
      { name: 'fill', value: '#00f' },
    ]);
    expect(evaluate([base, { ...rule, enabled: false }]).entries).toMatchObject([
      { name: 'fill', value: '#f00' },
    ]);
    expect(
      evaluate([contribution('first', ['bg-blue']), contribution('last', ['bg-green'])]).entries
    ).toMatchObject([{ name: 'fill', value: '#0f0' }]);
  });

  it('suppresses a semantic group without deleting other styles and reverses suppression on withdrawal', () => {
    const base = contribution('base', ['bg-red', 'opacity-50']);
    const rule = contribution('rule', ['bg-blue'], { layer: 'rule' });
    const suppression: StyleContribution = {
      id: 'suppression',
      scope: 'host',
      layer: 'patch',
      intents: [
        { kind: 'feedback.style.suppress', handles: [{ kind: 'tw', tokens: ['bg-green'] }] },
      ],
    };
    expect(evaluate([base, rule, suppression]).entries).toMatchObject([
      { name: 'alpha', value: 0.5 },
    ]);
    expect(evaluate([base, rule, { ...suppression, enabled: false }]).entries).toMatchObject([
      { name: 'alpha', value: 0.5 },
      { name: 'fill', value: '#00f' },
    ]);
    const patch: StyleContribution = {
      ...suppression,
      intents: [{ kind: 'feedback.style.patch', handles: [{ kind: 'tw', tokens: ['bg-green'] }] }],
    };
    expect(
      evaluate([base, rule, patch]).entries.find((entry) => entry.name === 'fill')?.value
    ).toBe('#0f0');
  });

  it('handles mapped collisions by actual priority and keeps source scopes independent', () => {
    const projection = evaluate([
      contribution('early', ['bg-red']),
      contribution('middle', ['native-accent']),
      contribution('late', ['bg-green']),
      contribution('surface', ['bg-blue'], { scope: 'surface' }),
      contribution('boundary', ['bg-red'], { scope: 'boundary' }),
    ]);
    expect(projection.entries).toMatchObject([
      { scope: 'host', name: 'fill', value: '#0f0' },
      { scope: 'surface', name: 'fill', value: '#00f' },
      { scope: 'boundary', name: 'fill', value: '#f00' },
    ]);
    expect(
      evaluate([contribution('multi', ['native-multi']), contribution('alpha', ['opacity-50'])])
        .entries
    ).toMatchObject([
      { name: 'fill', value: 'multi' },
      { name: 'alpha', value: 0.5 },
    ]);
  });

  it('maps authored properties explicitly instead of treating CSS values as native values', () => {
    const plan: StylePlan = {
      contributions: [
        {
          id: 'ink',
          scope: 'surface',
          layer: 'base',
          intents: [
            {
              kind: 'feedback.style.use',
              handles: [{ kind: 'property', name: 'ink', value: 'muted' }],
            },
          ],
        },
      ],
    };
    expect(evaluateStylePlan(plan, mapping)).toMatchObject({
      ok: true,
      value: {
        entries: [{ scope: 'surface', kind: 'property', name: 'foreground', value: '#888' }],
      },
    });
    const unsupported = {
      ...plan.contributions[0],
      enabled: false,
      intents: [
        {
          kind: 'feedback.style.use' as const,
          handles: [{ kind: 'property' as const, name: 'ink', value: 'var(--consumer-ink)' }],
        },
      ],
    };
    expect(evaluateStylePlan({ contributions: [unsupported] }, mapping)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'unsupported-input', code: 'PUI4202' }],
    });
  });

  it('rejects unknown, selector-bearing and invalid native values before emitting even disabled contributions', () => {
    for (const token of ['unknown-native-value', 'hover:bg-red', 'bg-[color:red]']) {
      expect(
        evaluateStylePlan(
          { contributions: [contribution('inactive', [token], { enabled: false })] },
          mapping
        )
      ).toMatchObject({ ok: false, diagnostics: [{ category: 'unsupported-input' }] });
    }
    expect(
      evaluateStylePlan(
        { contributions: [contribution('bad', ['bg-red'])] },
        {
          target: 'native-fixture',
          tokens: { 'bg-red': [{ kind: 'property', name: 'alpha', value: NaN }] },
        }
      )
    ).toMatchObject({ ok: false, diagnostics: [{ category: 'unsupported-input' }] });
  });
});

describe('consumer-preserving style projection diff', () => {
  it('restores the base beneath a withdrawn rule while retaining the original app baseline', () => {
    const app: StyleTargetEntry[] = [
      { kind: 'property', scope: 'host', name: 'fill', value: 'app' },
    ];
    const base = contribution('base', ['bg-red']);
    const rule = contribution('rule', ['bg-blue'], { layer: 'rule' });
    const initial = diffStyleProjection(undefined, evaluate([base]), app);
    const baseHost = apply(app, initial);
    const activeRule = diffStyleProjection(initial.state, evaluate([base, rule]), baseHost);
    const ruleHost = apply(baseHost, activeRule);
    expect(ruleHost).toEqual([{ kind: 'property', scope: 'host', name: 'fill', value: '#00f' }]);
    const withdrawal = diffStyleProjection(activeRule.state, evaluate([base]), ruleHost);
    const restoredBase = apply(ruleHost, withdrawal);
    expect(restoredBase).toEqual(baseHost);
    const release = diffStyleProjection(
      withdrawal.state,
      { target: mapping.target, entries: [] },
      restoredBase
    );
    expect(apply(restoredBase, release)).toEqual(app);
  });

  it('overlays and withdraws compiler values without clearing app-owned properties or identical app tokens', () => {
    const webMapping: StyleTargetMapping = {
      ...mapping,
      tokens: {
        ...mapping.tokens,
        'rounded-lg': [{ kind: 'token', name: 'rounded-lg', value: true }],
      },
    };
    const result = evaluateStylePlan(
      { contributions: [contribution('base', ['bg-red', 'rounded-lg'])] },
      webMapping
    );
    if (!result.ok) throw new Error('Fixture mapping rejected');
    const app: StyleTargetEntry[] = [
      { kind: 'property', scope: 'host', name: 'fill', value: 'app-fill' },
      { kind: 'property', scope: 'host', name: 'padding', value: 17 },
      { kind: 'token', scope: 'host', name: 'rounded-lg', value: true },
      { kind: 'token', scope: 'host', name: 'app-theme', value: true },
    ];
    const overlay = diffStyleProjection(undefined, result.value, app);
    const overlaid = apply(app, overlay);
    expect(overlaid.find((entry) => entry.name === 'fill')?.value).toBe('#f00');
    const withdrawn = diffStyleProjection(
      overlay.state,
      { target: webMapping.target, entries: [] },
      overlaid
    );
    expect(apply(overlaid, withdrawn)).toEqual(app);
  });

  it('restores external values beneath a suppressed contributor rather than clearing its consumer property', () => {
    const app: StyleTargetEntry[] = [
      { kind: 'property', scope: 'host', name: 'fill', value: 'app' },
    ];
    const base = contribution('base', ['bg-red']);
    const suppression: StyleContribution = {
      id: 'mask',
      scope: 'host',
      layer: 'patch',
      intents: [{ kind: 'feedback.style.suppress', handles: [{ kind: 'tw', tokens: ['bg-red'] }] }],
    };
    const first = diffStyleProjection(undefined, evaluate([base]), app);
    const current = apply(app, first);
    const suppressed = diffStyleProjection(first.state, evaluate([base, suppression]), current);
    expect(apply(current, suppressed)).toEqual(app);
    const resumed = diffStyleProjection(suppressed.state, evaluate([base]), app);
    expect(apply(app, resumed)).toEqual([
      { kind: 'property', scope: 'host', name: 'fill', value: '#f00' },
    ]);
  });

  it('does not erase an external write on release, and captures changed app values before re-overlaying', () => {
    const projection = evaluate([contribution('base', ['bg-red'])]);
    const first = diffStyleProjection(undefined, projection, []);
    const externallyChanged: StyleTargetEntry[] = [
      { kind: 'property', scope: 'host', name: 'fill', value: 'new-app' },
    ];
    const empty = { target: mapping.target, entries: [] };
    expect(diffStyleProjection(first.state, empty, externallyChanged).changes).toEqual([]);
    const refreshed = diffStyleProjection(first.state, projection, externallyChanged);
    const overlaid = apply(externallyChanged, refreshed);
    const release = diffStyleProjection(refreshed.state, empty, overlaid);
    expect(apply(overlaid, release)).toEqual(externallyChanged);
    expect(diffStyleProjection(first.state, empty, []).changes).toEqual([]);
  });

  it('removes only newly acquired compiler properties when no app value was displaced', () => {
    const app: StyleTargetEntry[] = [
      { kind: 'property', scope: 'boundary', name: 'fill', value: 'boundary-app' },
    ];
    const initial = diffStyleProjection(
      undefined,
      evaluate([contribution('base', ['bg-red'])]),
      app
    );
    const current = apply(app, initial);
    const release = diffStyleProjection(
      initial.state,
      { target: mapping.target, entries: [] },
      current
    );
    expect(release.changes).toEqual([
      { kind: 'remove', scope: 'host', channel: 'property', name: 'fill' },
    ]);
    expect(apply(current, release)).toEqual(app);
  });
});
