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

const ACTIVE_CARD_CLASSES = ['bg-main', 'text-main-foreground'];
const IDLE_CARD_CLASSES = ['bg-secondary-background', 'text-foreground'];

function planCard(value: string, title: string, description: string): DemoNode {
  const key = `brutalist-plan-${value}`;
  return {
    kind: 'box',
    ref: `${key}-card`,
    className:
      'flex items-start justify-between gap-4 rounded-base border-2 border-black bg-secondary-background p-4 shadow-[4px_4px_0_0_#000]',
    children: [
      {
        kind: 'box',
        className: 'grid flex-1 gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            className: 'cursor-pointer font-heading text-sm font-bold leading-none',
            children: [title],
          },
          {
            kind: 'box',
            className: 'font-sans text-sm font-medium opacity-80',
            children: [description],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'brutalist-radio-group-indicator' }],
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
        api.getExposes('brutalistChoiceCardGroup')?.value as { get(): string } | undefined
      )?.get();
      for (const plan of PLANS) {
        const card = refs[`brutalist-plan-${plan.value}-card`];
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
    className: 'w-full max-w-sm p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-radio-group-root',
        ref: 'brutalistChoiceCardGroup',
        className: 'w-full gap-3',
        props: { a11yLabel: 'Plan tier', defaultValue: 'plus' },
        children: PLANS.map((plan) => planCard(plan.value, plan.title, plan.description)),
      },
    ],
  },
} as unknown as DemoSpec;
