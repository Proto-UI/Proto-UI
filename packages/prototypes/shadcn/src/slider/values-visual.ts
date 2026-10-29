import { tw, type DefHandle, type StyleHandle } from '@proto.ui/core';
import type { SliderValuesPartProps } from '@proto.ui/prototypes-base/slider';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  type ShadcnStyleId,
  type ShadcnStyleProps,
} from '../style-scope';

export type ShadcnSliderValuesPartProps = SliderValuesPartProps & ShadcnStyleProps;

// cn-slider* recipes at shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7,
// apps/v4/registry/styles/style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css.
// New York is independently sourced from registry/new-york-v4/ui/slider.tsx.
// The compatibility baseline remains the existing scalar Slider's base-Nova paint.
export function setupSliderValuesStyle(def: DefHandle<ShadcnStyleProps>) {
  return setupShadcnStyleSelection(def, 'nova', { supportedStyles: SHADCN_STYLE_IDS });
}

// The rail is separate paint inside the structural Track, as in the scalar
// projection. It never clips or becomes a second owner for the indexed Thumbs.
export const VALUES_RAIL: Record<
  ShadcnStyleId,
  { horizontal: StyleHandle; vertical: StyleHandle }
> = {
  vega: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-muted'
    ),
  },
  nova: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-muted'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-muted'
    ),
  },
  maia: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-3 w-full -translate-y-1/2 rounded-[var(--pui-radius-4xl)] bg-muted'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 rounded-[var(--pui-radius-4xl)] bg-muted'
    ),
  },
  lyra: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-none bg-muted'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-none bg-muted'
    ),
  },
  mira: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-md bg-muted'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-md bg-muted'
    ),
  },
  luma: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-input/90'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-2 -translate-x-1/2 rounded-full bg-input/90'
    ),
  },
  sera: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-input/50'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-input/50'
    ),
  },
  rhea: {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-[var(--pui-radius-2xl)] bg-input/90'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-[var(--pui-radius-2xl)] bg-input/90'
    ),
  },
  'new-york-v4': {
    horizontal: tw(
      'pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted'
    ),
    vertical: tw(
      'pointer-events-none absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-muted'
    ),
  },
};

export const VALUES_RANGE: Record<
  ShadcnStyleId,
  { horizontal: StyleHandle; vertical: StyleHandle }
> = {
  vega: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-1.5 rounded-full'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-1.5 rounded-full'),
  },
  nova: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-1 rounded-full'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-1 rounded-full'),
  },
  maia: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-3 rounded-[var(--pui-radius-4xl)]'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-3 rounded-[var(--pui-radius-4xl)]'),
  },
  lyra: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-1 rounded-none'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-1 rounded-none'),
  },
  mira: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-1 rounded-md'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-1 rounded-md'),
  },
  luma: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-2 rounded-full'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-2 rounded-full'),
  },
  sera: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-0.5 rounded-none'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-0.5 rounded-none'),
  },
  rhea: {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-1 rounded-[var(--pui-radius-2xl)]'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-1 rounded-[var(--pui-radius-2xl)]'),
  },
  'new-york-v4': {
    horizontal: tw('w-[calc(var(--pui-extent)*1%)] h-1.5 rounded-full'),
    vertical: tw('h-[calc(var(--pui-extent)*1%)] w-1.5 rounded-full'),
  },
};

// Nova/Lyra/Mira's after:-inset-2 is represented by the same real Thumb's
// transparent hit box, not a second target or a pseudo-element input owner.
export const VALUES_THUMB_HIT: Record<ShadcnStyleId, StyleHandle> = {
  vega: tw('size-4'),
  nova: tw('size-7'),
  maia: tw('size-4'),
  lyra: tw('size-7'),
  mira: tw('size-7'),
  luma: tw('h-4 w-6'),
  sera: tw('size-3'),
  rhea: tw('size-4'),
  'new-york-v4': tw('size-4'),
};

export const VALUES_THUMB_PAINT: Record<
  ShadcnStyleId,
  { rest: StyleHandle; hover: StyleHandle; focus: StyleHandle }
