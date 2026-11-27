import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'min-w-0 grid gap-3 p-4 max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-combobox-root',
        props: {
          value: 'next.js',
          inputValue: 'Next.js',
          open: false,
          a11yLabel: 'Controlled framework picker',
        },
        ref: 'root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-input',
            props: {
              placeholder: 'Select a framework...',
              a11yLabel: 'Select a framework',
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-trigger',
            children: [
              { kind: 'proto', prototypeId: 'lucide-chevron-down-icon', props: { size: 14 } },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-combobox-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['Next.js'],
                props: { value: 'next.js', textValue: 'Next.js' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['SvelteKit'],
                props: { value: 'sveltekit', textValue: 'SvelteKit' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['Nuxt.js'],
                props: { value: 'nuxt.js', textValue: 'Nuxt.js' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-item',
                children: ['Astro'],
                props: { value: 'astro', textValue: 'Astro' },
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-combobox-empty',
                children: ['No frameworks found.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'pickAstro',
            props: { variant: 'outline', size: 'sm' },
            children: ['Set Astro'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'clearBtn',
            props: { variant: 'outline', size: 'sm' },
            children: ['Clear'],
          },
          {
            kind: 'box',
            ref: 'readout',
            className: 'text-xs text-muted-foreground',
            attrs: { 'aria-live': 'polite' },
            children: ['Value: next.js'],
          },
        ],
      },
    ],
  },
  setup({ refs, api }) {
    let state = { value: 'next.js', inputValue: 'Next.js', open: false };
    const sync = () => {
      api.setProps('root', {
        value: state.value,
        inputValue: state.inputValue,
        open: state.open,
        onValueChange: (detail: { value: string; textValue: string }) => {
          state = { ...state, value: detail.value, inputValue: detail.textValue };
          sync();
        },
        onInputValueChange: (detail: { value: string }) => {
          state = { ...state, inputValue: detail.value };
          sync();
        },
        onOpenChange: (detail: { open: boolean }) => {
          state = { ...state, open: detail.open };
          sync();
        },
      });
      refs.readout.textContent = `Value: ${state.value || 'none'}`;
    };
    const onPickAstro = () => {
      state = { value: 'astro', inputValue: 'Astro', open: false };
      sync();
    };
    const onClear = () => {
      state = { value: '', inputValue: '', open: false };
      sync();
    };
    refs.pickAstro.addEventListener('click', onPickAstro);
    refs.clearBtn.addEventListener('click', onClear);
    sync();
    return () => {
      refs.pickAstro.removeEventListener('click', onPickAstro);
      refs.clearBtn.removeEventListener('click', onClear);
    };
  },
} satisfies DemoSpec);
