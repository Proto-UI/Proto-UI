import { createControlLabelRef, type InstanceAssociations } from '@proto.ui/core';
import type { LabelRootProps } from '@proto.ui/prototypes-base/label';
import checkboxRoot from './root.proto';
import checkboxIndicator from './indicator.proto';
import labelRoot from '../label/root.proto';
import { shadcnCheckboxComponentPreset } from './preset';

/**
 * Public host-side recommendation, not a Template or another prototype.
 * Indicator replacement remains governed by the existing Checkbox preset.
 * Only new containers/default Label props are frozen; imported atoms and the
 * shared preset are retained by identity and are not deep-frozen or modified.
 * Render control and label as siblings; render the indicator inside control.
 * Content is authored through the host's ordinary children/slots, not a string prop.
 */
export const shadcnCheckboxLabelComposition = Object.freeze({
  parts: Object.freeze({ control: checkboxRoot, indicator: checkboxIndicator, label: labelRoot }),
  structure: Object.freeze({
    siblings: Object.freeze(['control', 'label'] as const),
    indicatorParent: 'control' as const,
  }),
  association: Object.freeze({
    kind: 'controlLabel' as const,
    participants: Object.freeze(['control', 'label'] as const),
  }),
  labelProps: Object.freeze({ naming: true, activation: true } satisfies LabelRootProps),
  defaultPart: shadcnCheckboxComponentPreset,
});

export interface ShadcnCheckboxLabelCompositionInstance {
  readonly recipe: typeof shadcnCheckboxLabelComposition;
  readonly control: Readonly<{ instanceAssociations: InstanceAssociations }>;
  readonly label: Readonly<{
    instanceAssociations: InstanceAssociations;
    props: typeof shadcnCheckboxLabelComposition.labelProps;
  }>;
}

/**
 * Create once per mounted composition, retaining the result across host renders.
 * The adapters own binding, detach/rebind and disposal. This object owns no listeners
 * or checked state; sharing it between separate controls is not supported.
 * Opaque associations must never enter JSON Props, attributes or serialized demos.
 */
export function createShadcnCheckboxLabelComposition(): ShadcnCheckboxLabelCompositionInstance {
  const instanceAssociations: InstanceAssociations = Object.freeze({
    controlLabel: createControlLabelRef(),
  });
  return Object.freeze({
    recipe: shadcnCheckboxLabelComposition,
    control: Object.freeze({ instanceAssociations }),
    label: Object.freeze({
      instanceAssociations,
      props: shadcnCheckboxLabelComposition.labelProps,
    }),
  });
}
