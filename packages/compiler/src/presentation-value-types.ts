import type { ValueType } from './ir';

const affine: ValueType = {
  kind: 'record',
  fields: [
    { name: 'px', type: 'number' },
    { name: 'rootText', type: 'number' },
    { name: 'ownBox', type: 'number' },
  ],
};
const translation: ValueType = { kind: 'value-array', element: affine, readonly: true };
const dynamicTranslation: ValueType = {
  kind: 'object',
  fields: [
    { name: 'source', type: 'state:string' },
    { name: 'cases', type: { kind: 'object', fields: [], index: translation } },
  ],
};
const frame: ValueType = {
  kind: 'object',
  fields: [
    { name: 'opacity', type: 'number', optional: true },
    {
      name: 'translate',
      type: { kind: 'value-union', members: [translation, dynamicTranslation] },
      optional: true,
    },
  ],
};

/** Structure checked here; the canonical host snapshot validates tuple length and finite coefficients. */
export const PRESENCE_PRESENTATION_DECLARATION: ValueType = {
  kind: 'object',
  fields: [
    { name: 'owner', type: 'presentation-owner-ref' },
    { name: 'closed', type: frame },
    { name: 'entered', type: frame },
    { name: 'easing', type: { kind: 'value-array', element: 'number', readonly: true } },
  ],
};
