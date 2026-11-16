import { createControlLabelRef, definePrototype } from '@proto.ui/core';
import type { ProtoReactProps } from '@proto.ui/adapter-react';
import button, { asButton } from '@proto.ui/prototypes-base/button';
import toggle from '@proto.ui/prototypes-base/toggle';
import { toggleGroupItem } from '@proto.ui/prototypes-base/toggle-group';
import { useTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';

const instanceAssociations = { controlLabel: createControlLabelRef() };
const buttonProps: ProtoReactProps<typeof button> = { instanceAssociations, onClick: () => {} };
const toggleProps: ProtoReactProps<typeof toggle> = { instanceAssociations, active: false };
const itemProps: ProtoReactProps<typeof toggleGroupItem> = { instanceAssociations, value: 'bold' };
// @ts-expect-error The React facade does not declare generic native aria-label forwarding.
const nativeName: ProtoReactProps<typeof button> = { 'aria-label': 'Save' };
const portableAssociation: import('@proto.ui/prototypes-base/button').ButtonProps = {
  // @ts-expect-error Association identity is not a portable prototype Prop.
  instanceAssociations,
};
const composed = definePrototype({
  name: 'type-test-tooltip-button',
  setup() {
    asButton();
    useTooltipTrigger();
    // @ts-expect-error The bounded participation hook has no configuration options.
    useTooltipTrigger({ asChild: true });
  },
});
void [buttonProps, toggleProps, itemProps, nativeName, portableAssociation, composed];
