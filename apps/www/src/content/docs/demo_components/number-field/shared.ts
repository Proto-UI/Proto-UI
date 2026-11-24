import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export type NumberFieldDemoFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function stepIcon(glyph: string, label: string): DemoChild[] {
  return [
    {
      kind: 'box',
      tag: 'span',
      attrs: { 'aria-hidden': 'true' },
      children: [glyph],
    },
    {
      kind: 'box',
      tag: 'span',
      className: 'sr-only',
      children: [label],
    },
  ];
}

function makeField(
  family: NumberFieldDemoFamily,
  labelText: string,
  props: Record<string, unknown>,
  ref?: string
): DemoProtoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-number-field-root`,
    props,
    ...(ref ? { ref } : {}),
    children: [
      {
        kind: 'proto',
        prototypeId: `${family}-number-field-label`,
        children: [labelText],
      },
      {
        kind: 'proto',
        prototypeId: `${family}-number-field-decrement`,
        children: stepIcon('−', `Decrease ${labelText}`),
      },
      {
        kind: 'proto',
        prototypeId: `${family}-number-field-input`,
      },
      {
        kind: 'proto',
        prototypeId: `${family}-number-field-increment`,
        children: stepIcon('+', `Increase ${labelText}`),
      },
    ],
  };
}

function wrapStage(
  family: NumberFieldDemoFamily,
  children: DemoChild[],
  attrs?: Record<string, string>
): DemoNode {
  const inner: DemoNode = {
    kind: 'box',
    className: 'mx-auto grid w-full max-w-xs min-w-0 gap-4',
    ...(attrs ? { attrs } : {}),
    children,
  };
  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className:
        'w-full rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
      children: [inner],
    };
  }
  return {
    kind: 'box',
    className: 'w-full p-4',
    children: [inner],
  };
}

export function createNumberFieldHeroDemo(family: NumberFieldDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      makeField(
        family,
        'Quantity',
        {
          defaultValue: 12,
          min: 0,
          max: 100,
          step: 1,
          ariaLabel: 'Quantity',
        },
        'control'
      ),
    ]),
  };
}

export function createNumberFieldFormattingDemo(family: NumberFieldDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      makeField(family, 'Budget (USD)', {
        defaultValue: 1250,
        min: 0,
        max: 100000,
        step: 25,
        locale: 'en-US',
        formatOptions: { style: 'currency', currency: 'USD' },
        ariaLabel: 'Budget (USD)',
      }),
      makeField(family, 'Discount rate', {
        defaultValue: 0.25,
        min: 0,
        max: 1,
        step: 0.05,
        locale: 'en-US',
        formatOptions: { style: 'percent' },
        ariaLabel: 'Discount rate',
      }),
    ]),
  };
}

export function createNumberFieldScrubNullableDemo(family: NumberFieldDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      makeField(family, 'Opacity (drag label)', {
        defaultValue: 60,
        min: 0,
        max: 100,
        step: 1,
        scrub: true,
        scrubSteps: 50,
        ariaLabel: 'Opacity',
      }),
      makeField(family, 'Optional seat limit', {
        defaultValue: null,
        min: 1,
        max: 500,
        step: 1,
        allowEmpty: true,
        ariaLabel: 'Optional seat limit',
      }),
    ]),
  };
}

export function createNumberFieldStatesDemo(family: NumberFieldDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      makeField(family, 'Disabled', {
        defaultValue: 42,
        min: 0,
        max: 100,
        disabled: true,
        ariaLabel: 'Disabled quantity',
      }),
      makeField(family, 'Read-only', {
        defaultValue: 24,
        min: 0,
        max: 100,
        readOnly: true,
        ariaLabel: 'Read-only quantity',
      }),
      makeField(family, 'Unbounded offset', {
        defaultValue: 3.14,
        min: null,
        max: null,
        step: 0.5,
        snapToStep: false,
        ariaLabel: 'Unbounded offset',
      }),
    ]),
  };
}

function extractValuePayload(payload: unknown): number | null | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if ('value' in record && (typeof record.value === 'number' || record.value === null)) {
    return record.value;
  }
  if (record.detail && typeof record.detail === 'object') {
    const detail = record.detail as Record<string, unknown>;
    if ('value' in detail && (typeof detail.value === 'number' || detail.value === null)) {
      return detail.value;
    }
  }
  return undefined;
}

export function createNumberFieldControlledDemo(family: NumberFieldDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(family, [
      makeField(
        family,
        'Controlled volume',
        {
          value: 25,
          min: 0,
          max: 100,
          step: 5,
          allowEmpty: true,
          ariaLabel: 'Controlled volume',
        },
        'controlled-root'
      ),
      {
        kind: 'box',
        ref: 'status',
        className: 'text-xs text-muted-foreground tabular-nums',
        attrs: { role: 'status', 'aria-live': 'polite' },
        children: ['Accepted value: 25 · Commits: 0'],
      },
    ]),
    setup({ refs, api }) {
      let current: number | null = 25;
      let commits = 0;
      const status = refs['status'];
      const syncStatus = () => {
        if (status) {
          status.textContent = `Accepted value: ${current === null ? 'empty' : current} · Commits: ${commits}`;
        }
      };
      syncStatus();
      api.setProps('controlled-root', {
        onValueChange: (payload: unknown) => {
          const next = extractValuePayload(payload);
          if (next === undefined) return;
          current = next;
          api.setProps('controlled-root', { value: current });
          syncStatus();
        },
        onValueCommit: (payload: unknown) => {
          const next = extractValuePayload(payload);
          if (next !== undefined) current = next;
          commits += 1;
          syncStatus();
        },
      });
      return () => {
        api.setProps('controlled-root', {
          onValueChange: null,
          onValueCommit: null,
        });
      };
    },
  };
}

export function createNumberFieldRtlDemo(family: NumberFieldDemoFamily): DemoSpec {
  return {
    type: 'demo',
    root: wrapStage(
      family,
      [
        makeField(family, 'الكمية (اسحب التسمية)', {
          defaultValue: 40,
          min: 0,
          max: 100,
          step: 5,
          direction: 'rtl',
          scrub: true,
          scrubSteps: 20,
          ariaLabel: 'الكمية',
        }),
      ],
      { dir: 'rtl' }
    ),
  };
}