> = {
  vega: {
    rest: tw(
      'pointer-events-none block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] select-none'
    ),
    hover: tw(
      'pointer-events-none block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 ring-4 transition-[color,box-shadow] select-none'
    ),
    focus: tw(
      'pointer-events-none block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 ring-4 forced-colors-focus-outline transition-[color,box-shadow] select-none'
    ),
  },
  nova: {
    rest: tw(
      'pointer-events-none block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none'
    ),
    hover: tw(
      'pointer-events-none block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 ring-3 transition-[color,box-shadow] select-none'
    ),
    focus: tw(
      'pointer-events-none block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 ring-3 forced-colors-focus-outline transition-[color,box-shadow] select-none'
    ),
  },
  maia: {
    rest: tw(
      'pointer-events-none block size-4 shrink-0 rounded-[var(--pui-radius-4xl)] border border-primary bg-white shadow-sm ring-ring/50 transition-colors select-none'
    ),
    hover: tw(
      'pointer-events-none block size-4 shrink-0 rounded-[var(--pui-radius-4xl)] border border-primary bg-white shadow-sm ring-ring/50 ring-4 transition-colors select-none'
    ),
    focus: tw(
      'pointer-events-none block size-4 shrink-0 rounded-[var(--pui-radius-4xl)] border border-primary bg-white shadow-sm ring-ring/50 ring-4 forced-colors-focus-outline transition-colors select-none'
    ),
  },
  lyra: {
    rest: tw(
      'pointer-events-none block size-3 shrink-0 rounded-none border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none'
    ),
    hover: tw(
      'pointer-events-none block size-3 shrink-0 rounded-none border border-ring bg-white ring-ring/50 ring-1 transition-[color,box-shadow] select-none'
    ),
    focus: tw(
      'pointer-events-none block size-3 shrink-0 rounded-none border border-ring bg-white ring-ring/50 ring-1 forced-colors-focus-outline transition-[color,box-shadow] select-none'
    ),
  },
  mira: {
    rest: tw(
      'pointer-events-none block size-3 shrink-0 rounded-md border border-ring bg-white ring-ring/30 transition-[color,box-shadow] select-none'
    ),
    hover: tw(
      'pointer-events-none block size-3 shrink-0 rounded-md border border-ring bg-white ring-ring/30 ring-2 transition-[color,box-shadow] select-none'
    ),
    focus: tw(
      'pointer-events-none block size-3 shrink-0 rounded-md border border-ring bg-white ring-ring/30 ring-2 forced-colors-focus-outline transition-[color,box-shadow] select-none'
    ),
  },
  luma: {
    rest: tw(
      'pointer-events-none block h-4 w-6 shrink-0 rounded-full bg-white shadow-md ring-black/10 ring-1 transition-[color,box-shadow,background-color] select-none'
    ),
    hover: tw(
      'pointer-events-none block h-4 w-6 shrink-0 rounded-full bg-white shadow-md ring-ring/30 ring-4 transition-[color,box-shadow,background-color] select-none'
    ),
    focus: tw(
      'pointer-events-none block h-4 w-6 shrink-0 rounded-full bg-white shadow-md ring-ring/30 ring-4 forced-colors-focus-outline transition-[color,box-shadow,background-color] select-none'
    ),
  },
  sera: {
    rest: tw(
      'pointer-events-none block size-3 shrink-0 border-0 bg-primary transition-colors select-none'
    ),
    hover: tw(
      'pointer-events-none block size-3 shrink-0 border-0 bg-primary ring-ring/30 ring-2 transition-colors select-none'
    ),
    focus: tw(
      'pointer-events-none block size-3 shrink-0 border-0 bg-primary ring-ring/30 ring-2 forced-colors-focus-outline transition-colors select-none'
    ),
  },
  rhea: {
    rest: tw(
      'pointer-events-none block size-4 shrink-0 rounded-[var(--pui-radius-2xl)] bg-white shadow-md ring-black/10 ring-1 transition-[color,box-shadow] duration-200 select-none'
    ),
    hover: tw(
      'pointer-events-none block size-4 shrink-0 rounded-[var(--pui-radius-2xl)] bg-white shadow-md ring-ring/30 ring-4 transition-[color,box-shadow] duration-200 select-none'
    ),
    focus: tw(
      'pointer-events-none block size-4 shrink-0 rounded-[var(--pui-radius-2xl)] bg-white shadow-md ring-ring/30 ring-4 forced-colors-focus-outline transition-[color,box-shadow] duration-200 select-none'
    ),
  },
  'new-york-v4': {
    rest: tw(
      'pointer-events-none block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] select-none'
    ),
    hover: tw(
      'pointer-events-none block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 ring-4 transition-[color,box-shadow] select-none'
    ),
    focus: tw(
      'pointer-events-none block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 ring-4 forced-colors-focus-outline transition-[color,box-shadow] select-none'
    ),
  },
};
