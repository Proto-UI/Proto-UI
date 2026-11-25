import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';

const PLANS = [
  { value: 'plus', title: 'Plus', description: 'For individuals and small teams.' },
  { value: 'pro', title: 'Pro', description: 'For growing businesses.' },
  { value: 'enterprise', title: 'Enterprise', description: 'For large teams and enterprises.' },
] as const;

const ACTIVE_CARD_CLASSES = ['border-primary', 'bg-secondary'];
const IDLE_CARD_CLASSES = ['border-border', 'bg-background'];

// Concentric container (rounded-2xl + p-1) with inner rounded-xl cards.
// Items inside elevated cards opt out via material="opaque" to avoid glass-on-glass.
function planCard(value: string, title: string, description: string): DemoNode {
  const key = `lg-plan-${value}`;
  return {
    kind: 'box',
    ref: `${key}-card`,
    className:
      'flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-3.5 shadow-sm transition-colors',
    children: [
      {
        kind: 'box',
        className: 'grid flex-1 gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            props: { naming: true, activation: true },
            className: 'cursor-pointer text-sm font-medium leading-none',
            children: [title],
          },
          {
            kind: 'box',
            className: 'text-sm text-muted-foreground',
            children: [description],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value, material: 'opaque' },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'liquid-glass-radio-group-indicator' }],
      },
    ],
  };
}

export default {
  type: 'demo',
  setup({ host, refs, api }: DemoSetupContext) {
    let frame = 0;
    const syncCards = () => {
      const value = (
        api.getExposes('liquidGlassChoiceCardGroup')?.value as { get(): string } | undefined
      )?.get();
      for (const plan of PLANS) {
        const card = refs[`lg-plan-${plan.value}-card`];
        if (!card) continue;
        const selected = value === plan.value;
        card.classList.remove(...(selected ? IDLE_CARD_CLASSES : ACTIVE_CARD_CLASSES));
        card.classList.add(...(selected ? ACTIVE_CARD_CLASSES : IDLE_CARD_CLASSES));
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncCards);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    host.addEventListener('valueChange', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('valueChange', schedule);
    };
  },
  root: {
    kind: 'box',
    className: 'flex w-full justify-center',
    children: [
      {
        kind: 'box',
        className: 'w-full max-w-sm rounded-2xl p-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-radio-group-root',
            ref: 'liquidGlassChoiceCardGroup',
            className: 'w-full gap-2.5',
            props: { a11yLabel: 'Plan tier', defaultValue: 'plus' },
            children: PLANS.map((plan) => planCard(plan.value, plan.title, plan.description)),
          },
        ],
      },
    ],
  },
} as unknown as DemoSpec;
